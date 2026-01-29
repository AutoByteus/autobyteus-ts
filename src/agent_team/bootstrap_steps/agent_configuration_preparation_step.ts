import { BaseAgentTeamBootstrapStep } from './base_agent_team_bootstrap_step.js';
import { AgentConfig } from '../../agent/context/agent_config.js';
import type { AgentTeamContext } from '../context/agent_team_context.js';

export class AgentConfigurationPreparationStep extends BaseAgentTeamBootstrapStep {
  async execute(context: AgentTeamContext): Promise<boolean> {
    const team_id = context.team_id;
    console.info(
      `Team '${team_id}': Executing AgentConfigurationPreparationStep to prepare all agent configurations.`
    );

    const team_manager = context.team_manager as any;
    if (!team_manager) {
      console.error(`Team '${team_id}': TeamManager not found in context during agent config preparation.`);
      return false;
    }

    try {
      for (const node_config_wrapper of context.config.nodes) {
        if (node_config_wrapper.is_sub_team) {
          continue;
        }

        const unique_name = node_config_wrapper.name;
        const node_definition = node_config_wrapper.node_definition;

        if (!(node_definition instanceof AgentConfig)) {
          console.warn(
            `Team '${team_id}': Node '${unique_name}' has an unexpected definition type and will be skipped: ` +
            `${typeof node_definition}`
          );
          continue;
        }

        const final_config = node_definition.copy();

        if (!final_config.initial_custom_data) {
          final_config.initial_custom_data = {};
        }
        final_config.initial_custom_data.team_context = context;
        console.debug(
          `Team '${team_id}': Injected shared team_context into initial_custom_data for agent '${unique_name}'.`
        );

        const prepared_prompt = context.state.prepared_agent_prompts[unique_name];
        if (prepared_prompt) {
          final_config.system_prompt = prepared_prompt;
          console.info(`Team '${team_id}': Applied dynamic prompt to agent '${unique_name}'.`);
        }

        context.state.final_agent_configs[unique_name] = final_config;
        const tool_names = final_config.tools.map((tool: any) => tool.constructor?.getName?.() ?? tool.constructor?.name ?? 'unknown');
        console.info(
          `Team '${team_id}': Prepared final config for agent '${unique_name}' with user-defined tools: ${tool_names}`
        );
      }

      return true;
    } catch (error) {
      console.error(`Team '${team_id}': Failed during agent configuration preparation: ${error}`);
      return false;
    }
  }
}
