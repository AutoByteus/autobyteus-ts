import { BaseAgentTeamBootstrapStep } from './base_agent_team_bootstrap_step.js';
import { TaskNotificationMode } from '../task_notification/task_notification_mode.js';
import { SystemEventDrivenAgentTaskNotifier } from '../task_notification/system_event_driven_agent_task_notifier.js';
import type { AgentTeamContext } from '../context/agent_team_context.js';

export class TaskNotifierInitializationStep extends BaseAgentTeamBootstrapStep {
  async execute(context: AgentTeamContext): Promise<boolean> {
    const team_id = context.team_id;
    console.info(`Team '${team_id}': Executing TaskNotifierInitializationStep.`);

    if (context.config.task_notification_mode !== TaskNotificationMode.SYSTEM_EVENT_DRIVEN) {
      console.info(
        `Team '${team_id}': Task notification mode is '${context.config.task_notification_mode}'. ` +
        'Skipping event-driven notifier setup.'
      );
      return true;
    }

    console.info(`Team '${team_id}': Mode is SYSTEM_EVENT_DRIVEN. Initializing and activating task notifier.`);
    try {
      const task_plan = context.state.task_plan as any;
      if (!task_plan) {
        console.error(
          `Team '${team_id}': TaskPlan not found. Cannot initialize task notifier. ` +
          'This step should run after TeamContextInitializationStep.'
        );
        return false;
      }

      const team_manager = context.team_manager as any;
      if (!team_manager) {
        console.error(`Team '${team_id}': TeamManager not found. Cannot initialize task notifier.`);
        return false;
      }

      const notifier = new SystemEventDrivenAgentTaskNotifier(task_plan, team_manager);
      notifier.start_monitoring();

      context.state.task_notifier = notifier as any;
      console.info(`Team '${team_id}': SystemEventDrivenAgentTaskNotifier initialized and monitoring started.`);
      return true;
    } catch (error) {
      console.error(
        `Team '${team_id}': Critical failure during task notifier initialization: ${error}`
      );
      return false;
    }
  }
}
