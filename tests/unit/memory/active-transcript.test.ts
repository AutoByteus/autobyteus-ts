import { describe, it, expect } from 'vitest';
import { ActiveTranscript } from '../../../src/memory/active-transcript.js';
import { Message, MessageRole, ToolCallSpec } from '../../../src/llm/utils/messages.js';

describe('ActiveTranscript', () => {
  it('appends messages and tool payloads', () => {
    const transcript = new ActiveTranscript();
    transcript.appendUser('hello');
    transcript.appendAssistant('hi', 'reason');
    const toolCalls: ToolCallSpec[] = [
      { id: 'call-1', name: 'tool', arguments: { a: 1 } }
    ];
    transcript.appendToolCalls(toolCalls);
    transcript.appendToolResult('call-1', 'tool', { ok: true });

    const messages = transcript.buildMessages();
    expect(messages).toHaveLength(4);
    expect(messages[0].role).toBe(MessageRole.USER);
    expect(messages[1].role).toBe(MessageRole.ASSISTANT);
    expect(messages[2].role).toBe(MessageRole.ASSISTANT);
    expect(messages[3].role).toBe(MessageRole.TOOL);
  });

  it('resets with snapshot and increments epoch', () => {
    const transcript = new ActiveTranscript([new Message(MessageRole.SYSTEM, { content: 'sys' })]);
    const startingEpoch = transcript.epochId;
    transcript.reset([new Message(MessageRole.SYSTEM, { content: 'snapshot' })]);
    expect(transcript.epochId).toBe(startingEpoch + 1);
    const messages = transcript.buildMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('snapshot');
  });
});
