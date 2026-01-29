import { AgentStatus } from './status_enum.js';
import { LifecycleEvent } from '../lifecycle/events.js';
import type { AgentContext } from '../context/agent_context.js';
import type { AgentExternalEventNotifier } from '../events/notifiers.js';

export class AgentStatusManager {
  private context: AgentContext;
  public readonly notifier: AgentExternalEventNotifier;

  constructor(context: AgentContext, notifier: AgentExternalEventNotifier) {
    if (!notifier) {
      throw new Error('AgentStatusManager requires a notifier.');
    }
    this.context = context;
    this.notifier = notifier;

    if (!Object.values(AgentStatus).includes(this.context.current_status)) {
      this.context.current_status = AgentStatus.UNINITIALIZED;
    }

    console.debug(
      `AgentStatusManager initialized for agent_id '${this.context.agent_id}'. Initial status: ${this.context.current_status}. Notifier provided: ${Boolean(notifier)}`
    );
  }

  private async execute_lifecycle_processors(
    old_status: AgentStatus,
    new_status: AgentStatus,
    event_data: Record<string, any> | null = null
  ): Promise<void> {
    let lifecycle_event: LifecycleEvent | null = null;
    if (old_status === AgentStatus.BOOTSTRAPPING && new_status === AgentStatus.IDLE) {
      lifecycle_event = LifecycleEvent.AGENT_READY;
    } else if (new_status === AgentStatus.AWAITING_LLM_RESPONSE) {
      lifecycle_event = LifecycleEvent.BEFORE_LLM_CALL;
    } else if (old_status === AgentStatus.AWAITING_LLM_RESPONSE && new_status === AgentStatus.ANALYZING_LLM_RESPONSE) {
      lifecycle_event = LifecycleEvent.AFTER_LLM_RESPONSE;
    } else if (new_status === AgentStatus.EXECUTING_TOOL) {
      lifecycle_event = LifecycleEvent.BEFORE_TOOL_EXECUTE;
    } else if (old_status === AgentStatus.EXECUTING_TOOL) {
      lifecycle_event = LifecycleEvent.AFTER_TOOL_EXECUTE;
    } else if (new_status === AgentStatus.SHUTTING_DOWN) {
      lifecycle_event = LifecycleEvent.AGENT_SHUTTING_DOWN;
    }

    if (!lifecycle_event) {
      return;
    }

    const processors = (this.context.config.lifecycle_processors ?? []).filter(
      (processor) => processor.event === lifecycle_event
    );

    if (!processors.length) {
      return;
    }

    const sorted_processors = processors.sort((a, b) => a.get_order() - b.get_order());
    const processor_names = sorted_processors.map((processor) => processor.get_name());
    console.info(
      `Agent '${this.context.agent_id}': Executing ${sorted_processors.length} lifecycle processors for '${lifecycle_event}': ${processor_names}`
    );

    for (const processor of sorted_processors) {
      try {
        await processor.process(this.context, event_data ?? {});
        console.debug(
          `Agent '${this.context.agent_id}': Lifecycle processor '${processor.get_name()}' executed successfully.`
        );
      } catch (error) {
        console.error(
          `Agent '${this.context.agent_id}': Error executing lifecycle processor '${processor.get_name()}' for '${lifecycle_event}': ${error}`
        );
      }
    }
  }

  async emit_status_update(
    old_status: AgentStatus,
    new_status: AgentStatus,
    additional_data: Record<string, any> | null = null
  ): Promise<void> {
    if (old_status === new_status) {
      return;
    }

    await this.execute_lifecycle_processors(old_status, new_status, additional_data);
    this.notifier.notify_status_updated(new_status, old_status, additional_data ?? undefined);
  }
}
