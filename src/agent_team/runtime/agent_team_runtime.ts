import type { AgentTeamContext } from '../context/agent_team_context.js';
import type { AgentTeamEventHandlerRegistry } from '../handlers/agent_team_event_handler_registry.js';
import { AgentTeamStatusManager } from '../status/agent_team_status_manager.js';
import { apply_event_and_derive_status } from '../status/status_update_utils.js';
import { is_terminal } from '../status/agent_team_status.js';
import {
  BaseAgentTeamEvent,
  AgentTeamErrorEvent,
  AgentTeamStoppedEvent,
  AgentTeamShutdownRequestedEvent,
  ProcessUserMessageEvent
} from '../events/agent_team_events.js';
import { AgentTeamExternalEventNotifier } from '../streaming/agent_team_event_notifier.js';
import { AgentEventMultiplexer } from '../streaming/agent_event_multiplexer.js';
import { AgentTeamWorker } from './agent_team_worker.js';

export class AgentTeamRuntime {
  context: AgentTeamContext;
  notifier: AgentTeamExternalEventNotifier;
  status_manager: AgentTeamStatusManager;
  multiplexer: AgentEventMultiplexer;
  _worker: AgentTeamWorker;

  constructor(context: AgentTeamContext, event_handler_registry: AgentTeamEventHandlerRegistry) {
    this.context = context;
    this.notifier = new AgentTeamExternalEventNotifier(this.context.team_id, this);

    this.status_manager = new AgentTeamStatusManager(this.context, this.notifier);
    this.context.state.status_manager_ref = this.status_manager;

    this._worker = new AgentTeamWorker(this.context, event_handler_registry);
    this._worker.add_done_callback((result) => this._handle_worker_completion(result));

    this.multiplexer = new AgentEventMultiplexer(this.context.team_id, this.notifier, this._worker);
    this.context.state.multiplexer_ref = this.multiplexer;

    console.info(`AgentTeamRuntime initialized for team '${this.context.team_id}'.`);
  }

  get_worker_loop(): Promise<void> | null {
    return this._worker.get_worker_loop();
  }

  start(): void {
    const team_id = this.context.team_id;
    if (this._worker.is_alive()) {
      console.warn(`AgentTeamRuntime for '${team_id}' is already running. Ignoring start request.`);
      return;
    }

    console.info(`AgentTeamRuntime for '${team_id}': Starting worker.`);
    this._worker.start();
  }

  async stop(timeout: number = 10.0): Promise<void> {
    if (!this._worker.is_alive()) {
      if (!is_terminal(this.context.current_status)) {
        await this._apply_event_and_derive_status(new AgentTeamStoppedEvent());
      }
      return;
    }

    await this._apply_event_and_derive_status(new AgentTeamShutdownRequestedEvent());
    await this._worker.stop(timeout);
    await this._apply_event_and_derive_status(new AgentTeamStoppedEvent());
  }

  async submit_event(event: BaseAgentTeamEvent): Promise<void> {
    const team_id = this.context.team_id;
    if (!this._worker.is_alive()) {
      throw new Error(`Agent team worker for '${team_id}' is not active.`);
    }

    if (!this.context.state.input_event_queues) {
      console.error(
        `AgentTeamRuntime '${team_id}': Input event queues not initialized for event ${event.constructor.name}.`
      );
      return;
    }

    if (event instanceof ProcessUserMessageEvent) {
      await this.context.state.input_event_queues.enqueue_user_message(event);
    } else {
      await this.context.state.input_event_queues.enqueue_internal_system_event(event);
    }
  }

  private _handle_worker_completion(result: PromiseSettledResult<void>): void {
    const team_id = this.context.team_id;
    if (result.status === 'rejected') {
      console.error(`AgentTeamRuntime '${team_id}': Worker loop terminated with an exception: ${result.reason}`);
      if (!is_terminal(this.context.current_status)) {
        this._apply_event_and_derive_status(
          new AgentTeamErrorEvent('Worker loop exited unexpectedly.', String(result.reason))
        ).catch((error) =>
          console.error(`AgentTeamRuntime '${team_id}': Failed to emit derived error: ${error}`)
        );
      }
    }

    if (!is_terminal(this.context.current_status)) {
      this._apply_event_and_derive_status(new AgentTeamStoppedEvent()).catch((error) =>
        console.error(`AgentTeamRuntime '${team_id}': Failed to emit derived shutdown complete: ${error}`)
      );
    }
  }

  async _apply_event_and_derive_status(event: BaseAgentTeamEvent): Promise<void> {
    await apply_event_and_derive_status(event, this.context);
  }

  get is_running(): boolean {
    return this._worker.is_alive();
  }
}
