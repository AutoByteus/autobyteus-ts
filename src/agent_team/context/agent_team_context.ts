import { AgentTeamStatus } from '../status/agent_team_status.js';
import type { AgentTeamConfig } from './agent_team_config.js';
import type { AgentTeamRuntimeState } from './agent_team_runtime_state.js';
import type { TeamNodeConfig } from './team_node_config.js';
import type { Agent } from '../../agent/agent.js';
import type { AgentTeamStatusManager } from '../status/agent_team_status_manager.js';
import type { AgentTeamStatusDeriver } from '../status/status_deriver.js';
import type { AgentTeamEventStore } from '../events/event_store.js';
import type { TeamManager } from './team_manager.js';
import type { AgentEventMultiplexer } from '../streaming/agent_event_multiplexer.js';

export class AgentTeamContext {
  team_id: string;
  config: AgentTeamConfig;
  state: AgentTeamRuntimeState;
  private node_config_map: Map<string, TeamNodeConfig> | null = null;

  constructor(team_id: string, config: AgentTeamConfig, state: AgentTeamRuntimeState) {
    if (!team_id || typeof team_id !== 'string') {
      throw new Error("AgentTeamContext requires a non-empty string 'team_id'.");
    }

    this.team_id = team_id;
    this.config = config;
    this.state = state;

    console.info(`AgentTeamContext composed for team_id '${this.team_id}'.`);
  }

  get_node_config_by_name(name: string): TeamNodeConfig | undefined {
    if (!this.node_config_map) {
      this.node_config_map = new Map(this.config.nodes.map((node) => [node.name, node]));
    }
    return this.node_config_map.get(name);
  }

  get agents(): Agent[] {
    const manager = this.state.team_manager as TeamManager;
    if (manager && typeof manager.get_all_agents === 'function') {
      return manager.get_all_agents();
    }
    return [];
  }

  get coordinator_agent(): Agent | null {
    const manager = this.state.team_manager as TeamManager;
    if (manager) {
      return (manager as any).coordinator_agent ?? null;
    }
    return null;
  }

  get status_manager(): AgentTeamStatusManager | null {
    return this.state.status_manager_ref ?? null;
  }

  get current_status(): AgentTeamStatus {
    return this.state.current_status;
  }

  set current_status(value: AgentTeamStatus) {
    if (!Object.values(AgentTeamStatus).includes(value)) {
      throw new TypeError(`current_status must be an AgentTeamStatus value. Got ${String(value)}`);
    }
    this.state.current_status = value;
  }

  get event_store(): AgentTeamEventStore | null {
    return this.state.event_store ?? null;
  }

  get status_deriver(): AgentTeamStatusDeriver | null {
    return this.state.status_deriver ?? null;
  }

  get team_manager(): TeamManager {
    return (this.state.team_manager as TeamManager) ?? null;
  }

  get multiplexer(): AgentEventMultiplexer | null {
    return this.state.multiplexer_ref ?? null;
  }
}
