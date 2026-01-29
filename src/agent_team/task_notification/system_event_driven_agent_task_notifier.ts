import { EventType } from '../../events/event_types.js';
import { TaskStatus } from '../../task_management/base_task_plan.js';
import type { BaseTaskPlan } from '../../task_management/base_task_plan.js';
import type { TasksCreatedEvent, TaskStatusUpdatedEvent } from '../../task_management/events.js';
import { ActivationPolicy } from './activation_policy.js';
import { TaskActivator } from './task_activator.js';

export class SystemEventDrivenAgentTaskNotifier {
  private task_plan: BaseTaskPlan;
  private team_manager: { team_id: string };
  private policy: ActivationPolicy;
  private activator: TaskActivator;

  constructor(task_plan: BaseTaskPlan, team_manager: { team_id: string }) {
    if (!task_plan || !team_manager) {
      throw new Error('TaskPlan and TeamManager are required for the notifier.');
    }

    this.task_plan = task_plan;
    this.team_manager = team_manager;
    this.policy = new ActivationPolicy(this.team_manager.team_id);
    this.activator = new TaskActivator(this.team_manager as any);

    console.info(
      `SystemEventDrivenAgentTaskNotifier orchestrator initialized for team '${this.team_manager.team_id}'.`
    );
  }

  start_monitoring(): void {
    this.task_plan.subscribe(EventType.TASK_PLAN_TASKS_CREATED, this._handle_tasks_changed);
    this.task_plan.subscribe(EventType.TASK_PLAN_STATUS_UPDATED, this._handle_tasks_changed);
    console.info(
      `Team '${this.team_manager.team_id}': Task notifier orchestrator is now monitoring TaskPlan events.`
    );
  }

  _handle_tasks_changed = async (payload: TasksCreatedEvent | TaskStatusUpdatedEvent): Promise<void> => {
    const team_id = this.team_manager.team_id;
    const is_tasks_created = 'tasks' in payload;

    console.info(
      `Team '${team_id}': Task plan changed (${is_tasks_created ? 'TasksCreatedEvent' : 'TaskStatusUpdatedEvent'}). ` +
      'Orchestrating activation check.'
    );

    if (is_tasks_created) {
      console.info(`Team '${team_id}': New tasks created. Resetting activation policy.`);
      this.policy.reset();
    }

    const runnable_tasks = this.task_plan.get_next_runnable_tasks();
    if (!runnable_tasks.length) {
      console.debug(`Team '${team_id}': No runnable tasks found after change. No action needed.`);
      return;
    }

    const agents_to_activate = this.policy.determine_activations(runnable_tasks);
    if (!agents_to_activate.length) {
      console.info(
        `Team '${team_id}': Runnable tasks exist, but policy determined no new agents need activation.`
      );
      return;
    }

    for (const agent_name of agents_to_activate) {
      const agent_runnable_tasks = runnable_tasks.filter(
        (task: any) => task.assignee_name === agent_name
      );

      for (const task of agent_runnable_tasks) {
        const task_id = task.task_id;
        const statusOverview = this.task_plan.get_status_overview();
        if (statusOverview?.task_statuses?.[task_id] === TaskStatus.NOT_STARTED) {
          this.task_plan.update_task_status(task_id, TaskStatus.QUEUED, 'SystemTaskNotifier');
        }
      }

      await this.activator.activate_agent(agent_name);
    }
  };
}
