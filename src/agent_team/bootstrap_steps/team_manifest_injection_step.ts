import { BaseAgentTeamBootstrapStep } from './base_agent_team_bootstrap_step.js';
import { AgentConfig } from '../../agent/context/agent_config.js';
import { AgentTeamConfig } from '../context/agent_team_config.js';
import type { AgentTeamContext } from '../context/agent_team_context.js';
import type { TeamNodeConfig } from '../context/team_node_config.js';

export class TeamManifestInjectionStep extends BaseAgentTeamBootstrapStep {
  async execute(context: AgentTeamContext): Promise<boolean> {
    const team_id = context.team_id;
    console.info(`Team '${team_id}': Executing TeamManifestInjectionStep.`);

    try {
      const prepared_prompts: Record<string, string> = {};

      for (const node_config_wrapper of context.config.nodes) {
        if (node_config_wrapper.is_sub_team) {
          continue;
        }

        const node_definition = node_config_wrapper.node_definition;
        if (!(node_definition instanceof AgentConfig)) {
          console.warn(
            `Team '${team_id}': Node '${node_config_wrapper.name}' is not an AgentConfig. ` +
            'Skipping prompt preparation for this node.'
          );
          continue;
        }

        const prompt_template = node_definition.system_prompt;
        if (!prompt_template) {
          continue;
        }

        const team_manifest = this.generate_team_manifest(context, node_config_wrapper.name);
        const finalized_prompt = prompt_template.includes('{{team}}')
          ? prompt_template.replace('{{team}}', team_manifest)
          : this.inject_team_manifest(prompt_template, team_manifest);
        prepared_prompts[node_config_wrapper.name] = finalized_prompt;
        console.debug(
          `Team '${team_id}': Prepared prompt for agent '${node_config_wrapper.name}' with team manifest.`
        );
      }

      context.state.prepared_agent_prompts = prepared_prompts;
      console.info(`Team '${team_id}': Team prompts prepared for ${Object.keys(prepared_prompts).length} agent(s).`);
      return true;
    } catch (error) {
      console.error(`Team '${team_id}': Failed to prepare team prompts: ${error}`);
      return false;
    }
  }

  private generate_team_manifest(context: AgentTeamContext, exclude_name: string): string {
    const prompt_parts: string[] = [];

    const sorted_nodes = [...context.config.nodes].sort((a: TeamNodeConfig, b: TeamNodeConfig) =>
      a.name.localeCompare(b.name)
    );

    for (const node of sorted_nodes) {
      if (node.name === exclude_name) {
        continue;
      }

      const node_def = node.node_definition;
      let description = 'No description available.';

      if (node_def instanceof AgentConfig) {
        description = node_def.description;
      } else if (node_def instanceof AgentTeamConfig) {
        description = node_def.role ?? node_def.description;
      }

      prompt_parts.push(`- name: ${node.name}\n  description: ${description}`);
    }

    if (!prompt_parts.length) {
      return 'You are working alone. You have no team members to delegate to.';
    }

    return prompt_parts.join('\n');
  }

  private inject_team_manifest(prompt: string, manifest: string): string {
    const lines = prompt.split('\n');
    const headerIndex = lines.findIndex((line) => {
      const trimmed = line.trim();
      return trimmed === '### Your Team' || trimmed === '### Your Teams';
    });

    if (headerIndex >= 0) {
      let insertIndex = headerIndex + 1;
      while (insertIndex < lines.length && lines[insertIndex].trim() !== '') {
        insertIndex += 1;
      }
      lines.splice(insertIndex, 0, manifest);
      return `${lines.join('\n')}\n`;
    }

    return `${prompt.trimEnd()}\n\n### Your Team\n${manifest}\n`;
  }
}
