import { BaseAgentTeamBootstrapStep } from './base_agent_team_bootstrap_step.js';
import { TaskPlan } from '../../task_management/index.js';
import { EventType } from '../../events/event_types.js';
import type { AgentTeamContext } from '../context/agent_team_context.js';

export class TeamContextInitializationStep extends BaseAgentTeamBootstrapStep {
  async execute(context: AgentTeamContext): Promise<boolean> {
    const team_id = context.team_id;
    console.info(`Team '${team_id}': Executing TeamContextInitializationStep.`);

    try {
      if (!context.state.task_plan) {
        const task_plan = new TaskPlan(team_id);
        context.state.task_plan = task_plan as any;
        console.info(`Team '${team_id}': TaskPlan initialized and attached to team state.`);

        const status_manager: any = context.status_manager;
        const notifier = status_manager?.notifier;
        if (notifier) {
          notifier.subscribe_from(
            task_plan as any,
            EventType.TASK_PLAN_TASKS_CREATED,
            notifier.handle_and_publish_task_plan_event
          );
          notifier.subscribe_from(
            task_plan as any,
            EventType.TASK_PLAN_STATUS_UPDATED,
            notifier.handle_and_publish_task_plan_event
          );
          console.info(`Team '${team_id}': Successfully bridged TaskPlan events to the team notifier.`);
        } else {
          console.warn(
            `Team '${team_id}': Notifier not found in StatusManager. Cannot bridge TaskPlan events.`
          );
        }
      } else {
        console.warn(`Team '${team_id}': TaskPlan already exists. Skipping initialization.`);
      }

      return true;
    } catch (error) {
      console.error(
        `Team '${team_id}': Critical failure during team context initialization: ${error}`
      );
      return false;
    }
  }
}
