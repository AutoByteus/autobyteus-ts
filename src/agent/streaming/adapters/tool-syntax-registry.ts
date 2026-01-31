import { SegmentType } from '../segments/segment-events.js';

export type ToolArgsBuilder = (metadata: Record<string, any>, content: string) => Record<string, any> | null;

export class ToolSyntaxSpec {
  toolName: string;
  buildArguments: ToolArgsBuilder;

  constructor(toolName: string, buildArguments: ToolArgsBuilder) {
    this.toolName = toolName;
    this.buildArguments = buildArguments;
  }
}

const buildWriteFileArgs: ToolArgsBuilder = (metadata, content) => {
  const path = metadata.path;
  if (!path) {
    return null;
  }
  return { path, content };
};

const buildRunBashArgs: ToolArgsBuilder = (metadata, content) => {
  const command = content || metadata.cmd || '';
  if (!command) {
    return null;
  }
  return { command };
};

const buildPatchFileArgs: ToolArgsBuilder = (metadata, content) => {
  const path = metadata.path;
  if (!path) {
    return null;
  }
  return { path, patch: content };
};

const TOOL_SYNTAX_REGISTRY = new Map<SegmentType, ToolSyntaxSpec>([
  [SegmentType.WRITE_FILE, new ToolSyntaxSpec('write_file', buildWriteFileArgs)],
  [SegmentType.RUN_BASH, new ToolSyntaxSpec('run_bash', buildRunBashArgs)],
  [SegmentType.PATCH_FILE, new ToolSyntaxSpec('patch_file', buildPatchFileArgs)]
]);

export const getToolSyntaxSpec = (segmentType: SegmentType): ToolSyntaxSpec | undefined => {
  return TOOL_SYNTAX_REGISTRY.get(segmentType);
};

export const toolSyntaxRegistryItems = (): Array<[SegmentType, ToolSyntaxSpec]> => {
  return Array.from(TOOL_SYNTAX_REGISTRY.entries());
};
