import { describe, it, expect, vi } from 'vitest';
import { TeamEventBridge } from '../../../../src/agent_team/streaming/team_event_bridge.js';
import { AgentTeamStreamEvent } from '../../../../src/agent_team/streaming/agent_team_stream_events.js';
import { AgentTeamStatusUpdateData } from '../../../../src/agent_team/streaming/agent_team_stream_events.js';
import { AgentTeamStatus } from '../../../../src/agent_team/status/agent_team_status.js';

const SENTINEL = Symbol('sentinel');

class MockTeamEventStream {
  queue: Array<AgentTeamStreamEvent | typeof SENTINEL> = [];
  waiters: Array<(value: AgentTeamStreamEvent | typeof SENTINEL) => void> = [];
  close = vi.fn(async () => {
    this.put(SENTINEL);
  });

  put(item: AgentTeamStreamEvent | typeof SENTINEL): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(item);
      return;
    }
    this.queue.push(item);
  }

  private get(): Promise<AgentTeamStreamEvent | typeof SENTINEL> {
    const item = this.queue.shift();
    if (item !== undefined) {
      return Promise.resolve(item);
    }
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  async *all_events(): AsyncGenerator<AgentTeamStreamEvent, void, unknown> {
    while (true) {
      const item = await this.get();
      if (item === SENTINEL) {
        break;
      }
      yield item as AgentTeamStreamEvent;
    }
  }
}

describe('TeamEventBridge', () => {
  it('forwards sub-team events to parent notifier', async () => {
    const notifier = { publish_sub_team_event: vi.fn() } as any;
    const stream = new MockTeamEventStream();

    const bridge = new TeamEventBridge(
      { team_id: 'sub-team-1' } as any,
      'SubTeam',
      notifier,
      { stream } as any
    );

    const event1 = new AgentTeamStreamEvent({
      team_id: 'sub-team-1',
      event_source_type: 'TEAM',
      data: new AgentTeamStatusUpdateData({ new_status: AgentTeamStatus.IDLE })
    });
    const event2 = new AgentTeamStreamEvent({
      team_id: 'sub-team-1',
      event_source_type: 'TEAM',
      data: new AgentTeamStatusUpdateData({ new_status: AgentTeamStatus.PROCESSING })
    });

    stream.put(event1);
    stream.put(event2);

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(notifier.publish_sub_team_event).toHaveBeenCalledTimes(2);
    expect(notifier.publish_sub_team_event).toHaveBeenCalledWith('SubTeam', event1);
    expect(notifier.publish_sub_team_event).toHaveBeenCalledWith('SubTeam', event2);

    await bridge.cancel();
    expect(stream.close).toHaveBeenCalledTimes(1);
  });
});
