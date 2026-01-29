import { BaseAgentTeamEventHandler } from './base_agent_team_event_handler.js';
import {
  BaseAgentTeamEvent,
  AgentTeamBootstrapStartedEvent,
  AgentTeamReadyEvent,
  AgentTeamIdleEvent,
  AgentTeamShutdownRequestedEvent,
  AgentTeamStoppedEvent,
  AgentTeamErrorEvent
} from '../events/agent_team_events.js';
import type { AgentTeamContext } from '../context/agent_team_context.js';

export class LifecycleAgentTeamEventHandler extends BaseAgentTeamEventHandler {
  async handle(event: BaseAgentTeamEvent, context: AgentTeamContext): Promise<void> {
    const team_id = context.team_id;
    const current_status = context.state.current_status;

    if (event instanceof AgentTeamBootstrapStartedEvent) {
      console.info(`Team '${team_id}' Logged AgentTeamBootstrapStartedEvent. Current status: ${current_status}`);
    } else if (event instanceof AgentTeamReadyEvent) {
      console.info(`Team '${team_id}' Logged AgentTeamReadyEvent. Current status: ${current_status}`);
    } else if (event instanceof AgentTeamIdleEvent) {
      console.info(`Team '${team_id}' Logged AgentTeamIdleEvent. Current status: ${current_status}`);
    } else if (event instanceof AgentTeamShutdownRequestedEvent) {
      console.info(`Team '${team_id}' Logged AgentTeamShutdownRequestedEvent. Current status: ${current_status}`);
    } else if (event instanceof AgentTeamStoppedEvent) {
      console.info(`Team '${team_id}' Logged AgentTeamStoppedEvent. Current status: ${current_status}`);
    } else if (event instanceof AgentTeamErrorEvent) {
      console.error(
        `Team '${team_id}' Logged AgentTeamErrorEvent: ${event.error_message}. ` +
        `Details: ${event.exception_details}. Current status: ${current_status}`
      );
    } else {
      console.warn(`LifecycleAgentTeamEventHandler received unhandled event type: ${event.constructor.name}`);
    }
  }
}
