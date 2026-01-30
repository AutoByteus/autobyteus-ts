import { BaseAgentTeamBootstrapStep } from './base_agent_team_bootstrap_step.js';
import { AgentConfig } from '../../agent/context/agent_config.js';
import { AgentTeamConfig } from '../context/agent_team_config.js';
import type { AgentTeamContext } from '../context/agent_team_context.js';
import type { TeamNodeConfig } from '../context/team_node_config.js';

export class TeamManifestInjectionStep extends BaseAgentTeamBootstrapStep {
  async execute(context: AgentTeamContext): Promise<boolean> {
    const teamId = context.teamId;
    console.info(`Team '${teamId}': Executing TeamManifestInjectionStep.`);

    try {
      const preparedPrompts: Record<string, string> = {};

      for (const nodeConfigWrapper of context.config.nodes) {
        if (nodeConfigWrapper.isSubTeam) {
          continue;
        }

        const nodeDefinition = nodeConfigWrapper.nodeDefinition;
        if (!(nodeDefinition instanceof AgentConfig)) {
          console.warn(
            `Team '${teamId}': Node '${nodeConfigWrapper.name}' is not an AgentConfig. ` +
            'Skipping prompt preparation for this node.'
          );
          continue;
        }

        const promptTemplate = nodeDefinition.systemPrompt;
        if (!promptTemplate) {
          continue;
        }

        const teamManifest = this.generateTeamManifest(context, nodeConfigWrapper.name);
        const finalizedPrompt = promptTemplate.includes('{{team}}')
          ? promptTemplate.replace('{{team}}', teamManifest)
          : this.injectTeamManifest(promptTemplate, teamManifest);
        preparedPrompts[nodeConfigWrapper.name] = finalizedPrompt;
        console.debug(
          `Team '${teamId}': Prepared prompt for agent '${nodeConfigWrapper.name}' with team manifest.`
        );
      }

      context.state.preparedAgentPrompts = preparedPrompts;
      console.info(`Team '${teamId}': Team prompts prepared for ${Object.keys(preparedPrompts).length} agent(s).`);
      return true;
    } catch (error) {
      console.error(`Team '${teamId}': Failed to prepare team prompts: ${error}`);
      return false;
    }
  }

  private generateTeamManifest(context: AgentTeamContext, excludeName: string): string {
    const promptParts: string[] = [];

    const sortedNodes = [...context.config.nodes].sort((a: TeamNodeConfig, b: TeamNodeConfig) =>
      a.name.localeCompare(b.name)
    );

    for (const node of sortedNodes) {
      if (node.name === excludeName) {
        continue;
      }

      const nodeDef = node.nodeDefinition;
      let description = 'No description available.';

      if (nodeDef instanceof AgentConfig) {
        description = nodeDef.description;
      } else if (nodeDef instanceof AgentTeamConfig) {
        description = nodeDef.role ?? nodeDef.description;
      }

      promptParts.push(`- name: ${node.name}\n  description: ${description}`);
    }

    if (!promptParts.length) {
      return 'You are working alone. You have no team members to delegate to.';
    }

    return promptParts.join('\n');
  }

  private injectTeamManifest(prompt: string, manifest: string): string {
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
