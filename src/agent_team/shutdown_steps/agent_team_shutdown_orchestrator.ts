import { BaseAgentTeamShutdownStep } from './base_agent_team_shutdown_step.js';
import { BridgeCleanupStep } from './bridge_cleanup_step.js';
import { SubTeamShutdownStep } from './sub_team_shutdown_step.js';
import { AgentTeamShutdownStep } from './agent_team_shutdown_step.js';
import type { AgentTeamContext } from '../context/agent_team_context.js';

export class AgentTeamShutdownOrchestrator {
  shutdown_steps: BaseAgentTeamShutdownStep[];

  constructor(steps?: BaseAgentTeamShutdownStep[]) {
    this.shutdown_steps = steps ?? [
      new BridgeCleanupStep(),
      new SubTeamShutdownStep(),
      new AgentTeamShutdownStep()
    ];
  }

  async run(context: AgentTeamContext): Promise<boolean> {
    const team_id = context.team_id;
    console.info(`Team '${team_id}': Shutdown orchestrator starting.`);

    let all_successful = true;
    for (const step of this.shutdown_steps) {
      const success = await step.execute(context);
      if (!success) {
        console.error(`Team '${team_id}': Shutdown step ${step.constructor.name} failed.`);
        all_successful = false;
      }
    }

    console.info(`Team '${team_id}': Shutdown orchestration completed.`);
    return all_successful;
  }
}
