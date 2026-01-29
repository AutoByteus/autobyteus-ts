import { BaseAgentTeamShutdownStep } from './base_agent_team_shutdown_step.js';
import type { AgentTeamContext } from '../context/agent_team_context.js';

export class AgentTeamShutdownStep extends BaseAgentTeamShutdownStep {
  async execute(context: AgentTeamContext): Promise<boolean> {
    const team_id = context.team_id;
    console.info(`Team '${team_id}': Executing AgentTeamShutdownStep.`);

    const team_manager: any = context.team_manager;
    if (!team_manager) {
      console.warn(`Team '${team_id}': No TeamManager found, cannot shut down agents.`);
      return true;
    }

    const all_agents = team_manager.get_all_agents();
    const running_agents = all_agents.filter((agent: any) => agent.is_running);

    if (!running_agents.length) {
      console.info(`Team '${team_id}': No running agents to shut down.`);
      return true;
    }

    console.info(`Team '${team_id}': Shutting down ${running_agents.length} running agents.`);
    const stop_tasks = running_agents.map((agent: any) => agent.stop(10.0));
    const results = await Promise.allSettled(stop_tasks);

    let all_successful = true;
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        const agent = running_agents[idx];
        console.error(`Team '${team_id}': Error stopping agent '${agent.agent_id}': ${result.reason}`);
        all_successful = false;
      }
    });

    return all_successful;
  }
}
