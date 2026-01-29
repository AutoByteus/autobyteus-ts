import { EventEmitter } from '../../events/event_emitter.js';
import { EventType } from '../../events/event_types.js';
import { AgentTeamStreamEvent } from './agent_team_stream_events.js';
import { SimpleQueue, streamQueueItems } from '../../agent/streaming/utils/queue_streamer.js';

const ATS_INTERNAL_SENTINEL = {};

export type AgentTeamLike = {
  team_id: string;
  notifier?: EventEmitter | null;
};

export class AgentTeamEventStream {
  team_id: string;
  private internalQueue: SimpleQueue<AgentTeamStreamEvent | object>;
  private notifier: EventEmitter | null;

  constructor(team: AgentTeamLike) {
    if (!team || typeof team !== 'object' || typeof team.team_id !== 'string') {
      throw new TypeError(`AgentTeamEventStream requires a Team-like instance, got ${typeof team}.`);
    }

    this.team_id = team.team_id;
    this.internalQueue = new SimpleQueue<AgentTeamStreamEvent | object>();
    this.notifier = team.notifier ?? null;

    if (!this.notifier) {
      console.error(`AgentTeamEventStream for '${this.team_id}': Notifier not available. No events will be streamed.`);
      return;
    }

    this.notifier.subscribe(EventType.TEAM_STREAM_EVENT, this._handle_event);
  }

  private _handle_event = (payload?: any): void => {
    if (payload instanceof AgentTeamStreamEvent && payload.team_id === this.team_id) {
      this.internalQueue.put(payload);
    }
  };

  async close(): Promise<void> {
    if (this.notifier) {
      this.notifier.unsubscribe(EventType.TEAM_STREAM_EVENT, this._handle_event);
    }
    this.internalQueue.put(ATS_INTERNAL_SENTINEL);
  }

  async *all_events(): AsyncGenerator<AgentTeamStreamEvent, void, unknown> {
    for await (const event of streamQueueItems(
      this.internalQueue,
      ATS_INTERNAL_SENTINEL,
      `team_${this.team_id}_stream`
    )) {
      yield event as AgentTeamStreamEvent;
    }
  }
}
