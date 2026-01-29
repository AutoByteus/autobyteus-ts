import { EventEmitter } from '../../../events/event_emitter.js';
import { EventType } from '../../../events/event_types.js';
import { StreamEvent, StreamEventType } from '../events/stream_events.js';
import {
  create_assistant_chunk_data,
  create_assistant_complete_response_data,
  create_tool_interaction_log_entry_data,
  create_agent_status_update_data,
  create_error_event_data,
  create_tool_invocation_approval_requested_data,
  create_tool_invocation_auto_executing_data,
  create_segment_event_data,
  create_system_task_notification_data,
  create_inter_agent_message_data,
  create_todo_list_update_data,
  create_artifact_persisted_data,
  create_artifact_updated_data,
  AssistantChunkData,
  AssistantCompleteResponseData,
  ToolInteractionLogEntryData,
  AgentStatusUpdateData,
  ToolInvocationApprovalRequestedData,
  ToolInvocationAutoExecutingData,
  SegmentEventData,
  ErrorEventData,
  SystemTaskNotificationData,
  InterAgentMessageData,
  ToDoListUpdateData,
  ArtifactPersistedData,
  ArtifactUpdatedData,
  type StreamDataPayload
} from '../events/stream_event_payloads.js';
import { streamQueueItems, SimpleQueue } from '../utils/queue_streamer.js';

export type AgentLike = {
  agent_id: string;
  context?: {
    status_manager?: {
      notifier?: EventEmitter;
    } | null;
  };
};

const AES_INTERNAL_SENTINEL = {};

export class AgentEventStream extends EventEmitter {
  agent_id: string;
  private genericStreamQueue: SimpleQueue<StreamEvent | object>;
  private notifier: EventEmitter | null;

  constructor(agent: AgentLike) {
    super();

    if (!agent || typeof agent !== 'object' || typeof agent.agent_id !== 'string') {
      throw new TypeError(`AgentEventStream requires an Agent-like instance, got ${typeof agent}.`);
    }

    this.agent_id = agent.agent_id;
    this.genericStreamQueue = new SimpleQueue<StreamEvent | object>();
    this.notifier = agent.context?.status_manager?.notifier ?? null;

    if (!this.notifier) {
      console.error(`AgentEventStream for '${this.agent_id}': Notifier not available. No events will be streamed.`);
      return;
    }

    this.registerListeners();
    console.info(
      `AgentEventStream (ID: ${this.object_id}) initialized for agent_id '${this.agent_id}'. Subscribed to notifier.`
    );
  }

  private registerListeners(): void {
    const allAgentEventTypes = Object.values(EventType).filter((eventType) =>
      String(eventType).startsWith('agent_')
    );

    for (const eventType of allAgentEventTypes) {
      this.subscribe_from(this.notifier as EventEmitter, eventType as EventType, this.handleNotifierEventSync);
    }
  }

  private handleNotifierEventSync = (payload?: any, metadata?: Record<string, any>): void => {
    const eventType = metadata?.event_type as EventType | undefined;
    if (!eventType) {
      return;
    }
    const eventAgentId = metadata?.agent_id ?? this.agent_id;

    let typedPayload: StreamDataPayload | null = null;
    let streamEventType: StreamEventType | null = null;

    try {
      switch (eventType) {
        case EventType.AGENT_STATUS_UPDATED:
          typedPayload = create_agent_status_update_data(payload);
          streamEventType = StreamEventType.AGENT_STATUS_UPDATED;
          break;
        case EventType.AGENT_DATA_ASSISTANT_CHUNK:
          typedPayload = create_assistant_chunk_data(payload);
          streamEventType = StreamEventType.ASSISTANT_CHUNK;
          break;
        case EventType.AGENT_DATA_ASSISTANT_COMPLETE_RESPONSE:
          typedPayload = create_assistant_complete_response_data(payload);
          streamEventType = StreamEventType.ASSISTANT_COMPLETE_RESPONSE;
          break;
        case EventType.AGENT_DATA_TOOL_LOG:
          typedPayload = create_tool_interaction_log_entry_data(payload);
          streamEventType = StreamEventType.TOOL_INTERACTION_LOG_ENTRY;
          break;
        case EventType.AGENT_REQUEST_TOOL_INVOCATION_APPROVAL:
          typedPayload = create_tool_invocation_approval_requested_data(payload);
          streamEventType = StreamEventType.TOOL_INVOCATION_APPROVAL_REQUESTED;
          break;
        case EventType.AGENT_TOOL_INVOCATION_AUTO_EXECUTING:
          typedPayload = create_tool_invocation_auto_executing_data(payload);
          streamEventType = StreamEventType.TOOL_INVOCATION_AUTO_EXECUTING;
          break;
        case EventType.AGENT_DATA_SEGMENT_EVENT:
          typedPayload = create_segment_event_data(payload);
          streamEventType = StreamEventType.SEGMENT_EVENT;
          break;
        case EventType.AGENT_ERROR_OUTPUT_GENERATION:
          typedPayload = create_error_event_data(payload);
          streamEventType = StreamEventType.ERROR_EVENT;
          break;
        case EventType.AGENT_DATA_SYSTEM_TASK_NOTIFICATION_RECEIVED:
          typedPayload = create_system_task_notification_data(payload);
          streamEventType = StreamEventType.SYSTEM_TASK_NOTIFICATION;
          break;
        case EventType.AGENT_DATA_INTER_AGENT_MESSAGE_RECEIVED:
          typedPayload = create_inter_agent_message_data(payload);
          streamEventType = StreamEventType.INTER_AGENT_MESSAGE;
          break;
        case EventType.AGENT_DATA_TODO_LIST_UPDATED:
          typedPayload = create_todo_list_update_data(payload);
          streamEventType = StreamEventType.AGENT_TODO_LIST_UPDATE;
          break;
        case EventType.AGENT_ARTIFACT_PERSISTED:
          typedPayload = create_artifact_persisted_data(payload);
          streamEventType = StreamEventType.ARTIFACT_PERSISTED;
          break;
        case EventType.AGENT_ARTIFACT_UPDATED:
          typedPayload = create_artifact_updated_data(payload);
          streamEventType = StreamEventType.ARTIFACT_UPDATED;
          break;
        case EventType.AGENT_DATA_TOOL_LOG_STREAM_END:
          break;
        default:
          console.debug(
            `AgentEventStream received internal event '${eventType}' with no direct stream mapping.`
          );
      }
    } catch (error) {
      console.error(`AgentEventStream error processing payload for event '${eventType}': ${error}`);
    }

    if (typedPayload && streamEventType) {
      const streamEvent = new StreamEvent({
        agent_id: eventAgentId,
        event_type: streamEventType,
        data: typedPayload
      });
      this.genericStreamQueue.put(streamEvent);
    }
  };

