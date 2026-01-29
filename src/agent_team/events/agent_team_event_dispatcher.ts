import {
  BaseAgentTeamEvent,
  AgentTeamErrorEvent,
  AgentTeamIdleEvent,
  OperationalAgentTeamEvent
} from './agent_team_events.js';
import { apply_event_and_derive_status } from '../status/status_update_utils.js';
import type { AgentTeamContext } from '../context/agent_team_context.js';
import type { AgentTeamEventHandlerRegistry } from '../handlers/agent_team_event_handler_registry.js';

export class AgentTeamEventDispatcher {
  private registry: AgentTeamEventHandlerRegistry;

  constructor(event_handler_registry: AgentTeamEventHandlerRegistry) {
    this.registry = event_handler_registry;
    console.debug('AgentTeamEventDispatcher initialized.');
  }

  async dispatch(event: BaseAgentTeamEvent, context: AgentTeamContext): Promise<void> {
    const team_id = context.team_id;
    const event_class = event.constructor as typeof BaseAgentTeamEvent;
    const event_class_name = event_class?.name ?? 'UnknownEvent';

    try {
      await apply_event_and_derive_status(event, context);
    } catch (error) {
      console.error(`Team '${team_id}': Status derivation failed for '${event_class_name}': ${error}`);
    }

    const handler = this.registry.get_handler(event_class as any);
    if (!handler) {
      console.warn(`Team '${team_id}': No handler for event '${event_class_name}'.`);
      return;
    }

    try {
      await handler.handle(event as any, context as any);
    } catch (error) {
      const error_message = `Error handling '${event_class_name}' in team '${team_id}': ${error}`;
      console.error(error_message);
      if (context.state.input_event_queues) {
        await context.state.input_event_queues.enqueue_internal_system_event(
          new AgentTeamErrorEvent(error_message, String(error))
        );
      }
      return;
    }

    if (event instanceof OperationalAgentTeamEvent) {
      if (context.state.input_event_queues) {
        await context.state.input_event_queues.enqueue_internal_system_event(new AgentTeamIdleEvent());
      }
    }
  }
}
