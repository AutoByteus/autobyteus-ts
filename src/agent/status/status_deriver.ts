import { AgentStatus } from './status_enum.js';
import {
  AgentReadyEvent,
  AgentStoppedEvent,
  AgentErrorEvent,
  AgentIdleEvent,
  ShutdownRequestedEvent,
  BootstrapStartedEvent,
  BootstrapCompletedEvent,
  UserMessageReceivedEvent,
  InterAgentMessageReceivedEvent,
  LLMUserMessageReadyEvent,
  LLMCompleteResponseReceivedEvent,
  PendingToolInvocationEvent,
  ToolExecutionApprovalEvent,
  ApprovedToolInvocationEvent,
  ToolResultEvent,
  BaseEvent
} from '../events/agent_events.js';
import type { AgentContextLike } from '../context/agent_context_like.js';

export class AgentStatusDeriver {
  private currentStatusValue: AgentStatus;

  constructor(initial_status: AgentStatus = AgentStatus.UNINITIALIZED) {
    this.currentStatusValue = initial_status;
    console.debug(`AgentStatusDeriver initialized with status '${initial_status}'.`);
  }

  get current_status(): AgentStatus {
    return this.currentStatusValue;
  }

  apply(event: BaseEvent, context: AgentContextLike | null = null): [AgentStatus, AgentStatus] {
    const oldStatus = this.currentStatusValue;
    const newStatus = this.reduce(event, oldStatus, context);
    this.currentStatusValue = newStatus;
    return [oldStatus, newStatus];
  }

  private reduce(event: BaseEvent, current_status: AgentStatus, context: AgentContextLike | null): AgentStatus {
    if (event instanceof BootstrapStartedEvent) {
      return AgentStatus.BOOTSTRAPPING;
    }
    if (event instanceof BootstrapCompletedEvent) {
      return current_status;
    }
    if (event instanceof AgentReadyEvent) {
      return AgentStatus.IDLE;
    }
    if (event instanceof AgentIdleEvent) {
      return AgentStatus.IDLE;
    }
    if (event instanceof ShutdownRequestedEvent) {
      if (current_status === AgentStatus.ERROR) {
        return current_status;
      }
      return AgentStatus.SHUTTING_DOWN;
    }
    if (event instanceof AgentStoppedEvent) {
      if (current_status === AgentStatus.ERROR) {
        return AgentStatus.ERROR;
      }
      return AgentStatus.SHUTDOWN_COMPLETE;
    }
    if (event instanceof AgentErrorEvent) {
      return AgentStatus.ERROR;
    }

    if (event instanceof UserMessageReceivedEvent || event instanceof InterAgentMessageReceivedEvent) {
      return AgentStatus.PROCESSING_USER_INPUT;
    }
    if (event instanceof LLMUserMessageReadyEvent) {
      if (current_status === AgentStatus.AWAITING_LLM_RESPONSE || current_status === AgentStatus.ERROR) {
        return current_status;
      }
      return AgentStatus.AWAITING_LLM_RESPONSE;
    }
    if (event instanceof LLMCompleteResponseReceivedEvent) {
      if (current_status !== AgentStatus.AWAITING_LLM_RESPONSE) {
        return current_status;
      }
      return AgentStatus.ANALYZING_LLM_RESPONSE;
    }

    if (event instanceof PendingToolInvocationEvent) {
      if (context && context.auto_execute_tools === false) {
        return AgentStatus.AWAITING_TOOL_APPROVAL;
      }
      return AgentStatus.EXECUTING_TOOL;
    }
    if (event instanceof ApprovedToolInvocationEvent) {
      return AgentStatus.EXECUTING_TOOL;
    }
    if (event instanceof ToolExecutionApprovalEvent) {
      if (event.is_approved) {
        return AgentStatus.EXECUTING_TOOL;
      }
      return AgentStatus.TOOL_DENIED;
    }
    if (event instanceof ToolResultEvent) {
      if (current_status !== AgentStatus.EXECUTING_TOOL) {
        return current_status;
      }
      return AgentStatus.PROCESSING_TOOL_RESULT;
    }

    return current_status;
  }
}
