import { describe, it, expect, beforeEach } from 'vitest';
import { apply_event_and_derive_status } from '../../../../src/agent_team/status/status_update_utils.js';
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
  const node = new TeamNodeConfig({ node_definition: { name: 'Coordinator' } });
  const config = new AgentTeamConfig({
    name: 'Team',
    description: 'desc',
    nodes: [node],
    coordinator_node: node
  });
  const state = new AgentTeamRuntimeState({ team_id: 'team-1', current_status: AgentTeamStatus.UNINITIALIZED });
  return new AgentTeamContext('team-1', config, state);
};

describe('agent_team status_update_utils', () => {
  let agent_team_context: AgentTeamContext;

  beforeEach(() => {
    agent_team_context = makeContext();
  });

  it('updates status and appends to store', async () => {
    agent_team_context.state.status_deriver = new AgentTeamStatusDeriver(AgentTeamStatus.UNINITIALIZED);
    agent_team_context.state.event_store = new AgentTeamEventStore(agent_team_context.team_id);
    agent_team_context.current_status = AgentTeamStatus.UNINITIALIZED;

    const emitCalls: any[] = [];
    agent_team_context.state.status_manager_ref = {
      emit_status_update: async (...args: any[]) => {
        emitCalls.push(args);
      }
    } as any;

    const [oldStatus, newStatus] = await apply_event_and_derive_status(
      new AgentTeamBootstrapStartedEvent(),
      agent_team_context
    );

    expect(oldStatus).toBe(AgentTeamStatus.UNINITIALIZED);
    expect(newStatus).toBe(AgentTeamStatus.BOOTSTRAPPING);
    expect(agent_team_context.current_status).toBe(AgentTeamStatus.BOOTSTRAPPING);
    expect(emitCalls).toHaveLength(1);
    expect(agent_team_context.state.event_store?.all_events().length).toBe(1);
  });

  it('includes error payload in status update', async () => {
    agent_team_context.state.status_deriver = new AgentTeamStatusDeriver(AgentTeamStatus.IDLE);
    agent_team_context.state.event_store = new AgentTeamEventStore(agent_team_context.team_id);
    agent_team_context.current_status = AgentTeamStatus.IDLE;

    const emitCalls: any[] = [];
    agent_team_context.state.status_manager_ref = {
      emit_status_update: async (...args: any[]) => {
        emitCalls.push(args);
      }
    } as any;

    await apply_event_and_derive_status(
      new AgentTeamErrorEvent('boom', 'trace'),
      agent_team_context
    );

    expect(emitCalls).toHaveLength(1);
    expect(emitCalls[0][2]).toEqual({ error_message: 'boom' });
  });

  it('sets processing status for operational event', async () => {
    agent_team_context.state.status_deriver = new AgentTeamStatusDeriver(AgentTeamStatus.IDLE);
    agent_team_context.state.event_store = new AgentTeamEventStore(agent_team_context.team_id);
    agent_team_context.current_status = AgentTeamStatus.IDLE;

    const emitCalls: any[] = [];
    agent_team_context.state.status_manager_ref = {
      emit_status_update: async (...args: any[]) => {
        emitCalls.push(args);
      }
    } as any;

    const event = new ProcessUserMessageEvent(
      new AgentInputUserMessage('hi'),
      'Coordinator'
    );

    const [oldStatus, newStatus] = await apply_event_and_derive_status(event, agent_team_context);
    expect(oldStatus).toBe(AgentTeamStatus.IDLE);
    expect(newStatus).toBe(AgentTeamStatus.PROCESSING);
    expect(emitCalls).toHaveLength(1);
  });
});
