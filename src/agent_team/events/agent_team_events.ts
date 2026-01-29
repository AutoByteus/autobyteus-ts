import type { AgentInputUserMessage } from '../../agent/message/agent_input_user_message.js';

export class BaseAgentTeamEvent {}

export class LifecycleAgentTeamEvent extends BaseAgentTeamEvent {}

export class OperationalAgentTeamEvent extends BaseAgentTeamEvent {}

export class AgentTeamBootstrapStartedEvent extends LifecycleAgentTeamEvent {}

export class AgentTeamReadyEvent extends LifecycleAgentTeamEvent {}

export class AgentTeamIdleEvent extends LifecycleAgentTeamEvent {}

export class AgentTeamShutdownRequestedEvent extends LifecycleAgentTeamEvent {}

export class AgentTeamStoppedEvent extends LifecycleAgentTeamEvent {}

export class AgentTeamErrorEvent extends LifecycleAgentTeamEvent {
  error_message: string;
  exception_details?: string;

  constructor(error_message: string, exception_details?: string) {
    super();
    this.error_message = error_message;
    this.exception_details = exception_details;
  }
}

export class ProcessUserMessageEvent extends OperationalAgentTeamEvent {
  user_message: AgentInputUserMessage;
  target_agent_name: string;

  constructor(user_message: AgentInputUserMessage, target_agent_name: string) {
    super();
    this.user_message = user_message;
    this.target_agent_name = target_agent_name;
  }
}

export class InterAgentMessageRequestEvent extends OperationalAgentTeamEvent {
  sender_agent_id: string;
  recipient_name: string;
  content: string;
  message_type: string;

  constructor(sender_agent_id: string, recipient_name: string, content: string, message_type: string) {
    super();
    this.sender_agent_id = sender_agent_id;
    this.recipient_name = recipient_name;
    this.content = content;
    this.message_type = message_type;
  }
}

export class ToolApprovalTeamEvent extends OperationalAgentTeamEvent {
  agent_name: string;
  tool_invocation_id: string;
  is_approved: boolean;
  reason?: string;

  constructor(agent_name: string, tool_invocation_id: string, is_approved: boolean, reason?: string) {
    super();
    this.agent_name = agent_name;
    this.tool_invocation_id = tool_invocation_id;
    this.is_approved = is_approved;
    this.reason = reason;
  }
}
