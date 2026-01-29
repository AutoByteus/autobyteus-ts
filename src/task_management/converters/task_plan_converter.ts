import type { BaseTaskPlan } from '../base_task_plan.js';
import {
  TaskStatusReportItemSchema,
  TaskStatusReportSchema,
  type TaskStatusReport
} from '../schemas/task_status_report.js';

export class TaskPlanConverter {
  static to_schema(task_plan: BaseTaskPlan): TaskStatusReport | null {
    if (task_plan.tasks.length === 0) {
      return null;
    }

    const internalStatus = task_plan.get_status_overview();
    const idToNameMap = new Map(task_plan.tasks.map((task) => [task.task_id, task.task_name]));

    const reportItems = task_plan.tasks.map((task) => {
      const depNames = (task.dependencies ?? []).map((depId) => idToNameMap.get(depId) ?? String(depId));

      return TaskStatusReportItemSchema.parse({
        task_name: task.task_name,
        assignee_name: task.assignee_name,
        description: task.description,
        dependencies: depNames,
        status: internalStatus.task_statuses?.[task.task_id],
        file_deliverables: task.file_deliverables
      });
    });

    return TaskStatusReportSchema.parse({ tasks: reportItems });
  }
}
