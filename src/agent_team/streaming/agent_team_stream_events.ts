import { randomUUID } from 'node:crypto';
import { BaseTaskPlanEventSchema } from '../../task_management/events.js';
import {
  AgentTeamStatusUpdateData,
  AgentEventRebroadcastPayload,
  SubTeamEventRebroadcastPayload,
  type TaskPlanEventPayload
} from './agent_team_stream_event_payloads.js';

export {
  AgentTeamStatusUpdateData,
  AgentEventRebroadcastPayload,
  SubTeamEventRebroadcastPayload,
  type TaskPlanEventPayload
} from './agent_team_stream_event_payloads.js';

export type AgentTeamStreamEventSourceType = 'TEAM' | 'AGENT' | 'SUB_TEAM' | 'TASK_PLAN';

export type TeamSpecificPayload = AgentTeamStatusUpdateData;

export type AgentTeamStreamDataPayload =
  | TeamSpecificPayload
  | AgentEventRebroadcastPayload
  | SubTeamEventRebroadcastPayload
  | TaskPlanEventPayload;

const isTaskPlanPayload = (data: unknown): boolean => {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  return BaseTaskPlanEventSchema.safeParse(data).success;
};

export class AgentTeamStreamEvent {
  event_id: string;
  timestamp: Date;
  team_id: string;
  event_source_type: AgentTeamStreamEventSourceType;
  data: AgentTeamStreamDataPayload;

  constructor(options: {
    event_id?: string;
    timestamp?: Date;
    team_id: string;
    event_source_type: AgentTeamStreamEventSourceType;
    data: AgentTeamStreamDataPayload;
  }) {
    this.event_id = options.event_id ?? randomUUID();
    this.timestamp = options.timestamp ?? new Date();
    this.team_id = options.team_id;
    this.event_source_type = options.event_source_type;
    this.data = options.data;

    this.validate_payload();
  }

  private validate_payload(): void {
    const is_agent_event = this.event_source_type === 'AGENT';
    const is_agent_payload = this.data instanceof AgentEventRebroadcastPayload;

    const is_sub_team_event = this.event_source_type === 'SUB_TEAM';
    const is_sub_team_payload = this.data instanceof SubTeamEventRebroadcastPayload;

    const is_team_event = this.event_source_type === 'TEAM';
    const is_team_payload = this.data instanceof AgentTeamStatusUpdateData;

    const is_task_plan_event = this.event_source_type === 'TASK_PLAN';
    const is_task_plan_payload = isTaskPlanPayload(this.data);

    if (is_agent_event && !is_agent_payload) {
      throw new Error("event_source_type is 'AGENT' but data is not an AgentEventRebroadcastPayload");
    }

    if (is_sub_team_event && !is_sub_team_payload) {
      throw new Error("event_source_type is 'SUB_TEAM' but data is not a SubTeamEventRebroadcastPayload");
    }

    if (is_team_event && !is_team_payload) {
      throw new Error("event_source_type is 'TEAM' but data is not a valid team-specific payload");
    }

    if (is_task_plan_event && !is_task_plan_payload) {
      throw new Error("event_source_type is 'TASK_PLAN' but data is not a BaseTaskPlanEvent instance");
    }
  }
}
