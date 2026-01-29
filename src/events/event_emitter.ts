import { randomUUID } from 'node:crypto';
import { EventManager, Subscription, Topic, type Listener } from './event_manager.js';
import { EventType } from './event_types.js';

export class EventEmitter {
  object_id: string;
  event_manager: EventManager;

  constructor() {
    this.object_id = randomUUID();
    this.event_manager = EventManager.getInstance();
  }

  subscribe(event: EventType, listener: Listener): void {
    const subscription = new Subscription(this.object_id, listener);
    const topic = new Topic(event, null);
    this.event_manager.subscribe(subscription, topic);
  }

  subscribe_from(sender: EventEmitter, event: EventType, listener: Listener): void {
    const subscription = new Subscription(this.object_id, listener);
    const senderId = sender?.object_id ?? null;
    const topic = new Topic(event, senderId);
    this.event_manager.subscribe(subscription, topic);
  }

  unsubscribe(event: EventType, listener: Listener): void {
    const subscription = new Subscription(this.object_id, listener);
    const topic = new Topic(event, null);
    this.event_manager.unsubscribe(subscription, topic);
  }

  unsubscribe_from(sender: EventEmitter, event: EventType, listener: Listener): void {
    const subscription = new Subscription(this.object_id, listener);
    const senderId = sender?.object_id ?? null;
    const topic = new Topic(event, senderId);
    this.event_manager.unsubscribe(subscription, topic);
  }

  unsubscribe_all_listeners(): void {
    this.event_manager.unsubscribe_all_for_subscriber(this.object_id);
  }

  emit(event: EventType, kwargs: Record<string, any> = {}): void {
    this.event_manager.emit(event, this.object_id, kwargs);
  }
}
