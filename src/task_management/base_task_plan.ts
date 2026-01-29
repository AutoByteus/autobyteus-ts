import { EventEmitter } from '../events/event_emitter.js';
import type { Task } from './task.js';
import type { TaskDefinition } from './schemas/task_definition.js';

export enum TaskStatus {
  NOT_STARTED = 'not_started',
  QUEUED = 'queued',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  BLOCKED = 'blocked',
  FAILED = 'failed'
}

export function isTerminalTaskStatus(status: TaskStatus): boolean {
  return status === TaskStatus.COMPLETED || status === TaskStatus.FAILED;
}

export abstract class BaseTaskPlan extends EventEmitter {
  team_id: string;
  tasks: Task[] = [];

  constructor(team_id: string) {
    super();
    this.team_id = team_id;
  }

  abstract add_tasks(task_definitions: TaskDefinition[]): Task[];

  abstract add_task(task_definition: TaskDefinition): Task | null;

  abstract update_task_status(task_id: string, status: TaskStatus, agent_name: string): boolean;

  abstract get_status_overview(): Record<string, any>;

  abstract get_next_runnable_tasks(): Task[];
}
