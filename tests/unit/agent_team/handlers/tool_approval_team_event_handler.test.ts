import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolApprovalTeamEventHandler } from '../../../../src/agent_team/handlers/tool_approval_team_event_handler.js';
import { ToolApprovalTeamEvent, AgentTeamErrorEvent } from '../../../../src/agent_team/events/agent_team_events.js';
import { AgentTeamContext } from '../../../../src/agent_team/context/agent_team_context.js';
import { AgentTeamConfig } from '../../../../src/agent_team/context/agent_team_config.js';
import { AgentTeamRuntimeState } from '../../../../src/agent_team/context/agent_team_runtime_state.js';
import { TeamNodeConfig } from '../../../../src/agent_team/context/team_node_config.js';
import { AgentTeamStatus } from '../../../../src/agent_team/status/agent_team_status.js';

const makeContext = (): AgentTeamContext => {
  const node = new TeamNodeConfig({ nodeDefinition: { name: 'Coordinator' } });
  const config = new AgentTeamConfig({
    name: 'Team',
    description: 'desc',
    nodes: [node],
    coordinatorNode: node
  });
  const state = new AgentTeamRuntimeState({ teamId: 'team-1', currentStatus: AgentTeamStatus.IDLE });
  state.inputEventQueues = {
    enqueueInternalSystemEvent: vi.fn(async () => undefined)
  } as any;
  return new AgentTeamContext('team-1', config, state);
};

describe('ToolApprovalTeamEventHandler', () => {
  let handler: ToolApprovalTeamEventHandler;
  let agentTeamContext: AgentTeamContext;
  let event: ToolApprovalTeamEvent;

  beforeEach(() => {
    handler = new ToolApprovalTeamEventHandler();
    agentTeamContext = makeContext();
    event = new ToolApprovalTeamEvent(
      'ApproverAgent',
      'tool-call-123',
      true,
      'User approved'
    );
  });

  it('posts approval to agent', async () => {
    const mockAgent = { postToolExecutionApproval: vi.fn(async () => undefined) };
    agentTeamContext.state.teamManager = {
      ensureNodeIsReady: vi.fn(async () => mockAgent)
    } as any;

    await handler.handle(event, agentTeamContext);

    expect(agentTeamContext.state.teamManager?.ensureNodeIsReady).toHaveBeenCalledWith('ApproverAgent');
    expect(mockAgent.postToolExecutionApproval).toHaveBeenCalledWith(
      event.toolInvocationId,
      event.isApproved,
      event.reason
    );
  });

  it('enqueues error when target agent not found', async () => {
    agentTeamContext.state.teamManager = {
      ensureNodeIsReady: vi.fn(async () => null)
    } as any;

    await handler.handle(event, agentTeamContext);

    const enqueue = agentTeamContext.state.inputEventQueues?.enqueueInternalSystemEvent as any;
    expect(enqueue).toHaveBeenCalledTimes(1);
    const enqueuedEvent = enqueue.mock.calls[0][0];
    expect(enqueuedEvent).toBeInstanceOf(AgentTeamErrorEvent);
  });
});
