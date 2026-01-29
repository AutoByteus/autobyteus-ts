import { ZodError } from 'zod';
import { BaseTool } from '../../../tools/base_tool.js';
import { ToolCategory } from '../../../tools/tool_category.js';
import { zodToParameterSchema } from '../../../tools/zod_schema_converter.js';
import { ToDosDefinitionSchema, type ToDosDefinition } from '../../schemas/todo_definition.js';
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

export class CreateToDoList extends BaseTool {
  static CATEGORY = ToolCategory.TASK_MANAGEMENT;

  static getName(): string {
    return 'create_todo_list';
  }

  static getDescription(): string {
    return (
      'Creates a new personal to-do list for you to manage your own sub-tasks. ' +
      'This will overwrite any existing to-do list you have. Use this to break down a larger task into smaller steps. ' +
      'Returns the full list of created to-do items with their new IDs.'
    );
  }

  static getArgumentSchema() {
    return zodToParameterSchema(ToDosDefinitionSchema);
  }

  protected async _execute(context: any, kwargs: Record<string, any> = {}): Promise<string> {
    const agentId = context?.agent_id ?? context?.agentId ?? 'unknown';

    let todosDef: ToDosDefinition;
    try {
      todosDef = ToDosDefinitionSchema.parse(kwargs);
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
      return `Error: Invalid to-do list definition provided${suffix}`;
    }

    const todoList = new ToDoList(agentId);
    const newTodos = todoList.add_todos(todosDef.todos);
    context.state.todo_list = todoList;

    notifyTodoUpdate(context);

    try {
      return JSON.stringify(newTodos, null, 2);
    } catch (error) {
      return `Successfully created ${newTodos.length} to-do items, but failed to return them in the response.`;
    }
  }
}
