import { describe, it, expect } from 'vitest';
import { AgentEventStore } from '../../../../src/agent/events/event_store.js';
import { AgentReadyEvent } from '../../../../src/agent/events/agent_events.js';

describe('AgentEventStore', () => {
  it('creates envelopes and increments sequence', () => {
    const store = new AgentEventStore('agent-123');
    const event = new AgentReadyEvent();

    const envelope = store.append(event, 'corr-1', 'cause-0');

    expect(envelope.event).toBe(event);
    expect(envelope.event_type).toBe('AgentReadyEvent');
    expect(envelope.agent_id).toBe('agent-123');
    expect(envelope.correlation_id).toBe('corr-1');
    expect(envelope.caused_by_event_id).toBe('cause-0');
    expect(envelope.sequence).toBe(0);
    expect(typeof envelope.timestamp).toBe('number');

    const second = store.append(new AgentReadyEvent());
    expect(second.sequence).toBe(1);
  });

  it('returns a copy of events', () => {
    const store = new AgentEventStore('agent-xyz');
    store.append(new AgentReadyEvent());
    store.append(new AgentReadyEvent());

    const events = store.all_events();
    expect(events).toHaveLength(2);

    events.length = 0;
    expect(store.all_events()).toHaveLength(2);
  });
});
