import { EventEmitter } from '../../events/event_emitter.js';
import { EventType } from '../../events/event_types.js';
import { AgentTeamStatus } from '../status/agent_team_status.js';
import { StreamEvent } from '../../agent/streaming/stream_events.js';
import {
  AgentTeamStreamEvent,
  AgentEventRebroadcastPayload,
  AgentTeamStatusUpdateData,
  SubTeamEventRebroadcastPayload
} from './agent_team_stream_events.js';
import type { TaskPlanEventPayload } from './agent_team_stream_events.js';

export class AgentTeamExternalEventNotifier extends EventEmitter {
  team_id: string;
  runtime_ref: unknown;

  constructor(team_id: string, runtime_ref: unknown) {
    super();
    this.team_id = team_id;
    this.runtime_ref = runtime_ref;
    console.debug(`AgentTeamExternalEventNotifier initialized for team '${this.team_id}'.`);
  }

  private emit_event(event: AgentTeamStreamEvent): void {
    this.emit(EventType.TEAM_STREAM_EVENT, { payload: event });
  }

  notify_status_updated(
    new_status: AgentTeamStatus,
    old_status: AgentTeamStatus | null | undefined,
    extra_data?: Record<string, any> | null
  ): void {
    const payload: Record<string, any> = {
      new_status,
      old_status,
      error_message: extra_data?.error_message ?? undefined
    };

    const filtered_payload: Record<string, any> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined && value !== null) {
        filtered_payload[key] = value;
      }
    }

    const event = new AgentTeamStreamEvent({
      team_id: this.team_id,
      event_source_type: 'TEAM',
      data: new AgentTeamStatusUpdateData(filtered_payload)
    });
    this.emit_event(event);
  }

  publish_agent_event(agent_name: string, agent_event: StreamEvent): void {
    const event = new AgentTeamStreamEvent({
      team_id: this.team_id,
      event_source_type: 'AGENT',
      data: new AgentEventRebroadcastPayload({ agent_name, agent_event })
    });
    this.emit_event(event);
  }

  publish_sub_team_event(sub_team_node_name: string, sub_team_event: AgentTeamStreamEvent): void {
    const event = new AgentTeamStreamEvent({
      team_id: this.team_id,
      event_source_type: 'SUB_TEAM',
      data: new SubTeamEventRebroadcastPayload({ sub_team_node_name, sub_team_event })
    });
    this.emit_event(event);
  }

  handle_and_publish_task_plan_event(payload: TaskPlanEventPayload): void {
    const event = new AgentTeamStreamEvent({
      team_id: this.team_id,
      event_source_type: 'TASK_PLAN',
      data: payload
    });
    this.emit_event(event);
  }
}
