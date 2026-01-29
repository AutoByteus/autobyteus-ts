import { describe, it, expect } from 'vitest';
import { RunBashXmlSchemaFormatter } from '../../../../../src/tools/usage/formatters/run_bash_xml_schema_formatter.js';
import { RunBashXmlExampleFormatter } from '../../../../../src/tools/usage/formatters/run_bash_xml_example_formatter.js';
import { ToolDefinition } from '../../../../../src/tools/registry/tool_definition.js';
import { ToolOrigin } from '../../../../../src/tools/tool_origin.js';

class DummyToolFactory {
  static create(): any {
    return {} as any;
  }
}

describe('RunBashXmlFormatter (integration)', () => {
  it('provides schema and example strings for run_bash', () => {
    const toolDef = new ToolDefinition(
      'run_bash',
      'Runs shell commands.',
      ToolOrigin.LOCAL,
      'general',
      () => null,
      () => null,
      { customFactory: () => DummyToolFactory.create() }
    );

    const schema = new RunBashXmlSchemaFormatter().provide(toolDef);
    const example = new RunBashXmlExampleFormatter().provide(toolDef);

    expect(schema).toContain('## run_bash');
    expect(example).toContain('python -m pytest tests/ -v');
  });
});
