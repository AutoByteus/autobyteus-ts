import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProcessUserMessageEventHandler } from '../../../../src/agent_team/handlers/process_user_message_event_handler.js';
import { ProcessUserMessageEvent, AgentTeamErrorEvent } from '../../../../src/agent_team/events/agent_team_events.js';
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

describe('ProcessUserMessageEventHandler', () => {
  let handler: ProcessUserMessageEventHandler;
  let agent_team_context: AgentTeamContext;
  let event: ProcessUserMessageEvent;

  beforeEach(() => {
    handler = new ProcessUserMessageEventHandler();
    agent_team_context = makeContext();
    event = new ProcessUserMessageEvent(
      new AgentInputUserMessage('Hello agent team'),
      'Coordinator'
    );
  });

  it('routes user message to agent when node is ready', async () => {
    const mock_agent = { post_user_message: vi.fn(async () => undefined) };
    agent_team_context.state.team_manager = {
      ensure_node_is_ready: vi.fn(async () => mock_agent)
    } as any;

    await handler.handle(event, agent_team_context);

    expect(agent_team_context.state.team_manager?.ensure_node_is_ready).toHaveBeenCalledWith('Coordinator');
    expect(mock_agent.post_user_message).toHaveBeenCalledWith(event.user_message);
    const enqueue = agent_team_context.state.input_event_queues?.enqueue_internal_system_event as any;
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('enqueues error when agent not found', async () => {
    agent_team_context.state.team_manager = {
      ensure_node_is_ready: vi.fn(async () => { throw new Error('Not Found'); })
    } as any;

    await handler.handle(event, agent_team_context);

    const enqueue = agent_team_context.state.input_event_queues?.enqueue_internal_system_event as any;
    expect(enqueue).toHaveBeenCalledTimes(1);
    const enqueued_event = enqueue.mock.calls[0][0];
    expect(enqueued_event).toBeInstanceOf(AgentTeamErrorEvent);
  });
});
