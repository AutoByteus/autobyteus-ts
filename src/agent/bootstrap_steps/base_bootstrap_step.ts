import type { AgentContext } from '../context/agent_context.js';

export abstract class BaseBootstrapStep {
  abstract execute(context: AgentContext): Promise<boolean>;

  toString(): string {
    return `<${this.constructor.name}>`;
  }
}
