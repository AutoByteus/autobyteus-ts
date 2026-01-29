import { describe, it, expect } from 'vitest';
import { AgentConfigurationPreparationStep } from '../../../../src/agent_team/bootstrap_steps/agent_configuration_preparation_step.js';
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
import { CreateTasks } from '../../../../src/task_management/tools/task_tools/create_tasks.js';
import { SendMessageTo } from '../../../../src/agent/message/send_message_to.js';

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
  state.team_manager = { team_id: 'team-1' } as any;
  return new AgentTeamContext('team-1', config, state);
};

describe('AgentConfigurationPreparationStep', () => {
  it('prepares final configs and preserves tools', async () => {
    const step = new AgentConfigurationPreparationStep();
    const context = makeContext();

    const coordinator_def = makeAgentConfig('Coordinator');
    coordinator_def.tools = [new CreateTasks(), new SendMessageTo()];

    const member_def = makeAgentConfig('Member');
    member_def.tools = [];

    const coordinator_node = new TeamNodeConfig({ node_definition: coordinator_def });
    const member_node = new TeamNodeConfig({ node_definition: member_def });

    const sub_team_coordinator = new TeamNodeConfig({ node_definition: makeAgentConfig('SubCoord') });
    const sub_team_node = new TeamNodeConfig({
      node_definition: new AgentTeamConfig({
        name: 'SubTeam',
        description: 'sub team',
        nodes: [sub_team_coordinator],
        coordinator_node: sub_team_coordinator
      })
    });

    const new_team_config = new AgentTeamConfig({
      name: 'TestTeamWithExplicitTools',
      description: 'A test team',
      nodes: [coordinator_node, member_node, sub_team_node],
      coordinator_node: coordinator_node
    });
    rebuildContextWithConfig(context, new_team_config);

    context.state.prepared_agent_prompts = {
      [coordinator_node.name]: 'This is the special coordinator prompt.',
      [member_node.name]: 'Member prompt'
    };

    const success = await step.execute(context);

    expect(success).toBe(true);

    const final_configs = context.state.final_agent_configs;
    expect(Object.keys(final_configs).length).toBe(2);

    const coord_config = final_configs[coordinator_node.name];
    expect(coord_config).toBeInstanceOf(AgentConfig);
    const coord_tool_names = coord_config.tools.map((tool: any) => tool.constructor.getName());
    expect(coord_tool_names).toContain(CreateTasks.getName());
    expect(coord_tool_names).toContain(SendMessageTo.getName());
    expect(coord_tool_names.length).toBe(2);
    expect(coord_config.system_prompt).toBe(context.state.prepared_agent_prompts[coordinator_node.name]);
    expect(coord_config.initial_custom_data?.team_context).toBe(context);

    const member_config = final_configs[member_node.name];
    expect(member_config).toBeInstanceOf(AgentConfig);
    expect(member_config.tools.length).toBe(0);
    expect(member_config.system_prompt).toBe(context.state.prepared_agent_prompts[member_node.name]);
    expect(member_config.initial_custom_data?.team_context).toBe(context);
  });

  it('fails if team manager missing', async () => {
    const step = new AgentConfigurationPreparationStep();
    const context = makeContext();
    context.state.team_manager = null;

    const success = await step.execute(context);

    expect(success).toBe(false);
  });
});
