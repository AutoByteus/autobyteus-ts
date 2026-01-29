import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseLLM } from '../../../src/llm/base.js';
import { LLMModel } from '../../../src/llm/models.js';
import { LLMConfig } from '../../../src/llm/utils/llm_config.js';
import { LLMUserMessage } from '../../../src/llm/user_message.js';
import { CompleteResponse, ChunkResponse } from '../../../src/llm/utils/response_types.js';
import { MessageRole } from '../../../src/llm/utils/messages.js';
import { LLMProvider } from '../../../src/llm/providers.js';

class ConcreteLLM extends BaseLLM {
  async _sendUserMessageToLLM(userMessage: LLMUserMessage, kwargs: Record<string, any>): Promise<CompleteResponse> {
    // Mock response
    return new CompleteResponse({ content: 'Mock response' });
  }

  async *_streamUserMessageToLLM(userMessage: LLMUserMessage, kwargs: Record<string, any>): AsyncGenerator<ChunkResponse, void, unknown> {
    yield new ChunkResponse({ content: 'Mock' });
    yield new ChunkResponse({ content: ' Stream', is_complete: true });
  }
}

describe('BaseLLM', () => {
  let model: LLMModel;
  let config: LLMConfig;
  let llm: ConcreteLLM;

  beforeEach(() => {
    config = new LLMConfig();
    model = new LLMModel({ 
      name: 'test', 
      value: 'test', 
      canonical_name: 'test',
      provider: LLMProvider.OPENAI 
    });
    llm = new ConcreteLLM(model, config);
  });

  it('should initialize with system message', () => {
    expect(llm.messages).toHaveLength(1);
    expect(llm.messages[0].role).toBe(MessageRole.SYSTEM);
    expect(llm.messages[0].content).toContain("helpful assistant");
  });

  it('should add user message', () => {
    llm.addUserMessage(new LLMUserMessage({ content: 'Hi' }));
    expect(llm.messages).toHaveLength(2);
    expect(llm.messages[1].role).toBe(MessageRole.USER);
    expect(llm.messages[1].content).toBe('Hi');
  });

  it('should send user message and trigger hooks', async () => {
    const spy = vi.spyOn(llm as any, 'executeBeforeHooks');
    const resp = await llm.sendUserMessage(new LLMUserMessage({ content: 'Hi' }));
    expect(resp.content).toBe('Mock response');
    expect(spy).toHaveBeenCalled();
  });

  it('should configure system prompt', () => {
    llm.configureSystemPrompt('New prompt');
    expect(llm.messages[0].content).toBe('New prompt');
    
    // Add another, ensure it replaces first
    llm.configureSystemPrompt('New prompt 2');
    expect(llm.messages[0].content).toBe('New prompt 2');
    expect(llm.messages).toHaveLength(1);
  });
});
