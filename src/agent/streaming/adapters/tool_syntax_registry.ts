import { SegmentType } from '../segments/segment_events.js';

export type ToolArgsBuilder = (metadata: Record<string, any>, content: string) => Record<string, any> | null;

export class ToolSyntaxSpec {
  tool_name: string;
  build_arguments: ToolArgsBuilder;

  constructor(toolName: string, buildArguments: ToolArgsBuilder) {
    this.tool_name = toolName;
    this.build_arguments = buildArguments;
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

export const get_tool_syntax_spec = (segmentType: SegmentType): ToolSyntaxSpec | undefined => {
  return TOOL_SYNTAX_REGISTRY.get(segmentType);
};

export const tool_syntax_registry_items = (): Array<[SegmentType, ToolSyntaxSpec]> => {
  return Array.from(TOOL_SYNTAX_REGISTRY.entries());
};
