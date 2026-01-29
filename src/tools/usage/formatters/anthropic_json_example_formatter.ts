import { BaseExampleFormatter } from './base_formatter.js';
import { DefaultXmlExampleFormatter } from './default_xml_example_formatter.js';
import { ToolDefinition } from '../../registry/tool_definition.js';

export class AnthropicJsonExampleFormatter implements BaseExampleFormatter {
  provide(tool: ToolDefinition): string {
    return new DefaultXmlExampleFormatter().provide(tool);
  }
}
