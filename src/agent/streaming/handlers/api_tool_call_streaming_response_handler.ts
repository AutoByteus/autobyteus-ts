import { StreamingResponseHandler } from './streaming_response_handler.js';
import { SegmentEvent, SegmentEventType, SegmentType } from '../segments/segment_events.js';
import { ToolInvocationAdapter } from '../adapters/invocation_adapter.js';
import { WriteFileContentStreamer, PatchFileContentStreamer } from '../api_tool_call/file_content_streamer.js';
import { ToolInvocation } from '../../tool_invocation.js';
import { ChunkResponse } from '../../../llm/utils/response_types.js';
import type { ToolCallDelta } from '../../../llm/utils/tool_call_delta.js';
import { randomUUID } from 'node:crypto';

type ToolCallState = {
  segment_id: string;
  name: string;
  accumulated_args: string;
  segment_type: SegmentType;
  streamer?: WriteFileContentStreamer | PatchFileContentStreamer | null;
  path?: string;
  segment_started: boolean;
  pending_content: string;
};

export class ApiToolCallStreamingResponseHandler extends StreamingResponseHandler {
  private onSegmentEvent?: (event: SegmentEvent) => void;
  private onToolInvocation?: (invocation: ToolInvocation) => void;
  private segmentIdPrefix: string;
  private adapter: ToolInvocationAdapter;
  private textSegmentId: string | null = null;
  private activeTools: Map<number, ToolCallState> = new Map();
  private allEvents: SegmentEvent[] = [];
  private allInvocations: ToolInvocation[] = [];
  private isFinalized = false;

  constructor(options?: {
    on_segment_event?: (event: SegmentEvent) => void;
    on_tool_invocation?: (invocation: ToolInvocation) => void;
    segment_id_prefix?: string;
  }) {
    super();
    this.onSegmentEvent = options?.on_segment_event;
    this.onToolInvocation = options?.on_tool_invocation;
    this.segmentIdPrefix = options?.segment_id_prefix ?? '';
    this.adapter = new ToolInvocationAdapter();
  }

  private generateId(): string {
    return `${this.segmentIdPrefix}${randomUUID().replace(/-/g, '')}`;
  }

  private resolveSegmentType(toolName: string): { segmentType: SegmentType; streamer?: any } {
    if (toolName === 'write_file') {
      return { segmentType: SegmentType.WRITE_FILE, streamer: new WriteFileContentStreamer() };
    }
    if (toolName === 'patch_file') {
      return { segmentType: SegmentType.PATCH_FILE, streamer: new PatchFileContentStreamer() };
    }
    return { segmentType: SegmentType.TOOL_CALL, streamer: null };
  }

  private emit(event: SegmentEvent): void {
    this.allEvents.push(event);
    if (this.onSegmentEvent) {
      try {
        this.onSegmentEvent(event);
      } catch (error) {
        console.error(`Error in on_segment_event callback: ${error}`);
      }
    }

    const invocation = this.adapter.process_event(event);
    if (invocation) {
      this.allInvocations.push(invocation);
      if (this.onToolInvocation) {
        try {
          this.onToolInvocation(invocation);
        } catch (error) {
          console.error(`Error in on_tool_invocation callback: ${error}`);
        }
      }
    }
  }

