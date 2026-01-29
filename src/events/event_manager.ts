import { Singleton } from '../utils/singleton.js';
import { EventType } from './event_types.js';

export type Listener = (payload?: any, metadata?: Record<string, any>) => void | Promise<void>;

export class Topic {
  event_type: EventType;
  sender_id: string | null;

  constructor(event_type: EventType, sender_id: string | null = null) {
    this.event_type = event_type;
    this.sender_id = sender_id;
  }
}

export class Subscription {
  subscriber_id: string;
  listener: Listener;

  constructor(subscriber_id: string, listener: Listener) {
    this.subscriber_id = subscriber_id;
    this.listener = listener;
  }
}

class SubscriberList {
  private subscriptions: Map<string, Set<Listener>> = new Map();

  add(subscription: Subscription): void {
    const existing = this.subscriptions.get(subscription.subscriber_id);
    if (!existing) {
      this.subscriptions.set(subscription.subscriber_id, new Set([subscription.listener]));
      return;
    }

    if (!existing.has(subscription.listener)) {
      existing.add(subscription.listener);
    }
  }

  removeSubscriber(subscriber_id: string): void {
    this.subscriptions.delete(subscriber_id);
  }

  removeSpecific(subscriber_id: string, listener: Listener): void {
    const existing = this.subscriptions.get(subscriber_id);
    if (!existing) {
      return;
    }
    existing.delete(listener);
    if (existing.size === 0) {
      this.subscriptions.delete(subscriber_id);
    }
  }

  getAllListeners(): Listener[] {
    const all: Listener[] = [];
    for (const listeners of this.subscriptions.values()) {
      for (const listener of listeners) {
        all.push(listener);
      }
    }
    return all;
  }

  isEmpty(): boolean {
    return this.subscriptions.size === 0;
  }
}

function topicKey(topic: Topic): string {
  const senderKey = topic.sender_id ?? '*';
  return `${topic.event_type}::${senderKey}`;
}

export class EventManager extends Singleton {
  private topics: Map<string, SubscriberList> = new Map();

  subscribe(subscription: Subscription, topic: Topic): void {
    const key = topicKey(topic);
    const list = this.topics.get(key) ?? new SubscriberList();
    list.add(subscription);
    this.topics.set(key, list);
  }

  unsubscribe(subscription: Subscription, topic: Topic): void {
    const key = topicKey(topic);
    const list = this.topics.get(key);
    if (!list) {
      return;
    }
    list.removeSpecific(subscription.subscriber_id, subscription.listener);
    if (list.isEmpty()) {
      this.topics.delete(key);
    }
  }

  unsubscribe_all_for_subscriber(subscriber_id: string): void {
    for (const [key, list] of this.topics.entries()) {
      list.removeSubscriber(subscriber_id);
      if (list.isEmpty()) {
        this.topics.delete(key);
      }
    }
  }

  emit(event_type: EventType, origin_object_id: string | null = null, kwargs: Record<string, any> = {}): void {
    const available_kwargs: Record<string, any> = { event_type, object_id: origin_object_id, ...kwargs };
    const targetedKey = topicKey(new Topic(event_type, origin_object_id));
    const globalKey = topicKey(new Topic(event_type, null));

    const listeners: Listener[] = [];
    const targetedList = this.topics.get(targetedKey);
    if (targetedList) {
      listeners.push(...targetedList.getAllListeners());
    }
    const globalList = this.topics.get(globalKey);
    if (globalList) {
      listeners.push(...globalList.getAllListeners());
    }

    const payload = Object.prototype.hasOwnProperty.call(available_kwargs, 'payload')
      ? available_kwargs.payload
      : undefined;
    const primaryArg = payload === undefined ? available_kwargs : payload;

    for (const listener of listeners) {
      try {
        const result = listener(primaryArg, available_kwargs);
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch(() => undefined);
        }
      } catch {
        // Swallow listener errors to mirror Python's best-effort behavior.
      }
    }
  }
}
