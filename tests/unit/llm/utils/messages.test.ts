import { describe, it, expect } from 'vitest';
import { Message, MessageRole } from '../../../../src/llm/utils/messages.js';

describe('Message', () => {
  it('should initialize with string content', () => {
    const msg = new Message(MessageRole.USER, 'Hello');
    expect(msg.role).toBe(MessageRole.USER);
    expect(msg.content).toBe('Hello');
    expect(msg.image_urls).toEqual([]);
  });

  it('should initialize with options', () => {
    const msg = new Message(MessageRole.ASSISTANT, {
      content: 'Hi',
      reasoning_content: 'Thinking...',
      image_urls: ['img1.png']
    });
    expect(msg.role).toBe(MessageRole.ASSISTANT);
    expect(msg.content).toBe('Hi');
    expect(msg.reasoning_content).toBe('Thinking...');
    expect(msg.image_urls).toEqual(['img1.png']);
  });

  it('should handle partial options', () => {
    const msg = new Message(MessageRole.SYSTEM, { content: 'System prompt' });
    expect(msg.role).toBe(MessageRole.SYSTEM);
    expect(msg.content).toBe('System prompt');
    expect(msg.audio_urls).toEqual([]);
  });

  it('should convert to dict', () => {
    const msg = new Message(MessageRole.USER, 'Test');
    const dict = msg.toDict();
    expect(dict).toMatchObject({
      role: 'user',
      content: 'Test',
      reasoning_content: null,
      image_urls: [],
    });
  });
});
