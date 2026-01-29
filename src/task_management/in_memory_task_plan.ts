import { EventType } from '../events/event_types.js';
import { BaseTaskPlan, TaskStatus } from './base_task_plan.js';
import type { TaskDefinition } from './schemas/task_definition.js';
import { TaskSchema, type Task } from './task.js';
import { TasksCreatedEventSchema, TaskStatusUpdatedEventSchema } from './events.js';

export class InMemoryTaskPlan extends BaseTaskPlan {
  task_statuses: Record<string, TaskStatus> = {};
  _task_map: Map<string, Task> = new Map();
  private _id_counter = 0;

  private generate_next_id(): string {
    this._id_counter += 1;
    return `task_${String(this._id_counter).padStart(4, '0')}`;
  }

  add_tasks(task_definitions: TaskDefinition[]): Task[] {
    const newTasks: Task[] = [];

    for (const taskDef of task_definitions) {
      const task_id = this.generate_next_id();
      const task = TaskSchema.parse({
        task_id,
        task_name: taskDef.task_name,
        assignee_name: taskDef.assignee_name,
        description: taskDef.description,
        dependencies: taskDef.dependencies ?? [],
        file_deliverables: 'file_deliverables' in taskDef ? (taskDef as Task).file_deliverables : undefined
      });

      this.tasks.push(task);
      this.task_statuses[task.task_id] = TaskStatus.NOT_STARTED;
      this._task_map.set(task.task_id, task);
      newTasks.push(task);
    }

    this.hydrate_all_dependencies();

    const eventPayload = TasksCreatedEventSchema.parse({
      team_id: this.team_id,
      tasks: newTasks
    });

    this.emit(EventType.TASK_PLAN_TASKS_CREATED, { payload: eventPayload });
    return newTasks;
  }

  add_task(task_definition: TaskDefinition): Task | null {
    const created = this.add_tasks([task_definition]);
    return created.length ? created[0] : null;
  }

  private hydrate_all_dependencies(): void {
    const nameToIdMap = new Map(this.tasks.map((task) => [task.task_name, task.task_id]));
    const allTaskIds = new Set(this._task_map.keys());

    for (const task of this.tasks) {
      if (!task.dependencies || task.dependencies.length === 0) {
        continue;
      }

      const resolvedDeps: string[] = [];
      for (const dep of task.dependencies) {
        if (allTaskIds.has(dep)) {
          resolvedDeps.push(dep);
          continue;
        }
        const mapped = nameToIdMap.get(dep);
        if (mapped) {
          resolvedDeps.push(mapped);
        }
      }

      task.dependencies = resolvedDeps;
    }
  }

  update_task_status(task_id: string, status: TaskStatus, agent_name: string): boolean {
    if (!(task_id in this.task_statuses)) {
      return false;
    }

    this.task_statuses[task_id] = status;
    const task = this._task_map.get(task_id);

    const eventPayload = TaskStatusUpdatedEventSchema.parse({
      team_id: this.team_id,
      task_id,
      new_status: status,
      agent_name,
      deliverables: task?.file_deliverables
    });

    this.emit(EventType.TASK_PLAN_STATUS_UPDATED, { payload: eventPayload });
    return true;
  }

  get_status_overview(): Record<string, any> {
    const task_statuses: Record<string, string> = {};
    for (const [taskId, status] of Object.entries(this.task_statuses)) {
      task_statuses[taskId] = status;
    }

    return {
      task_statuses,
      tasks: this.tasks
    };
  }

  get_next_runnable_tasks(): Task[] {
    const runnable: Task[] = [];

    for (const [taskId, status] of Object.entries(this.task_statuses)) {
      if (status !== TaskStatus.NOT_STARTED) {
        continue;
      }

      const task = this._task_map.get(taskId);
      if (!task) {
        continue;
      }

      const dependencies = task.dependencies ?? [];
      if (dependencies.length === 0) {
        runnable.push(task);
        continue;
      }

      const dependenciesMet = dependencies.every(
        (depId) => this.task_statuses[depId] === TaskStatus.COMPLETED
      );

      if (dependenciesMet) {
        runnable.push(task);
      }
    }

    return runnable;
  }
}
