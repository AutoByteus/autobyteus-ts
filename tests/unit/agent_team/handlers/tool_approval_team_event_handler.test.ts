import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolApprovalTeamEventHandler } from '../../../../src/agent_team/handlers/tool_approval_team_event_handler.js';
import { ToolApprovalTeamEvent, AgentTeamErrorEvent } from '../../../../src/agent_team/events/agent_team_events.js';
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

describe('ToolApprovalTeamEventHandler', () => {
  let handler: ToolApprovalTeamEventHandler;
  let agent_team_context: AgentTeamContext;
  let event: ToolApprovalTeamEvent;

  beforeEach(() => {
    handler = new ToolApprovalTeamEventHandler();
    agent_team_context = makeContext();
    event = new ToolApprovalTeamEvent(
      'ApproverAgent',
      'tool-call-123',
      true,
      'User approved'
    );
  });

  it('posts approval to agent', async () => {
    const mock_agent = { post_tool_execution_approval: vi.fn(async () => undefined) };
    agent_team_context.state.team_manager = {
      ensure_node_is_ready: vi.fn(async () => mock_agent)
    } as any;

    await handler.handle(event, agent_team_context);

    expect(agent_team_context.state.team_manager?.ensure_node_is_ready).toHaveBeenCalledWith('ApproverAgent');
    expect(mock_agent.post_tool_execution_approval).toHaveBeenCalledWith(
      event.tool_invocation_id,
      event.is_approved,
      event.reason
    );
  });

  it('enqueues error when target agent not found', async () => {
    agent_team_context.state.team_manager = {
      ensure_node_is_ready: vi.fn(async () => null)
    } as any;

    await handler.handle(event, agent_team_context);

    const enqueue = agent_team_context.state.input_event_queues?.enqueue_internal_system_event as any;
    expect(enqueue).toHaveBeenCalledTimes(1);
    const enqueued_event = enqueue.mock.calls[0][0];
    expect(enqueued_event).toBeInstanceOf(AgentTeamErrorEvent);
  });
});
