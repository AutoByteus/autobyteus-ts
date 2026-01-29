import os from 'node:os';
import { tool } from '../../functional_tool.js';
import type { BaseTool } from '../../base_tool.js';
import { ToolCategory } from '../../tool_category.js';
import { ParameterSchema, ParameterDefinition, ParameterType } from '../../../utils/parameter_schema.js';
import { defaultToolRegistry } from '../../registry/tool_registry.js';
import { TerminalResult } from '../types.js';
import { TerminalSessionManager } from '../terminal_session_manager.js';

type WorkspaceLike = { getBasePath: () => string };
export type AgentContextLike = { workspace?: WorkspaceLike | null; agentId?: string };

let defaultTerminalManager: TerminalSessionManager | null = null;

function _get_terminal_manager(context: AgentContextLike | null | undefined): TerminalSessionManager {
  if (!context) {
    if (!defaultTerminalManager) {
      defaultTerminalManager = new TerminalSessionManager();
    }
    return defaultTerminalManager;
  }

  const contextAny = context as Record<string, any>;
  if (!contextAny._terminal_session_manager) {
    contextAny._terminal_session_manager = new TerminalSessionManager();
  }

  return contextAny._terminal_session_manager as TerminalSessionManager;
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

export async function run_bash(
  context: AgentContextLike | null,
  command: string,
  timeout_seconds: number = 30
): Promise<TerminalResult> {
  const manager = _get_terminal_manager(context);
  const cwd = _get_cwd(context);

  await manager.ensure_started(cwd);
  return manager.execute_command(command, timeout_seconds);
}

const argumentSchema = new ParameterSchema();
argumentSchema.addParameter(new ParameterDefinition({
  name: 'command',
  type: ParameterType.STRING,
  description: "Parameter 'command' for tool 'run_bash'.",
  required: true
}));
argumentSchema.addParameter(new ParameterDefinition({
  name: 'timeout_seconds',
  type: ParameterType.INTEGER,
  description: "Parameter 'timeout_seconds' for tool 'run_bash'.",
  required: false,
  defaultValue: 30
}));

const TOOL_NAME = 'run_bash';
let cachedTool: BaseTool | null = null;

export function registerRunBashTool(): BaseTool {
  if (!defaultToolRegistry.getToolDefinition(TOOL_NAME)) {
    cachedTool = tool({
      name: TOOL_NAME,
      description: 'Execute a shell command in a stateful terminal session.',
      argumentSchema,
      category: ToolCategory.SYSTEM
    })(run_bash) as BaseTool;
    return cachedTool;
  }

  if (!cachedTool) {
    cachedTool = defaultToolRegistry.createTool(TOOL_NAME) as BaseTool;
  }

  return cachedTool;
}