  async close(): Promise<void> {
    console.info(
      `AgentEventStream (ID: ${this.object_id}) for '${this.agent_id}': close() called. Unsubscribing all listeners and signaling.`
    );
    this.unsubscribe_all_listeners();
    this.genericStreamQueue.put(AES_INTERNAL_SENTINEL);
  }

  async *all_events(): AsyncGenerator<StreamEvent, void, unknown> {
    for await (const event of streamQueueItems(
      this.genericStreamQueue,
      AES_INTERNAL_SENTINEL,
      `agent_${this.agent_id}_all_events`
    )) {
      yield event as StreamEvent;
    }
  }

  async *stream_assistant_chunks(): AsyncGenerator<AssistantChunkData, void, unknown> {
    for await (const event of this.all_events()) {
      if (event.event_type === StreamEventType.ASSISTANT_CHUNK && event.data instanceof AssistantChunkData) {
        yield event.data;
      }
    }
  }

  async *stream_assistant_final_response(): AsyncGenerator<AssistantCompleteResponseData, void, unknown> {
    for await (const event of this.all_events()) {
      if (
        event.event_type === StreamEventType.ASSISTANT_COMPLETE_RESPONSE &&
        event.data instanceof AssistantCompleteResponseData
      ) {
        yield event.data;
      }
    }
  }

  async *stream_tool_logs(): AsyncGenerator<ToolInteractionLogEntryData, void, unknown> {
    for await (const event of this.all_events()) {
      if (event.event_type === StreamEventType.TOOL_INTERACTION_LOG_ENTRY && event.data instanceof ToolInteractionLogEntryData) {
        yield event.data;
      }
    }
  }

  async *stream_status_updates(): AsyncGenerator<AgentStatusUpdateData, void, unknown> {
    for await (const event of this.all_events()) {
      if (event.event_type === StreamEventType.AGENT_STATUS_UPDATED && event.data instanceof AgentStatusUpdateData) {
        yield event.data;
      }
    }
  }

  async *stream_tool_approval_requests(): AsyncGenerator<ToolInvocationApprovalRequestedData, void, unknown> {
    for await (const event of this.all_events()) {
      if (
        event.event_type === StreamEventType.TOOL_INVOCATION_APPROVAL_REQUESTED &&
        event.data instanceof ToolInvocationApprovalRequestedData
      ) {
        yield event.data;
      }
    }
  }

  async *stream_tool_auto_executing(): AsyncGenerator<ToolInvocationAutoExecutingData, void, unknown> {
    for await (const event of this.all_events()) {
      if (
        event.event_type === StreamEventType.TOOL_INVOCATION_AUTO_EXECUTING &&
        event.data instanceof ToolInvocationAutoExecutingData
      ) {
        yield event.data;
      }
    }
  }

  async *stream_errors(): AsyncGenerator<ErrorEventData, void, unknown> {
    for await (const event of this.all_events()) {
      if (event.event_type === StreamEventType.ERROR_EVENT && event.data instanceof ErrorEventData) {
        yield event.data;
      }
    }
  }

  async *stream_system_task_notifications(): AsyncGenerator<SystemTaskNotificationData, void, unknown> {
    for await (const event of this.all_events()) {
      if (event.event_type === StreamEventType.SYSTEM_TASK_NOTIFICATION && event.data instanceof SystemTaskNotificationData) {
        yield event.data;
      }
    }
  }

  async *stream_inter_agent_messages(): AsyncGenerator<InterAgentMessageData, void, unknown> {
    for await (const event of this.all_events()) {
      if (event.event_type === StreamEventType.INTER_AGENT_MESSAGE && event.data instanceof InterAgentMessageData) {
        yield event.data;
      }
    }
  }

  async *stream_todo_updates(): AsyncGenerator<ToDoListUpdateData, void, unknown> {
    for await (const event of this.all_events()) {
      if (event.event_type === StreamEventType.AGENT_TODO_LIST_UPDATE && event.data instanceof ToDoListUpdateData) {
        yield event.data;
      }
    }
  }

  async *stream_artifact_persisted(): AsyncGenerator<ArtifactPersistedData, void, unknown> {
    for await (const event of this.all_events()) {
      if (event.event_type === StreamEventType.ARTIFACT_PERSISTED && event.data instanceof ArtifactPersistedData) {
        yield event.data;
      }
    }
  }

  async *stream_artifact_updated(): AsyncGenerator<ArtifactUpdatedData, void, unknown> {
    for await (const event of this.all_events()) {
      if (event.event_type === StreamEventType.ARTIFACT_UPDATED && event.data instanceof ArtifactUpdatedData) {
        yield event.data;
      }
    }
  }
}
