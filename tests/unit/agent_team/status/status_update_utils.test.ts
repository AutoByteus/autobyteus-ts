import { describe, it, expect, beforeEach } from 'vitest';
import { applyEventAndDeriveStatus } from '../../../../src/agent_team/status/status_update_utils.js';
import { AgentTeamStatusDeriver } from '../../../../src/agent_team/status/status_deriver.js';
import { AgentTeamStatus } from '../../../../src/agent_team/status/agent_team_status.js';
import { AgentTeamEventStore } from '../../../../src/agent_team/events/event_store.js';
import {
  AgentTeamBootstrapStartedEvent,
  AgentTeamErrorEvent,
  ProcessUserMessageEvent
} from '../../../../src/agent_team/events/agent_team_events.js';
import { AgentInputUserMessage } from '../../../../src/agent/message/agent_input_user_message.js';
import { AgentTeamContext } from '../../../../src/agent_team/context/agent_team_context.js';
import { AgentTeamConfig } from '../../../../src/agent_team/context/agent_team_config.js';
import { AgentTeamRuntimeState } from '../../../../src/agent_team/context/agent_team_runtime_state.js';
import { TeamNodeConfig } from '../../../../src/agent_team/context/team_node_config.js';

const makeContext = (): AgentTeamContext => {
  const node = new TeamNodeConfig({ nodeDefinition: { name: 'Coordinator' } });
  const config = new AgentTeamConfig({
    name: 'Team',
    description: 'desc',
    nodes: [node],
    coordinatorNode: node
  });
  const state = new AgentTeamRuntimeState({ teamId: 'team-1', currentStatus: AgentTeamStatus.UNINITIALIZED });
  return new AgentTeamContext('team-1', config, state);
};

describe('agent_team status_update_utils', () => {
  let agentTeamContext: AgentTeamContext;

  beforeEach(() => {
    agentTeamContext = makeContext();
  });

  it('updates status and appends to store', async () => {
    agentTeamContext.state.statusDeriver = new AgentTeamStatusDeriver(AgentTeamStatus.UNINITIALIZED);
    agentTeamContext.state.eventStore = new AgentTeamEventStore(agentTeamContext.teamId);
    agentTeamContext.currentStatus = AgentTeamStatus.UNINITIALIZED;

    const emitCalls: any[] = [];
    agentTeamContext.state.statusManagerRef = {
      emitStatusUpdate: async (...args: any[]) => {
        emitCalls.push(args);
      }
    } as any;

    const [oldStatus, newStatus] = await applyEventAndDeriveStatus(
      new AgentTeamBootstrapStartedEvent(),
      agentTeamContext
    );

    expect(oldStatus).toBe(AgentTeamStatus.UNINITIALIZED);
    expect(newStatus).toBe(AgentTeamStatus.BOOTSTRAPPING);
    expect(agentTeamContext.currentStatus).toBe(AgentTeamStatus.BOOTSTRAPPING);
    expect(emitCalls).toHaveLength(1);
    expect(agentTeamContext.state.eventStore?.allEvents().length).toBe(1);
  });

  it('includes error payload in status update', async () => {
    agentTeamContext.state.statusDeriver = new AgentTeamStatusDeriver(AgentTeamStatus.IDLE);
    agentTeamContext.state.eventStore = new AgentTeamEventStore(agentTeamContext.teamId);
    agentTeamContext.currentStatus = AgentTeamStatus.IDLE;

    const emitCalls: any[] = [];
    agentTeamContext.state.statusManagerRef = {
      emitStatusUpdate: async (...args: any[]) => {
        emitCalls.push(args);
      }
    } as any;

    await applyEventAndDeriveStatus(
      new AgentTeamErrorEvent('boom', 'trace'),
      agentTeamContext
    );

    expect(emitCalls).toHaveLength(1);
    expect(emitCalls[0][2]).toEqual({ error_message: 'boom' });
  });

  it('sets processing status for operational event', async () => {
    agentTeamContext.state.statusDeriver = new AgentTeamStatusDeriver(AgentTeamStatus.IDLE);
    agentTeamContext.state.eventStore = new AgentTeamEventStore(agentTeamContext.teamId);
    agentTeamContext.currentStatus = AgentTeamStatus.IDLE;

    const emitCalls: any[] = [];
    agentTeamContext.state.statusManagerRef = {
      emitStatusUpdate: async (...args: any[]) => {
        emitCalls.push(args);
      }
    } as any;

    const event = new ProcessUserMessageEvent(
      new AgentInputUserMessage('hi'),
      'Coordinator'
    );

    const [oldStatus, newStatus] = await applyEventAndDeriveStatus(event, agentTeamContext);
    expect(oldStatus).toBe(AgentTeamStatus.IDLE);
    expect(newStatus).toBe(AgentTeamStatus.PROCESSING);
    expect(emitCalls).toHaveLength(1);
  });
});
