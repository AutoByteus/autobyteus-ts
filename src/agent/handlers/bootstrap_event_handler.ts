import { AgentBootstrapper } from '../bootstrap_steps/agent_bootstrapper.js';
import { BaseBootstrapStep } from '../bootstrap_steps/base_bootstrap_step.js';
import {
  AgentErrorEvent,
  AgentReadyEvent,
  BootstrapStartedEvent,
  BootstrapStepRequestedEvent,
  BootstrapStepCompletedEvent,
  BootstrapCompletedEvent
} from '../events/agent_events.js';
import { AgentEventHandler } from './base_event_handler.js';
import type { AgentContext } from '../context/agent_context.js';

const BOOTSTRAP_STEPS_KEY = '_bootstrap_steps';

export class BootstrapEventHandler extends AgentEventHandler {
  private bootstrapper: AgentBootstrapper;

  constructor(steps: BaseBootstrapStep[] | null = null) {
    super();
    this.bootstrapper = new AgentBootstrapper(steps ?? null);
  }

  async handle(event: object, context: AgentContext): Promise<void> {
    if (event instanceof BootstrapStartedEvent) {
      await this.handleBootstrapStarted(context);
      return;
    }
    if (event instanceof BootstrapStepRequestedEvent) {
      await this.handleBootstrapStepRequested(event, context);
      return;
    }
    if (event instanceof BootstrapStepCompletedEvent) {
      await this.handleBootstrapStepCompleted(event, context);
      return;
    }
    if (event instanceof BootstrapCompletedEvent) {
      await this.handleBootstrapCompleted(event, context);
      return;
    }

    console.warn(
      `BootstrapEventHandler received unexpected event type: ${event?.constructor?.name ?? typeof event}`
    );
  }

  private async handleBootstrapStarted(context: AgentContext): Promise<void> {
    const steps = [...this.bootstrapper.bootstrap_steps];
    context.state.custom_data[BOOTSTRAP_STEPS_KEY] = steps;

    if (steps.length === 0) {
      console.info(
        `Agent '${context.agent_id}': No bootstrap steps configured. Marking bootstrap complete.`
      );
      await context.input_event_queues.enqueue_internal_system_event(
        new BootstrapCompletedEvent(true)
      );
      return;
    }

    console.info(
      `Agent '${context.agent_id}': Bootstrap started with ${steps.length} steps.`
    );
    await context.input_event_queues.enqueue_internal_system_event(
      new BootstrapStepRequestedEvent(0)
    );
  }

  private async handleBootstrapStepRequested(
    event: BootstrapStepRequestedEvent,
    context: AgentContext
  ): Promise<void> {
    const steps = context.state.custom_data[BOOTSTRAP_STEPS_KEY] as BaseBootstrapStep[] | undefined;
    if (!steps || steps.length === 0) {
      const errorMessage = 'Bootstrap steps list missing from context during step request.';
      console.error(`Agent '${context.agent_id}': ${errorMessage}`);
      await this.notifyBootstrapError(context, errorMessage);
      await context.input_event_queues.enqueue_internal_system_event(
        new BootstrapCompletedEvent(false, errorMessage)
      );
      return;
    }

    const stepIndex = event.step_index;
    if (stepIndex < 0 || stepIndex >= steps.length) {
      const errorMessage = `Invalid bootstrap step index ${stepIndex}.`;
      console.error(`Agent '${context.agent_id}': ${errorMessage}`);
      await this.notifyBootstrapError(context, errorMessage);
      await context.input_event_queues.enqueue_internal_system_event(
        new BootstrapCompletedEvent(false, errorMessage)
      );
      return;
    }

    const step = steps[stepIndex];
    const stepName = step.constructor.name;
    console.debug(
      `Agent '${context.agent_id}': Executing bootstrap step ${stepIndex + 1}/${steps.length}: ${stepName}`
    );

    let success = false;
    try {
      success = await step.execute(context);
    } catch (error) {
      const errorMessage = `Exception during bootstrap step '${stepName}': ${error}`;
      console.error(`Agent '${context.agent_id}': ${errorMessage}`);
      success = false;
    }

    if (!success) {
      const errorMessage = `Bootstrap step '${stepName}' failed.`;
      await this.notifyBootstrapError(context, errorMessage);
    }

    await context.input_event_queues.enqueue_internal_system_event(
      new BootstrapStepCompletedEvent(
        stepIndex,
        stepName,
        success,
        success ? undefined : `Step '${stepName}' failed`
      )
    );
  }

  private async handleBootstrapStepCompleted(
    event: BootstrapStepCompletedEvent,
    context: AgentContext
  ): Promise<void> {
    if (!event.success) {
      await context.input_event_queues.enqueue_internal_system_event(
        new BootstrapCompletedEvent(false, event.error_message)
      );
      return;
    }

    const steps = context.state.custom_data[BOOTSTRAP_STEPS_KEY] as BaseBootstrapStep[] | undefined;
    if (!steps || steps.length === 0) {
      const errorMessage = 'Bootstrap steps list missing during step completion.';
      console.error(`Agent '${context.agent_id}': ${errorMessage}`);
      await this.notifyBootstrapError(context, errorMessage);
      await context.input_event_queues.enqueue_internal_system_event(
        new BootstrapCompletedEvent(false, errorMessage)
      );
      return;
    }

    const nextIndex = event.step_index + 1;
    if (nextIndex < steps.length) {
      await context.input_event_queues.enqueue_internal_system_event(
        new BootstrapStepRequestedEvent(nextIndex)
      );
      return;
    }

    await context.input_event_queues.enqueue_internal_system_event(
      new BootstrapCompletedEvent(true)
    );
  }

  private async handleBootstrapCompleted(
    event: BootstrapCompletedEvent,
    context: AgentContext
  ): Promise<void> {
    if (!event.success) {
      console.error(
        `Agent '${context.agent_id}': Bootstrap completed with failure. Error: ${event.error_message}`
      );
      await this.notifyBootstrapError(context, event.error_message ?? 'Bootstrap failed.');
      return;
    }

    console.info(
      `Agent '${context.agent_id}': Bootstrap completed successfully. Emitting AgentReadyEvent.`
    );
    await context.input_event_queues.enqueue_internal_system_event(new AgentReadyEvent());
  }

  private async notifyBootstrapError(context: AgentContext, errorMessage: string): Promise<void> {
    await context.input_event_queues.enqueue_internal_system_event(
      new AgentErrorEvent(errorMessage, errorMessage)
    );
  }
}
