import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentTeamStatusManager } from '../../../../src/agent_team/status/agent_team_status_manager.js';
import { AgentTeamStatus } from '../../../../src/agent_team/status/agent_team_status.js';
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

describe('AgentTeamStatusManager', () => {
  let agentTeamContext: AgentTeamContext;

  beforeEach(() => {
    agentTeamContext = makeContext();
  });

  it('emits status updates through notifier', async () => {
    const notifier = { notifyStatusUpdated: vi.fn() } as any;
    const manager = new AgentTeamStatusManager(agentTeamContext, notifier);

    await manager.emitStatusUpdate(AgentTeamStatus.UNINITIALIZED, AgentTeamStatus.BOOTSTRAPPING);

    expect(notifier.notifyStatusUpdated).toHaveBeenCalledOnce();
    expect(notifier.notifyStatusUpdated).toHaveBeenCalledWith(
      AgentTeamStatus.BOOTSTRAPPING,
      AgentTeamStatus.UNINITIALIZED,
      null
    );
  });

  it('does not notify when status unchanged', async () => {
    const notifier = { notifyStatusUpdated: vi.fn() } as any;
    const manager = new AgentTeamStatusManager(agentTeamContext, notifier);

    await manager.emitStatusUpdate(AgentTeamStatus.IDLE, AgentTeamStatus.IDLE);

    expect(notifier.notifyStatusUpdated).not.toHaveBeenCalled();
  });

  it('passes additional payload to notifier', async () => {
    const notifier = { notifyStatusUpdated: vi.fn() } as any;
    const manager = new AgentTeamStatusManager(agentTeamContext, notifier);

    await manager.emitStatusUpdate(
      AgentTeamStatus.IDLE,
      AgentTeamStatus.ERROR,
      { error_message: 'boom' }
    );

    expect(notifier.notifyStatusUpdated).toHaveBeenCalledWith(
      AgentTeamStatus.ERROR,
      AgentTeamStatus.IDLE,
      { error_message: 'boom' }
    );
  });

  it('requires a notifier', () => {
    expect(() => new AgentTeamStatusManager(agentTeamContext, null as any)).toThrow(
      'AgentTeamStatusManager requires a notifier.'
    );
  });
});
