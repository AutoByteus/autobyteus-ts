import type {
  BaseEvent,
  UserMessageReceivedEvent,
  InterAgentMessageReceivedEvent,
  PendingToolInvocationEvent,
  ToolResultEvent,
  ToolExecutionApprovalEvent
} from './agent_events.js';

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

  tryGet(): T | undefined {
    return this.items.shift();
  }

  async get(): Promise<T> {
    const item = this.tryGet();
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

export class AgentInputEventQueueManager {
  user_message_input_queue: AsyncQueue<UserMessageReceivedEvent>;
  inter_agent_message_input_queue: AsyncQueue<InterAgentMessageReceivedEvent>;
  tool_invocation_request_queue: AsyncQueue<PendingToolInvocationEvent>;
  tool_result_input_queue: AsyncQueue<ToolResultEvent>;
  tool_execution_approval_queue: AsyncQueue<ToolExecutionApprovalEvent>;
  internal_system_event_queue: AsyncQueue<BaseEvent>;

  private inputQueues: Array<[string, AsyncQueue<BaseEvent>]>;
  private readyBuffers: Map<string, BaseEvent[]>;
  private queuePriority: string[];
  private availabilityWaiters: Array<() => void> = [];

  constructor() {
    this.user_message_input_queue = new AsyncQueue();
    this.inter_agent_message_input_queue = new AsyncQueue();
    this.tool_invocation_request_queue = new AsyncQueue();
    this.tool_result_input_queue = new AsyncQueue();
    this.tool_execution_approval_queue = new AsyncQueue();
    this.internal_system_event_queue = new AsyncQueue();

    this.inputQueues = [
      ['user_message_input_queue', this.user_message_input_queue as unknown as AsyncQueue<BaseEvent>],
      ['inter_agent_message_input_queue', this.inter_agent_message_input_queue as unknown as AsyncQueue<BaseEvent>],
      ['tool_invocation_request_queue', this.tool_invocation_request_queue as unknown as AsyncQueue<BaseEvent>],
      ['tool_result_input_queue', this.tool_result_input_queue as unknown as AsyncQueue<BaseEvent>],
      ['tool_execution_approval_queue', this.tool_execution_approval_queue as unknown as AsyncQueue<BaseEvent>],
      ['internal_system_event_queue', this.internal_system_event_queue]
    ];

    this.readyBuffers = new Map(this.inputQueues.map(([name]) => [name, []]));
    this.queuePriority = [
      'user_message_input_queue',
      'inter_agent_message_input_queue',
      'tool_invocation_request_queue',
      'tool_result_input_queue',
      'tool_execution_approval_queue',
      'internal_system_event_queue'
    ];
  }

  private notifyAvailability(): void {
    const waiter = this.availabilityWaiters.shift();
    if (waiter) {
      waiter();
    }
  }

  async enqueue_user_message(event: UserMessageReceivedEvent): Promise<void> {
    await this.user_message_input_queue.put(event);
    this.notifyAvailability();
  }

  async enqueue_inter_agent_message(event: InterAgentMessageReceivedEvent): Promise<void> {
    await this.inter_agent_message_input_queue.put(event);
    this.notifyAvailability();
  }

  async enqueue_tool_invocation_request(event: PendingToolInvocationEvent): Promise<void> {
    await this.tool_invocation_request_queue.put(event);
    this.notifyAvailability();
  }

  async enqueue_tool_result(event: ToolResultEvent): Promise<void> {
    await this.tool_result_input_queue.put(event);
    this.notifyAvailability();
  }

  async enqueue_tool_approval_event(event: ToolExecutionApprovalEvent): Promise<void> {
    await this.tool_execution_approval_queue.put(event);
    this.notifyAvailability();
  }

  async enqueue_internal_system_event(event: BaseEvent): Promise<void> {
    await this.internal_system_event_queue.put(event);
    this.notifyAvailability();
  }

  async get_next_input_event(): Promise<[string, BaseEvent] | null> {
    while (true) {
      for (const qname of this.queuePriority) {
        const buffer = this.readyBuffers.get(qname);
        if (buffer && buffer.length > 0) {
          return [qname, buffer.shift()!];
        }
      }

      let bufferedAny = false;
      for (const [name, queue] of this.inputQueues) {
        const item = queue.tryGet();
        if (item !== undefined) {
          this.readyBuffers.get(name)?.push(item);
          bufferedAny = true;
        }
      }

      if (bufferedAny) {
        continue;
      }

      await new Promise<void>((resolve) => this.availabilityWaiters.push(resolve));
    }
  }

  async get_next_internal_event(): Promise<[string, BaseEvent] | null> {
    const qname = 'internal_system_event_queue';
    const buffer = this.readyBuffers.get(qname);
    if (buffer && buffer.length > 0) {
      return [qname, buffer.shift()!];
    }

    const item = this.internal_system_event_queue.tryGet();
    if (item !== undefined) {
      return [qname, item];
    }

    await new Promise<void>((resolve) => this.availabilityWaiters.push(resolve));
    const nextItem = await this.internal_system_event_queue.get();
    return [qname, nextItem];
  }
}
