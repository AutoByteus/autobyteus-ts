import { describe, it, expect } from 'vitest';
import { ToolFormattingRegistry } from '../../../../../src/tools/usage/registries/tool-formatting-registry.js';
import { PatchFileXmlSchemaFormatter } from '../../../../../src/tools/usage/formatters/patch-file-xml-schema-formatter.js';
import { PatchFileXmlExampleFormatter } from '../../../../../src/tools/usage/formatters/patch-file-xml-example-formatter.js';

describe('PatchFileXmlFormatter (integration)', () => {
  it('registry returns patch_file-specific formatters', () => {
    (ToolFormattingRegistry as any).instance = undefined;
    const registry = new ToolFormattingRegistry();
    const pair = registry.getFormatterPairForTool('patch_file', null);
    expect(pair.schemaFormatter).toBeInstanceOf(PatchFileXmlSchemaFormatter);
    expect(pair.exampleFormatter).toBeInstanceOf(PatchFileXmlExampleFormatter);
  });
});
