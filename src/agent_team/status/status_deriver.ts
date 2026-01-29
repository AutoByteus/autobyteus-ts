import { AgentTeamStatus } from './agent_team_status.js';
import {
  AgentTeamBootstrapStartedEvent,
  AgentTeamReadyEvent,
  AgentTeamIdleEvent,
  AgentTeamShutdownRequestedEvent,
  AgentTeamStoppedEvent,
  AgentTeamErrorEvent,
  OperationalAgentTeamEvent,
  BaseAgentTeamEvent
} from '../events/agent_team_events.js';

export class AgentTeamStatusDeriver {
  private currentStatus: AgentTeamStatus;

  constructor(initial_status: AgentTeamStatus = AgentTeamStatus.UNINITIALIZED) {
    this.currentStatus = initial_status;
    console.debug(`AgentTeamStatusDeriver initialized with status '${initial_status}'.`);
  }

  get current_status(): AgentTeamStatus {
    return this.currentStatus;
  }

  apply(event: BaseAgentTeamEvent): [AgentTeamStatus, AgentTeamStatus] {
    const oldStatus = this.currentStatus;
    const newStatus = this.reduce(event, oldStatus);
    this.currentStatus = newStatus;
    return [oldStatus, newStatus];
  }

  private reduce(event: BaseAgentTeamEvent, current_status: AgentTeamStatus): AgentTeamStatus {
    if (event instanceof AgentTeamBootstrapStartedEvent) {
      return AgentTeamStatus.BOOTSTRAPPING;
    }
    if (event instanceof AgentTeamReadyEvent) {
      return AgentTeamStatus.IDLE;
    }
    if (event instanceof AgentTeamIdleEvent) {
      return AgentTeamStatus.IDLE;
    }
    if (event instanceof AgentTeamShutdownRequestedEvent) {
      if (current_status === AgentTeamStatus.ERROR) {
        return current_status;
      }
      return AgentTeamStatus.SHUTTING_DOWN;
    }
    if (event instanceof AgentTeamStoppedEvent) {
      if (current_status === AgentTeamStatus.ERROR) {
        return current_status;
      }
      return AgentTeamStatus.SHUTDOWN_COMPLETE;
    }
    if (event instanceof AgentTeamErrorEvent) {
      return AgentTeamStatus.ERROR;
    }

    if (event instanceof OperationalAgentTeamEvent) {
      return AgentTeamStatus.PROCESSING;
    }

    return current_status;
  }
}
