import { BaseLLM } from '../base.js';
import { LLMUserMessage } from '../user-message.js';
import { Message } from '../utils/messages.js';
import { CompleteResponse } from '../utils/response-types.js';

export abstract class LLMExtension {
  protected llm: BaseLLM;

  constructor(llm: BaseLLM) {
    this.llm = llm;
  }

  abstract beforeInvoke(userMessage: LLMUserMessage, kwargs?: Record<string, unknown>): Promise<void>;

  abstract afterInvoke(
    userMessage: LLMUserMessage,
    response: CompleteResponse | null,
    kwargs?: Record<string, unknown>
  ): Promise<void>;

  onUserMessageAdded(message: Message): void {
    // Optional hook
  }

  onAssistantMessageAdded(message: Message): void {
    // Optional hook
  }

  async cleanup(): Promise<void> {
    // Optional hook
  }
}
