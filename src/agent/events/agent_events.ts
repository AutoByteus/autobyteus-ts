import type { AgentInputUserMessage } from '../message/agent_input_user_message.js';
import type { InterAgentMessage } from '../message/inter_agent_message.js';
import type { ToolInvocation } from '../tool_invocation.js';
import type { LLMUserMessage } from '../../llm/user_message.js';
import type { CompleteResponse } from '../../llm/utils/response_types.js';

export class BaseEvent {}

export class LifecycleEvent extends BaseEvent {}

export class AgentProcessingEvent extends BaseEvent {}

export class AgentOperationalEvent extends AgentProcessingEvent {}

export class AgentReadyEvent extends LifecycleEvent {}

export class AgentStoppedEvent extends LifecycleEvent {}

export class AgentErrorEvent extends LifecycleEvent {
  error_message: string;
  exception_details?: string;

  constructor(error_message: string, exception_details?: string) {
    super();
    this.error_message = error_message;
    this.exception_details = exception_details;
  }
}

export class AgentIdleEvent extends LifecycleEvent {}

export class ShutdownRequestedEvent extends LifecycleEvent {}

export class BootstrapStartedEvent extends LifecycleEvent {}

export class BootstrapStepRequestedEvent extends LifecycleEvent {
  step_index: number;

  constructor(step_index: number) {
    super();
    this.step_index = step_index;
  }
}

export class BootstrapStepCompletedEvent extends LifecycleEvent {
  step_index: number;
  step_name: string;
  success: boolean;
  error_message?: string;

  constructor(step_index: number, step_name: string, success: boolean, error_message?: string) {
    super();
    this.step_index = step_index;
    this.step_name = step_name;
    this.success = success;
    this.error_message = error_message;
  }
}

export class BootstrapCompletedEvent extends LifecycleEvent {
  success: boolean;
  error_message?: string;

  constructor(success: boolean, error_message?: string) {
    super();
    this.success = success;
    this.error_message = error_message;
  }
}

export class UserMessageReceivedEvent extends AgentOperationalEvent {
  agent_input_user_message: AgentInputUserMessage;

  constructor(agent_input_user_message: AgentInputUserMessage) {
    super();
    this.agent_input_user_message = agent_input_user_message;
  }
}

export class InterAgentMessageReceivedEvent extends AgentOperationalEvent {
  inter_agent_message: InterAgentMessage;

  constructor(inter_agent_message: InterAgentMessage) {
    super();
    this.inter_agent_message = inter_agent_message;
  }
}

export class LLMUserMessageReadyEvent extends AgentOperationalEvent {
  llm_user_message: LLMUserMessage;

  constructor(llm_user_message: LLMUserMessage) {
    super();
    this.llm_user_message = llm_user_message;
  }
}

export class LLMCompleteResponseReceivedEvent extends AgentOperationalEvent {
  complete_response: CompleteResponse;
  is_error: boolean;

  constructor(complete_response: CompleteResponse, is_error: boolean = false) {
    super();
    this.complete_response = complete_response;
    this.is_error = is_error;
  }
}

export class PendingToolInvocationEvent extends AgentOperationalEvent {
  tool_invocation: ToolInvocation;

  constructor(tool_invocation: ToolInvocation) {
    super();
    this.tool_invocation = tool_invocation;
  }
}

export class ToolResultEvent extends AgentOperationalEvent {
  tool_name: string;
  result: any;
  tool_invocation_id?: string;
  error?: string;
  tool_args?: Record<string, any>;

  constructor(
    tool_name: string,
    result: any,
    tool_invocation_id?: string,
    error?: string,
    tool_args?: Record<string, any>
  ) {
    super();
    this.tool_name = tool_name;
    this.result = result;
    this.tool_invocation_id = tool_invocation_id;
    this.error = error;
    this.tool_args = tool_args;
  }
}

export class ToolExecutionApprovalEvent extends AgentOperationalEvent {
  tool_invocation_id: string;
  is_approved: boolean;
  reason?: string;

  constructor(tool_invocation_id: string, is_approved: boolean, reason?: string) {
    super();
    this.tool_invocation_id = tool_invocation_id;
    this.is_approved = is_approved;
    this.reason = reason;
  }
}

export class ApprovedToolInvocationEvent extends AgentOperationalEvent {
  tool_invocation: ToolInvocation;

  constructor(tool_invocation: ToolInvocation) {
    super();
    this.tool_invocation = tool_invocation;
  }
}

export class GenericEvent extends AgentOperationalEvent {
  payload: Record<string, any>;
  type_name: string;

  constructor(payload: Record<string, any>, type_name: string) {
    super();
    this.payload = payload;
    this.type_name = type_name;
  }
}
