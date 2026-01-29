import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentTeamStatusManager } from '../../../../src/agent_team/status/agent_team_status_manager.js';
import { AgentTeamStatus } from '../../../../src/agent_team/status/agent_team_status.js';
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

describe('AgentTeamStatusManager', () => {
  let agent_team_context: AgentTeamContext;

  beforeEach(() => {
    agent_team_context = makeContext();
  });

  it('emits status updates through notifier', async () => {
    const notifier = { notify_status_updated: vi.fn() } as any;
    const manager = new AgentTeamStatusManager(agent_team_context, notifier);

    await manager.emit_status_update(AgentTeamStatus.UNINITIALIZED, AgentTeamStatus.BOOTSTRAPPING);

    expect(notifier.notify_status_updated).toHaveBeenCalledOnce();
    expect(notifier.notify_status_updated).toHaveBeenCalledWith(
      AgentTeamStatus.BOOTSTRAPPING,
      AgentTeamStatus.UNINITIALIZED,
      null
    );
  });

  it('does not notify when status unchanged', async () => {
    const notifier = { notify_status_updated: vi.fn() } as any;
    const manager = new AgentTeamStatusManager(agent_team_context, notifier);

    await manager.emit_status_update(AgentTeamStatus.IDLE, AgentTeamStatus.IDLE);

    expect(notifier.notify_status_updated).not.toHaveBeenCalled();
  });

  it('passes additional payload to notifier', async () => {
    const notifier = { notify_status_updated: vi.fn() } as any;
    const manager = new AgentTeamStatusManager(agent_team_context, notifier);

    await manager.emit_status_update(
      AgentTeamStatus.IDLE,
      AgentTeamStatus.ERROR,
      { error_message: 'boom' }
    );

    expect(notifier.notify_status_updated).toHaveBeenCalledWith(
      AgentTeamStatus.ERROR,
      AgentTeamStatus.IDLE,
      { error_message: 'boom' }
    );
  });

  it('requires a notifier', () => {
    expect(() => new AgentTeamStatusManager(agent_team_context, null as any)).toThrow(
      'AgentTeamStatusManager requires a notifier.'
    );
  });
});
