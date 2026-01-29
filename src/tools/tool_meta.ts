import { BaseTool, type ToolClass } from './base_tool.js';
import { ToolDefinition } from './registry/tool_definition.js';
import { defaultToolRegistry } from './registry/tool_registry.js';
import { ToolOrigin } from './tool_origin.js';
import { ToolCategory } from './tool_category.js';

const SKIP_CLASSES = new Set(['BaseTool', 'GenericMcpTool', 'FunctionalTool']);

export function registerToolClass(toolClass: ToolClass): boolean {
  if (!toolClass || typeof toolClass !== 'function') {
    return false;
  }

  const className = toolClass.name;
  if (SKIP_CLASSES.has(className)) {
    return false;
  }

  let toolName: string;
  let description: string;
  try {
    toolName = toolClass.getName();
  } catch {
    return false;
  }

  if (!toolName || typeof toolName !== 'string') {
    return false;
  }

  try {
    description = toolClass.getDescription();
  } catch {
    return false;
  }

  if (!description || typeof description !== 'string') {
    return false;
  }

  const category = (toolClass as any).CATEGORY ?? ToolCategory.GENERAL;

  try {
    const definition = new ToolDefinition(
      toolName,
      description,
      ToolOrigin.LOCAL,
      category,
      () => toolClass.getArgumentSchema(),
      () => toolClass.getConfigSchema(),
      { toolClass }
    );
    defaultToolRegistry.registerTool(definition);
    return true;
  } catch {
    return false;
  }
}
