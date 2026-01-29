import { TokenUsageSchema, type TokenUsage } from '../../../llm/utils/token_usage.js';
import { AgentStatus } from '../../status/status_enum.js';

const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null;

const assertRequiredKeys = (data: Record<string, any>, keys: string[], name: string): void => {
  const missing = keys.filter((key) => !(key in data));
  if (missing.length) {
    throw new Error(`${name} missing required fields: ${missing.join(', ')}`);
  }
};

export class BaseStreamPayload {
  [key: string]: any;

  constructor(data: Record<string, any> = {}) {
    Object.assign(this, data);
  }
}

export class AssistantChunkData extends BaseStreamPayload {
  content: string;
  reasoning?: string;
  is_complete: boolean;
  usage?: TokenUsage;
  image_urls?: string[];
  audio_urls?: string[];
  video_urls?: string[];

  constructor(data: Record<string, any>) {
    assertRequiredKeys(data, ['content', 'is_complete'], 'AssistantChunkData');
    super(data);
    this.content = String(data.content ?? '');
    this.reasoning = data.reasoning ?? undefined;
    this.is_complete = Boolean(data.is_complete);
    this.usage = data.usage;
    this.image_urls = data.image_urls ?? undefined;
    this.audio_urls = data.audio_urls ?? undefined;
    this.video_urls = data.video_urls ?? undefined;
  }
}

export class AssistantCompleteResponseData extends BaseStreamPayload {
  content: string;
  reasoning?: string;
  usage?: TokenUsage;
  image_urls?: string[];
  audio_urls?: string[];
  video_urls?: string[];

  constructor(data: Record<string, any>) {
    assertRequiredKeys(data, ['content'], 'AssistantCompleteResponseData');
    super(data);
    this.content = String(data.content ?? '');
    this.reasoning = data.reasoning ?? undefined;
    this.usage = data.usage;
    this.image_urls = data.image_urls ?? undefined;
    this.audio_urls = data.audio_urls ?? undefined;
    this.video_urls = data.video_urls ?? undefined;
  }
}

export class ToolInteractionLogEntryData extends BaseStreamPayload {
  log_entry: string;
  tool_invocation_id: string;
  tool_name: string;

  constructor(data: Record<string, any>) {
    assertRequiredKeys(data, ['log_entry', 'tool_invocation_id', 'tool_name'], 'ToolInteractionLogEntryData');
    super(data);
    this.log_entry = String(data.log_entry ?? '');
    this.tool_invocation_id = String(data.tool_invocation_id ?? '');
    this.tool_name = String(data.tool_name ?? '');
  }
}

export class AgentStatusUpdateData extends BaseStreamPayload {
  new_status: AgentStatus;
  old_status?: AgentStatus;
  trigger?: string;
  tool_name?: string;
  error_message?: string;
  error_details?: string;

  constructor(data: Record<string, any>) {
    assertRequiredKeys(data, ['new_status'], 'AgentStatusUpdateData');
    super(data);
    this.new_status = data.new_status;
    this.old_status = data.old_status ?? undefined;
    this.trigger = data.trigger ?? undefined;
    this.tool_name = data.tool_name ?? undefined;
    this.error_message = data.error_message ?? undefined;
    this.error_details = data.error_details ?? undefined;
  }
}

export class ErrorEventData extends BaseStreamPayload {
  source: string;
  message: string;
  details?: string;

  constructor(data: Record<string, any>) {
    assertRequiredKeys(data, ['source', 'message'], 'ErrorEventData');
    super(data);
    this.source = String(data.source ?? '');
    this.message = String(data.message ?? '');
    this.details = data.details ?? undefined;
  }
}

export class ToolInvocationApprovalRequestedData extends BaseStreamPayload {
  invocation_id: string;
  tool_name: string;
  arguments: Record<string, any>;

  constructor(data: Record<string, any>) {
    assertRequiredKeys(data, ['invocation_id', 'tool_name', 'arguments'], 'ToolInvocationApprovalRequestedData');
    super(data);
    this.invocation_id = String(data.invocation_id ?? '');
    this.tool_name = String(data.tool_name ?? '');
    this.arguments = data.arguments ?? {};
  }
}

export class ToolInvocationAutoExecutingData extends BaseStreamPayload {
  invocation_id: string;
  tool_name: string;
  arguments: Record<string, any>;

  constructor(data: Record<string, any>) {
    assertRequiredKeys(data, ['invocation_id', 'tool_name', 'arguments'], 'ToolInvocationAutoExecutingData');
    super(data);
    this.invocation_id = String(data.invocation_id ?? '');
    this.tool_name = String(data.tool_name ?? '');
    this.arguments = data.arguments ?? {};
  }
}

