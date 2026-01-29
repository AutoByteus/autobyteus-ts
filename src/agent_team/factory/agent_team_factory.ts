import { randomUUID } from 'node:crypto';
import { Singleton } from '../../utils/singleton.js';
import { AgentTeam } from '../agent_team.js';
import { AgentTeamConfig } from '../context/agent_team_config.js';
import { AgentTeamContext } from '../context/agent_team_context.js';
import { AgentTeamRuntimeState } from '../context/agent_team_runtime_state.js';
import { TeamManager } from '../context/team_manager.js';
import { AgentTeamRuntime } from '../runtime/agent_team_runtime.js';
import { AgentTeamEventHandlerRegistry } from '../handlers/agent_team_event_handler_registry.js';
import { ProcessUserMessageEventHandler } from '../handlers/process_user_message_event_handler.js';
import { LifecycleAgentTeamEventHandler } from '../handlers/lifecycle_agent_team_event_handler.js';
import { InterAgentMessageRequestEventHandler } from '../handlers/inter_agent_message_request_event_handler.js';
import { ToolApprovalTeamEventHandler } from '../handlers/tool_approval_team_event_handler.js';
import { initializeLogging } from '../../utils/logger.js';
import {
  ProcessUserMessageEvent,
  AgentTeamBootstrapStartedEvent,
  AgentTeamReadyEvent,
  AgentTeamIdleEvent,
  AgentTeamShutdownRequestedEvent,
  AgentTeamStoppedEvent,
  AgentTeamErrorEvent,
  InterAgentMessageRequestEvent,
  ToolApprovalTeamEvent
} from '../events/agent_team_events.js';

export class AgentTeamFactory extends Singleton {
  private _active_teams: Map<string, AgentTeam> = new Map();

  constructor() {
    super();
    const existing = (AgentTeamFactory as any).instance as AgentTeamFactory | undefined;
    if (existing) {
      return existing;
    }
    (AgentTeamFactory as any).instance = this;
    initializeLogging();
    console.info('AgentTeamFactory (Singleton) initialized.');
  }

  private _get_default_event_handler_registry(): AgentTeamEventHandlerRegistry {
    const registry = new AgentTeamEventHandlerRegistry();
    registry.register(ProcessUserMessageEvent, new ProcessUserMessageEventHandler());
    registry.register(InterAgentMessageRequestEvent, new InterAgentMessageRequestEventHandler());
    registry.register(ToolApprovalTeamEvent, new ToolApprovalTeamEventHandler());

    const lifecycle_handler = new LifecycleAgentTeamEventHandler();
    registry.register(AgentTeamBootstrapStartedEvent, lifecycle_handler);
    registry.register(AgentTeamReadyEvent, lifecycle_handler);
    registry.register(AgentTeamIdleEvent, lifecycle_handler);
    registry.register(AgentTeamShutdownRequestedEvent, lifecycle_handler);
    registry.register(AgentTeamStoppedEvent, lifecycle_handler);
    registry.register(AgentTeamErrorEvent, lifecycle_handler);
    return registry;
  }

  create_team(config: AgentTeamConfig): AgentTeam {
    let team_id = `team_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
    while (this._active_teams.has(team_id)) {
      team_id = `team_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
    }

    const state = new AgentTeamRuntimeState({ team_id });
    const context = new AgentTeamContext(team_id, config, state);

    const handler_registry = this._get_default_event_handler_registry();
    const runtime = new AgentTeamRuntime(context, handler_registry);

    const team_manager = new TeamManager(team_id, runtime, runtime.multiplexer);
    context.state.team_manager = team_manager;

    const team = new AgentTeam(runtime);
    this._active_teams.set(team_id, team);
    console.info(`Agent Team '${team_id}' created and stored successfully.`);
    return team;
  }

  get_team(team_id: string): AgentTeam | undefined {
    return this._active_teams.get(team_id);
  }

  async remove_team(team_id: string, shutdown_timeout: number = 10.0): Promise<boolean> {
    const team = this._active_teams.get(team_id);
    if (!team) {
      console.warn(`Agent team with ID '${team_id}' not found for removal.`);
      return false;
    }

    this._active_teams.delete(team_id);
    console.info(`Removing agent team '${team_id}'. Attempting graceful shutdown.`);
    await team.stop(shutdown_timeout);
    return true;
  }

  list_active_team_ids(): string[] {
    return Array.from(this._active_teams.keys());
  }
}

export const defaultAgentTeamFactory = AgentTeamFactory.getInstance();
