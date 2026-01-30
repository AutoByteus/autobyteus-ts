import { BaseAgentTeamShutdownStep } from './base_agent_team_shutdown_step.js';
import type { AgentTeamContext } from '../context/agent_team_context.js';
import type { TeamManager } from '../context/team_manager.js';

export class AgentTeamShutdownStep extends BaseAgentTeamShutdownStep {
  async execute(context: AgentTeamContext): Promise<boolean> {
    const teamId = context.teamId;
    console.info(`Team '${teamId}': Executing AgentTeamShutdownStep.`);

    const teamManager = context.teamManager as TeamManager | null;
    if (!teamManager) {
      console.warn(`Team '${teamId}': No TeamManager found, cannot shut down agents.`);
      return true;
    }

    const allAgents = teamManager.getAllAgents();
    const runningAgents = allAgents.filter((agent) => agent.isRunning);

    if (!runningAgents.length) {
      console.info(`Team '${teamId}': No running agents to shut down.`);
      return true;
    }

    console.info(`Team '${teamId}': Shutting down ${runningAgents.length} running agents.`);
    const stopTasks = runningAgents.map((agent) => agent.stop(10.0));
    const results = await Promise.allSettled(stopTasks);

    let allSuccessful = true;
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        const agent = runningAgents[idx];
        console.error(`Team '${teamId}': Error stopping agent '${agent.agentId}': ${result.reason}`);
        allSuccessful = false;
      }
    });

    return allSuccessful;
  }
}