export class SegmentEventData extends BaseStreamPayload {
  event_type: string;
  segment_id: string;
  segment_type?: string;
  payload: Record<string, any>;

  constructor(data: Record<string, any>) {
    const eventType = data.event_type ?? data.type;
    assertRequiredKeys({ ...data, event_type: eventType }, ['event_type', 'segment_id'], 'SegmentEventData');
    super(data);
    this.event_type = eventType;
    this.segment_id = String(data.segment_id ?? '');
    this.segment_type = data.segment_type ?? undefined;
    this.payload = data.payload ?? {};
  }
}

export class SystemTaskNotificationData extends BaseStreamPayload {
  sender_id: string;
  content: string;

  constructor(data: Record<string, any>) {
    assertRequiredKeys(data, ['sender_id', 'content'], 'SystemTaskNotificationData');
    super(data);
    this.sender_id = String(data.sender_id ?? '');
    this.content = String(data.content ?? '');
  }
}

export class InterAgentMessageData extends BaseStreamPayload {
  sender_agent_id: string;
  recipient_role_name: string;
  content: string;
  message_type: string;

  constructor(data: Record<string, any>) {
    assertRequiredKeys(
      data,
      ['sender_agent_id', 'recipient_role_name', 'content', 'message_type'],
      'InterAgentMessageData'
    );
    super(data);
    this.sender_agent_id = String(data.sender_agent_id ?? '');
    this.recipient_role_name = String(data.recipient_role_name ?? '');
    this.content = String(data.content ?? '');
    this.message_type = String(data.message_type ?? '');
  }
}

export class ToDoItemData extends BaseStreamPayload {
  description: string;
  todo_id: string;
  status: string;

  constructor(data: Record<string, any>) {
    assertRequiredKeys(data, ['description', 'todo_id', 'status'], 'ToDoItemData');
    super(data);
    this.description = String(data.description ?? '');
    this.todo_id = String(data.todo_id ?? '');
    this.status = String(data.status ?? '');
  }
}

export class ToDoListUpdateData extends BaseStreamPayload {
  todos: ToDoItemData[];

  constructor(data: { todos: ToDoItemData[] }) {
    super(data as Record<string, any>);
    this.todos = data.todos;
  }
}

export class ArtifactPersistedData extends BaseStreamPayload {
  artifact_id: string;
  path: string;
  agent_id: string;
  type: string;
  workspace_root?: string;
  url?: string;

  constructor(data: Record<string, any>) {
    assertRequiredKeys(data, ['artifact_id', 'path', 'agent_id', 'type'], 'ArtifactPersistedData');
    super(data);
    this.artifact_id = String(data.artifact_id ?? '');
    this.path = String(data.path ?? '');
    this.agent_id = String(data.agent_id ?? '');
    this.type = String(data.type ?? '');
    this.workspace_root = data.workspace_root ?? undefined;
    this.url = data.url ?? undefined;
  }
}

export class ArtifactUpdatedData extends BaseStreamPayload {
  artifact_id?: string;
  path: string;
  agent_id: string;
  type: string;
  workspace_root?: string;

  constructor(data: Record<string, any>) {
    assertRequiredKeys(data, ['path', 'agent_id', 'type'], 'ArtifactUpdatedData');
    super(data);
    this.artifact_id = data.artifact_id ?? undefined;
    this.path = String(data.path ?? '');
    this.agent_id = String(data.agent_id ?? '');
    this.type = String(data.type ?? '');
    this.workspace_root = data.workspace_root ?? undefined;
  }
}

export class EmptyData extends BaseStreamPayload {}

export type StreamDataPayload =
  | AssistantChunkData
  | AssistantCompleteResponseData
  | ToolInteractionLogEntryData
  | AgentStatusUpdateData
  | ErrorEventData
  | ToolInvocationApprovalRequestedData
  | ToolInvocationAutoExecutingData
  | SegmentEventData
  | SystemTaskNotificationData
  | InterAgentMessageData
  | ToDoListUpdateData
  | ArtifactPersistedData
  | ArtifactUpdatedData
  | EmptyData;

const parseUsage = (usageData: unknown): TokenUsage | undefined => {
  if (!usageData) {
    return undefined;
  }
  const parsed = TokenUsageSchema.safeParse(usageData);
  if (!parsed.success) {
    console.warn(`Unsupported usage payload for stream event: ${parsed.error.message}`);
    return undefined;
  }
  return parsed.data;
};

