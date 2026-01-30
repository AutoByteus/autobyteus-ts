import { BaseSchemaFormatter } from './base_formatter.js';
import { ToolDefinition } from '../../registry/tool_definition.js';

export class GoogleJsonSchemaFormatter implements BaseSchemaFormatter {
  provide(tool: ToolDefinition): Record<string, unknown> {
    const parameters = tool.argumentSchema
      ? tool.argumentSchema.toJsonSchema()
      : { type: 'object', properties: {}, required: [] };

    return {
      name: tool.name,
      description: tool.description,
      parameters
    };
  }
}
