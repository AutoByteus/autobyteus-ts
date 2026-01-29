import { describe, it, expect } from 'vitest';
import { ExtensionRegistry } from '../../../../src/llm/extensions/extension_registry.js';
import { LLMExtension } from '../../../../src/llm/extensions/base_extension.js';
import { BaseLLM } from '../../../../src/llm/base.js';
import { CompleteResponse } from '../../../../src/llm/utils/response_types.js';
import { LLMUserMessage } from '../../../../src/llm/user_message.js';

class DummyLLM extends BaseLLM {
  async _sendUserMessageToLLM(_userMessage: LLMUserMessage): Promise<CompleteResponse> {
    return new CompleteResponse({ content: '' });
  }
  async *_streamUserMessageToLLM(): AsyncGenerator<any, void, unknown> {
    yield;
  }
}

class ExtA extends LLMExtension {
  async beforeInvoke(): Promise<void> {}
  async afterInvoke(): Promise<void> {}
}

class ExtB extends LLMExtension {
  async beforeInvoke(): Promise<void> {}
  async afterInvoke(): Promise<void> {}
}

describe('ExtensionRegistry (integration)', () => {
  it('stores multiple extension classes', () => {
    const registry = new ExtensionRegistry();
    const llm = new DummyLLM({} as any, {} as any);
    registry.register(new ExtA(llm));
    registry.register(new ExtB(llm));
    const all = registry.getAll();
    expect(all).toHaveLength(2);
  });
});
