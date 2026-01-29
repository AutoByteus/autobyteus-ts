import type { Task } from '../../task_management/task.js';

export class ActivationPolicy {
  private team_id: string;
  _activated_agents: Set<string> = new Set();

  constructor(team_id: string) {
    this.team_id = team_id;
    console.debug(`ActivationPolicy initialized for team '${this.team_id}'.`);
  }

  reset(): void {
    console.info(
      `Team '${this.team_id}': ActivationPolicy state has been reset. All agents are now considered inactive.`
    );
    this._activated_agents.clear();
  }

  determine_activations(runnable_tasks: Task[]): string[] {
    if (!runnable_tasks || runnable_tasks.length === 0) {
      return [];
    }

    const agents_with_runnable_tasks = new Set(
      runnable_tasks.map((task) => (task as any).assignee_name).filter(Boolean)
    );

    const new_agents_to_activate = Array.from(agents_with_runnable_tasks).filter(
      (agent) => !this._activated_agents.has(agent)
    );

    if (new_agents_to_activate.length) {
      for (const agent of new_agents_to_activate) {
        this._activated_agents.add(agent);
      }
      console.info(
        `Team '${this.team_id}': Policy determined ${new_agents_to_activate.length} new agent(s) to activate: ` +
        `${new_agents_to_activate}. Total activated agents is now ${this._activated_agents.size}.`
      );
    }

    return new_agents_to_activate;
  }
}
