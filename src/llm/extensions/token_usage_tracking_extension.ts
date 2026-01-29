import { LLMExtension } from './base_extension.js';
import { BaseLLM } from '../base.js';
import { TokenUsageTracker, ModelWithConfig } from '../utils/token_usage_tracker.js';
import { BaseTokenCounter } from '../token_counter/base_token_counter.js';
import { LLMUserMessage } from '../user_message.js';
import { CompleteResponse } from '../utils/response_types.js';
import { Message } from '../utils/messages.js';
import { TokenUsage } from '../utils/token_usage.js';

// We need a factory or mechanism to get the token counter.
// For now, let's assume valid token counter is passed or resolved.
// Since we haven't ported TokenCounterFactory yet, we'll dependency inject it or stub it.
// Python: `self.token_counter = get_token_counter(llm.model, llm)`
// TypeScript: We might need to inject it. 
// For this migration step, I will define a helper or interface to get it.

export interface TokenCounterFactory {
  getTokenCounter(model: any, llm: BaseLLM): BaseTokenCounter | null;
}

export class TokenUsageTrackingExtension extends LLMExtension {
  private tokenCounter: BaseTokenCounter | null = null;
  private usageTracker: TokenUsageTracker | null = null;
  private latestUsage: TokenUsage | null = null;

  constructor(llm: BaseLLM, tokenCounterFactory?: TokenCounterFactory) {
    super(llm);
    
    // In a real app, we'd use the factory here.
    // Since we don't have the factory fully migrated, we'll rely on it being passed or null.
    // If not passed, we disable tracking for now to allow compilation/tests.
    // Or we can expect it to be set up later.
    // Let's assume the LLM model has what we need if we interpret `llm` correctly.
    
    // For this step, I'll simulate the factory check if provided.
    // Accessing llm.model might require casting if BaseLLM is still skeletal.
    
    if (tokenCounterFactory) {
      this.tokenCounter = tokenCounterFactory.getTokenCounter((llm as any).model, llm);
    }

    if (this.tokenCounter) {
      this.usageTracker = new TokenUsageTracker((llm as any).model, this.tokenCounter);
    }
  }

  get isEnabled(): boolean {
    return this.tokenCounter !== null;
  }

  getLatestUsage(): TokenUsage | null {
    return this.latestUsage;
  }

  async beforeInvoke(userMessage: LLMUserMessage, kwargs?: Record<string, any>): Promise<void> {
    // No-op
  }

  async afterInvoke(userMessage: LLMUserMessage, response: CompleteResponse | null, kwargs?: Record<string, any>): Promise<void> {
    if (!this.isEnabled || !this.usageTracker) return;

    const latest = this.usageTracker.getLatestUsage();
    
    if (!latest) {
      console.warn("No token usage record found in after_invoke.");
      return;
    }

    if (response && response.usage) {
      latest.prompt_tokens = response.usage.prompt_tokens;
      latest.completion_tokens = response.usage.completion_tokens;
      // Recalc total
      latest.total_tokens = response.usage.total_tokens;
    }

    // Recalculate costs
    latest.prompt_cost = this.usageTracker.calculateCost(latest.prompt_tokens, true);
    latest.completion_cost = this.usageTracker.calculateCost(latest.completion_tokens, false);
    latest.total_cost = (latest.prompt_cost || 0) + (latest.completion_cost || 0);

    this.latestUsage = latest;
  }

  onUserMessageAdded(message: Message): void {
    if (!this.isEnabled || !this.usageTracker) return;
    // We need access to llm.messages. BaseLLM skeleton needs this property.
    // We'll cast for now.
    const history = (this.llm as any).messages || [];
    this.usageTracker.calculateInputMessages(history);
  }

  onAssistantMessageAdded(message: Message): void {
    if (!this.isEnabled || !this.usageTracker) return;
    this.usageTracker.calculateOutputMessage(message);
  }

  getTotalCost(): number {
    return this.usageTracker?.getTotalCost() || 0.0;
  }

  async cleanup(): Promise<void> {
    this.usageTracker?.clearHistory();
    this.latestUsage = null;
  }
}
