import { BaseTool } from '../../../tools/base_tool.js';
import { ToolCategory } from '../../../tools/tool_category.js';

export class GetToDoList extends BaseTool {
  static CATEGORY = ToolCategory.TASK_MANAGEMENT;

  static getName(): string {
    return 'get_todo_list';
  }

  static getDescription(): string {
    return (
      'Retrieves your current personal to-do list. ' +
      'Use this to see your plan, check the status of your steps, and decide what to do next.'
    );
  }

  static getArgumentSchema() {
    return null;
  }

  protected async _execute(context: any): Promise<string> {
    const todoList = context?.state?.todo_list;
    if (!todoList || todoList.get_all_todos().length === 0) {
      return 'Your to-do list is empty.';
    }

    try {
      const todosForLLM = todoList.get_all_todos();
      return JSON.stringify(todosForLLM, null, 2);
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      return `Error: An unexpected error occurred while formatting your to-do list: ${details}`;
    }
  }
}
