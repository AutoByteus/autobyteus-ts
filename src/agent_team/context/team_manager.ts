import { AgentFactory } from '../../agent/factory/agent_factory.js';
import { wait_for_agent_to_be_idle } from '../../agent/utils/wait_for_idle.js';
import { wait_for_team_to_be_idle } from '../utils/wait_for_idle.js';
import { TeamNodeNotFoundException } from '../exceptions.js';
import { Agent } from '../../agent/agent.js';
import { AgentTeam } from '../agent_team.js';
import { AgentTeamConfig } from './agent_team_config.js';
import type { AgentTeamRuntime } from '../runtime/agent_team_runtime.js';
import type { AgentEventMultiplexer } from '../streaming/agent_event_multiplexer.js';
import type { InterAgentMessageRequestEvent, ProcessUserMessageEvent } from '../events/agent_team_events.js';

export type ManagedNode = Agent | AgentTeam;

export class TeamManager {
  team_id: string;
  private _runtime: AgentTeamRuntime;
  private _multiplexer: AgentEventMultiplexer;
  _agent_factory: AgentFactory;
  _nodes_cache: Map<string, ManagedNode> = new Map();
  _agent_id_to_name_map: Map<string, string> = new Map();
  private _coordinator_agent: Agent | null = null;

  constructor(team_id: string, runtime: AgentTeamRuntime, multiplexer: AgentEventMultiplexer) {
    this.team_id = team_id;
    this._runtime = runtime;
    this._multiplexer = multiplexer;
    this._agent_factory = new AgentFactory();
    console.info(`TeamManager created for team '${this.team_id}'.`);
  }

  async dispatch_inter_agent_message_request(event: InterAgentMessageRequestEvent): Promise<void> {
    await this._runtime.submit_event(event);
  }

  async dispatch_user_message_to_agent(event: ProcessUserMessageEvent): Promise<void> {
    await this._runtime.submit_event(event);
  }

  async ensure_node_is_ready(name_or_agent_id: string): Promise<ManagedNode> {
    const unique_name = this._agent_id_to_name_map.get(name_or_agent_id) ?? name_or_agent_id;

    let node_instance = this._nodes_cache.get(unique_name);
    let was_created = false;

    if (!node_instance) {
      console.debug(`Node '${unique_name}' not in cache for team '${this.team_id}'. Attempting lazy creation.`);

      const node_config_wrapper = this._runtime.context.get_node_config_by_name(unique_name);
      if (!node_config_wrapper) {
        throw new TeamNodeNotFoundException(name_or_agent_id, this.team_id);
      }

      if (node_config_wrapper.is_sub_team) {
        const { AgentTeamFactory } = await import('../factory/agent_team_factory.js');
        const node_definition = node_config_wrapper.node_definition;
        if (!(node_definition instanceof AgentTeamConfig)) {
          throw new TypeError(
            `Expected AgentTeamConfig for node '${unique_name}', but found ${
              node_definition?.constructor?.name ?? typeof node_definition
            }`
          );
        }
        console.info(`Lazily creating sub-team node '${unique_name}' in team '${this.team_id}'.`);
        const team_factory = new AgentTeamFactory();
        node_instance = team_factory.create_team(node_definition);
      } else {
        const final_config = this._runtime.context.state.final_agent_configs[unique_name];
        if (!final_config) {
          throw new Error(
            `No pre-prepared agent configuration found for '${unique_name}'. Bootstrap step may have failed or skipped this agent.`
          );
        }

        console.info(`Lazily creating agent node '${unique_name}' using pre-prepared configuration.`);
        node_instance = this._agent_factory.create_agent(final_config);
      }

      this._nodes_cache.set(unique_name, node_instance);
      was_created = true;

      if (node_instance instanceof Agent) {
        this._agent_id_to_name_map.set(node_instance.agent_id, unique_name);
      }
    }

    if (was_created && node_instance) {
      if (node_instance instanceof AgentTeam) {
        this._multiplexer.start_bridging_team_events(node_instance, unique_name);
      } else if (node_instance instanceof Agent) {
        this._multiplexer.start_bridging_agent_events(node_instance, unique_name);
      }
    }

    if (!node_instance.is_running) {
      console.info(`Team '${this.team_id}': Node '${unique_name}' is not running. Starting on-demand.`);
      await this._start_node(node_instance, unique_name);
    }

    return node_instance;
  }

  private async _start_node(node: ManagedNode, name: string): Promise<void> {
    try {
      node.start();
      if (node instanceof AgentTeam) {
        await wait_for_team_to_be_idle(node, 120.0);
      } else {
        await wait_for_agent_to_be_idle(node, 60.0);
      }
    } catch (error) {
      console.error(`Team '${this.team_id}': Failed to start node '${name}' on-demand: ${error}`);
      throw new Error(`Failed to start node '${name}' on-demand.`);
    }
  }

  get_all_agents(): Agent[] {
    return Array.from(this._nodes_cache.values()).filter((node) => node instanceof Agent) as Agent[];
  }

  get_all_sub_teams(): AgentTeam[] {
    return Array.from(this._nodes_cache.values()).filter((node) => node instanceof AgentTeam) as AgentTeam[];
  }

  get coordinator_agent(): Agent | null {
    return this._coordinator_agent;
  }

  async ensure_coordinator_is_ready(coordinator_name: string): Promise<Agent> {
    const node = await this.ensure_node_is_ready(coordinator_name);
    if (!(node instanceof Agent)) {
      throw new TypeError(
        `Coordinator node '${coordinator_name}' resolved to a non-agent type: ${node?.constructor?.name ?? typeof node}`
      );
    }

    this._coordinator_agent = node;
    return node;
  }
}
