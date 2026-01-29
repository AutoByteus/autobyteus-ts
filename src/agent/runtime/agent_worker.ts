import { AgentStatus } from '../status/status_enum.js';
import {
  AgentErrorEvent,
  AgentStoppedEvent,
  BootstrapStartedEvent,
  BaseEvent
} from '../events/agent_events.js';
import { AgentInputEventQueueManager } from '../events/agent_input_event_queue_manager.js';
import { AgentEventStore } from '../events/event_store.js';
import { WorkerEventDispatcher } from '../events/worker_event_dispatcher.js';
import { AgentStatusDeriver } from '../status/status_deriver.js';
import { AgentShutdownOrchestrator } from '../shutdown_steps/agent_shutdown_orchestrator.js';
import type { AgentContext } from '../context/agent_context.js';
import type { EventHandlerRegistry } from '../handlers/event_handler_registry.js';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class AgentWorker {
  context: AgentContext;
  status_manager: any;
  worker_event_dispatcher: WorkerEventDispatcher;
  private _is_active: boolean = false;

  private loopPromise: Promise<void> | null = null;
  private stopRequested = false;
  private stopInitiated = false;
  private doneCallbacks: Array<(result: PromiseSettledResult<void>) => void> = [];

  constructor(context: AgentContext, event_handler_registry: EventHandlerRegistry) {
    this.context = context;
    this.status_manager = this.context.status_manager;
    if (!this.status_manager) {
      throw new Error(`AgentWorker for '${this.context.agent_id}': AgentStatusManager not found.`);
    }

    this.worker_event_dispatcher = new WorkerEventDispatcher(event_handler_registry);
    console.info(`AgentWorker initialized for agent_id '${this.context.agent_id}'.`);
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

  start(): void {
    const agent_id = this.context.agent_id;
    if (this._is_active) {
      console.warn(`AgentWorker '${agent_id}': Start called, but worker is already active.`);
      return;
    }

    console.info(`AgentWorker '${agent_id}': Starting...`);
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

  private async _initialize(): Promise<boolean> {
    const agent_id = this.context.agent_id;
    console.info(`Agent '${agent_id}': Starting internal initialization process using bootstrap events.`);

    await this.context.input_event_queues.enqueue_internal_system_event(new BootstrapStartedEvent());

    while (![AgentStatus.IDLE, AgentStatus.ERROR].includes(this.context.current_status)) {
      if (this.stopRequested) {
        break;
      }

      let queueEvent: [string, BaseEvent] | null = null;
      try {
        queueEvent = await this.context.state.input_event_queues!.get_next_internal_event();
      } catch {
        queueEvent = null;
      }

      if (!queueEvent) {
        continue;
      }

      const [, eventObj] = queueEvent;
      await this.worker_event_dispatcher.dispatch(eventObj, this.context);
      await delay(0);
    }

    return this.context.current_status === AgentStatus.IDLE;
  }

  private async _runtime_init(): Promise<boolean> {
    const agent_id = this.context.agent_id;

    if (!this.context.state.event_store) {
      this.context.state.event_store = new AgentEventStore(agent_id);
      console.info(`Agent '${agent_id}': Runtime init completed (event store initialized).`);
    }

    if (!this.context.state.status_deriver) {
      this.context.state.status_deriver = new AgentStatusDeriver(this.context.current_status);
      console.info(`Agent '${agent_id}': Runtime init completed (status deriver initialized).`);
    }

    if (this.context.state.input_event_queues) {
      console.debug(`Agent '${agent_id}': Runtime init skipped; input event queues already initialized.`);
      return true;
    }

    try {
      this.context.state.input_event_queues = new AgentInputEventQueueManager();
      console.info(`Agent '${agent_id}': Runtime init completed (input queues initialized).`);
      return true;
    } catch (error) {
      console.error(`Agent '${agent_id}': Runtime init failed while initializing input queues: ${error}`);
      return false;
    }
  }

  async async_run(): Promise<void> {
    const agent_id = this.context.agent_id;

    try {
      console.info(`AgentWorker '${agent_id}' async_run(): Starting.`);

      const runtimeInitSuccess = await this._runtime_init();
      if (!runtimeInitSuccess) {
        console.error(`AgentWorker '${agent_id}' failed during runtime init. Worker is shutting down.`);
        this.stopRequested = true;
        return;
      }

      const initSuccess = await this._initialize();
      if (!initSuccess) {
        console.error(`AgentWorker '${agent_id}' failed to initialize. Worker is shutting down.`);
        this.stopRequested = true;
        return;
      }

      console.info(`AgentWorker '${agent_id}' initialized successfully. Entering main event loop.`);
      while (!this.stopRequested) {
        let queueEvent: [string, BaseEvent] | null = null;
        try {
          queueEvent = await this.context.state.input_event_queues!.get_next_input_event();
        } catch {
          queueEvent = null;
        }

        if (!queueEvent) {
          continue;
        }

        const [, eventObj] = queueEvent;
        try {
          await this.worker_event_dispatcher.dispatch(eventObj, this.context);
        } catch (error) {
          console.error(`Fatal error in AgentWorker '${agent_id}' dispatch: ${error}`);
          this.stopRequested = true;
        }

        await delay(0);
      }
    } catch (error) {
      console.error(`Fatal error in AgentWorker '${agent_id}' async_run() loop: ${error}`);
    } finally {
      console.info(`AgentWorker '${agent_id}' async_run() loop has finished.`);
      console.info(`AgentWorker '${agent_id}': Running shutdown sequence on worker loop.`);
      const orchestrator = new AgentShutdownOrchestrator();
      const cleanupSuccess = await orchestrator.run(this.context);

      if (!cleanupSuccess) {
        console.error(`AgentWorker '${agent_id}': Shutdown resource cleanup failed.`);
      } else {
        console.info(`AgentWorker '${agent_id}': Shutdown resource cleanup completed successfully.`);
      }
      console.info(`AgentWorker '${agent_id}': Shutdown sequence completed.`);
    }
  }

  async stop(timeout: number = 10.0): Promise<void> {
    if (!this._is_active || this.stopInitiated) {
      return;
    }

    const agent_id = this.context.agent_id;
    console.info(`AgentWorker '${agent_id}': Stop requested.`);
    this.stopInitiated = true;
    this.stopRequested = true;

    if (this.context.state.input_event_queues) {
      await this.context.state.input_event_queues.enqueue_internal_system_event(new AgentStoppedEvent());
    }

    if (this.loopPromise) {
      const timeoutMs = Math.max(1, timeout * 1000);
      const result = await Promise.race([
        this.loopPromise,
        delay(timeoutMs).then(() => 'timeout')
      ]);
      if (result === 'timeout') {
        console.warn(`AgentWorker '${agent_id}': Timeout waiting for worker loop to terminate.`);
      }
    }

    this._is_active = false;
  }
}
