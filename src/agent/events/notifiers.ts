import { EventEmitter } from '../../events/event_emitter.js';
import { EventType } from '../../events/event_types.js';
import { AgentStatus } from '../status/status_enum.js';
import type { ChunkResponse, CompleteResponse } from '../../llm/utils/response_types.js';

export class AgentExternalEventNotifier extends EventEmitter {
  agent_id: string;

  constructor(agent_id: string) {
    super();
    this.agent_id = agent_id;
    console.debug(
      `AgentExternalEventNotifier initialized for agent_id '${this.agent_id}' (NotifierID: ${this.object_id}).`
    );
  }

  private emitEvent(eventType: EventType, payloadContent?: any): void {
    const emitKwargs: Record<string, any> = { agent_id: this.agent_id };
    if (payloadContent !== undefined) {
      emitKwargs['payload'] = payloadContent;
    }
    this.emit(eventType, emitKwargs);

    const logMessage =
      `AgentExternalEventNotifier (NotifierID: ${this.object_id}, AgentID: ${this.agent_id}) ` +
      `emitted ${eventType}. Kwarg keys for emit: ${Object.keys(emitKwargs)}`;

    if ([EventType.AGENT_DATA_ASSISTANT_CHUNK, EventType.AGENT_DATA_SEGMENT_EVENT].includes(eventType)) {
      const summary = this.summarizePayload(eventType, payloadContent);
      if (summary) {
        console.debug(`${logMessage} | ${summary}`);
      } else {
        console.debug(logMessage);
      }
    } else {
      console.info(logMessage);
    }
  }

  private summarizePayload(eventType: EventType, payloadContent?: any): string | null {
    if (payloadContent === undefined || payloadContent === null) {
      return null;
    }

    if (eventType === EventType.AGENT_DATA_SEGMENT_EVENT && typeof payloadContent === 'object') {
      const segType = payloadContent.segment_type;
      const segId = payloadContent.segment_id;
      const segEventType = payloadContent.type;
      const payload = payloadContent.payload ?? {};
      const summaryParts = [
        `segment_id=${segId}`,
        `segment_type=${segType}`,
        `event_type=${segEventType}`
      ];
      if (payload && typeof payload === 'object') {
        if ('delta' in payload) {
          const delta = payload.delta ?? '';
          summaryParts.push(`delta_len=${String(delta).length}`);
        }
        if ('metadata' in payload && payload.metadata && typeof payload.metadata === 'object') {
          const metaKeys = Object.keys(payload.metadata);
          if (metaKeys.length) {
            summaryParts.push(`metadata_keys=${metaKeys.join(',')}`);
          }
        }
      }
      return summaryParts.join(' ');
    }

    if (eventType === EventType.AGENT_DATA_ASSISTANT_CHUNK && typeof payloadContent === 'object') {
      const content = payloadContent.content ?? '';
      const reasoning = payloadContent.reasoning ?? '';
      return `content_len=${String(content).length} reasoning_len=${String(reasoning).length}`;
    }

    return null;
  }

  private emitStatusUpdate(
    newStatus: AgentStatus,
    oldStatus?: AgentStatus,
    additionalData?: Record<string, any>
  ): void {
    const statusPayload: Record<string, any> = {
      new_status: newStatus,
      old_status: oldStatus ?? null
    };
    if (additionalData) {
      Object.assign(statusPayload, additionalData);
    }
    this.emitEvent(EventType.AGENT_STATUS_UPDATED, statusPayload);
  }

  notify_status_updated(
    new_status: AgentStatus,
    old_status?: AgentStatus,
    additional_data?: Record<string, any>
  ): void {
    this.emitStatusUpdate(new_status, old_status, additional_data);
  }

  notify_agent_data_assistant_chunk(chunk: ChunkResponse): void {
    this.emitEvent(EventType.AGENT_DATA_ASSISTANT_CHUNK, chunk);
  }

  notify_agent_data_assistant_complete_response(completeResponse: CompleteResponse): void {
    this.emitEvent(EventType.AGENT_DATA_ASSISTANT_COMPLETE_RESPONSE, completeResponse);
  }

  notify_agent_segment_event(eventDict: Record<string, any>): void {
    this.emitEvent(EventType.AGENT_DATA_SEGMENT_EVENT, eventDict);
  }

  notify_agent_data_tool_log(logData: Record<string, any>): void {
    this.emitEvent(EventType.AGENT_DATA_TOOL_LOG, logData);
  }

  notify_agent_data_tool_log_stream_end(): void {
    this.emitEvent(EventType.AGENT_DATA_TOOL_LOG_STREAM_END);
  }

  notify_agent_request_tool_invocation_approval(approvalData: Record<string, any>): void {
    this.emitEvent(EventType.AGENT_REQUEST_TOOL_INVOCATION_APPROVAL, approvalData);
  }

  notify_agent_tool_invocation_auto_executing(autoExecData: Record<string, any>): void {
    this.emitEvent(EventType.AGENT_TOOL_INVOCATION_AUTO_EXECUTING, autoExecData);
  }

  notify_agent_data_system_task_notification_received(notificationData: Record<string, any>): void {
    this.emitEvent(EventType.AGENT_DATA_SYSTEM_TASK_NOTIFICATION_RECEIVED, notificationData);
  }

  notify_agent_data_inter_agent_message_received(messageData: Record<string, any>): void {
    this.emitEvent(EventType.AGENT_DATA_INTER_AGENT_MESSAGE_RECEIVED, messageData);
  }

  notify_agent_data_todo_list_updated(todoList: Array<Record<string, any>>): void {
    this.emitEvent(EventType.AGENT_DATA_TODO_LIST_UPDATED, { todos: todoList });
  }

  notify_agent_error_output_generation(error_source: string, error_message: string, error_details?: string): void {
    const payload = { source: error_source, message: error_message, details: error_details };
    this.emitEvent(EventType.AGENT_ERROR_OUTPUT_GENERATION, payload);
  }

  notify_agent_artifact_persisted(artifactData: Record<string, any>): void {
    this.emitEvent(EventType.AGENT_ARTIFACT_PERSISTED, artifactData);
  }

  notify_agent_artifact_updated(artifactData: Record<string, any>): void {
    this.emitEvent(EventType.AGENT_ARTIFACT_UPDATED, artifactData);
  }
}
