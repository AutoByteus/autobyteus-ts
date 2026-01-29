import type { AgentContext } from '../context/agent_context.js';
import type { ToolResultEvent } from '../events/agent_events.js';

export class BaseToolExecutionResultProcessor {
  constructor() {
    if (new.target === BaseToolExecutionResultProcessor) {
      throw new Error('BaseToolExecutionResultProcessor cannot be instantiated directly.');
    }
    if (this.process === BaseToolExecutionResultProcessor.prototype.process) {
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
    const ctor = this.constructor as typeof BaseToolExecutionResultProcessor;
    return ctor.get_name();
  }

  get_order(): number {
    const ctor = this.constructor as typeof BaseToolExecutionResultProcessor;
    return ctor.get_order();
  }

  is_mandatory(): boolean {
    const ctor = this.constructor as typeof BaseToolExecutionResultProcessor;
    return ctor.is_mandatory();
  }

  async process(
    _event: ToolResultEvent,
    _context: AgentContext
  ): Promise<ToolResultEvent> {
    throw new Error("Subclasses must implement the 'process' method.");
  }

  toString(): string {
    return `<${this.constructor.name}>`;
  }
}
