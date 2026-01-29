import { BaseAgentTeamBootstrapStep } from './base_agent_team_bootstrap_step.js';
import type { AgentTeamContext } from '../context/agent_team_context.js';

export class CoordinatorInitializationStep extends BaseAgentTeamBootstrapStep {
  async execute(context: AgentTeamContext): Promise<boolean> {
    const team_id = context.team_id;
    console.info(`Team '${team_id}': Executing CoordinatorInitializationStep.`);

    try {
      const team_manager: any = context.team_manager;
      if (!team_manager) {
        throw new Error('TeamManager not found in team context. It should be created by the factory.');
      }

      const coordinator_name = context.config.coordinator_node.name;
      const coordinator = await team_manager.ensure_coordinator_is_ready(coordinator_name);

      if (!coordinator) {
        throw new Error(
          `TeamManager failed to return a ready coordinator agent for '${coordinator_name}'.`
        );
      }

      console.info(
        `Team '${team_id}': Coordinator '${coordinator_name}' initialized and started via TeamManager.`
      );
      return true;
    } catch (error) {
      console.error(`Team '${team_id}': Failed to initialize coordinator agent: ${error}`);
      return false;
    }
  }
}
