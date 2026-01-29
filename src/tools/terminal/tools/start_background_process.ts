import os from 'node:os';
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

function _get_cwd(context: AgentContextLike | null | undefined): string {
  if (context?.workspace) {
    try {
      const basePath = context.workspace.getBasePath();
      if (basePath && typeof basePath === 'string') {
        return basePath;
      }
    } catch {
      // ignore workspace errors
    }
  }

  return os.tmpdir();
}

export async function start_background_process(
  context: AgentContextLike | null,
  command: string
): Promise<{ process_id: string; status: string }> {
  const manager = _get_background_manager(context);
  const cwd = _get_cwd(context);

  const process_id = await manager.start_process(command, cwd);
  return { process_id, status: 'started' };
}

const argumentSchema = new ParameterSchema();
argumentSchema.addParameter(new ParameterDefinition({
  name: 'command',
  type: ParameterType.STRING,
  description: "Parameter 'command' for tool 'start_background_process'.",
  required: true
}));

const TOOL_NAME = 'start_background_process';
let cachedTool: BaseTool | null = null;

export function registerStartBackgroundProcessTool(): BaseTool {
  if (!defaultToolRegistry.getToolDefinition(TOOL_NAME)) {
    cachedTool = tool({
      name: TOOL_NAME,
      description: 'Start a long-running process in the background and return its process_id.',
      argumentSchema,
      category: ToolCategory.SYSTEM
    })(start_background_process) as BaseTool;
    return cachedTool;
  }

  if (!cachedTool) {
    cachedTool = defaultToolRegistry.createTool(TOOL_NAME) as BaseTool;
  }

  return cachedTool;
}
