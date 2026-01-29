import { describe, it, expect, vi } from 'vitest';
import { SubTeamShutdownStep } from '../../../../src/agent_team/shutdown_steps/sub_team_shutdown_step.js';
import { AgentTeamContext } from '../../../../src/agent_team/context/agent_team_context.js';
import { AgentTeamConfig } from '../../../../src/agent_team/context/agent_team_config.js';
import { TeamNodeConfig } from '../../../../src/agent_team/context/team_node_config.js';
import { AgentTeamRuntimeState } from '../../../../src/agent_team/context/agent_team_runtime_state.js';
import { AgentConfig } from '../../../../src/agent/context/agent_config.js';
import { BaseLLM } from '../../../../src/llm/base.js';
import { LLMModel } from '../../../../src/llm/models.js';
import { LLMProvider } from '../../../../src/llm/providers.js';
import { LLMConfig } from '../../../../src/llm/utils/llm_config.js';
import { CompleteResponse, ChunkResponse } from '../../../../src/llm/utils/response_types.js';
import { LLMUserMessage } from '../../../../src/llm/user_message.js';

class DummyLLM extends BaseLLM {
  protected async _sendUserMessageToLLM(_userMessage: LLMUserMessage): Promise<CompleteResponse> {
    return new CompleteResponse({ content: 'ok' });
  }

  protected async *_streamUserMessageToLLM(_userMessage: LLMUserMessage): AsyncGenerator<ChunkResponse, void, unknown> {
    yield new ChunkResponse({ content: 'ok', is_complete: true });
  }
}

const makeContext = (): AgentTeamContext => {
  const model = new LLMModel({
    name: 'dummy',
    value: 'dummy',
    canonical_name: 'dummy',
    provider: LLMProvider.OPENAI
  });
  const llm = new DummyLLM(model, new LLMConfig());
  const agent = new AgentConfig('Coordinator', 'Coordinator', 'desc', llm);
  const node = new TeamNodeConfig({ node_definition: agent });
  const config = new AgentTeamConfig({
    name: 'Team',
    description: 'desc',
    nodes: [node],
    coordinator_node: node
  });
  const state = new AgentTeamRuntimeState({ team_id: 'team-1' });
  return new AgentTeamContext('team-1', config, state);
};

describe('SubTeamShutdownStep', () => {
  it('succeeds with no team manager', async () => {
    const context = makeContext();
    context.state.team_manager = null;
    const step = new SubTeamShutdownStep();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const success = await step.execute(context);

    expect(success).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('succeeds when there are no running sub-teams', async () => {
    const context = makeContext();
    const teamManager = { get_all_sub_teams: vi.fn(() => []) };
    context.state.team_manager = teamManager as any;
    const step = new SubTeamShutdownStep();

    const success = await step.execute(context);

    expect(success).toBe(true);
    expect(teamManager.get_all_sub_teams).toHaveBeenCalledTimes(1);
  });

  it('stops running sub-teams', async () => {
    const context = makeContext();
    const runningTeam = { name: 'Sub1', is_running: true, stop: vi.fn(async () => undefined) };
    const stoppedTeam = { name: 'Sub2', is_running: false, stop: vi.fn(async () => undefined) };
    const teamManager = { get_all_sub_teams: vi.fn(() => [runningTeam, stoppedTeam]) };
    context.state.team_manager = teamManager as any;
    const step = new SubTeamShutdownStep();

    const success = await step.execute(context);

    expect(success).toBe(true);
    expect(runningTeam.stop).toHaveBeenCalledWith(20.0);
    expect(stoppedTeam.stop).not.toHaveBeenCalled();
  });

  it('reports failure when a sub-team stop rejects', async () => {
    const context = makeContext();
    const failingTeam = {
      name: 'Failing',
      is_running: true,
      stop: vi.fn(async () => {
        throw new Error('boom');
      })
    };
    const teamManager = { get_all_sub_teams: vi.fn(() => [failingTeam]) };
    context.state.team_manager = teamManager as any;
    const step = new SubTeamShutdownStep();

    const success = await step.execute(context);

    expect(success).toBe(false);
    expect(failingTeam.stop).toHaveBeenCalledWith(20.0);
  });
});
