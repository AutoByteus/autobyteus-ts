import { describe, it, expect } from 'vitest';
import { TeamManifestInjectionStep } from '../../../../src/agent_team/bootstrap_steps/team_manifest_injection_step.js';
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

const makeAgentConfig = (name: string): AgentConfig => {
  const model = new LLMModel({
    name: 'dummy',
    value: 'dummy',
    canonical_name: 'dummy',
    provider: LLMProvider.OPENAI
  });
  const llm = new DummyLLM(model, new LLMConfig());
  return new AgentConfig(name, name, `${name} description`, llm);
};

const rebuildContextWithConfig = (context: AgentTeamContext, newConfig: AgentTeamConfig) => {
  context.config = newConfig;
  (context as any).node_config_map = null;
};

const makeContext = (): AgentTeamContext => {
  const node = new TeamNodeConfig({ node_definition: makeAgentConfig('Coordinator') });
  const config = new AgentTeamConfig({
    name: 'Team',
    description: 'desc',
    nodes: [node],
    coordinator_node: node
  });
  const state = new AgentTeamRuntimeState({ team_id: 'team-1' });
  return new AgentTeamContext('team-1', config, state);
};

describe('TeamManifestInjectionStep', () => {
  it('injects manifest for each agent', async () => {
    const step = new TeamManifestInjectionStep();
    const context = makeContext();

    const coordinator_def = makeAgentConfig('Coordinator');
    coordinator_def.system_prompt = 'Team Manifest:\n{{team}}';

    const member_def = makeAgentConfig('Member');
    member_def.system_prompt = 'Known team:\n{{team}}';
    member_def.description = 'This is the member agent.';

    const coordinator_node = new TeamNodeConfig({ node_definition: coordinator_def });
    const member_node = new TeamNodeConfig({ node_definition: member_def });

    const new_team_config = new AgentTeamConfig({
      name: 'Team',
      description: 'desc',
      nodes: [coordinator_node, member_node],
      coordinator_node: coordinator_node
    });
    rebuildContextWithConfig(context, new_team_config);

    const success = await step.execute(context);

    expect(success).toBe(true);
    const prompts = context.state.prepared_agent_prompts;
    expect(prompts[coordinator_node.name]).toBe(
      'Team Manifest:\n- name: Member\n  description: This is the member agent.'
    );
    const expectedMemberView = `Known team:\n- name: Coordinator\n  description: ${coordinator_def.description}`;
    expect(prompts[member_node.name]).toBe(expectedMemberView);
  });

  it('handles solo agent', async () => {
    const step = new TeamManifestInjectionStep();
    const context = makeContext();

    const coordinator_def = makeAgentConfig('Solo');
    coordinator_def.system_prompt = 'My Team: {{team}}';
    const coordinator_node = new TeamNodeConfig({ node_definition: coordinator_def });

    const solo_config = new AgentTeamConfig({
      name: 'Solo Team',
      nodes: [coordinator_node],
      coordinator_node: coordinator_node,
      description: 'Solo agent team'
    });
    rebuildContextWithConfig(context, solo_config);

    const success = await step.execute(context);

    expect(success).toBe(true);
    const prompts = context.state.prepared_agent_prompts;
    expect(prompts['Solo']).toBe(
      'My Team: You are working alone. You have no team members to delegate to.'
    );
  });

  it('injects manifest even when {{team}} is missing', async () => {
    const step = new TeamManifestInjectionStep();
    const context = makeContext();

    const coordinator_def = makeAgentConfig('Coordinator');
    coordinator_def.system_prompt = 'Intro\\n\\n### Your Team\\nThese are your peers.';

    const member_def = makeAgentConfig('Member');
    member_def.system_prompt = 'Intro\\n\\n### Your Team\\nThese are your peers.';
    member_def.description = 'Member description.';

    const coordinator_node = new TeamNodeConfig({ node_definition: coordinator_def });
    const member_node = new TeamNodeConfig({ node_definition: member_def });

    const new_team_config = new AgentTeamConfig({
      name: 'Team',
      description: 'desc',
      nodes: [coordinator_node, member_node],
      coordinator_node: coordinator_node
    });
    rebuildContextWithConfig(context, new_team_config);

    const success = await step.execute(context);

    expect(success).toBe(true);
    const prompts = context.state.prepared_agent_prompts;
    expect(prompts[coordinator_node.name]).toContain('### Your Team');
    expect(prompts[coordinator_node.name]).toContain('- name: Member');
    expect(prompts[member_node.name]).toContain('- name: Coordinator');
  });

  it('returns false when manifest generation fails', async () => {
    const step = new TeamManifestInjectionStep();
    const context = makeContext();

    const coordinator_def = makeAgentConfig('Coordinator');
    coordinator_def.system_prompt = '{{team}}';
    const coordinator_node = new TeamNodeConfig({ node_definition: coordinator_def });
    const new_config = new AgentTeamConfig({
      name: 'FailTeam',
      description: 'Desc',
      nodes: [coordinator_node],
      coordinator_node
    });
    rebuildContextWithConfig(context, new_config);

    (step as any).generate_team_manifest = () => {
      throw new Error('Synthetic error');
    };

    const success = await step.execute(context);

    expect(success).toBe(false);
    expect(context.state.prepared_agent_prompts).toEqual({});
  });
});
