import { tool } from '../../functional_tool.js';
import type { BaseTool } from '../../base_tool.js';
import { ToolCategory } from '../../tool_category.js';
import { ParameterSchema, ParameterDefinition, ParameterType } from '../../../utils/parameter_schema.js';
import { defaultToolRegistry } from '../../registry/tool_registry.js';
import { BackgroundProcessManager } from '../background_process_manager.js';
import type { AgentContextLike } from './run_bash.js';

let defaultBackgroundManager: BackgroundProcessManager | null = null;

function _get_background_manager(context: AgentContextLike | null | undefined): BackgroundProcessManager {
  if (!context) {
    if (!defaultBackgroundManager) {
      defaultBackgroundManager = new BackgroundProcessManager();
    }
    return defaultBackgroundManager;
  }

  const contextAny = context as Record<string, any>;
  if (!contextAny._background_process_manager) {
    contextAny._background_process_manager = new BackgroundProcessManager();
  }

  return contextAny._background_process_manager as BackgroundProcessManager;
}

export async function stop_background_process(
  context: AgentContextLike | null,
  process_id: string
): Promise<{ status: string; process_id: string }> {
  const manager = _get_background_manager(context);
  const success = await manager.stop_process(process_id);
  return { status: success ? 'stopped' : 'not_found', process_id };
}

const argumentSchema = new ParameterSchema();
argumentSchema.addParameter(new ParameterDefinition({
  name: 'process_id',
  type: ParameterType.STRING,
  description: "Parameter 'process_id' for tool 'stop_background_process'.",
  required: true
}));

const TOOL_NAME = 'stop_background_process';
let cachedTool: BaseTool | null = null;

export function registerStopBackgroundProcessTool(): BaseTool {
  if (!defaultToolRegistry.getToolDefinition(TOOL_NAME)) {
    cachedTool = tool({
      name: TOOL_NAME,
      description: 'Stop a running background process.',
      argumentSchema,
      category: ToolCategory.SYSTEM
    })(stop_background_process) as BaseTool;
    return cachedTool;
  }

  if (!cachedTool) {
    cachedTool = defaultToolRegistry.createTool(TOOL_NAME) as BaseTool;
  }

  return cachedTool;
}
