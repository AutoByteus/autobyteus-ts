import { BaseEvent } from '../events/agent_events.js';
import { AgentEventHandler } from './base_event_handler.js';

type EventClass<T extends BaseEvent = BaseEvent> = new (...args: any[]) => T;

export class EventHandlerRegistry {
  private handlers: Map<EventClass, AgentEventHandler>;

  constructor() {
    this.handlers = new Map();
    console.info('EventHandlerRegistry initialized.');
  }

  register(eventClass: EventClass, handlerInstance: AgentEventHandler): void {
    if (typeof eventClass !== 'function' || !(eventClass.prototype instanceof BaseEvent)) {
      const msg = `Cannot register handler: 'event_class' must be a subclass of BaseEvent, got ${String(eventClass)}.`;
      console.error(msg);
      throw new TypeError(msg);
    }

    if (this.handlers.has(eventClass)) {
      const msg = `Handler already registered for event class '${eventClass.name}'. Overwriting is not allowed by default.`;
      console.error(msg);
      throw new Error(msg);
    }

    this.handlers.set(eventClass, handlerInstance);
    console.info(
      `Handler '${handlerInstance.constructor.name}' registered for event class '${eventClass.name}'.`
    );
  }

  get_handler(eventClass: EventClass): AgentEventHandler | null {
    if (typeof eventClass !== 'function' || !(eventClass.prototype instanceof BaseEvent)) {
      console.warn(`Attempted to get handler for invalid event_class type: ${String(eventClass)}.`);
      return null;
    }

    return this.handlers.get(eventClass) ?? null;
  }

  get_all_registered_event_types(): EventClass[] {
    return Array.from(this.handlers.keys());
  }

  toString(): string {
    const registeredTypes = this.get_all_registered_event_types()
      .map((eventClass) => `'${eventClass.name}'`)
      .join(', ');
    return `<EventHandlerRegistry registered_event_types=[${registeredTypes}]>`;
  }
}
