import type { ProcessUserMessageEvent } from './agent_team_events.js';

class AsyncQueue<T> {
  private items: T[] = [];
  private waiters: Array<(value: T) => void> = [];

  async put(item: T): Promise<void> {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(item);
      return;
    }
    this.items.push(item);
  }

  async get(): Promise<T> {
    const item = this.items.shift();
    if (item !== undefined) {
      return item;
    }
    return new Promise<T>((resolve) => this.waiters.push(resolve));
  }

  qsize(): number {
    return this.items.length;
  }

  empty(): boolean {
    return this.items.length === 0;
  }
}

export class AgentTeamInputEventQueueManager {
  user_message_queue: AsyncQueue<ProcessUserMessageEvent>;
  internal_system_event_queue: AsyncQueue<any>;

  constructor(queue_size: number = 0) {
    void queue_size;
    this.user_message_queue = new AsyncQueue<ProcessUserMessageEvent>();
    this.internal_system_event_queue = new AsyncQueue<any>();
    console.info('AgentTeamInputEventQueueManager initialized.');
  }

  async enqueue_user_message(event: ProcessUserMessageEvent): Promise<void> {
    await this.user_message_queue.put(event);
  }

  async enqueue_internal_system_event(event: any): Promise<void> {
    await this.internal_system_event_queue.put(event);
  }
}
