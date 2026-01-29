import { AgentEventBridge } from './agent_event_bridge.js';
import { TeamEventBridge } from './team_event_bridge.js';
import type { AgentTeamExternalEventNotifier } from './agent_team_event_notifier.js';

type WorkerLike = { get_worker_loop: () => unknown };

type AgentLike = Record<string, any>;

type TeamLike = Record<string, any>;

export class AgentEventMultiplexer {
  private team_id: string;
  private notifier: AgentTeamExternalEventNotifier;
  private worker: WorkerLike;
  private loop: unknown | null = null;
  private agent_bridges: Map<string, AgentEventBridge> = new Map();
  private team_bridges: Map<string, TeamEventBridge> = new Map();

  constructor(team_id: string, notifier: AgentTeamExternalEventNotifier, worker_ref: WorkerLike) {
    this.team_id = team_id;
    this.notifier = notifier;
    this.worker = worker_ref;
    console.info(`AgentEventMultiplexer initialized for team '${this.team_id}'.`);
  }

  private get_loop(): unknown {
    if (!this.loop) {
      this.loop = this.worker.get_worker_loop();
      if (!this.loop) {
        throw new Error(`Agent team worker loop for team '${this.team_id}' is not available or not running.`);
      }
    }
    return this.loop;
  }

  start_bridging_agent_events(agent: AgentLike, agent_name: string): void {
    if (this.agent_bridges.has(agent_name)) {
      console.warn(`Event bridge for agent '${agent_name}' already exists. Skipping creation.`);
      return;
    }

    const bridge = new AgentEventBridge(agent, agent_name, this.notifier, this.get_loop());
    this.agent_bridges.set(agent_name, bridge);
    console.info(`AgentEventMultiplexer started agent event bridge for '${agent_name}'.`);
  }

  start_bridging_team_events(sub_team: TeamLike, node_name: string): void {
    if (this.team_bridges.has(node_name)) {
      console.warn(`Event bridge for sub-team '${node_name}' already exists. Skipping creation.`);
      return;
    }

    const bridge = new TeamEventBridge(sub_team, node_name, this.notifier, this.get_loop());
    this.team_bridges.set(node_name, bridge);
    console.info(`AgentEventMultiplexer started team event bridge for '${node_name}'.`);
  }

  async shutdown(): Promise<void> {
    console.info(`AgentEventMultiplexer for '${this.team_id}' shutting down all event bridges.`);
    const agent_tasks = Array.from(this.agent_bridges.values()).map((bridge) => bridge.cancel());
    const team_tasks = Array.from(this.team_bridges.values()).map((bridge) => bridge.cancel());

    await Promise.allSettled([...agent_tasks, ...team_tasks]);

    this.agent_bridges.clear();
    this.team_bridges.clear();
    console.info(`All event bridges for team '${this.team_id}' have been shut down by multiplexer.`);
  }
}