export const create_assistant_chunk_data = (chunkObj: unknown): AssistantChunkData => {
  if (!isRecord(chunkObj)) {
    throw new Error(`Cannot create AssistantChunkData from ${typeof chunkObj}`);
  }

  const usage = parseUsage(chunkObj.usage);
  const data = { ...chunkObj, usage };
  return new AssistantChunkData(data);
};

export const create_assistant_complete_response_data = (
  completeRespObj: unknown
): AssistantCompleteResponseData => {
  if (!isRecord(completeRespObj)) {
    throw new Error(`Cannot create AssistantCompleteResponseData from ${typeof completeRespObj}`);
  }

  const usage = parseUsage(completeRespObj.usage);
  const data = { ...completeRespObj, usage };
  return new AssistantCompleteResponseData(data);
};

export const create_tool_interaction_log_entry_data = (logData: unknown): ToolInteractionLogEntryData => {
  if (!isRecord(logData)) {
    throw new Error('Cannot create ToolInteractionLogEntryData from non-object');
  }
  return new ToolInteractionLogEntryData(logData);
};

export const create_agent_status_update_data = (statusData: unknown): AgentStatusUpdateData => {
  if (!isRecord(statusData)) {
    throw new Error('Cannot create AgentStatusUpdateData from non-object');
  }
  return new AgentStatusUpdateData(statusData);
};

export const create_error_event_data = (errorData: unknown): ErrorEventData => {
  if (!isRecord(errorData)) {
    throw new Error('Cannot create ErrorEventData from non-object');
  }
  return new ErrorEventData(errorData);
};

export const create_tool_invocation_approval_requested_data = (
  approvalData: unknown
): ToolInvocationApprovalRequestedData => {
  if (!isRecord(approvalData)) {
    throw new Error('Cannot create ToolInvocationApprovalRequestedData from non-object');
  }
  return new ToolInvocationApprovalRequestedData(approvalData);
};

export const create_tool_invocation_auto_executing_data = (
  autoExecData: unknown
): ToolInvocationAutoExecutingData => {
  if (!isRecord(autoExecData)) {
    throw new Error('Cannot create ToolInvocationAutoExecutingData from non-object');
  }
  return new ToolInvocationAutoExecutingData(autoExecData);
};

export const create_segment_event_data = (eventData: unknown): SegmentEventData => {
  if (eventData instanceof SegmentEventData) {
    return eventData;
  }
  if (!isRecord(eventData)) {
    throw new Error('Cannot create SegmentEventData from non-object');
  }
  return new SegmentEventData(eventData);
};

export const create_inter_agent_message_data = (msgData: unknown): InterAgentMessageData => {
  if (!isRecord(msgData)) {
    throw new Error('Cannot create InterAgentMessageData from non-object');
  }
  return new InterAgentMessageData(msgData);
};

export const create_system_task_notification_data = (notificationData: unknown): SystemTaskNotificationData => {
  if (!isRecord(notificationData)) {
    throw new Error('Cannot create SystemTaskNotificationData from non-object');
  }
  return new SystemTaskNotificationData(notificationData);
};

export const create_todo_list_update_data = (todoData: unknown): ToDoListUpdateData => {
  if (!isRecord(todoData)) {
    throw new Error('Cannot create ToDoListUpdateData from non-object');
  }
  const todosPayload = todoData.todos;
  if (!Array.isArray(todosPayload)) {
    throw new Error("Expected 'todos' to be a list when creating ToDoListUpdateData.");
  }
  const todoItems: ToDoItemData[] = [];
  for (const todoEntry of todosPayload) {
    if (!isRecord(todoEntry)) {
      console.warn(`Skipping non-object todo entry when creating ToDoListUpdateData: ${String(todoEntry)}`);
      continue;
    }
    try {
      todoItems.push(new ToDoItemData(todoEntry));
    } catch (error) {
      console.warn(`Failed to parse todo entry into ToDoItemData: ${JSON.stringify(todoEntry)}; error: ${error}`);
    }
  }
  return new ToDoListUpdateData({ todos: todoItems });
};

export const create_artifact_persisted_data = (data: unknown): ArtifactPersistedData => {
  if (!isRecord(data)) {
    throw new Error('Cannot create ArtifactPersistedData from non-object');
  }
  return new ArtifactPersistedData(data);
};

export const create_artifact_updated_data = (data: unknown): ArtifactUpdatedData => {
  if (!isRecord(data)) {
    throw new Error('Cannot create ArtifactUpdatedData from non-object');
  }
  return new ArtifactUpdatedData(data);
};
