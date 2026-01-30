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
  protected static instance?: AgentTeamFactory;

  private activeTeams: Map<string, AgentTeam> = new Map();

  constructor() {
    super();
    if (AgentTeamFactory.instance) {
      return AgentTeamFactory.instance;
    }
    AgentTeamFactory.instance = this;
    initializeLogging();
    console.info('AgentTeamFactory (Singleton) initialized.');
  }

  private getDefaultEventHandlerRegistry(): AgentTeamEventHandlerRegistry {
    const registry = new AgentTeamEventHandlerRegistry();
    registry.register(ProcessUserMessageEvent, new ProcessUserMessageEventHandler());
    registry.register(InterAgentMessageRequestEvent, new InterAgentMessageRequestEventHandler());
    registry.register(ToolApprovalTeamEvent, new ToolApprovalTeamEventHandler());

    const lifecycleHandler = new LifecycleAgentTeamEventHandler();
    registry.register(AgentTeamBootstrapStartedEvent, lifecycleHandler);
    registry.register(AgentTeamReadyEvent, lifecycleHandler);
    registry.register(AgentTeamIdleEvent, lifecycleHandler);
    registry.register(AgentTeamShutdownRequestedEvent, lifecycleHandler);
    registry.register(AgentTeamStoppedEvent, lifecycleHandler);
    registry.register(AgentTeamErrorEvent, lifecycleHandler);
    return registry;
  }

  createTeam(config: AgentTeamConfig): AgentTeam {
    let teamId = `team_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
    while (this.activeTeams.has(teamId)) {
      teamId = `team_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
    }

    const state = new AgentTeamRuntimeState({ teamId });
    const context = new AgentTeamContext(teamId, config, state);

    const handlerRegistry = this.getDefaultEventHandlerRegistry();
    const runtime = new AgentTeamRuntime(context, handlerRegistry);

    const teamManager = new TeamManager(teamId, runtime, runtime.multiplexer);
    context.state.teamManager = teamManager;

    const team = new AgentTeam(runtime);
    this.activeTeams.set(teamId, team);
    console.info(`Agent Team '${teamId}' created and stored successfully.`);
    return team;
  }

  getTeam(teamId: string): AgentTeam | undefined {
    return this.activeTeams.get(teamId);
  }

  async removeTeam(teamId: string, shutdownTimeout: number = 10.0): Promise<boolean> {
    const team = this.activeTeams.get(teamId);
    if (!team) {
      console.warn(`Agent team with ID '${teamId}' not found for removal.`);
      return false;
    }

    this.activeTeams.delete(teamId);
    console.info(`Removing agent team '${teamId}'. Attempting graceful shutdown.`);
    await team.stop(shutdownTimeout);
    return true;
  }

  listActiveTeamIds(): string[] {
    return Array.from(this.activeTeams.keys());
  }
}

export const defaultAgentTeamFactory = AgentTeamFactory.getInstance();
