import { BaseTool } from '../base_tool.js';
import { ToolConfig } from '../tool_config.js';

export abstract class ToolFactory {
  abstract createTool(config?: ToolConfig): BaseTool;
}
