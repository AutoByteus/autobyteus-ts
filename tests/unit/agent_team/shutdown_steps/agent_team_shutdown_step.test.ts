import { describe, it, expect, vi } from 'vitest';
import { AgentTeamShutdownStep } from '../../../../src/agent_team/shutdown_steps/agent_team_shutdown_step.js';
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

describe('AgentTeamShutdownStep', () => {
  it('succeeds with no team manager', async () => {
    const context = makeContext();
    context.state.team_manager = null;
    const step = new AgentTeamShutdownStep();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const success = await step.execute(context);

    expect(success).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('succeeds when there are no running agents', async () => {
    const context = makeContext();
    const teamManager = { get_all_agents: vi.fn(() => []) };
    context.state.team_manager = teamManager as any;
    const step = new AgentTeamShutdownStep();
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    const success = await step.execute(context);

    expect(success).toBe(true);
    expect(teamManager.get_all_agents).toHaveBeenCalledTimes(1);
    expect(infoSpy.mock.calls.some((call) => String(call[0]).includes('No running agents'))).toBe(true);
    infoSpy.mockRestore();
  });

  it('stops running agents', async () => {
    const context = makeContext();
    const runningAgent = { agent_id: 'running', is_running: true, stop: vi.fn(async () => undefined) };
    const stoppedAgent = { agent_id: 'stopped', is_running: false, stop: vi.fn(async () => undefined) };
    const teamManager = { get_all_agents: vi.fn(() => [runningAgent, stoppedAgent]) };
    context.state.team_manager = teamManager as any;
    const step = new AgentTeamShutdownStep();

    const success = await step.execute(context);

    expect(success).toBe(true);
    expect(runningAgent.stop).toHaveBeenCalledWith(10.0);
    expect(stoppedAgent.stop).not.toHaveBeenCalled();
  });

  it('reports failure when an agent stop rejects', async () => {
    const context = makeContext();
    const agentOk = { agent_id: 'agent_ok', is_running: true, stop: vi.fn(async () => undefined) };
    const agentFail = {
      agent_id: 'agent_fail',
      is_running: true,
      stop: vi.fn(async () => {
        throw new Error('Stop failed');
      })
    };
    const teamManager = { get_all_agents: vi.fn(() => [agentOk, agentFail]) };
    context.state.team_manager = teamManager as any;
    const step = new AgentTeamShutdownStep();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const success = await step.execute(context);

    expect(success).toBe(false);
    expect(agentOk.stop).toHaveBeenCalledWith(10.0);
    expect(agentFail.stop).toHaveBeenCalledWith(10.0);
    expect(errorSpy.mock.calls.some((call) => String(call[0]).includes("agent_fail"))).toBe(true);
    errorSpy.mockRestore();
  });
});
