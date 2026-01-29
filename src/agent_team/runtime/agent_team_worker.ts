import { AgentTeamEventDispatcher } from '../events/agent_team_event_dispatcher.js';
import {
  AgentTeamBootstrapStartedEvent,
  AgentTeamReadyEvent,
  AgentTeamErrorEvent,
  AgentTeamStoppedEvent,
  BaseAgentTeamEvent
} from '../events/agent_team_events.js';
import { AgentTeamInputEventQueueManager } from '../events/agent_team_input_event_queue_manager.js';
import { AgentTeamEventStore } from '../events/event_store.js';
import { AgentTeamBootstrapper } from '../bootstrap_steps/agent_team_bootstrapper.js';
import { AgentTeamShutdownOrchestrator } from '../shutdown_steps/agent_team_shutdown_orchestrator.js';
import { AgentTeamStatusDeriver } from '../status/status_deriver.js';
import { apply_event_and_derive_status } from '../status/status_update_utils.js';
import type { AgentTeamContext } from '../context/agent_team_context.js';
import type { AgentTeamEventHandlerRegistry } from '../handlers/agent_team_event_handler_registry.js';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type QueuedEvent = BaseAgentTeamEvent;

type EventSource = 'user' | 'system';

type EventResult = { source: EventSource; event: QueuedEvent };

export class AgentTeamWorker {
  context: AgentTeamContext;
  status_manager: any;
  event_dispatcher: AgentTeamEventDispatcher;
  private _is_active: boolean = false;

  private loopPromise: Promise<void> | null = null;
  private stopRequested = false;
  private stopInitiated = false;
  private doneCallbacks: Array<(result: PromiseSettledResult<void>) => void> = [];

  constructor(context: AgentTeamContext, event_handler_registry: AgentTeamEventHandlerRegistry) {
    this.context = context;
    this.status_manager = this.context.status_manager;
    if (!this.status_manager) {
      throw new Error(`AgentTeamWorker for '${this.context.team_id}': AgentTeamStatusManager not found.`);
    }

    this.event_dispatcher = new AgentTeamEventDispatcher(event_handler_registry);
    console.info(`AgentTeamWorker initialized for team '${this.context.team_id}'.`);
  }

  add_done_callback(callback: (result: PromiseSettledResult<void>) => void): void {
    if (this.loopPromise) {
      this.loopPromise
        .then(() => callback({ status: 'fulfilled', value: undefined }))
        .catch((error) => callback({ status: 'rejected', reason: error }));
      return;
    }
    this.doneCallbacks.push(callback);
  }

  is_alive(): boolean {
    return this._is_active;
  }

  get_worker_loop(): Promise<void> | null {
    return this._is_active ? this.loopPromise : null;
  }

  start(): void {
    const team_id = this.context.team_id;
    if (this._is_active) {
      console.warn(`AgentTeamWorker '${team_id}': Start called, but worker is already active.`);
      return;
    }

    console.info(`AgentTeamWorker '${team_id}': Starting...`);
    this._is_active = true;
    this.stopRequested = false;
    this.stopInitiated = false;

    this.loopPromise = this.async_run();
    this.loopPromise
      .then(() => {
        this._is_active = false;
        this.doneCallbacks.forEach((cb) => cb({ status: 'fulfilled', value: undefined }));
        this.doneCallbacks = [];
      })
      .catch((error) => {
        this._is_active = false;
        this.doneCallbacks.forEach((cb) => cb({ status: 'rejected', reason: error }));
        this.doneCallbacks = [];
      });
  }

  private async _runtime_init(): Promise<boolean> {
    const team_id = this.context.team_id;

    if (!this.context.state.event_store) {
      this.context.state.event_store = new AgentTeamEventStore(team_id);
      console.info(`Team '${team_id}': Runtime init completed (event store initialized).`);
    }

    if (!this.context.state.status_deriver) {
      this.context.state.status_deriver = new AgentTeamStatusDeriver();
      console.info(`Team '${team_id}': Runtime init completed (status deriver initialized).`);
    }

    if (this.context.state.input_event_queues) {
      console.debug(`Team '${team_id}': Runtime init skipped; input event queues already initialized.`);
      return true;
    }

    try {
      this.context.state.input_event_queues = new AgentTeamInputEventQueueManager();
      console.info(`Team '${team_id}': Runtime init completed (input queues initialized).`);
      return true;
    } catch (error) {
      console.error(`Team '${team_id}': Runtime init failed while initializing input queues: ${error}`);
      return false;
    }
  }

