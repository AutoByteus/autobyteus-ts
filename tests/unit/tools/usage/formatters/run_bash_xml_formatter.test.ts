import { describe, it, expect } from 'vitest';
import { RunBashXmlSchemaFormatter } from '../../../../../src/tools/usage/formatters/run_bash_xml_schema_formatter.js';
import { RunBashXmlExampleFormatter } from '../../../../../src/tools/usage/formatters/run_bash_xml_example_formatter.js';
import { ToolDefinition } from '../../../../../src/tools/registry/tool_definition.js';
import { ToolOrigin } from '../../../../../src/tools/tool_origin.js';
import { ToolCategory } from '../../../../../src/tools/tool_category.js';

describe('RunBashXmlFormatter', () => {
  const toolDef = new ToolDefinition(
    'run_bash',
    'Runs shell commands.',
    ToolOrigin.LOCAL,
    ToolCategory.GENERAL,
    () => null,
    () => null,
    { customFactory: () => ({} as any) }
  );

  it('schema uses shorthand XML syntax', () => {
    const formatter = new RunBashXmlSchemaFormatter();
    const schema = formatter.provide(toolDef);
    expect(schema).toContain('<run_bash>');
    expect(schema).toContain('</run_bash>');
    expect(schema).toContain('Runs a command in the terminal');
  });

  it('example uses shorthand XML syntax', () => {
    const formatter = new RunBashXmlExampleFormatter();
    const example = formatter.provide(toolDef);
    expect(example).toContain('<run_bash>');
    expect(example).toContain('</run_bash>');
    expect(example).toContain('ls -la');
  });
});
