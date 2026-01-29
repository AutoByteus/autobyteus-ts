import type { AgentInputUserMessage } from '../message/agent_input_user_message.js';
import type { AgentContext } from '../context/agent_context.js';
import type { UserMessageReceivedEvent } from '../events/agent_events.js';

export class BaseAgentUserInputMessageProcessor {
  constructor() {
    if (new.target === BaseAgentUserInputMessageProcessor) {
      throw new Error('BaseAgentUserInputMessageProcessor cannot be instantiated directly.');
    }
    if (this.process === BaseAgentUserInputMessageProcessor.prototype.process) {
      throw new Error("Subclasses must implement the 'process' method.");
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
    const ctor = this.constructor as typeof BaseAgentUserInputMessageProcessor;
    return ctor.get_name();
  }

  get_order(): number {
    const ctor = this.constructor as typeof BaseAgentUserInputMessageProcessor;
    return ctor.get_order();
  }

  is_mandatory(): boolean {
    const ctor = this.constructor as typeof BaseAgentUserInputMessageProcessor;
    return ctor.is_mandatory();
  }

  async process(
    _message: AgentInputUserMessage,
    _context: AgentContext,
    _triggering_event: UserMessageReceivedEvent
  ): Promise<AgentInputUserMessage> {
    throw new Error("Subclasses must implement the 'process' method.");
  }

  toString(): string {
    return `<${this.constructor.name}>`;
  }
}
