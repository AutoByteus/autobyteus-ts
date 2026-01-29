import fs from 'fs/promises';
import pathModule from 'path';
import { tool } from '../functional_tool.js';
import type { BaseTool } from '../base_tool.js';
import { ToolCategory } from '../tool_category.js';
import { defaultToolRegistry } from '../registry/tool_registry.js';
import { ParameterSchema, ParameterDefinition, ParameterType } from '../../utils/parameter_schema.js';

const DESCRIPTION = [
  'Reads content from a specified file. Supports optional 1-based inclusive line ranges via start_line/end_line.',
  'Each returned line is prefixed with its line number when include_line_numbers is true.',
  "'path' is the path to the file. If relative, it must be resolved against a configured agent workspace.",
  'Raises ValueError if a relative path is given without a valid workspace or if line range arguments are invalid.',
  'Raises FileNotFoundError if the file does not exist.',
  'Raises IOError if file reading fails for other reasons.'
].join(' ');

const argumentSchema = new ParameterSchema();
argumentSchema.addParameter(new ParameterDefinition({
  name: 'path',
  type: ParameterType.STRING,
  description: "Parameter 'path' for tool 'read_file'. This is expected to be a path.",
  required: true
}));
argumentSchema.addParameter(new ParameterDefinition({
  name: 'start_line',
  type: ParameterType.INTEGER,
  description: "Parameter 'start_line' for tool 'read_file'.",
  required: false
}));
argumentSchema.addParameter(new ParameterDefinition({
  name: 'end_line',
  type: ParameterType.INTEGER,
  description: "Parameter 'end_line' for tool 'read_file'.",
  required: false
}));
argumentSchema.addParameter(new ParameterDefinition({
  name: 'include_line_numbers',
  type: ParameterType.BOOLEAN,
  description: 'If true, prefix each returned line with its line number (default).',
  required: false,
  defaultValue: true
}));

type WorkspaceLike = { getBasePath: () => string };
type AgentContextLike = { agentId: string; workspace?: WorkspaceLike | null };

export async function readFile(
  context: AgentContextLike,
  path: string,
  start_line?: number | null,
  end_line?: number | null,
  include_line_numbers: boolean = true
): Promise<string> {
  if (start_line !== undefined && start_line !== null && start_line < 1) {
    throw new Error(`start_line must be >= 1 when provided; got ${start_line}.`);
  }
  if (end_line !== undefined && end_line !== null && end_line < 1) {
    throw new Error(`end_line must be >= 1 when provided; got ${end_line}.`);
  }
  if (
    start_line !== undefined &&
    start_line !== null &&
    end_line !== undefined &&
    end_line !== null &&
    end_line < start_line
  ) {
    throw new Error(`end_line (${end_line}) must be >= start_line (${start_line}).`);
  }

  let finalPath = path;
  if (!pathModule.isAbsolute(path)) {
    const workspace = context.workspace ?? null;
    if (!workspace) {
      throw new Error(
        `Relative path '${path}' provided, but no workspace is configured for agent '${context.agentId}'. A workspace is required to resolve relative paths.`
      );
    }
    const basePath = workspace.getBasePath();
    if (!basePath || typeof basePath !== 'string') {
      throw new Error(
        `Agent '${context.agentId}' has a configured workspace, but it provided an invalid base path ('${basePath}'). Cannot resolve relative path '${path}'.`
      );
    }
    finalPath = pathModule.join(basePath, path);
  }

  finalPath = pathModule.normalize(finalPath);

  try {
    await fs.access(finalPath);
  } catch {
    throw new Error(`The file at resolved path ${finalPath} does not exist.`);
  }

  try {
    const fileContents = await fs.readFile(finalPath, 'utf-8');
    const lines = fileContents.match(/.*(?:\n|$)/g) ?? [];
    const selected: string[] = [];
    let lineNo = 0;

    for (const line of lines) {
      if (line === '') {
        continue;
      }
      lineNo += 1;
      if (start_line !== undefined && start_line !== null && lineNo < start_line) {
        continue;
      }
      if (end_line !== undefined && end_line !== null && lineNo > end_line) {
        break;
      }

      if (include_line_numbers) {
        const hasNewline = line.endsWith('\n');
        const lineText = hasNewline ? line.slice(0, -1) : line;
        selected.push(`${lineNo}: ${lineText}${hasNewline ? '\n' : ''}`);
      } else {
        selected.push(line);
      }
    }

    return selected.join('');
  } catch (error: any) {
    throw new Error(`Could not read file at ${finalPath}: ${error?.message ?? String(error)}`);
  }
}

const TOOL_NAME = 'read_file';
let cachedTool: BaseTool | null = null;

export function registerReadFileTool(): BaseTool {
  if (!defaultToolRegistry.getToolDefinition(TOOL_NAME)) {
    cachedTool = tool({
      name: TOOL_NAME,
      description: DESCRIPTION,
      argumentSchema,
      category: ToolCategory.FILE_SYSTEM
    })(readFile) as BaseTool;
    return cachedTool;
  }

  if (!cachedTool) {
    cachedTool = defaultToolRegistry.createTool(TOOL_NAME) as BaseTool;
  }

  return cachedTool;
}
