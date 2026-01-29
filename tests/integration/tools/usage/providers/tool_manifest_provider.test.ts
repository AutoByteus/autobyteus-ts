import { describe, it, expect } from 'vitest';
import { ToolManifestProvider } from '../../../../../src/tools/usage/providers/tool_manifest_provider.js';
import { ToolDefinition } from '../../../../../src/tools/registry/tool_definition.js';
import { ParameterSchema, ParameterDefinition, ParameterType } from '../../../../../src/utils/parameter_schema.js';
import { ToolOrigin } from '../../../../../src/tools/tool_origin.js';
import { ToolCategory } from '../../../../../src/tools/tool_category.js';
import { LLMProvider } from '../../../../../src/llm/providers.js';

describe('ToolManifestProvider (integration)', () => {
  it('builds JSON manifest for OpenAI provider', () => {
    const schema = new ParameterSchema();
    schema.addParameter(new ParameterDefinition({
      name: 'query',
      type: ParameterType.STRING,
      description: 'Query',
      required: true
    }));

    const toolDef = new ToolDefinition(
      'SearchTool',
      'Search tool',
      ToolOrigin.LOCAL,
      ToolCategory.GENERAL,
      () => schema,
      () => null,
      { customFactory: () => ({} as any) }
    );

    const provider = new ToolManifestProvider();
    const manifest = provider.provide([toolDef], LLMProvider.OPENAI);

    expect(manifest).toContain('"name": "SearchTool"');
    expect(manifest).toContain('Example: To use this tool');
  });
});
