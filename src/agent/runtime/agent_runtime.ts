import type { AgentContext } from '../context/agent_context.js';
import { AgentContextRegistry } from '../context/agent_context_registry.js';
import { AgentStatus } from '../status/status_enum.js';
import { AgentStatusManager } from '../status/manager.js';
import { AgentExternalEventNotifier } from '../events/notifiers.js';
import {
  BaseEvent,
  AgentErrorEvent,
  AgentStoppedEvent,
  ShutdownRequestedEvent,
  UserMessageReceivedEvent,
  InterAgentMessageReceivedEvent,
  ToolExecutionApprovalEvent
} from '../events/agent_events.js';
import { apply_event_and_derive_status } from '../status/status_update_utils.js';
import { AgentWorker } from './agent_worker.js';
import type { EventHandlerRegistry } from '../handlers/event_handler_registry.js';

export class AgentRuntime {
  context: AgentContext;
  event_handler_registry: EventHandlerRegistry;
  external_event_notifier: AgentExternalEventNotifier;
  status_manager: AgentStatusManager;
  _worker: AgentWorker;
  private _context_registry: AgentContextRegistry;

  constructor(context: AgentContext, event_handler_registry: EventHandlerRegistry) {
    this.context = context;
    this.event_handler_registry = event_handler_registry;

    this.external_event_notifier = new AgentExternalEventNotifier(this.context.agent_id);
    this.status_manager = new AgentStatusManager(this.context, this.external_event_notifier);
    this.context.state.status_manager_ref = this.status_manager;

    this._worker = new AgentWorker(this.context, this.event_handler_registry);
    this._worker.add_done_callback((result) => this._handle_worker_completion(result));

    this._context_registry = new AgentContextRegistry();
    this._context_registry.registerContext(this.context);

    console.info(`AgentRuntime initialized for agent_id '${this.context.agent_id}'. Context registered.`);
  }

  async submit_event(event: BaseEvent): Promise<void> {
    const agent_id = this.context.agent_id;
    if (!this._worker || !this._worker.is_alive()) {
      throw new Error(`Agent '${agent_id}' worker is not active.`);
    }

    if (!this.context.state.input_event_queues) {
      console.error(
        `AgentRuntime '${agent_id}': Input event queues not initialized for event ${event.constructor.name}.`
      );
      return;
    }

    if (event instanceof UserMessageReceivedEvent) {
      await this.context.state.input_event_queues.enqueue_user_message(event);
    } else if (event instanceof InterAgentMessageReceivedEvent) {
      await this.context.state.input_event_queues.enqueue_inter_agent_message(event);
    } else if (event instanceof ToolExecutionApprovalEvent) {
      await this.context.state.input_event_queues.enqueue_tool_approval_event(event);
    } else {
      await this.context.state.input_event_queues.enqueue_internal_system_event(event);
    }
  }

  start(): void {
    const agent_id = this.context.agent_id;
    if (this._worker.is_alive()) {
      console.warn(`AgentRuntime for '${agent_id}' is already running. Ignoring start request.`);
      return;
    }

    console.info(`AgentRuntime for '${agent_id}': Starting worker.`);
    this._worker.start();
  }

  private _handle_worker_completion(result: PromiseSettledResult<void>): void {
    const agent_id = this.context.agent_id;
    if (result.status === 'rejected') {
      console.error(`AgentRuntime '${agent_id}': Worker loop terminated with an exception: ${result.reason}`);
      if (!AgentStatus.isTerminal(this.context.current_status)) {
        this._apply_event_and_derive_status(
          new AgentErrorEvent('Worker loop exited unexpectedly.', String(result.reason))
        ).catch((error) =>
          console.error(`AgentRuntime '${agent_id}': Failed to emit derived error: ${error}`)
        );
      }
    }

    if (!AgentStatus.isTerminal(this.context.current_status)) {
      this._apply_event_and_derive_status(new AgentStoppedEvent()).catch((error) =>
        console.error(`AgentRuntime '${agent_id}': Failed to emit derived shutdown complete: ${error}`)
      );
    }
  }

  async stop(timeout: number = 10.0): Promise<void> {
    const agent_id = this.context.agent_id;
    if (!this._worker.is_alive()) {
      if (!AgentStatus.isTerminal(this.context.current_status)) {
        await this._apply_event_and_derive_status(new AgentStoppedEvent());
      }
      return;
    }

    await this._apply_event_and_derive_status(new ShutdownRequestedEvent());
    await this._worker.stop(timeout);

    this._context_registry.unregisterContext(agent_id);
    console.info(`AgentRuntime for '${agent_id}': Context unregistered.`);

    await this._apply_event_and_derive_status(new AgentStoppedEvent());
    console.info(`AgentRuntime for '${agent_id}' stop() method completed.`);
  }

  async _apply_event_and_derive_status(event: BaseEvent): Promise<void> {
    await apply_event_and_derive_status(event, this.context);
  }

  get current_status_property(): AgentStatus {
    return this.context.current_status;
  }

  get is_running(): boolean {
    return this._worker.is_alive();
  }
}
