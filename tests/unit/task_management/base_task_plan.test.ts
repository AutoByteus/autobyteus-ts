import { describe, it, expect } from 'vitest';
import { BaseTaskPlan, TaskStatus, isTerminalTaskStatus } from '../../../src/task_management/base_task_plan.js';
import type { Task } from '../../../src/task_management/task.js';
import type { TaskDefinition } from '../../../src/task_management/schemas/task_definition.js';

class DummyPlan extends BaseTaskPlan {
  add_tasks(_task_definitions: TaskDefinition[]): Task[] {
    return [];
  }

  add_task(_task_definition: TaskDefinition): Task | null {
    return null;
  }

  update_task_status(_task_id: string, _status: TaskStatus, _agent_name: string): boolean {
    return false;
  }

  get_status_overview(): Record<string, any> {
    return {};
  }

  get_next_runnable_tasks(): Task[] {
    return [];
  }
}

describe('BaseTaskPlan', () => {
  it('stores team_id and initializes tasks', () => {
    const plan = new DummyPlan('team-123');
    expect(plan.team_id).toBe('team-123');
    expect(plan.tasks).toEqual([]);
  });
});

describe('TaskStatus', () => {
  it('identifies terminal statuses', () => {
    expect(isTerminalTaskStatus(TaskStatus.COMPLETED)).toBe(true);
    expect(isTerminalTaskStatus(TaskStatus.FAILED)).toBe(true);
    expect(isTerminalTaskStatus(TaskStatus.IN_PROGRESS)).toBe(false);
  });
});
