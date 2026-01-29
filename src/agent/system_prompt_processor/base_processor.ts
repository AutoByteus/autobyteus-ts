import type { BaseTool } from '../../tools/base_tool.js';
import type { AgentContextLike } from '../context/agent_context_like.js';

export class BaseSystemPromptProcessor {
  constructor() {
    if (new.target === BaseSystemPromptProcessor) {
      throw new Error("BaseSystemPromptProcessor cannot be instantiated directly.");
    }
    if (this.process === BaseSystemPromptProcessor.prototype.process) {
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
    const ctor = this.constructor as typeof BaseSystemPromptProcessor;
    return ctor.get_name();
  }

  get_order(): number {
    const ctor = this.constructor as typeof BaseSystemPromptProcessor;
    return ctor.get_order();
  }

  is_mandatory(): boolean {
    const ctor = this.constructor as typeof BaseSystemPromptProcessor;
    return ctor.is_mandatory();
  }

  process(_system_prompt: string, _tool_instances: Record<string, BaseTool>, _agent_id: string, _context: AgentContextLike): string {
    throw new Error("Subclasses must implement the 'process' method.");
  }

  toString(): string {
    return `<${this.constructor.name}>`;
  }
}
