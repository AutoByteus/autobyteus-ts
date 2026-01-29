import { describe, it, expect, vi } from 'vitest';
import { GetTaskPlanStatus } from '../../../../../src/task_management/tools/task_tools/get_task_plan_status.js';
import { TaskPlanConverter } from '../../../../../src/task_management/converters/task_plan_converter.js';
import { TaskStatusReportSchema } from '../../../../../src/task_management/schemas/task_status_report.js';
import { TaskStatus } from '../../../../../src/task_management/base_task_plan.js';
import { createFileDeliverable } from '../../../../../src/task_management/deliverable.js';

const makeAgentContext = () => ({
  agentId: 'test_agent_get_status',
  custom_data: {} as Record<string, any>
});

const makeTeamContext = () => ({
  state: {
    task_plan: {}
  }
});

describe('GetTaskPlanStatus tool', () => {
  it('returns JSON from the converter', async () => {
    const tool = new GetTaskPlanStatus();
    const context = makeAgentContext();
    const teamContext = makeTeamContext();
    context.custom_data.team_context = teamContext;

    const report = TaskStatusReportSchema.parse({
      tasks: [
        {
          task_name: 'task1',
          assignee_name: 'a1',
          description: 'd1',
          dependencies: [],
          status: TaskStatus.NOT_STARTED,
          file_deliverables: []
        }
      ]
    });

    const spy = vi.spyOn(TaskPlanConverter, 'to_schema').mockReturnValue(report);

    const result = await (tool as any)._execute(context);

    expect(spy).toHaveBeenCalledWith(teamContext.state.task_plan);

    const resultData = JSON.parse(result);
    expect(resultData.overall_goal).toBeUndefined();
    expect(resultData.tasks[0].task_name).toBe('task1');
    expect(resultData.tasks[0].file_deliverables).toEqual([]);
  });

  it('serializes deliverables in the JSON output', async () => {
    const tool = new GetTaskPlanStatus();
    const context = makeAgentContext();
    const teamContext = makeTeamContext();
    context.custom_data.team_context = teamContext;

    const deliverable = createFileDeliverable({
      file_path: 'report.pdf',
      summary: 'Final report',
      author_agent_name: 'TestAgent'
    });

    const report = TaskStatusReportSchema.parse({
      tasks: [
        {
          task_name: 'task1',
          assignee_name: 'a1',
          description: 'd1',
          dependencies: [],
          status: TaskStatus.COMPLETED,
          file_deliverables: [deliverable]
        }
      ]
    });

    vi.spyOn(TaskPlanConverter, 'to_schema').mockReturnValue(report);

    const result = await (tool as any)._execute(context);

    const resultData = JSON.parse(result);
    expect(resultData.tasks[0].file_deliverables.length).toBe(1);
    const deliverableData = resultData.tasks[0].file_deliverables[0];
    expect(deliverableData.file_path).toBe('report.pdf');
    expect(deliverableData.summary).toBe('Final report');
    expect(resultData.overall_goal).toBeUndefined();
  });

  it('returns a message when the task plan is empty', async () => {
    const tool = new GetTaskPlanStatus();
    const context = makeAgentContext();
    const teamContext = makeTeamContext();
    context.custom_data.team_context = teamContext;

    vi.spyOn(TaskPlanConverter, 'to_schema').mockReturnValue(null);

    const result = await (tool as any)._execute(context);

    expect(result).toBe('The task plan is currently empty. No tasks have been published.');
  });

  it('returns an error when team context is missing', async () => {
    const tool = new GetTaskPlanStatus();
    const context = makeAgentContext();

    const result = await (tool as any)._execute(context);

    expect(result).toContain('Error: Team context is not available');
  });

  it('returns an error when task plan is missing', async () => {
    const tool = new GetTaskPlanStatus();
    const context = makeAgentContext();
    context.custom_data.team_context = { state: { task_plan: null } };

    const result = await (tool as any)._execute(context);

    expect(result).toContain('Error: Task plan has not been initialized');
  });
});
