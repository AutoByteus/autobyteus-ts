import { describe, it, expect, beforeEach } from 'vitest';
import { ToolFormattingRegistry, registerToolFormatter } from '../../../../../src/tools/usage/registries/tool_formatting_registry.js';
import { ToolFormatterPair } from '../../../../../src/tools/usage/registries/tool_formatter_pair.js';
import { LLMProvider } from '../../../../../src/llm/providers.js';
import { OpenAiJsonSchemaFormatter } from '../../../../../src/tools/usage/formatters/openai_json_schema_formatter.js';
import { OpenAiJsonExampleFormatter } from '../../../../../src/tools/usage/formatters/openai_json_example_formatter.js';
import { DefaultXmlSchemaFormatter } from '../../../../../src/tools/usage/formatters/default_xml_schema_formatter.js';
import { DefaultXmlExampleFormatter } from '../../../../../src/tools/usage/formatters/default_xml_example_formatter.js';
import { DefaultJsonSchemaFormatter } from '../../../../../src/tools/usage/formatters/default_json_schema_formatter.js';
import { DefaultJsonExampleFormatter } from '../../../../../src/tools/usage/formatters/default_json_example_formatter.js';
import { BaseSchemaFormatter, BaseExampleFormatter } from '../../../../../src/tools/usage/formatters/base_formatter.js';

class DummySchemaFormatter implements BaseSchemaFormatter {
  provide(): any {
    return {};
  }
}

class DummyExampleFormatter implements BaseExampleFormatter {
  provide(): any {
    return '';
  }
}

describe('ToolFormattingRegistry', () => {
  beforeEach(() => {
    delete process.env.AUTOBYTEUS_STREAM_PARSER;
    (ToolFormattingRegistry as any).instance = undefined;
  });

  it('test_get_openai_json_pair', () => {
    const registry = new ToolFormattingRegistry();
    const pair = registry.getFormatterPair(LLMProvider.OPENAI);
    expect(pair).toBeInstanceOf(ToolFormatterPair);
    expect(pair.schemaFormatter).toBeInstanceOf(OpenAiJsonSchemaFormatter);
    expect(pair.exampleFormatter).toBeInstanceOf(OpenAiJsonExampleFormatter);
  });

  it('test_get_anthropic_xml_pair', () => {
    const registry = new ToolFormattingRegistry();
    const pair = registry.getFormatterPair(LLMProvider.ANTHROPIC);
    expect(pair).toBeInstanceOf(ToolFormatterPair);
    expect(pair.schemaFormatter).toBeInstanceOf(DefaultXmlSchemaFormatter);
    expect(pair.exampleFormatter).toBeInstanceOf(DefaultXmlExampleFormatter);
  });

  it('test_get_default_pair_for_unregistered_provider', () => {
    const registry = new ToolFormattingRegistry();
    const pair = registry.getFormatterPair(LLMProvider.KIMI);
    expect(pair).toBeInstanceOf(ToolFormatterPair);
    expect(pair.schemaFormatter).toBeInstanceOf(DefaultJsonSchemaFormatter);
    expect(pair.exampleFormatter).toBeInstanceOf(DefaultJsonExampleFormatter);
  });

  it('test_get_default_pair_for_none_provider', () => {
    const registry = new ToolFormattingRegistry();
    const pair = registry.getFormatterPair(null);
    expect(pair).toBeInstanceOf(ToolFormatterPair);
    expect(pair.schemaFormatter).toBeInstanceOf(DefaultJsonSchemaFormatter);
    expect(pair.exampleFormatter).toBeInstanceOf(DefaultJsonExampleFormatter);
  });

  it('test_register_tool_formatter_facade', () => {
    const schemaFormatter = new DummySchemaFormatter();
    const exampleFormatter = new DummyExampleFormatter();
    const toolName = 'test_custom_tool';

    registerToolFormatter(toolName, schemaFormatter, exampleFormatter);

    const registry = ToolFormattingRegistry.getInstance() as ToolFormattingRegistry;
    const pair = registry.getFormatterPairForTool(toolName, null);
    expect(pair.schemaFormatter).toBe(schemaFormatter);
    expect(pair.exampleFormatter).toBe(exampleFormatter);
  });
});
