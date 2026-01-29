import { ZodError } from 'zod';
import { BaseTool } from '../../../tools/base_tool.js';
import { ToolCategory } from '../../../tools/tool_category.js';
import { zodToParameterSchema } from '../../../tools/zod_schema_converter.js';
import { TaskDefinitionSchema, type TaskDefinition } from '../../schemas/task_definition.js';
import { InterAgentMessageRequestEvent } from '../../../agent_team/events/agent_team_events.js';

export class AssignTaskTo extends BaseTool {
  static CATEGORY = ToolCategory.TASK_MANAGEMENT;

  static getName(): string {
    return 'assign_task_to';
  }

  static getDescription(): string {
    return (
      'Creates and assigns a single new task to a specific team member, and sends them a direct notification ' +
      'with the task details. Use this to delegate a well-defined piece of work you have identified.'
    );
  }

  static getArgumentSchema() {
    return zodToParameterSchema(TaskDefinitionSchema);
  }

  protected async _execute(context: any, kwargs: Record<string, any> = {}): Promise<string> {
    const taskName = kwargs.task_name ?? 'unnamed task';
    const assigneeName = kwargs.assignee_name;

    const teamContext = context?.custom_data?.team_context;
    if (!teamContext) {
      return 'Error: Team context is not available. Cannot access the task plan or send messages.';
    }

    const taskPlan = teamContext.state?.task_plan;
    if (!taskPlan) {
      return 'Error: Task plan has not been initialized for this team.';
    }

    let taskDef: TaskDefinition;
    try {
      taskDef = TaskDefinitionSchema.parse(kwargs);
    } catch (error) {
      let details = '';
      if (error instanceof ZodError) {
        details = error.issues.map((issue) => issue.message).filter(Boolean).join('; ');
      } else if (error instanceof Error) {
        details = error.message;
      } else {
        details = String(error);
      }
      const suffix = details ? `: ${details}` : '';
      return `Error: Invalid task definition provided${suffix}`;
    }

    const newTask = taskPlan.add_task(taskDef);
    if (!newTask) {
      return `Error: Failed to publish task '${taskName}' to the plan for an unknown reason.`;
    }

    const teamManager = teamContext.team_manager;
    if (!teamManager) {
      return (
        `Successfully published task '${newTask.task_name}', but could not send a direct notification ` +
        'because the TeamManager is not available.'
      );
    }

    try {
      const senderAgentId = context?.agent_id ?? context?.agentId ?? 'unknown';
      let notificationContent =
        `You have been assigned a new task directly from agent '${context?.config?.name ?? 'Unknown'}'.\n\n` +
        `**Task Name**: '${newTask.task_name}'\n` +
        `**Description**: ${newTask.description}\n`;

      if (newTask.dependencies && newTask.dependencies.length > 0) {
        const idToNameMap = new Map(taskPlan.tasks.map((task: any) => [task.task_id, task.task_name]));
        const depNames = newTask.dependencies.map((depId: string) => idToNameMap.get(depId) ?? String(depId));
        notificationContent += `**Dependencies**: ${depNames.join(', ')}\n`;
      }

      notificationContent +=
        '\nThis task has been logged on the team\'s task plan. You can begin work when its dependencies are met.';

      const event = new InterAgentMessageRequestEvent(
        senderAgentId,
        assigneeName,
        notificationContent,
        'task_assignment'
      );

      await teamManager.dispatch_inter_agent_message_request(event);
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      return (
        `Successfully published task '${newTask.task_name}', but failed to send the direct notification message. ` +
        `Error: ${details}`
      );
    }

    return `Successfully assigned task '${newTask.task_name}' to agent '${newTask.assignee_name}' and sent a notification.`;
  }
}