  feed(chunk: ChunkResponse): SegmentEvent[] {
    if (this.isFinalized) {
      throw new Error('Handler has been finalized.');
    }

    const events: SegmentEvent[] = [];

    if (chunk.content) {
      if (!this.textSegmentId) {
        this.textSegmentId = this.generateId();
        const startEvent = SegmentEvent.start(this.textSegmentId, SegmentType.TEXT);
        this.emit(startEvent);
        events.push(startEvent);
      }

      const contentEvent = SegmentEvent.content(this.textSegmentId, chunk.content);
      this.emit(contentEvent);
      events.push(contentEvent);
    }

    if (chunk.tool_calls) {
      for (const delta of chunk.tool_calls as ToolCallDelta[]) {
        if (!this.activeTools.has(delta.index)) {
          const segId = delta.call_id ?? this.generateId();
          const toolName = delta.name ?? '';
          const resolved = this.resolveSegmentType(toolName);
          this.activeTools.set(delta.index, {
            segment_id: segId,
            name: toolName,
            accumulated_args: '',
            segment_type: resolved.segmentType,
            streamer: resolved.streamer,
            segment_started: false,
            pending_content: ''
          });

          if (resolved.segmentType === SegmentType.TOOL_CALL) {
            const startEvent = SegmentEvent.start(segId, resolved.segmentType, { tool_name: toolName });
            const state = this.activeTools.get(delta.index);
            if (state) {
              state.segment_started = true;
            }
            this.emit(startEvent);
            events.push(startEvent);
          }
        }

        const state = this.activeTools.get(delta.index)!;

        if (delta.arguments_delta !== undefined && delta.arguments_delta !== null) {
          state.accumulated_args += delta.arguments_delta;

          if (state.segment_type === SegmentType.TOOL_CALL) {
            if (!state.segment_started) {
              const startEvent = SegmentEvent.start(state.segment_id, state.segment_type, { tool_name: state.name });
              state.segment_started = true;
              this.emit(startEvent);
              events.push(startEvent);
            }
            const contentEvent = SegmentEvent.content(state.segment_id, delta.arguments_delta);
            this.emit(contentEvent);
            events.push(contentEvent);
          } else if (state.streamer) {
            const update = state.streamer.feed(delta.arguments_delta);
            if (update.path && !state.path) {
              state.path = update.path;
            }

            if (!state.segment_started && state.path) {
              const startEvent = SegmentEvent.start(state.segment_id, state.segment_type, {
                tool_name: state.name,
                path: state.path
              });
              state.segment_started = true;
              this.emit(startEvent);
              events.push(startEvent);
              if (state.pending_content) {
                const pendingEvent = SegmentEvent.content(state.segment_id, state.pending_content);
                this.emit(pendingEvent);
                events.push(pendingEvent);
                state.pending_content = '';
              }
            }

            if (update.content_delta) {
              if (state.segment_started) {
                const contentEvent = SegmentEvent.content(state.segment_id, update.content_delta);
                this.emit(contentEvent);
                events.push(contentEvent);
              } else {
                state.pending_content += update.content_delta;
              }
            }
          }
        }

        if (delta.name && !state.name) {
          state.name = delta.name;
        }
      }
    }

    return events;
  }

  finalize(): SegmentEvent[] {
    if (this.isFinalized) {
      return [];
    }
    this.isFinalized = true;
    const events: SegmentEvent[] = [];

    if (this.textSegmentId) {
      const endEvent = new SegmentEvent({
        event_type: SegmentEventType.END,
        segment_id: this.textSegmentId
      });
      this.emit(endEvent);
      events.push(endEvent);
    }

    for (const state of this.activeTools.values()) {
      if (state.segment_type === SegmentType.WRITE_FILE || state.segment_type === SegmentType.PATCH_FILE) {
        if (!state.segment_started) {
          const metadata: Record<string, any> = { tool_name: state.name };
          if (state.path) {
            metadata.path = state.path;
          }
          const startEvent = SegmentEvent.start(state.segment_id, state.segment_type, metadata);
          state.segment_started = true;
          this.emit(startEvent);
          events.push(startEvent);
          if (state.pending_content) {
            const pendingEvent = SegmentEvent.content(state.segment_id, state.pending_content);
            this.emit(pendingEvent);
            events.push(pendingEvent);
            state.pending_content = '';
          }
        }
      }

      let endEvent: SegmentEvent;
      if (state.segment_type === SegmentType.TOOL_CALL) {
        let parsedArgs: Record<string, any> = {};
        if (state.accumulated_args) {
          try {
            parsedArgs = JSON.parse(state.accumulated_args);
          } catch (error) {
            console.error(`Failed to parse tool arguments for ${state.name}: ${error}`);
            parsedArgs = {};
          }
        }
        endEvent = new SegmentEvent({
          event_type: SegmentEventType.END,
          segment_id: state.segment_id,
          payload: {
            metadata: {
              tool_name: state.name,
              arguments: parsedArgs
            }
          }
        });
      } else {
        const metadata: Record<string, any> = {};
        if (state.path) {
          metadata.path = state.path;
        }
        endEvent = new SegmentEvent({
          event_type: SegmentEventType.END,
          segment_id: state.segment_id,
          payload: Object.keys(metadata).length ? { metadata } : {}
        });
      }
      this.emit(endEvent);
      events.push(endEvent);
    }

    if (this.allInvocations.length) {
      console.info(
        `ApiToolCallStreamingResponseHandler finalized ${this.allInvocations.length} tool invocations.`
      );
    }

    return events;
  }

  get_all_events(): SegmentEvent[] {
    return [...this.allEvents];
  }

  get_all_invocations(): ToolInvocation[] {
    return [...this.allInvocations];
  }

  reset(): void {
    this.textSegmentId = null;
    this.activeTools.clear();
    this.allEvents = [];
    this.allInvocations = [];
    this.adapter = new ToolInvocationAdapter();
    this.isFinalized = false;
  }
}
