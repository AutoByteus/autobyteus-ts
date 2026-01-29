import { BaseAgentTeamEventHandler } from './base_agent_team_event_handler.js';
import { ToolApprovalTeamEvent, AgentTeamErrorEvent } from '../events/agent_team_events.js';
import type { AgentTeamContext } from '../context/agent_team_context.js';

export class ToolApprovalTeamEventHandler extends BaseAgentTeamEventHandler {
  async handle(event: ToolApprovalTeamEvent, context: AgentTeamContext): Promise<void> {
    const team_id = context.team_id;
    const team_manager: any = context.team_manager;

    if (!team_manager) {
      const message =
        `Team '${team_id}': TeamManager not found. Cannot route approval for agent '${event.agent_name}'.`;
      console.error(message);
      if (context.state.input_event_queues) {
        await context.state.input_event_queues.enqueue_internal_system_event(
          new AgentTeamErrorEvent(message, 'TeamManager is not initialized.')
        );
      }
      return;
    }

    const target_node = await team_manager.ensure_node_is_ready(event.agent_name);
    if (!target_node || typeof target_node.post_tool_execution_approval !== 'function') {
      const message = `Team '${team_id}': Target node '${event.agent_name}' for approval is not an agent.`;
      console.error(message);
      if (context.state.input_event_queues) {
        await context.state.input_event_queues.enqueue_internal_system_event(
          new AgentTeamErrorEvent(
            message,
            `Node '${event.agent_name}' is not an agent.`
          )
        );
      }
      return;
    }

    console.info(
      `Team '${team_id}': Posting tool approval (Approved: ${event.is_approved}) ` +
      `to agent '${event.agent_name}' for invocation '${event.tool_invocation_id}'.`
    );
    await target_node.post_tool_execution_approval(
      event.tool_invocation_id,
      event.is_approved,
      event.reason
    );
  }
}
