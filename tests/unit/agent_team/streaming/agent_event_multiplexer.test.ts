import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../../src/agent_team/streaming/agent_event_bridge.js', () => {
  return {
    AgentEventBridge: vi.fn().mockImplementation(function (this: any, ..._args: any[]) {
      this.cancel = vi.fn(async () => undefined);
    })
  };
});

vi.mock('../../../../src/agent_team/streaming/team_event_bridge.js', () => {
  return {
    TeamEventBridge: vi.fn().mockImplementation(function (this: any, ..._args: any[]) {
      this.cancel = vi.fn(async () => undefined);
    })
  };
});

import { AgentEventMultiplexer } from '../../../../src/agent_team/streaming/agent_event_multiplexer.js';
import { AgentEventBridge } from '../../../../src/agent_team/streaming/agent_event_bridge.js';
import { TeamEventBridge } from '../../../../src/agent_team/streaming/team_event_bridge.js';

const makeMultiplexer = () => {
  const notifier = {} as any;
  const loop = { loop: true };
  const worker = { get_worker_loop: vi.fn(() => loop) } as any;
  const multiplexer = new AgentEventMultiplexer('team-mux-test', notifier, worker);
  return { multiplexer, notifier, worker, loop };
};

describe('AgentEventMultiplexer', () => {
  it('creates and stores agent event bridge', () => {
    const { multiplexer, notifier, loop } = makeMultiplexer();
    const mock_agent = {} as any;
    const agent_name = 'Agent1';

    multiplexer.start_bridging_agent_events(mock_agent, agent_name);

    expect(AgentEventBridge).toHaveBeenCalledWith(mock_agent, agent_name, notifier, loop);
    const bridges = (multiplexer as any).agent_bridges as Map<string, any>;
    expect(bridges.has(agent_name)).toBe(true);
  });

  it('creates and stores team event bridge', () => {
    const { multiplexer, notifier, loop } = makeMultiplexer();
    const mock_team = {} as any;
    const node_name = 'SubTeam1';

    multiplexer.start_bridging_team_events(mock_team, node_name);

    expect(TeamEventBridge).toHaveBeenCalledWith(mock_team, node_name, notifier, loop);
    const bridges = (multiplexer as any).team_bridges as Map<string, any>;
    expect(bridges.has(node_name)).toBe(true);
  });

  it('shutdown cancels all bridges', async () => {
    const { multiplexer } = makeMultiplexer();
    const agent_bridge = { cancel: vi.fn(async () => undefined) };
    const team_bridge = { cancel: vi.fn(async () => undefined) };

    (multiplexer as any).agent_bridges = new Map([['Agent1', agent_bridge]]);
    (multiplexer as any).team_bridges = new Map([['SubTeam1', team_bridge]]);

    await multiplexer.shutdown();

    expect(agent_bridge.cancel).toHaveBeenCalledTimes(1);
    expect(team_bridge.cancel).toHaveBeenCalledTimes(1);
    expect((multiplexer as any).agent_bridges.size).toBe(0);
    expect((multiplexer as any).team_bridges.size).toBe(0);
  });
});
