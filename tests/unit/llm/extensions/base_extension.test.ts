import { describe, it, expect } from 'vitest';
import { LLMExtension } from '../../../../src/llm/extensions/base_extension.js';
import { BaseLLM } from '../../../../src/llm/base.js';
import { CompleteResponse } from '../../../../src/llm/utils/response_types.js';
import { LLMUserMessage } from '../../../../src/llm/user_message.js';
import { Message } from '../../../../src/llm/utils/messages.js';

class DummyLLM extends BaseLLM {
  async _sendUserMessageToLLM(_userMessage: LLMUserMessage): Promise<CompleteResponse> {
    return new CompleteResponse({ content: '' });
  }
  async *_streamUserMessageToLLM(): AsyncGenerator<any, void, unknown> {
    yield;
  }
}

class DummyExtension extends LLMExtension {
  async beforeInvoke(): Promise<void> {}
  async afterInvoke(): Promise<void> {}
}

describe('LLMExtension', () => {
  it('supports optional hooks without throwing', () => {
    const llm = new DummyLLM({} as any, {} as any);
    const ext = new DummyExtension(llm);
    ext.onUserMessageAdded(new Message('user' as any, 'hi'));
    ext.onAssistantMessageAdded(new Message('assistant' as any, 'ok'));
    expect(ext).toBeInstanceOf(LLMExtension);
  });
});
