import { AgentTeamStatus } from './agent_team_status.js';
import type { AgentTeamContext } from '../context/agent_team_context.js';
import type { AgentTeamExternalEventNotifier } from '../streaming/agent_team_event_notifier.js';

export class AgentTeamStatusManager {
  private context: AgentTeamContext;
  public readonly notifier: AgentTeamExternalEventNotifier;

  constructor(context: AgentTeamContext, notifier: AgentTeamExternalEventNotifier) {
    if (!notifier) {
      throw new Error('AgentTeamStatusManager requires a notifier.');
    }

    this.context = context;
    this.notifier = notifier;

    if (!Object.values(AgentTeamStatus).includes(this.context.current_status)) {
      this.context.current_status = AgentTeamStatus.UNINITIALIZED;
    }

    console.debug(`AgentTeamStatusManager initialized for team '${context.team_id}'.`);
  }

  async emit_status_update(
    old_status: AgentTeamStatus,
    new_status: AgentTeamStatus,
    additional_data: Record<string, any> | null = null
  ): Promise<void> {
    if (old_status === new_status) {
      return;
    }

    this.notifier.notify_status_updated(new_status, old_status, additional_data ?? null);
  }
}
