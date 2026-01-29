import { ZodError } from 'zod';
import { BaseTool } from '../../../tools/base_tool.js';
import { ToolCategory } from '../../../tools/tool_category.js';
import { zodToParameterSchema } from '../../../tools/zod_schema_converter.js';
import { ToDoDefinitionSchema, type ToDoDefinition } from '../../schemas/todo_definition.js';
import { ToDoList } from '../../todo_list.js';

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

export class AddToDo extends BaseTool {
  static CATEGORY = ToolCategory.TASK_MANAGEMENT;

  static getName(): string {
    return 'add_todo';
  }

  static getDescription(): string {
    return (
      'Adds a single new item to your personal to-do list. ' +
      'Use this if you discover a new step is needed to complete your task.'
    );
  }

  static getArgumentSchema() {
    return zodToParameterSchema(ToDoDefinitionSchema);
  }

  protected async _execute(context: any, kwargs: Record<string, any> = {}): Promise<string> {
    const agentId = context?.agent_id ?? context?.agentId ?? 'unknown';

    if (context.state.todo_list == null) {
      context.state.todo_list = new ToDoList(agentId);
    }

    const todoList = context.state.todo_list as ToDoList;

    let todoDef: ToDoDefinition;
    try {
      todoDef = ToDoDefinitionSchema.parse(kwargs);
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
      return `Error: Invalid to-do item definition provided${suffix}`;
    }

    const newTodo = todoList.add_todo(todoDef);
    if (newTodo) {
      notifyTodoUpdate(context);
      return `Successfully added new item to your to-do list: '${newTodo.description}' (ID: ${newTodo.todo_id}).`;
    }

    return 'Error: Failed to add item to the to-do list for an unknown reason.';
  }
}
