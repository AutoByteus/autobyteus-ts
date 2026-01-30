import { BaseAgentTeamBootstrapStep } from './base_agent_team_bootstrap_step.js';
import { TaskNotificationMode } from '../task_notification/task_notification_mode.js';
import { SystemEventDrivenAgentTaskNotifier } from '../task_notification/system_event_driven_agent_task_notifier.js';
import type { AgentTeamContext } from '../context/agent_team_context.js';
import type { BaseTaskPlan } from '../../task_management/base_task_plan.js';
import type { TeamManager } from '../context/team_manager.js';

export class TaskNotifierInitializationStep extends BaseAgentTeamBootstrapStep {
  async execute(context: AgentTeamContext): Promise<boolean> {
    const teamId = context.teamId;
    console.info(`Team '${teamId}': Executing TaskNotifierInitializationStep.`);

    if (context.config.taskNotificationMode !== TaskNotificationMode.SYSTEM_EVENT_DRIVEN) {
      console.info(
        `Team '${teamId}': Task notification mode is '${context.config.taskNotificationMode}'. ` +
        'Skipping event-driven notifier setup.'
      );
      return true;
    }

    console.info(`Team '${teamId}': Mode is SYSTEM_EVENT_DRIVEN. Initializing and activating task notifier.`);
    try {
      const taskPlan = context.state.taskPlan as BaseTaskPlan | null;
      if (!taskPlan) {
        console.error(
          `Team '${teamId}': TaskPlan not found. Cannot initialize task notifier. ` +
          'This step should run after TeamContextInitializationStep.'
        );
        return false;
      }

      const teamManager = context.teamManager as TeamManager | null;
      if (!teamManager) {
        console.error(`Team '${teamId}': TeamManager not found. Cannot initialize task notifier.`);
        return false;
      }

      const notifier = new SystemEventDrivenAgentTaskNotifier(taskPlan, teamManager);
      notifier.startMonitoring();

      context.state.taskNotifier = notifier;
      console.info(`Team '${teamId}': SystemEventDrivenAgentTaskNotifier initialized and monitoring started.`);
      return true;
    } catch (error) {
      console.error(
        `Team '${teamId}': Critical failure during task notifier initialization: ${error}`
      );
      return false;
    }
  }
}
