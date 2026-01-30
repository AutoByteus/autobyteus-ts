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

function getTerminalManager(context: AgentContextLike | null | undefined): TerminalSessionManager {
  if (!context) {
    if (!defaultTerminalManager) {
      defaultTerminalManager = new TerminalSessionManager();
    }
    return defaultTerminalManager;
  }

  const contextRecord = context as Record<string, unknown>;
  const existing = contextRecord._terminalSessionManager as TerminalSessionManager | undefined;

  if (!existing) {
    const manager = new TerminalSessionManager();
    contextRecord._terminalSessionManager = manager;
    return manager;
  }

  if (!contextRecord._terminalSessionManager) {
    contextRecord._terminalSessionManager = existing;
  }

  return existing;
}

function getCwd(context: AgentContextLike | null | undefined): string {
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

export async function runBash(
  context: AgentContextLike | null,
  command: string,
  timeoutSeconds: number = 30
): Promise<TerminalResult> {
  const manager = getTerminalManager(context);
  const cwd = getCwd(context);

  await manager.ensureStarted(cwd);
  return manager.executeCommand(command, timeoutSeconds);
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
      category: ToolCategory.SYSTEM,
      paramNames: ['context', 'command', 'timeout_seconds']
    })(runBash) as BaseTool;
    return cachedTool;
  }

  if (!cachedTool) {
    cachedTool = defaultToolRegistry.createTool(TOOL_NAME) as BaseTool;
  }

  return cachedTool;
}
