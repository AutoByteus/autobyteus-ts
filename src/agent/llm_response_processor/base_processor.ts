import type { AgentContext } from '../context/agent_context.js';
import type { LLMCompleteResponseReceivedEvent } from '../events/agent_events.js';
import type { CompleteResponse } from '../../llm/utils/response_types.js';

export class BaseLLMResponseProcessor {
  constructor() {
    if (new.target === BaseLLMResponseProcessor) {
      throw new Error('BaseLLMResponseProcessor cannot be instantiated directly.');
    }
    if (this.process_response === BaseLLMResponseProcessor.prototype.process_response) {
      throw new Error("Subclasses must implement the 'process_response' method.");
    }
  }

  static get_name(): string {
    return this.name;
  }

  static get_order(): number {
    return 500;
  }

  static is_mandatory(): boolean {
    return false;
  }

  get_name(): string {
    const ctor = this.constructor as typeof BaseLLMResponseProcessor;
    return ctor.get_name();
  }

  get_order(): number {
    const ctor = this.constructor as typeof BaseLLMResponseProcessor;
    return ctor.get_order();
  }

  is_mandatory(): boolean {
    const ctor = this.constructor as typeof BaseLLMResponseProcessor;
    return ctor.is_mandatory();
  }

  async process_response(
    _response: CompleteResponse,
    _context: AgentContext,
    _triggering_event: LLMCompleteResponseReceivedEvent
  ): Promise<boolean> {
    throw new Error("Subclasses must implement the 'process_response' method.");
  }

  toString(): string {
    return `<${this.constructor.name}>`;
  }
}
