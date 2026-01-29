import { AgentRuntime } from './runtime/agent_runtime.js';
import { AgentStatus } from './status/status_enum.js';
import { AgentInputUserMessage } from './message/agent_input_user_message.js';
import { InterAgentMessage } from './message/inter_agent_message.js';
import {
  UserMessageReceivedEvent,
  InterAgentMessageReceivedEvent,
  ToolExecutionApprovalEvent,
  BaseEvent
} from './events/agent_events.js';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class Agent {
  private _runtime: AgentRuntime;
  agent_id: string;

  constructor(runtime: AgentRuntime) {
    this._runtime = runtime;
    this.agent_id = this._runtime.context.agent_id;

    console.info(`Agent facade initialized for agent_id '${this.agent_id}'.`);
  }

  get context() {
    return this._runtime.context;
  }

  private async _submit_event_to_runtime(event: BaseEvent): Promise<void> {
    if (!this._runtime.is_running) {
      console.info(`Agent '${this.agent_id}' runtime is not running. Calling start() before submitting event.`);
      this.start();
      await delay(0);
    }

    console.debug(`Agent '${this.agent_id}': Submitting ${event.constructor.name} to runtime.`);
    await this._runtime.submit_event(event);
  }

  async post_user_message(agent_input_user_message: AgentInputUserMessage): Promise<void> {
    const event = new UserMessageReceivedEvent(agent_input_user_message);
    await this._submit_event_to_runtime(event);
  }

  async post_inter_agent_message(inter_agent_message: InterAgentMessage): Promise<void> {
    const event = new InterAgentMessageReceivedEvent(inter_agent_message);
    await this._submit_event_to_runtime(event);
  }

  async post_tool_execution_approval(
    tool_invocation_id: string,
    is_approved: boolean,
    reason: string | null = null
  ): Promise<void> {
    if (!tool_invocation_id || typeof tool_invocation_id !== 'string') {
      throw new Error('tool_invocation_id must be a non-empty string.');
    }
    if (typeof is_approved !== 'boolean') {
      throw new TypeError('is_approved must be a boolean.');
    }

    const approvalEvent = new ToolExecutionApprovalEvent(tool_invocation_id, is_approved, reason ?? undefined);
    await this._submit_event_to_runtime(approvalEvent);
  }

  get_current_status(): AgentStatus {
    if (!this._runtime) {
      return AgentStatus.UNINITIALIZED;
    }
    return this._runtime.current_status_property;
  }

  get is_running(): boolean {
    return this._runtime.is_running;
  }

  start(): void {
    if (this._runtime.is_running) {
      console.info(`Agent '${this.agent_id}' runtime is already running. Ignoring start command.`);
      return;
    }

    console.info(`Agent '${this.agent_id}' requesting runtime to start.`);
    this._runtime.start();
  }

  async stop(timeout: number = 10.0): Promise<void> {
    console.info(`Agent '${this.agent_id}' requesting runtime to stop (timeout: ${timeout}s).`);
    await this._runtime.stop(timeout);
  }

  toString(): string {
    return `<Agent agent_id='${this.agent_id}', current_status='${this._runtime.current_status_property}'>`;
  }
}
