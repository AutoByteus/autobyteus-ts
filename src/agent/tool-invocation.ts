import type { ToolResultEvent } from './events/agent-events.js';

export class ToolInvocation {
  name: string;
  arguments: Record<string, unknown>;
  id: string;

  constructor(name: string, arguments_: Record<string, unknown>, id: string) {
    if (!id) {
      throw new Error('ToolInvocation requires a non-empty id.');
    }
    if (!name) {
      throw new Error('ToolInvocation requires a non-empty name.');
    }
    if (arguments_ === null || arguments_ === undefined) {
      throw new Error('ToolInvocation requires arguments.');
    }

    this.name = name;
    this.arguments = arguments_;
    this.id = id;
  }

  isValid(): boolean {
    return this.name != null && this.arguments != null;
  }

  toString(): string {
    return `ToolInvocation(id='${this.id}', name='${this.name}', arguments=${JSON.stringify(this.arguments)})`;
  }
}

export class ToolInvocationTurn {
  invocations: ToolInvocation[];
  results: ToolResultEvent[];

  constructor(invocations: ToolInvocation[], results: ToolResultEvent[] = []) {
    this.invocations = invocations;
    this.results = results;
  }

  isComplete(): boolean {
    return this.results.length >= this.invocations.length;
  }
}
