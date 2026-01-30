import { BaseAgentTeamShutdownStep } from './base_agent_team_shutdown_step.js';
import { BridgeCleanupStep } from './bridge_cleanup_step.js';
import { SubTeamShutdownStep } from './sub_team_shutdown_step.js';
import { AgentTeamShutdownStep } from './agent_team_shutdown_step.js';
import type { AgentTeamContext } from '../context/agent_team_context.js';

export class AgentTeamShutdownOrchestrator {
  shutdownSteps: BaseAgentTeamShutdownStep[];

  constructor(steps?: BaseAgentTeamShutdownStep[]) {
    this.shutdownSteps = steps ?? [
      new BridgeCleanupStep(),
      new SubTeamShutdownStep(),
      new AgentTeamShutdownStep()
    ];
  }

  async run(context: AgentTeamContext): Promise<boolean> {
    const teamId = context.teamId;
    console.info(`Team '${teamId}': Shutdown orchestrator starting.`);

    let allSuccessful = true;
    for (const step of this.shutdownSteps) {
      const success = await step.execute(context);
      if (!success) {
        console.error(`Team '${teamId}': Shutdown step ${step.constructor.name} failed.`);
        allSuccessful = false;
      }
    }

    console.info(`Team '${teamId}': Shutdown orchestration completed.`);
    return allSuccessful;
  }
}
