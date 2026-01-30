import {
  BaseAgentTeamEvent,
  AgentTeamErrorEvent,
  AgentTeamIdleEvent,
  OperationalAgentTeamEvent
} from './agent_team_events.js';
import { applyEventAndDeriveStatus } from '../status/status_update_utils.js';
import type { AgentTeamContext } from '../context/agent_team_context.js';
import type { AgentTeamEventHandlerRegistry } from '../handlers/agent_team_event_handler_registry.js';

export class AgentTeamEventDispatcher {
  private registry: AgentTeamEventHandlerRegistry;

  constructor(eventHandlerRegistry: AgentTeamEventHandlerRegistry) {
    this.registry = eventHandlerRegistry;
    console.debug('AgentTeamEventDispatcher initialized.');
  }

  async dispatch(event: BaseAgentTeamEvent, context: AgentTeamContext): Promise<void> {
    const teamId = context.teamId;
    const eventClass = event.constructor as typeof BaseAgentTeamEvent;
    const eventClassName = eventClass?.name ?? 'UnknownEvent';

    try {
      await applyEventAndDeriveStatus(event, context);
    } catch (error) {
      console.error(`Team '${teamId}': Status derivation failed for '${eventClassName}': ${error}`);
    }

    const handler = this.registry.getHandler(eventClass as any);
    if (!handler) {
      console.warn(`Team '${teamId}': No handler for event '${eventClassName}'.`);
      return;
    }

    try {
      await handler.handle(event as any, context as any);
    } catch (error) {
      const errorMessage = `Error handling '${eventClassName}' in team '${teamId}': ${error}`;
      console.error(errorMessage);
      if (context.state.inputEventQueues) {
        await context.state.inputEventQueues.enqueueInternalSystemEvent(
          new AgentTeamErrorEvent(errorMessage, String(error))
        );
      }
      return;
    }

    if (event instanceof OperationalAgentTeamEvent) {
      if (context.state.inputEventQueues) {
        await context.state.inputEventQueues.enqueueInternalSystemEvent(new AgentTeamIdleEvent());
      }
    }
  }
}
