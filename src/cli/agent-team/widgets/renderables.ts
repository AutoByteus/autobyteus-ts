import {
  AssistantCompleteResponseData,
  ErrorEventData,
  ToolInteractionLogEntryData,
  ToolInvocationApprovalRequestedData,
  ToolInvocationAutoExecutingData,
  SystemTaskNotificationData
} from '../../../agent/streaming/events/stream-event-payloads.js';
import {
  ASSISTANT_ICON,
  TOOL_ICON,
  PROMPT_ICON,
  ERROR_ICON,
  LOG_ICON,
  SYSTEM_TASK_ICON
} from './shared.js';

export const renderAssistantCompleteResponse = (data: AssistantCompleteResponseData): string[] => {
  const entries: string[] = [];
  if (data.reasoning) {
    entries.push(`<Thinking>\n${data.reasoning}\n</Thinking>`);
  }
  if (data.content) {
    entries.push(`${ASSISTANT_ICON} assistant: ${data.content}`);
  }
  return entries;
};

export const renderToolInteractionLog = (data: ToolInteractionLogEntryData): string => {
  return `${LOG_ICON} [tool-log] ${data.log_entry}`;
};

export const renderToolAutoExecuting = (data: ToolInvocationAutoExecutingData): string => {
  let argsStr = '';
  try {
    argsStr = JSON.stringify(data.arguments, null, 2);
  } catch {
    argsStr = String(data.arguments);
  }
  return `${TOOL_ICON} Executing tool '${data.tool_name}' with arguments:\n${argsStr}`;
};

export const renderToolApprovalRequest = (data: ToolInvocationApprovalRequestedData): string => {
  let argsStr = '';
  try {
    argsStr = JSON.stringify(data.arguments, null, 2);
  } catch {
    argsStr = String(data.arguments);
  }
  return `${PROMPT_ICON} Requesting approval for tool '${data.tool_name}' with arguments:\n${argsStr}`;
};

export const renderError = (data: ErrorEventData): string => {
  const details = data.details ? `\nDetails: ${data.details}` : '';
  return `${ERROR_ICON} Error from ${data.source}: ${data.message}${details}`;
};

export const renderSystemTaskNotification = (data: SystemTaskNotificationData): string => {
  return `${SYSTEM_TASK_ICON} System Task Notification: ${data.content}`;
};
