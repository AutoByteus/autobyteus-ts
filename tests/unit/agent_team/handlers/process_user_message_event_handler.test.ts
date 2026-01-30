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

describe('ProcessUserMessageEventHandler', () => {
  let handler: ProcessUserMessageEventHandler;
  let agentTeamContext: AgentTeamContext;
  let event: ProcessUserMessageEvent;

  beforeEach(() => {
    handler = new ProcessUserMessageEventHandler();
    agentTeamContext = makeContext();
    event = new ProcessUserMessageEvent(
      new AgentInputUserMessage('Hello agent team'),
      'Coordinator'
    );
  });

  it('routes user message to agent when node is ready', async () => {
    const mockAgent = { postUserMessage: vi.fn(async () => undefined) };
    agentTeamContext.state.teamManager = {
      ensureNodeIsReady: vi.fn(async () => mockAgent)
    } as any;

    await handler.handle(event, agentTeamContext);

    expect(agentTeamContext.state.teamManager?.ensureNodeIsReady).toHaveBeenCalledWith('Coordinator');
    expect(mockAgent.postUserMessage).toHaveBeenCalledWith(event.userMessage);
    const enqueue = agentTeamContext.state.inputEventQueues?.enqueueInternalSystemEvent as any;
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('enqueues error when agent not found', async () => {
    agentTeamContext.state.teamManager = {
      ensureNodeIsReady: vi.fn(async () => { throw new Error('Not Found'); })
    } as any;

    await handler.handle(event, agentTeamContext);

    const enqueue = agentTeamContext.state.inputEventQueues?.enqueueInternalSystemEvent as any;
    expect(enqueue).toHaveBeenCalledTimes(1);
    const enqueuedEvent = enqueue.mock.calls[0][0];
    expect(enqueuedEvent).toBeInstanceOf(AgentTeamErrorEvent);
  });
});
