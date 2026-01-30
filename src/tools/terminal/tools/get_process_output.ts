import { tool } from '../../functional_tool.js';
import type { BaseTool } from '../../base_tool.js';
import { ToolCategory } from '../../tool_category.js';
import { ParameterSchema, ParameterDefinition, ParameterType } from '../../../utils/parameter_schema.js';
import { defaultToolRegistry } from '../../registry/tool_registry.js';
import { BackgroundProcessManager } from '../background_process_manager.js';
import type { AgentContextLike } from './run_bash.js';

let defaultBackgroundManager: BackgroundProcessManager | null = null;

function getBackgroundManager(context: AgentContextLike | null | undefined): BackgroundProcessManager {
  if (!context) {
    if (!defaultBackgroundManager) {
      defaultBackgroundManager = new BackgroundProcessManager();
    }
    return defaultBackgroundManager;
  }

  const contextRecord = context as Record<string, unknown>;
  const existing = contextRecord._backgroundProcessManager as BackgroundProcessManager | undefined;

  if (!existing) {
    const manager = new BackgroundProcessManager();
    contextRecord._backgroundProcessManager = manager;
    return manager;
  }

  if (!contextRecord._backgroundProcessManager) {
    contextRecord._backgroundProcessManager = existing;
  }

  return existing;
}

export async function getProcessOutput(
  context: AgentContextLike | null,
  processId: string,
  lines: number = 100
): Promise<{ output: string; isRunning: boolean; processId: string; error?: string }>
{
  const manager = getBackgroundManager(context);

  try {
    const result = manager.getOutput(processId, lines);
    return {
      output: result.output,
      isRunning: result.isRunning,
      processId: result.processId
    };
  } catch {
    return {
      output: '',
      isRunning: false,
      processId,
      error: `Process '${processId}' not found. It may have already stopped or never existed.`
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
      category: ToolCategory.SYSTEM,
      paramNames: ['context', 'process_id', 'lines']
    })(getProcessOutput) as BaseTool;
    return cachedTool;
  }

  if (!cachedTool) {
    cachedTool = defaultToolRegistry.createTool(TOOL_NAME) as BaseTool;
  }

  return cachedTool;
}
