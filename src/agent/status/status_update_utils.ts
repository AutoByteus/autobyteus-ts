import { AgentStatus } from './status_enum.js';
import {
  AgentErrorEvent,
  PendingToolInvocationEvent,
  ApprovedToolInvocationEvent,
  ToolExecutionApprovalEvent,
  ToolResultEvent,
  BaseEvent
} from '../events/agent_events.js';
import type { AgentContext } from '../context/agent_context.js';

export function build_status_update_data(
  event: BaseEvent,
  context: AgentContext,
  new_status: AgentStatus
): Record<string, any> | null {
  if (new_status === AgentStatus.PROCESSING_USER_INPUT) {
    return { trigger: event.constructor.name };
  }

  if (new_status === AgentStatus.EXECUTING_TOOL) {
    let tool_name: string | undefined;
    if (event instanceof PendingToolInvocationEvent) {
      tool_name = event.tool_invocation.name;
    } else if (event instanceof ApprovedToolInvocationEvent) {
      tool_name = event.tool_invocation.name;
    } else if (event instanceof ToolExecutionApprovalEvent) {
      const pending = context.state.pending_tool_approvals[event.tool_invocation_id];
      tool_name = pending ? pending.name : 'unknown_tool';
    }
    if (tool_name) {
      return { tool_name };
    }
  }

  if (new_status === AgentStatus.PROCESSING_TOOL_RESULT && event instanceof ToolResultEvent) {
    return { tool_name: event.tool_name };
  }

  if (new_status === AgentStatus.TOOL_DENIED && event instanceof ToolExecutionApprovalEvent) {
    const pending = context.state.pending_tool_approvals[event.tool_invocation_id];
    const tool_name = pending ? pending.name : 'unknown_tool';
    return { tool_name, denial_for_tool: tool_name };
  }

  if (new_status === AgentStatus.ERROR && event instanceof AgentErrorEvent) {
    return { error_message: event.error_message, error_details: event.exception_details };
  }

  return null;
}

export async function apply_event_and_derive_status(
  event: BaseEvent,
  context: AgentContext
): Promise<[AgentStatus, AgentStatus]> {
  if (context.state.event_store) {
    try {
      context.state.event_store.append(event);
    } catch (error) {
      console.error(`Failed to append event to store: ${error}`);
    }
  }

  if (!context.state.status_deriver) {
    return [context.current_status, context.current_status];
  }

  const [old_status, new_status] = context.state.status_deriver.apply(event, context);
  if (old_status !== new_status) {
    context.current_status = new_status;
    const additional_data = build_status_update_data(event, context, new_status);
    if (context.status_manager) {
      await context.status_manager.emit_status_update(old_status, new_status, additional_data ?? null);
    }
  }

  return [old_status, new_status];
}
