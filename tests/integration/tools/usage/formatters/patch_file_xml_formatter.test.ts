import { describe, it, expect } from 'vitest';
import { ToolFormattingRegistry } from '../../../../../src/tools/usage/registries/tool_formatting_registry.js';
import { PatchFileXmlSchemaFormatter } from '../../../../../src/tools/usage/formatters/patch_file_xml_schema_formatter.js';
import { PatchFileXmlExampleFormatter } from '../../../../../src/tools/usage/formatters/patch_file_xml_example_formatter.js';

describe('PatchFileXmlFormatter (integration)', () => {
  it('registry returns patch_file-specific formatters', () => {
    (ToolFormattingRegistry as any).instance = undefined;
    const registry = new ToolFormattingRegistry();
    const pair = registry.getFormatterPairForTool('patch_file', null);
    expect(pair.schemaFormatter).toBeInstanceOf(PatchFileXmlSchemaFormatter);
    expect(pair.exampleFormatter).toBeInstanceOf(PatchFileXmlExampleFormatter);
  });
});
