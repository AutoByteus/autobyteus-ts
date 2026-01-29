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

export async function get_process_output(
  context: AgentContextLike | null,
  process_id: string,
  lines: number = 100
): Promise<{ output: string; is_running: boolean; process_id: string; error?: string }>
{
  const manager = _get_background_manager(context);

  try {
    const result = manager.get_output(process_id, lines);
    return {
      output: result.output,
      is_running: result.is_running,
      process_id: result.process_id
    };
  } catch {
    return {
      output: '',
      is_running: false,
      process_id,
      error: `Process '${process_id}' not found. It may have already stopped or never existed.`
    };
  }
}

const argumentSchema = new ParameterSchema();
argumentSchema.addParameter(new ParameterDefinition({
  name: 'process_id',
  type: ParameterType.STRING,
  description: "Parameter 'process_id' for tool 'get_process_output'.",
  required: true
}));
argumentSchema.addParameter(new ParameterDefinition({
  name: 'lines',
  type: ParameterType.INTEGER,
  description: "Parameter 'lines' for tool 'get_process_output'.",
  required: false,
  defaultValue: 100
}));

const TOOL_NAME = 'get_process_output';
let cachedTool: BaseTool | null = null;

export function registerGetProcessOutputTool(): BaseTool {
  if (!defaultToolRegistry.getToolDefinition(TOOL_NAME)) {
    cachedTool = tool({
      name: TOOL_NAME,
      description: 'Get recent output from a background process.',
      argumentSchema,
      category: ToolCategory.SYSTEM
    })(get_process_output) as BaseTool;
    return cachedTool;
  }

  if (!cachedTool) {
    cachedTool = defaultToolRegistry.createTool(TOOL_NAME) as BaseTool;
  }

  return cachedTool;
}
