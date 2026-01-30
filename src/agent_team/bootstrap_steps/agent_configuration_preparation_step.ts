import { BaseAgentTeamBootstrapStep } from './base_agent_team_bootstrap_step.js';
import { AgentConfig } from '../../agent/context/agent_config.js';
import type { AgentTeamContext } from '../context/agent_team_context.js';
import type { TeamManager } from '../context/team_manager.js';

export class AgentConfigurationPreparationStep extends BaseAgentTeamBootstrapStep {
  async execute(context: AgentTeamContext): Promise<boolean> {
    const teamId = context.teamId;
    console.info(
      `Team '${teamId}': Executing AgentConfigurationPreparationStep to prepare all agent configurations.`
    );

    const teamManager = context.teamManager as TeamManager | null;
    if (!teamManager) {
      console.error(`Team '${teamId}': TeamManager not found in context during agent config preparation.`);
      return false;
    }

    try {
      for (const nodeConfigWrapper of context.config.nodes) {
        if (nodeConfigWrapper.isSubTeam) {
          continue;
        }

        const uniqueName = nodeConfigWrapper.name;
        const nodeDefinition = nodeConfigWrapper.nodeDefinition;

        if (!(nodeDefinition instanceof AgentConfig)) {
          console.warn(
            `Team '${teamId}': Node '${uniqueName}' has an unexpected definition type and will be skipped: ` +
            `${typeof nodeDefinition}`
          );
          continue;
        }

        const finalConfig = nodeDefinition.copy();

        if (!finalConfig.initialCustomData) {
          finalConfig.initialCustomData = {};
        }
        finalConfig.initialCustomData.teamContext = context;
        console.debug(
          `Team '${teamId}': Injected shared teamContext into initialCustomData for agent '${uniqueName}'.`
        );

        const preparedPrompt = context.state.preparedAgentPrompts[uniqueName];
        if (preparedPrompt) {
          finalConfig.systemPrompt = preparedPrompt;
          console.info(`Team '${teamId}': Applied dynamic prompt to agent '${uniqueName}'.`);
        }

        context.state.finalAgentConfigs[uniqueName] = finalConfig;
        const toolNames = finalConfig.tools.map((tool) => {
          const ctor = tool.constructor as { getName?: () => string; name?: string };
          return ctor.getName?.() ?? ctor.name ?? 'unknown';
        });
        console.info(
          `Team '${teamId}': Prepared final config for agent '${uniqueName}' with user-defined tools: ${toolNames}`
        );
      }

      return true;
    } catch (error) {
      console.error(`Team '${teamId}': Failed during agent configuration preparation: ${error}`);
      return false;
    }
  }
}
