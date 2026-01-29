import { BaseAgentTeamShutdownStep } from './base_agent_team_shutdown_step.js';
import type { AgentTeamContext } from '../context/agent_team_context.js';

export class SubTeamShutdownStep extends BaseAgentTeamShutdownStep {
  async execute(context: AgentTeamContext): Promise<boolean> {
    const team_id = context.team_id;
    console.info(`Team '${team_id}': Executing SubTeamShutdownStep.`);

    const team_manager: any = context.team_manager;
    if (!team_manager) {
      console.warn(`Team '${team_id}': No TeamManager found, cannot shut down sub-teams.`);
      return true;
    }

    const all_sub_teams = team_manager.get_all_sub_teams();
    const running_sub_teams = all_sub_teams.filter((team: any) => team.is_running);

    if (!running_sub_teams.length) {
      console.info(`Team '${team_id}': No running sub-teams to shut down.`);
      return true;
    }

    console.info(`Team '${team_id}': Shutting down ${running_sub_teams.length} running sub-teams.`);
    const stop_tasks = running_sub_teams.map((team: any) => team.stop(20.0));
    const results = await Promise.allSettled(stop_tasks);

    let all_successful = true;
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        const team = running_sub_teams[idx];
        console.error(`Team '${team_id}': Error stopping sub-team '${team.name}': ${result.reason}`);
        all_successful = false;
      }
    });

    return all_successful;
  }
}
