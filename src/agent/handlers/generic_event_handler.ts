import { AgentEventHandler } from './base_event_handler.js';
import { GenericEvent, BaseEvent } from '../events/agent_events.js';
import type { AgentContext } from '../context/agent_context.js';

export class GenericEventHandler extends AgentEventHandler {
  constructor() {
    super();
    console.info('GenericEventHandler initialized.');
  }

  async handle(event: BaseEvent, context: AgentContext): Promise<void> {
    if (!(event instanceof GenericEvent)) {
      const eventType = event?.constructor?.name ?? typeof event;
      console.warn(`GenericEventHandler received a non-GenericEvent: ${eventType}. Skipping.`);
      return;
    }

    const agentId = context.agent_id;
    const payloadText = JSON.stringify(event.payload);
    console.info(
      `Agent '${agentId}' handling GenericEvent with type_name: '${event.type_name}'. Payload: ${payloadText}`
    );

    if (event.type_name === 'example_custom_generic_event') {
      console.info(
        `Handling specific generic event 'example_custom_generic_event' for agent '${agentId}'.`
      );
    } else if (event.type_name === 'another_custom_event') {
      console.info(`Handling specific generic event 'another_custom_event' for agent '${agentId}'.`);
    } else {
      console.warn(
        `Agent '${agentId}' received GenericEvent with unhandled type_name: '${event.type_name}'.`
      );
    }
  }
}
