import { BaseTool } from '../../../tools/base_tool.js';
import { ToolCategory } from '../../../tools/tool_category.js';
import { ParameterSchema, ParameterDefinition, ParameterType } from '../../../utils/parameter_schema.js';
import { ToDoStatus } from '../../todo.js';

function notifyTodoUpdate(context: any): void {
  const notifier = context?.status_manager?.notifier;
  const todoList = context?.state?.todo_list;
  if (notifier && todoList) {
    const todosForLLM = todoList.get_all_todos();
    if (typeof notifier.notify_agent_data_todo_list_updated === 'function') {
      notifier.notify_agent_data_todo_list_updated(todosForLLM);
    }
  }
}

export class UpdateToDoStatus extends BaseTool {
  static CATEGORY = ToolCategory.TASK_MANAGEMENT;

  static getName(): string {
    return 'update_todo_status';
  }

  static getDescription(): string {
    return 'Updates the status of a specific item on your personal to-do list.';
  }

  static getArgumentSchema(): ParameterSchema {
    const schema = new ParameterSchema();
    schema.addParameter(new ParameterDefinition({
      name: 'todo_id',
      type: ParameterType.STRING,
      description: "The unique ID of the to-do item to update (e.g., 'todo_...').",
      required: true
    }));
    schema.addParameter(new ParameterDefinition({
      name: 'status',
      type: ParameterType.ENUM,
      description: `The new status. Must be one of: ${Object.values(ToDoStatus).join(', ')}.`,
      required: true,
      enumValues: Object.values(ToDoStatus)
    }));
    return schema;
  }

  protected async _execute(context: any, kwargs: Record<string, any> = {}): Promise<string> {
    const todoId = kwargs.todo_id;
    const status = kwargs.status;

    if (context.state.todo_list == null) {
      return 'Error: You do not have a to-do list to update.';
    }

    const todoList = context.state.todo_list;

    const statusEnum = Object.values(ToDoStatus).includes(status as ToDoStatus)
      ? (status as ToDoStatus)
      : null;
    if (!statusEnum) {
      return `Error: Invalid status '${status}'. Must be one of: ${Object.values(ToDoStatus).join(', ')}.`;
    }

    if (!todoList.get_todo_by_id(todoId)) {
      return `Error: Failed to update status. A to-do item with ID '${todoId}' does not exist on your list.`;
    }

    if (todoList.update_todo_status(todoId, statusEnum)) {
      notifyTodoUpdate(context);
      return `Successfully updated status of to-do item '${todoId}' to '${status}'.`;
    }

    return `Error: Failed to update status for item '${todoId}'. An unexpected error occurred.`;
  }
}
