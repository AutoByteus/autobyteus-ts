import { AgentTeamStatus } from './agent_team_status.js';
import { AgentTeamErrorEvent, BaseAgentTeamEvent } from '../events/agent_team_events.js';
import type { AgentTeamContext } from '../context/agent_team_context.js';

export function build_status_update_data(
  event: BaseAgentTeamEvent,
  new_status: AgentTeamStatus
): Record<string, any> | null {
  if (new_status === AgentTeamStatus.ERROR && event instanceof AgentTeamErrorEvent) {
    return { error_message: event.error_message };
  }

  return null;
}

export async function apply_event_and_derive_status(
  event: BaseAgentTeamEvent,
  context: AgentTeamContext
): Promise<[AgentTeamStatus, AgentTeamStatus]> {
  if (context.state.event_store) {
    try {
      context.state.event_store.append(event);
    } catch (error) {
      console.error(`Failed to append team event to store: ${error}`);
    }
  }

  if (!context.state.status_deriver) {
    return [context.current_status, context.current_status];
  }

  const [old_status, new_status] = context.state.status_deriver.apply(event);
  if (old_status !== new_status) {
    context.current_status = new_status;
    const additional_data = build_status_update_data(event, new_status);
    if (context.status_manager) {
      await context.status_manager.emit_status_update(old_status, new_status, additional_data ?? null);
    }
  }

  return [old_status, new_status];
}
