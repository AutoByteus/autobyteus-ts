import { describe, it, expect } from 'vitest';
import { PatchFileXmlSchemaFormatter } from '../../../../../src/tools/usage/formatters/patch-file-xml-schema-formatter.js';
import { PatchFileXmlExampleFormatter } from '../../../../../src/tools/usage/formatters/patch-file-xml-example-formatter.js';
import { ToolDefinition } from '../../../../../src/tools/registry/tool-definition.js';
import { ToolOrigin } from '../../../../../src/tools/tool-origin.js';
import { ToolCategory } from '../../../../../src/tools/tool-category.js';

describe('PatchFileXmlFormatter', () => {
  const toolDef = new ToolDefinition(
    'patch_file',
    'Patches a file.',
    ToolOrigin.LOCAL,
    ToolCategory.GENERAL,
    () => null,
    () => null,
    { customFactory: () => ({} as any) }
  );

  it('schema uses standard XML structure', () => {
    const formatter = new PatchFileXmlSchemaFormatter();
    const schema = formatter.provide(toolDef);
    expect(schema).toContain('<tool name="patch_file">');
    expect(schema).toContain('</tool>');
    expect(schema).toContain('<arguments>');
  });

  it('schema includes sentinel instructions', () => {
    const formatter = new PatchFileXmlSchemaFormatter();
    const schema = formatter.provide(toolDef);
    expect(schema).toContain('__START_PATCH__');
    expect(schema).toContain('__END_PATCH__');
    expect(schema).toContain('sentinel tags');
  });

  it('example uses standard XML structure', () => {
    const formatter = new PatchFileXmlExampleFormatter();
    const example = formatter.provide(toolDef);
    expect(example).toContain('<tool name="patch_file">');
    expect(example).toContain('</tool>');
    expect(example).toContain('<arguments>');
  });

  it('example includes sentinel tags', () => {
    const formatter = new PatchFileXmlExampleFormatter();
    const example = formatter.provide(toolDef);
    expect(example).toContain('__START_PATCH__');
    expect(example).toContain('__END_PATCH__');
    expect(example).toContain('<arg name="path">/path/to/utils.py</arg>');
  });
});
