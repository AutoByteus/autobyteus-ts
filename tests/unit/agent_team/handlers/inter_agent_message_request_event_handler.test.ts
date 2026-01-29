import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InterAgentMessageRequestEventHandler } from '../../../../src/agent_team/handlers/inter_agent_message_request_event_handler.js';
import { InterAgentMessageRequestEvent, AgentTeamErrorEvent } from '../../../../src/agent_team/events/agent_team_events.js';
import { AgentTeamContext } from '../../../../src/agent_team/context/agent_team_context.js';
import { AgentTeamConfig } from '../../../../src/agent_team/context/agent_team_config.js';
import { AgentTeamRuntimeState } from '../../../../src/agent_team/context/agent_team_runtime_state.js';
import { TeamNodeConfig } from '../../../../src/agent_team/context/team_node_config.js';
import { AgentTeamStatus } from '../../../../src/agent_team/status/agent_team_status.js';
import { InterAgentMessage } from '../../../../src/agent/message/inter_agent_message.js';
import { AgentInputUserMessage } from '../../../../src/agent/message/agent_input_user_message.js';

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

describe('InterAgentMessageRequestEventHandler', () => {
  let handler: InterAgentMessageRequestEventHandler;
  let agent_team_context: AgentTeamContext;
  let event: InterAgentMessageRequestEvent;

  beforeEach(() => {
    handler = new InterAgentMessageRequestEventHandler();
    agent_team_context = makeContext();
    event = new InterAgentMessageRequestEvent(
      'sender_agent_id_123',
      'Recipient',
      'Do the thing',
      'TASK_ASSIGNMENT'
    );
  });

  it('posts inter-agent message to recipient agent', async () => {
    const mock_agent = {
      agent_id: 'agent-1',
      context: { config: { role: 'RecipientRole' } },
      post_inter_agent_message: vi.fn(async () => undefined)
    };
    agent_team_context.state.team_manager = {
      ensure_node_is_ready: vi.fn(async () => mock_agent)
    } as any;

    await handler.handle(event, agent_team_context);

    expect(agent_team_context.state.team_manager?.ensure_node_is_ready).toHaveBeenCalledWith('Recipient');
    expect(mock_agent.post_inter_agent_message).toHaveBeenCalledTimes(1);
    const posted_message = (mock_agent.post_inter_agent_message as any).mock.calls[0][0];
    expect(posted_message).toBeInstanceOf(InterAgentMessage);
    expect(posted_message.content).toBe(event.content);
    expect(posted_message.sender_agent_id).toBe(event.sender_agent_id);
    const enqueue = agent_team_context.state.input_event_queues?.enqueue_internal_system_event as any;
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('posts user message to sub-team recipient', async () => {
    const mock_sub_team = {
      post_message: vi.fn(async () => undefined)
    };
    agent_team_context.state.team_manager = {
      ensure_node_is_ready: vi.fn(async () => mock_sub_team)
    } as any;

    await handler.handle(event, agent_team_context);

    expect(agent_team_context.state.team_manager?.ensure_node_is_ready).toHaveBeenCalledWith('Recipient');
    expect(mock_sub_team.post_message).toHaveBeenCalledTimes(1);
    const posted_message = (mock_sub_team.post_message as any).mock.calls[0][0];
    expect(posted_message).toBeInstanceOf(AgentInputUserMessage);
    expect(posted_message.content).toBe(event.content);
  });

  it('enqueues error when recipient not found or failed to start', async () => {
    agent_team_context.state.team_manager = {
      ensure_node_is_ready: vi.fn(async () => { throw new Error('Test Failure'); })
    } as any;

    await handler.handle(event, agent_team_context);

    const enqueue = agent_team_context.state.input_event_queues?.enqueue_internal_system_event as any;
    expect(enqueue).toHaveBeenCalledTimes(1);
    const enqueued_event = enqueue.mock.calls[0][0];
    expect(enqueued_event).toBeInstanceOf(AgentTeamErrorEvent);
  });
});
