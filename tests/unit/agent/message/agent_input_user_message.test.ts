import { describe, it, expect } from 'vitest';
import { AgentInputUserMessage } from '../../../../src/agent/message/agent_input_user_message.js';
import { SenderType } from '../../../../src/agent/sender_type.js';
import { ContextFile } from '../../../../src/agent/message/context_file.js';
import { ContextFileType } from '../../../../src/agent/message/context_file_type.js';

describe('AgentInputUserMessage', () => {
  it('defaults to USER sender type', () => {
    const message = new AgentInputUserMessage('hello');
    expect(message.sender_type).toBe(SenderType.USER);
    expect(message.metadata).toEqual({});
  });

  it('serializes and deserializes with context files', () => {
    const contextFile = new ContextFile('notes.txt', ContextFileType.TEXT);
    const message = new AgentInputUserMessage('hello', SenderType.USER, [contextFile], { key: 'value' });

    const data = message.toDict();
    const restored = AgentInputUserMessage.fromDict(data);

    expect(restored.content).toBe('hello');
    expect(restored.sender_type).toBe(SenderType.USER);
    expect(restored.context_files?.length).toBe(1);
    expect(restored.context_files?.[0].uri).toBe('notes.txt');
    expect(restored.metadata).toEqual({ key: 'value' });
  });

  it('defaults to USER for invalid sender_type in fromDict', () => {
    const restored = AgentInputUserMessage.fromDict({
      content: 'hello',
      sender_type: 'invalid',
      context_files: null,
      metadata: {}
    });
    expect(restored.sender_type).toBe(SenderType.USER);
  });

  it('throws when content is not a string', () => {
    expect(() => new AgentInputUserMessage(123 as any)).toThrow();
  });
});
