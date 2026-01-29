import type { AgentContext } from '../context/agent_context.js';
import type { ToolInvocation } from '../tool_invocation.js';

export class BaseToolInvocationPreprocessor {
  constructor() {
    if (new.target === BaseToolInvocationPreprocessor) {
      throw new Error('BaseToolInvocationPreprocessor cannot be instantiated directly.');
    }
    if (this.process === BaseToolInvocationPreprocessor.prototype.process) {
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
    const ctor = this.constructor as typeof BaseToolInvocationPreprocessor;
    return ctor.get_name();
  }

  get_order(): number {
    const ctor = this.constructor as typeof BaseToolInvocationPreprocessor;
    return ctor.get_order();
  }

  is_mandatory(): boolean {
    const ctor = this.constructor as typeof BaseToolInvocationPreprocessor;
    return ctor.is_mandatory();
  }

  async process(
    _invocation: ToolInvocation,
    _context: AgentContext
  ): Promise<ToolInvocation> {
    throw new Error("Subclasses must implement the 'process' method.");
  }

  toString(): string {
    return `<${this.constructor.name}>`;
  }
}
