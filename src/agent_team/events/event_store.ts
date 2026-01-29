import { randomUUID } from 'node:crypto';
import type { BaseAgentTeamEvent } from './agent_team_events.js';

export type EventEnvelope = {
  event_id: string;
  event_type: string;
  timestamp: number;
  team_id: string;
  event: BaseAgentTeamEvent;
  correlation_id?: string | null;
  caused_by_event_id?: string | null;
  sequence: number;
};

export class AgentTeamEventStore {
  private team_id: string;
  private events: EventEnvelope[] = [];
  private sequence = 0;

  constructor(team_id: string) {
    this.team_id = team_id;
    console.debug(`AgentTeamEventStore initialized for team_id '${team_id}'.`);
  }

  append(event: BaseAgentTeamEvent, correlation_id?: string | null, caused_by_event_id?: string | null): EventEnvelope {
    const envelope: EventEnvelope = Object.freeze({
      event_id: randomUUID(),
      event_type: event.constructor.name,
      timestamp: Date.now() / 1000,
      team_id: this.team_id,
      event,
      correlation_id: correlation_id ?? null,
      caused_by_event_id: caused_by_event_id ?? null,
      sequence: this.sequence
    });

    this.sequence += 1;
    this.events.push(envelope);
    console.debug(`Appended event '${envelope.event_type}' to store for team '${this.team_id}'.`);
    return envelope;
  }

  all_events(): EventEnvelope[] {
    return [...this.events];
  }
}
