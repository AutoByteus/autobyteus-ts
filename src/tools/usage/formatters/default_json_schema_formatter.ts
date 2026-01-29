import { UsageFormatter } from './base_formatter.js';
import { ToolDefinition } from '../../registry/tool_definition.js';

export class DefaultJsonSchemaFormatter implements UsageFormatter {
  provide(tool: ToolDefinition): Record<string, any> {
    const schema = tool.argumentSchema
      ? tool.argumentSchema.toJsonSchema()
      : { type: "object", properties: {}, required: [] };

    return {
      name: tool.name,
      description: tool.description,
      inputSchema: schema
    };
  }
}