  async async_run(): Promise<void> {
    const team_id = this.context.team_id;

    try {
      const runtimeInitSuccess = await this._runtime_init();
      if (!runtimeInitSuccess) {
        console.error(`Team '${team_id}': Runtime init failed. Shutting down.`);
        await apply_event_and_derive_status(
          new AgentTeamErrorEvent('Runtime init failed.', 'Failed to initialize event store or queues.'),
          this.context
        );
        return;
      }

      const bootstrapper = new AgentTeamBootstrapper();
      await this.event_dispatcher.dispatch(new AgentTeamBootstrapStartedEvent(), this.context);
      const bootstrapSuccess = await bootstrapper.run(this.context);
      if (!bootstrapSuccess) {
        console.error(`Team '${team_id}': Bootstrap failed. Shutting down.`);
        await this.event_dispatcher.dispatch(
          new AgentTeamErrorEvent('Bootstrap failed.', 'Bootstrapper returned failure.'),
          this.context
        );
        return;
      }

      await this.event_dispatcher.dispatch(new AgentTeamReadyEvent(), this.context);

      let pendingUser: Promise<QueuedEvent> | null = null;
      let pendingSystem: Promise<QueuedEvent> | null = null;

      while (!this.stopRequested) {
        if (!this.context.state.input_event_queues) {
          await delay(50);
          continue;
        }

        if (!pendingUser) {
          pendingUser = this.context.state.input_event_queues.user_message_queue.get();
        }
        if (!pendingSystem) {
          pendingSystem = this.context.state.input_event_queues.internal_system_event_queue.get();
        }

        const result = await Promise.race([
          pendingUser.then((event): EventResult => ({ source: 'user', event })),
          pendingSystem.then((event): EventResult => ({ source: 'system', event })),
          delay(200).then(() => null)
        ]);

        if (!result) {
          continue;
        }

        if (result.source === 'user') {
          pendingUser = null;
        } else {
          pendingSystem = null;
        }

        try {
          await this.event_dispatcher.dispatch(result.event, this.context);
        } catch (error) {
          console.error(`Team '${team_id}': Error dispatching event: ${error}`);
        }

        await delay(0);
      }
    } catch (error) {
      console.error(`AgentTeamWorker '${team_id}' async_run() loop failed: ${error}`);
    } finally {
      console.info(`Team '${team_id}': Shutdown signal received. Cleaning up.`);
      const orchestrator = new AgentTeamShutdownOrchestrator();
      const cleanupSuccess = await orchestrator.run(this.context);

      if (!cleanupSuccess) {
        console.error(`Team '${team_id}': Shutdown resource cleanup failed.`);
      } else {
        console.info(`Team '${team_id}': Shutdown resource cleanup completed successfully.`);
      }
    }
  }

  async stop(timeout: number = 10.0): Promise<void> {
    if (!this._is_active || this.stopInitiated) {
      return;
    }

    const team_id = this.context.team_id;
    console.info(`AgentTeamWorker '${team_id}': Stop requested.`);
    this.stopInitiated = true;
    this.stopRequested = true;

    if (this.context.state.input_event_queues) {
      await this.context.state.input_event_queues.enqueue_internal_system_event(new AgentTeamStoppedEvent());
    }

    if (this.loopPromise) {
      const timeoutMs = Math.max(1, timeout * 1000);
      const result = await Promise.race([
        this.loopPromise,
        delay(timeoutMs).then(() => 'timeout')
      ]);
      if (result === 'timeout') {
        console.warn(`AgentTeamWorker '${team_id}': Timeout waiting for worker loop to terminate.`);
      }
    }

    this._is_active = false;
  }
}
