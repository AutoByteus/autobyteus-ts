import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentTeamEventDispatcher } from '../../../../src/agent_team/events/agent_team_event_dispatcher.js';
import {
  BaseAgentTeamEvent,
  ProcessUserMessageEvent,
  AgentTeamIdleEvent,
  AgentTeamErrorEvent
} from '../../../../src/agent_team/events/agent_team_events.js';
import { AgentInputUserMessage } from '../../../../src/agent/message/agent_input_user_message.js';
import { AgentTeamContext } from '../../../../src/agent_team/context/agent_team_context.js';
import { AgentTeamConfig } from '../../../../src/agent_team/context/agent_team_config.js';
import { AgentTeamRuntimeState } from '../../../../src/agent_team/context/agent_team_runtime_state.js';
import { TeamNodeConfig } from '../../../../src/agent_team/context/team_node_config.js';
import { AgentTeamStatus } from '../../../../src/agent_team/status/agent_team_status.js';

const makeContext = (): AgentTeamContext => {
  const node = new TeamNodeConfig({ node_definition: { name: 'Coordinator' } });
  const config = new AgentTeamConfig({
    name: 'Team',
    description: 'desc',
    nodes: [node],
    coordinator_node: node
  });
  const state = new AgentTeamRuntimeState({ team_id: 'team-1', current_status: AgentTeamStatus.IDLE });
  state.input_event_queues = {
    enqueue_internal_system_event: vi.fn(async () => undefined)
  } as any;
  return new AgentTeamContext('team-1', config, state);
};

describe('AgentTeamEventDispatcher', () => {
  let agent_team_context: AgentTeamContext;

  beforeEach(() => {
    agent_team_context = makeContext();
  });

  it('logs warning when no handler registered', async () => {
    const registry = { get_handler: () => undefined } as any;
    const dispatcher = new AgentTeamEventDispatcher(registry);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await dispatcher.dispatch(new BaseAgentTeamEvent(), agent_team_context);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('dispatches operational event and enqueues idle', async () => {
    const handler = { handle: vi.fn(async () => undefined) };
    const registry = { get_handler: () => handler } as any;
    const dispatcher = new AgentTeamEventDispatcher(registry);

    const event = new ProcessUserMessageEvent(
      new AgentInputUserMessage('hi'),
      'Coordinator'
    );

    await dispatcher.dispatch(event, agent_team_context);

    expect(handler.handle).toHaveBeenCalledWith(event, agent_team_context);
    const enqueue = agent_team_context.state.input_event_queues?.enqueue_internal_system_event as any;
    expect(enqueue).toHaveBeenCalledTimes(1);
    const enqueued_event = enqueue.mock.calls[0][0];
    expect(enqueued_event).toBeInstanceOf(AgentTeamIdleEvent);
  });

  it('enqueues error event when handler throws', async () => {
    const handler = { handle: vi.fn(async () => { throw new Error('boom'); }) };
    const registry = { get_handler: () => handler } as any;
    const dispatcher = new AgentTeamEventDispatcher(registry);

    await dispatcher.dispatch(new BaseAgentTeamEvent(), agent_team_context);

    const enqueue = agent_team_context.state.input_event_queues?.enqueue_internal_system_event as any;
    expect(enqueue).toHaveBeenCalledTimes(1);
    const enqueued_event = enqueue.mock.calls[0][0];
    expect(enqueued_event).toBeInstanceOf(AgentTeamErrorEvent);
  });
});
