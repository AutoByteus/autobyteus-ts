import { describe, it, expect } from 'vitest';
import { TokenUsageTrackingExtension } from '../../../../src/llm/extensions/token_usage_tracking_extension.js';
import { BaseLLM } from '../../../../src/llm/base.js';
import { BaseTokenCounter } from '../../../../src/llm/token_counter/base_token_counter.js';
import { Message, MessageRole } from '../../../../src/llm/utils/messages.js';
import { CompleteResponse } from '../../../../src/llm/utils/response_types.js';
import { LLMUserMessage } from '../../../../src/llm/user_message.js';
import { LLMModel } from '../../../../src/llm/models.js';
import { LLMProvider } from '../../../../src/llm/providers.js';
import { LLMConfig, TokenPricingConfig } from '../../../../src/llm/utils/llm_config.js';

class MockLLM extends BaseLLM {
  async _sendUserMessageToLLM(_userMessage: LLMUserMessage): Promise<CompleteResponse> {
    return new CompleteResponse({ content: '' });
  }
  async *_streamUserMessageToLLM(): AsyncGenerator<any, void, unknown> {
    yield;
  }
}

class MockCounter extends BaseTokenCounter {
  countInputTokens(): number { return 10; }
  countOutputTokens(): number { return 5; }
}

const mockFactory = {
  getTokenCounter: () => new MockCounter('test')
};

describe('TokenUsageTrackingExtension (integration)', () => {
  it('updates latest usage after invoke with response usage', async () => {
    const model = new LLMModel({
      name: 'test',
      value: 'test',
      canonical_name: 'test',
      provider: LLMProvider.OPENAI,
      default_config: new LLMConfig({
        pricing_config: new TokenPricingConfig({ input_token_pricing: 10.0, output_token_pricing: 20.0 })
      })
    });
    const llm = new MockLLM(model, model.default_config);
    const ext = new TokenUsageTrackingExtension(llm, mockFactory);

    llm.messages.push(new Message(MessageRole.USER, 'hi'));
    ext.onUserMessageAdded(llm.messages[0]);
    ext.onAssistantMessageAdded(new Message(MessageRole.ASSISTANT, 'ok'));

    const response = new CompleteResponse({
      content: '',
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15
      }
    });

    await ext.afterInvoke(new LLMUserMessage({ content: 'hello' }), response);
    const latest = ext.getLatestUsage();
    expect(latest?.total_tokens).toBe(15);
  });
});
