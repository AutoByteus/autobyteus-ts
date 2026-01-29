import { describe, it, expect } from 'vitest';
import { GeminiJsonSchemaFormatter } from '../../../../../src/tools/usage/formatters/gemini_json_schema_formatter.js';
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

describe('GeminiJsonSchemaFormatter (integration)', () => {
  it('produces empty parameters for tools without arguments', () => {
    const formatter = new GeminiJsonSchemaFormatter();
    const toolDef = new ToolDefinition(
      'NoArgTool',
      'Tool with no args.',
      ToolOrigin.LOCAL,
      'general',
      () => null,
      () => null,
      { toolClass: NoArgTool }
    );

    const output = formatter.provide(toolDef);

    expect(output).toEqual({
      name: 'NoArgTool',
      description: 'Tool with no args.',
      parameters: { type: 'object', properties: {}, required: [] }
    });
  });
});
