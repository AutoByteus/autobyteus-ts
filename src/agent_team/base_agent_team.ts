import type { AgentTeam } from './agent_team.js';

export abstract class BaseAgentTeam {
  name: string;
  protected _wrapped_team: AgentTeam | null;

  constructor(name: string, wrapped_team_instance: AgentTeam | null = null) {
    this.name = name;
    this._wrapped_team = wrapped_team_instance;

    if (this._wrapped_team) {
      console.info(
        `BaseAgentTeam '${this.name}' initialized, wrapping an instance of '${this._wrapped_team.constructor.name}'.`
      );
    } else {
      console.info(
        `BaseAgentTeam '${this.name}' initialized without a pre-wrapped instance. Subclass should handle team setup.`
      );
    }
  }

  get wrapped_team(): AgentTeam | null {
    return this._wrapped_team;
  }

  abstract start(): Promise<void> | void;
  abstract stop(timeout?: number): Promise<void> | void;
  abstract get is_running(): boolean;

  toString(): string {
    let running_status = 'N/A (not implemented by subclass)';
    try {
      running_status = String(this.is_running);
    } catch {
      running_status = 'N/A (not implemented by subclass)';
    }

    const wrappedName = this._wrapped_team ? this._wrapped_team.constructor.name : 'NoneInternal';
    return `<${this.constructor.name} name='${this.name}', wraps='${wrappedName}', is_running=${running_status}>`;
  }
}
