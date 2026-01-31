import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TokenUsageTrackingExtension } from '../../../../src/llm/extensions/token-usage-tracking-extension.js';
import { BaseLLM } from '../../../../src/llm/base.js';
import { BaseTokenCounter } from '../../../../src/llm/token-counter/base-token-counter.js';
import { TokenPricingConfig, LLMConfig } from '../../../../src/llm/utils/llm-config.js';
import { Message, MessageRole } from '../../../../src/llm/utils/messages.js';

import { CompleteResponse, ChunkResponse } from '../../../../src/llm/utils/response-types.js';
import { LLMUserMessage } from '../../../../src/llm/user-message.js';
import { LLMModel } from '../../../../src/llm/models.js';
import { LLMProvider } from '../../../../src/llm/providers.js';

// Mocks
class MockLLM extends BaseLLM {
  async _sendUserMessageToLLM(userMessage: LLMUserMessage, kwargs: Record<string, unknown>): Promise<CompleteResponse> {
    return new CompleteResponse({ content: '' });
  }
  async *_streamUserMessageToLLM(userMessage: LLMUserMessage, kwargs: Record<string, unknown>): AsyncGenerator<ChunkResponse, void, unknown> {
    yield new ChunkResponse({ content: '' });
  }
  // No custom constructor needed if we pass correct args to super, or we override it.
  // BaseLLM constructor takes (model, config).
  // We can create a valid dummy model.
}

class MockCounter extends BaseTokenCounter {
  countInputTokens(msgs: Message[]) { return 10; }
  countOutputTokens(msg: Message) { return 5; }
}

const mockFactory = {
  getTokenCounter: () => new MockCounter('test')
};

describe('TokenUsageTrackingExtension', () => {
  let llm: MockLLM;
  let ext: TokenUsageTrackingExtension;

  beforeEach(() => {
    // Create valid minimal model
    const model = new LLMModel({
      name: 'test',
      value: 'test',
      canonicalName: 'test',
      provider: LLMProvider.OPENAI,
      defaultConfig: new LLMConfig({
        pricingConfig: new TokenPricingConfig({
          inputTokenPricing: 10.0,
          outputTokenPricing: 20.0
        })
      })
    });
    llm = new MockLLM(model, model.defaultConfig);
    ext = new TokenUsageTrackingExtension(llm, mockFactory);
  });

  it('should enable checking', () => {
    expect(ext.isEnabled).toBe(true);
  });

  it('should track input messages', () => {
    llm.messages.push(new Message(MessageRole.USER, 'test'));
    ext.onUserMessageAdded(llm.messages[0]);
    
    // internal tracker should have updated.
    // Since we don't expose tracker, we check results via public methods if available or side effects?
    // The extension exposes getLatestUsage() after afterInvoke usually, 
    // but the tracker updates immediately on calculation.
    
    // Actually, TokenUsageTracker.calculateInputMessages pushes to history.
    // But TokenUsageTrackingExtension.latestUsage is updated in `after_invoke` via `self._latest_usage = latest_usage`.
    // Wait, python code: 
    // on_user_message_added -> usage_tracker.calculate_input_messages
    // TokenUsageTracker.calculate_input_messages sets `self.current_usage`.
    // It is ONLY when `after_invoke` is called that `_latest_usage` is set from tracker?
    // No, Python `latest_token_usage` property returns `self._latest_usage`.
    // In `after_invoke`, `self._latest_usage = latest_usage`.
    // So if I only call onUserMessageAdded, `latestUsage` remains null on the extension itself?
    // Let's check python:
    // `self._latest_usage` is initialized to None.
    // It is assigned in `after_invoke`.
    // So `on_user_message_added` purely updates the internal tracker state (starts a "session").
    
    // We can verify cost accumulation maybe?
    // `getTotalCost` calls `tracker.get_total_cost()`.
    
    expect(ext.getTotalCost()).toBeCloseTo(0.0001); // 10 tokens * $10/1M
  });

  it('should track output messages', () => {
    llm.messages.push(new Message(MessageRole.USER, 'test'));
    ext.onUserMessageAdded(llm.messages[0]);
    
    const outMsg = new Message(MessageRole.ASSISTANT, 'resp');
    ext.onAssistantMessageAdded(outMsg);
    
    // 10 input + 5 output = 15 total tokens.
    // 15 * 10 / 1M = 0.00015
    expect(ext.getTotalCost()).toBeCloseTo(0.00015);
  });
});
