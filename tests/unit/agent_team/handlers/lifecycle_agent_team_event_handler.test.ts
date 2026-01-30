import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LifecycleAgentTeamEventHandler } from '../../../../src/agent_team/handlers/lifecycle_agent_team_event_handler.js';
import { AgentTeamReadyEvent, AgentTeamErrorEvent } from '../../../../src/agent_team/events/agent_team_events.js';
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
  return new AgentTeamContext('team-1', config, state);
};

describe('LifecycleAgentTeamEventHandler', () => {
  let handler: LifecycleAgentTeamEventHandler;
  let agentTeamContext: AgentTeamContext;

  beforeEach(() => {
    handler = new LifecycleAgentTeamEventHandler();
    agentTeamContext = makeContext();
  });

  it('logs ready event', async () => {
    const event = new AgentTeamReadyEvent();
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    await handler.handle(event, agentTeamContext);

    expect(infoSpy).toHaveBeenCalled();
    const message = infoSpy.mock.calls[0][0] as string;
    expect(message).toContain(`Team '${agentTeamContext.teamId}' Logged AgentTeamReadyEvent`);

    infoSpy.mockRestore();
  });

  it('logs error event with details', async () => {
    const event = new AgentTeamErrorEvent('A critical error', 'Traceback...');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await handler.handle(event, agentTeamContext);

    expect(errorSpy).toHaveBeenCalled();
    const message = errorSpy.mock.calls[0][0] as string;
    expect(message).toContain(`Team '${agentTeamContext.teamId}' Logged AgentTeamErrorEvent: A critical error.`);
    expect(message).toContain('Details: Traceback...');

    errorSpy.mockRestore();
  });
});
