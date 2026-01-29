import { describe, it, expect } from 'vitest';
import { ParsingStreamingResponseHandler } from '../../../../src/agent/streaming/handlers/parsing_streaming_response_handler.js';
import { ParserConfig } from '../../../../src/agent/streaming/parser/parser_context.js';
import { get_json_tool_parsing_profile } from '../../../../src/agent/streaming/parser/json_parsing_strategies/index.js';
import { LLMProvider } from '../../../../src/llm/providers.js';
import { ChunkResponse } from '../../../../src/llm/utils/response_types.js';

const chunkText = (text: string, chunkSize = 7): string[] => {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
};

describe('JSON tool styles (integration)', () => {
  const cases: Array<{
    provider: LLMProvider;
    rawJson: string;
    expected: { name: string; args: Record<string, any> };
  }> = [
    {
      provider: LLMProvider.OPENAI,
      rawJson:
        '{"tool_calls": [{"function": {"name": "weather", "arguments": "{\\"city\\": \\\"NYC\\\"}"}}]}',
      expected: { name: 'weather', args: { city: 'NYC' } }
    },
    {
      provider: LLMProvider.GEMINI,
      rawJson: '{"name": "search", "args": {"query": "autobyteus"}}',
      expected: { name: 'search', args: { query: 'autobyteus' } }
    },
    {
      provider: LLMProvider.KIMI,
      rawJson: '{"tool": {"function": "write_file", "parameters": {"path": "a.txt"}}}',
      expected: { name: 'write_file', args: { path: 'a.txt' } }
    }
  ];

  for (const { provider, rawJson, expected } of cases) {
    it(`parses JSON tool style for ${provider}`, () => {
      const profile = get_json_tool_parsing_profile(provider);
      const config = new ParserConfig({
        parse_tool_calls: true,
        json_tool_patterns: profile.signature_patterns,
        json_tool_parser: profile.parser,
        strategy_order: ['json_tool']
      });
      const handler = new ParsingStreamingResponseHandler({ config, parser_name: 'json' });

      for (const chunk of chunkText(rawJson, 5)) {
        handler.feed(new ChunkResponse({ content: chunk }));
      }

      handler.finalize();

      const invocations = handler.get_all_invocations();
      expect(invocations).toHaveLength(1);
      expect(invocations[0].name).toBe(expected.name);
      expect(invocations[0].arguments).toEqual(expected.args);
    });
  }
});
