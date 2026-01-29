import { describe, it, expect } from 'vitest';
import { AnthropicJsonExampleFormatter } from '../../../../../src/tools/usage/formatters/anthropic_json_example_formatter.js';
import { DefaultXmlExampleFormatter } from '../../../../../src/tools/usage/formatters/default_xml_example_formatter.js';
import { ToolDefinition } from '../../../../../src/tools/registry/tool_definition.js';
import { ToolOrigin } from '../../../../../src/tools/tool_origin.js';
import { BaseTool } from '../../../../../src/tools/base_tool.js';

class NoArgTool extends BaseTool {
  protected _execute(): Promise<any> {
    return Promise.resolve();
  }
  static getDescription() { return 'No-arg tool'; }
  static getArgumentSchema() { return null; }
}

describe('AnthropicJsonExampleFormatter (integration)', () => {
  it('matches DefaultXmlExampleFormatter output', () => {
    const toolDef = new ToolDefinition(
      'NoArgTool',
      'Tool with no args.',
      ToolOrigin.LOCAL,
      'general',
      () => null,
      () => null,
      { toolClass: NoArgTool }
    );

    const anthropicOutput = new AnthropicJsonExampleFormatter().provide(toolDef);
    const xmlOutput = new DefaultXmlExampleFormatter().provide(toolDef);

    expect(anthropicOutput).toBe(xmlOutput);
  });
});
