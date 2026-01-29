import { defaultToolRegistry } from './registry/tool_registry.js';
import { registerToolClass } from './tool_meta.js';
import { registerReadFileTool } from './file/read_file.js';
import { registerWriteFileTool } from './file/write_file.js';
import { registerPatchFileTool } from './file/patch_file.js';
import { registerLoadSkillTool } from './skill/load_skill.js';
import { registerRunBashTool } from './terminal/tools/run_bash.js';
import { registerStartBackgroundProcessTool } from './terminal/tools/start_background_process.js';
import { registerGetProcessOutputTool } from './terminal/tools/get_process_output.js';
import { registerStopBackgroundProcessTool } from './terminal/tools/stop_background_process.js';
import { SendMessageTo } from '../agent/message/send_message_to.js';
import { Search } from './search_tool.js';
import { GenerateImageTool, EditImageTool } from './multimedia/image_tools.js';
import { GenerateSpeechTool } from './multimedia/audio_tools.js';
import { ReadMediaFile } from './multimedia/media_reader_tool.js';
import { DownloadMediaTool } from './multimedia/download_media_tool.js';
import { ReadUrl } from './web/read_url_tool.js';
import { AssignTaskTo } from '../task_management/tools/task_tools/assign_task_to.js';
import { CreateTasks } from '../task_management/tools/task_tools/create_tasks.js';
import { CreateTask } from '../task_management/tools/task_tools/create_task.js';
import { GetMyTasks } from '../task_management/tools/task_tools/get_my_tasks.js';
import { GetTaskPlanStatus } from '../task_management/tools/task_tools/get_task_plan_status.js';
import { UpdateTaskStatus } from '../task_management/tools/task_tools/update_task_status.js';
import { AddToDo } from '../task_management/tools/todo_tools/add_todo.js';
import { CreateToDoList } from '../task_management/tools/todo_tools/create_todo_list.js';
import { GetToDoList } from '../task_management/tools/todo_tools/get_todo_list.js';
import { UpdateToDoStatus } from '../task_management/tools/todo_tools/update_todo_status.js';

let toolsRegistered = false;

export function registerTools(): void {
  if (toolsRegistered && defaultToolRegistry.listTools().length > 0) return;

  registerReadFileTool();
  registerWriteFileTool();
  registerPatchFileTool();
  registerLoadSkillTool();
  registerRunBashTool();
  registerStartBackgroundProcessTool();
  registerGetProcessOutputTool();
  registerStopBackgroundProcessTool();

  registerToolClass(Search);
  registerToolClass(GenerateImageTool);
  registerToolClass(EditImageTool);
  registerToolClass(GenerateSpeechTool);
  registerToolClass(ReadMediaFile);
  registerToolClass(DownloadMediaTool);
  registerToolClass(ReadUrl);
  registerToolClass(SendMessageTo);
  registerToolClass(AssignTaskTo);
  registerToolClass(CreateTasks);
  registerToolClass(CreateTask);
  registerToolClass(GetMyTasks);
  registerToolClass(GetTaskPlanStatus);
  registerToolClass(UpdateTaskStatus);
  registerToolClass(AddToDo);
  registerToolClass(CreateToDoList);
  registerToolClass(GetToDoList);
  registerToolClass(UpdateToDoStatus);

  toolsRegistered = true;
}
