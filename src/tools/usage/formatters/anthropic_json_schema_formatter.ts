import { BaseSchemaFormatter } from './base_formatter.js';
import { ToolDefinition } from '../../registry/tool_definition.js';

export class AnthropicJsonSchemaFormatter implements BaseSchemaFormatter {
  provide(tool: ToolDefinition): Record<string, unknown> {
    const inputSchema = tool.argumentSchema
      ? tool.argumentSchema.toJsonSchema()
      : { type: 'object', properties: {}, required: [] };

    return {
      name: tool.name,
      description: tool.description,
      input_schema: inputSchema
    };
  }
}
