import { AgentStatus } from '../status/status_enum.js';
import { apply_event_and_derive_status } from '../status/status_update_utils.js';
import {
  BaseEvent,
  AgentErrorEvent,
  AgentIdleEvent,
  LLMCompleteResponseReceivedEvent
} from './agent_events.js';
import type { AgentContext } from '../context/agent_context.js';
import type { EventHandlerRegistry } from '../handlers/event_handler_registry.js';

export class WorkerEventDispatcher {
  private event_handler_registry: EventHandlerRegistry;

  constructor(event_handler_registry: EventHandlerRegistry) {
    this.event_handler_registry = event_handler_registry;
    console.debug('WorkerEventDispatcher initialized.');
  }

  async dispatch(event: BaseEvent, context: AgentContext): Promise<void> {
    const event_class = event.constructor as typeof BaseEvent;
    const handler = this.event_handler_registry.get_handler(event_class as any);
    const agent_id = context.agent_id;

    try {
      await apply_event_and_derive_status(event, context);
    } catch (error) {
      console.error(`WorkerEventDispatcher '${agent_id}': Status projection failed: ${error}`);
    }

    if (!handler) {
      console.warn(
        `WorkerEventDispatcher '${agent_id}' (Status: ${context.current_status}) No handler for '${event_class.name}'. Event: ${event}`
      );
      return;
    }

    const event_class_name = event_class.name ?? 'UnknownEvent';
    const handler_class_name = handler.constructor?.name ?? 'UnknownHandler';

    try {
      console.debug(
        `WorkerEventDispatcher '${agent_id}' (Status: ${context.current_status}) dispatching '${event_class_name}' to ${handler_class_name}.`
      );
      await handler.handle(event as any, context);
      console.debug(
        `WorkerEventDispatcher '${agent_id}' (Status: ${context.current_status}) event '${event_class_name}' handled by ${handler_class_name}.`
      );
    } catch (error) {
      const error_message = `WorkerEventDispatcher '${agent_id}' error handling '${event_class_name}' with ${handler_class_name}: ${error}`;
      console.error(error_message);
      await context.input_event_queues.enqueue_internal_system_event(
        new AgentErrorEvent(error_message, String(error))
      );
      return;
    }

    if (event instanceof LLMCompleteResponseReceivedEvent) {
      if (
        context.current_status === AgentStatus.ANALYZING_LLM_RESPONSE &&
        !Object.keys(context.state.pending_tool_approvals).length &&
        context.input_event_queues.tool_invocation_request_queue.empty()
      ) {
        await context.input_event_queues.enqueue_internal_system_event(new AgentIdleEvent());
      }
    }
  }
}
