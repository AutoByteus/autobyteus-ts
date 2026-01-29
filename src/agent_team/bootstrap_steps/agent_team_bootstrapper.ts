import { BaseAgentTeamBootstrapStep } from './base_agent_team_bootstrap_step.js';
import { TeamContextInitializationStep } from './team_context_initialization_step.js';
import { TaskNotifierInitializationStep } from './task_notifier_initialization_step.js';
import { TeamManifestInjectionStep } from './team_manifest_injection_step.js';
import { AgentConfigurationPreparationStep } from './agent_configuration_preparation_step.js';
import { CoordinatorInitializationStep } from './coordinator_initialization_step.js';
import type { AgentTeamContext } from '../context/agent_team_context.js';

export class AgentTeamBootstrapper {
  bootstrap_steps: BaseAgentTeamBootstrapStep[];

  constructor(steps?: BaseAgentTeamBootstrapStep[]) {
    this.bootstrap_steps = steps ?? [
      new TeamContextInitializationStep(),
      new TaskNotifierInitializationStep(),
      new TeamManifestInjectionStep(),
      new AgentConfigurationPreparationStep(),
      new CoordinatorInitializationStep()
    ];
  }

  async run(context: AgentTeamContext): Promise<boolean> {
    const team_id = context.team_id;
    console.info(`Team '${team_id}': Bootstrapper starting.`);

    for (const step of this.bootstrap_steps) {
      const step_name = step.constructor.name;
      console.debug(`Team '${team_id}': Executing bootstrap step: ${step_name}`);
      const success = await step.execute(context);
      if (!success) {
        console.error(`Team '${team_id}': Bootstrap step ${step_name} failed.`);
        return false;
      }
    }

    console.info(`Team '${team_id}': All bootstrap steps completed successfully.`);
    if (!context.state.input_event_queues) {
      console.error(`Team '${team_id}': Bootstrap succeeded but queues not available.`);
      return false;
    }

    return true;
  }
}
