import { describe, it, expect } from 'vitest';
import { ToolFormattingRegistry } from '../../../../../src/tools/usage/registries/tool_formatting_registry.js';
import { LLMProvider } from '../../../../../src/llm/providers.js';
import { DefaultXmlSchemaFormatter } from '../../../../../src/tools/usage/formatters/default_xml_schema_formatter.js';
import { DefaultXmlExampleFormatter } from '../../../../../src/tools/usage/formatters/default_xml_example_formatter.js';

describe('ToolFormattingRegistry (integration)', () => {
  it('respects XML override via environment', () => {
    (ToolFormattingRegistry as any).instance = undefined;
    process.env.AUTOBYTEUS_STREAM_PARSER = 'xml';

    const registry = new ToolFormattingRegistry();
    const pair = registry.getFormatterPair(LLMProvider.OPENAI);
    expect(pair.schemaFormatter).toBeInstanceOf(DefaultXmlSchemaFormatter);
    expect(pair.exampleFormatter).toBeInstanceOf(DefaultXmlExampleFormatter);

    delete process.env.AUTOBYTEUS_STREAM_PARSER;
  });
});
