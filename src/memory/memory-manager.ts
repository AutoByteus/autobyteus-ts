import { LLMUserMessage } from '../llm/user-message.js';
import { ToolCallSpec } from '../llm/utils/messages.js';
import { CompleteResponse } from '../llm/utils/response-types.js';
import { ToolResultEvent } from '../agent/events/agent-events.js';
import { ToolInvocation } from '../agent/tool-invocation.js';

import { RawTraceItem } from './models/raw-trace-item.js';
import { MemoryType } from './models/memory-types.js';
import { CompactionPolicy } from './policies/compaction-policy.js';
import { Compactor } from './compaction/compactor.js';
import { Retriever } from './retrieval/retriever.js';
import { MemoryStore } from './store/base-store.js';
import { TurnTracker } from './turn-tracker.js';
import { ActiveTranscript } from './active-transcript.js';
import { buildToolInteractions } from './tool-interaction-builder.js';

export class MemoryManager {
  store: MemoryStore;
  turnTracker: TurnTracker;
  compactionPolicy: CompactionPolicy;
  compactor: Compactor | null;
  retriever: Retriever;
  memoryTypes = MemoryType;
  activeTranscript: ActiveTranscript;
  compactionRequired = false;
  private seqByTurn = new Map<string, number>();

  constructor(options: {
    store: MemoryStore;
    turnTracker?: TurnTracker;
    compactionPolicy?: CompactionPolicy;
    compactor?: Compactor | null;
    retriever?: Retriever;
    activeTranscript?: ActiveTranscript;
  }) {
    this.store = options.store;
    this.turnTracker = options.turnTracker ?? new TurnTracker();
    this.compactionPolicy = options.compactionPolicy ?? new CompactionPolicy();
    this.compactor = options.compactor ?? null;
    this.retriever = options.retriever ?? new Retriever(this.store);
    this.activeTranscript = options.activeTranscript ?? new ActiveTranscript();
  }

  startTurn(): string {
    return this.turnTracker.nextTurnId();
  }

  requestCompaction(): void {
    this.compactionRequired = true;
  }

  clearCompactionRequest(): void {
    this.compactionRequired = false;
  }

  private nextSeq(turnId: string): number {
    const current = (this.seqByTurn.get(turnId) ?? 0) + 1;
    this.seqByTurn.set(turnId, current);
    return current;
  }

  ingestUserMessage(llmUserMessage: LLMUserMessage, turnId: string, sourceEvent: string): void {
    const trace = new RawTraceItem({
      id: `rt_${Date.now()}`,
      ts: Date.now() / 1000,
      turnId,
      seq: this.nextSeq(turnId),
      traceType: 'user',
      content: llmUserMessage.content,
      sourceEvent,
      media: {
        images: llmUserMessage.image_urls ?? [],
        audio: llmUserMessage.audio_urls ?? [],
        video: llmUserMessage.video_urls ?? []
      },
      tags: ['processed']
    });
    this.store.add([trace]);
  }

  ingestToolIntent(toolInvocation: ToolInvocation, turnId?: string): void {
    const effectiveTurnId = (toolInvocation as { turnId?: string }).turnId ?? turnId;
    if (!effectiveTurnId) {
      throw new Error('turnId is required to ingest tool intent');
    }

    const trace = new RawTraceItem({
      id: `rt_${Date.now()}`,
      ts: Date.now() / 1000,
      turnId: effectiveTurnId,
      seq: this.nextSeq(effectiveTurnId),
      traceType: 'tool_call',
      content: '',
      sourceEvent: 'PendingToolInvocationEvent',
      toolName: toolInvocation.name,
      toolCallId: toolInvocation.id,
      toolArgs: toolInvocation.arguments
    });

    this.store.add([trace]);
    this.activeTranscript.appendToolCalls([
      { id: toolInvocation.id, name: toolInvocation.name, arguments: toolInvocation.arguments } as ToolCallSpec
    ]);
  }

  ingestToolResult(event: ToolResultEvent, turnId?: string): void {
    const effectiveTurnId = (event as { turnId?: string }).turnId ?? turnId;
    if (!effectiveTurnId) {
      throw new Error('turnId is required to ingest tool result');
    }

    const trace = new RawTraceItem({
      id: `rt_${Date.now()}`,
      ts: Date.now() / 1000,
      turnId: effectiveTurnId,
      seq: this.nextSeq(effectiveTurnId),
      traceType: 'tool_result',
      content: '',
      sourceEvent: 'ToolResultEvent',
      toolName: event.toolName,
      toolCallId: event.toolInvocationId ?? null,
      toolArgs: event.toolArgs ?? null,
      toolResult: event.result,
      toolError: event.error ?? null
    });

    this.store.add([trace]);
    this.activeTranscript.appendToolResult(
      event.toolInvocationId ?? '',
      event.toolName,
      event.result,
      event.error ?? null
    );
  }

  ingestAssistantResponse(response: CompleteResponse, turnId: string, sourceEvent: string): void {
    const trace = new RawTraceItem({
      id: `rt_${Date.now()}`,
      ts: Date.now() / 1000,
      turnId,
      seq: this.nextSeq(turnId),
      traceType: 'assistant',
      content: response.content ?? '',
      sourceEvent,
      tags: ['final']
    });
    this.store.add([trace]);
    if (response.content || response.reasoning) {
      this.activeTranscript.appendAssistant(response.content ?? null, response.reasoning ?? null);
    }
  }

  private getRawTailInternal(tailTurns: number, excludeTurnId?: string | null): RawTraceItem[] {
    const rawItems = this.store.list(MemoryType.RAW_TRACE) as RawTraceItem[];
    if (tailTurns <= 0) {
      return [];
    }

    const orderedTurns: string[] = [];
    const seen = new Set<string>();
    for (const item of rawItems) {
      if (excludeTurnId && item.turnId === excludeTurnId) {
        continue;
      }
      if (!seen.has(item.turnId)) {
        seen.add(item.turnId);
        orderedTurns.push(item.turnId);
      }
    }

    if (!orderedTurns.length) {
      return [];
    }

    const keepTurns = new Set(orderedTurns.slice(-tailTurns));
    const tailItems = rawItems.filter((item) => keepTurns.has(item.turnId));
    const orderIndex = new Map(orderedTurns.map((turnId, idx) => [turnId, idx]));
    tailItems.sort((a, b) => {
      const orderA = orderIndex.get(a.turnId) ?? 0;
      const orderB = orderIndex.get(b.turnId) ?? 0;
      return orderA === orderB ? a.seq - b.seq : orderA - orderB;
    });
    return tailItems;
  }

  getRawTail(tailTurns: number, excludeTurnId?: string | null): RawTraceItem[] {
    return this.getRawTailInternal(tailTurns, excludeTurnId);
  }

  getTranscriptMessages() {
    return this.activeTranscript.buildMessages();
  }

  resetTranscript(snapshotMessages: Iterable<any>): void {
    this.activeTranscript.reset(snapshotMessages);
  }

  getToolInteractions(turnId?: string | null) {
    let rawItems = this.store.list(MemoryType.RAW_TRACE) as RawTraceItem[];
    if (turnId) {
      rawItems = rawItems.filter((item) => item.turnId === turnId);
    }
    return buildToolInteractions(rawItems);
  }
}
