import { describe, it, expect } from 'vitest';
import { TaskStatus } from '../../../../src/task_management/base_task_plan.js';
import { TaskStatusReportItemSchema } from '../../../../src/task_management/schemas/task_status_report.js';

describe('TaskStatusReportItemSchema', () => {
  const baseItem = {
    task_name: 'task_a',
    assignee_name: 'AgentA',
    description: 'Task description',
    dependencies: ['task_b'],
    status: TaskStatus.IN_PROGRESS
  };

  it('defaults file_deliverables', () => {
    const parsed = TaskStatusReportItemSchema.parse(baseItem);
    expect(parsed.file_deliverables).toEqual([]);
  });

  it('rejects invalid status', () => {
    const result = TaskStatusReportItemSchema.safeParse({
      ...baseItem,
      status: 'unknown'
    });

    expect(result.success).toBe(false);
  });
});
