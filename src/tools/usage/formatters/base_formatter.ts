import { ToolDefinition } from '../../registry/tool_definition.js';

export interface UsageFormatter {
  provide(tool: ToolDefinition): any;
}

export interface BaseSchemaFormatter extends UsageFormatter {}

export interface BaseExampleFormatter extends UsageFormatter {}

export abstract class BaseXmlSchemaFormatter implements BaseSchemaFormatter {
  abstract provide(tool: ToolDefinition): any;
}
