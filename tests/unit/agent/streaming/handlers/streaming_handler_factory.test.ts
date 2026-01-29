import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StreamingResponseHandlerFactory, StreamingHandlerResult } from '../../../../../src/agent/streaming/handlers/streaming_handler_factory.js';
import { ParsingStreamingResponseHandler } from '../../../../../src/agent/streaming/handlers/parsing_streaming_response_handler.js';
import { PassThroughStreamingResponseHandler } from '../../../../../src/agent/streaming/handlers/pass_through_streaming_response_handler.js';
import { ApiToolCallStreamingResponseHandler } from '../../../../../src/agent/streaming/handlers/api_tool_call_streaming_response_handler.js';
import { LLMProvider } from '../../../../../src/llm/providers.js';
import { ToolSchemaProvider } from '../../../../../src/tools/usage/providers/tool_schema_provider.js';

const ENV_VAR = 'AUTOBYTEUS_STREAM_PARSER';

const factoryOptions = (overrides?: Partial<{
  tool_names: string[];
  provider?: LLMProvider | null;
  segment_id_prefix?: string | null;
  on_segment_event?: any;
  on_tool_invocation?: any;
  agent_id?: string | null;
}>) => ({
  tool_names: ['test_tool'],
  provider: LLMProvider.OPENAI,
  segment_id_prefix: 'test:',
  on_segment_event: null,
  on_tool_invocation: null,
  agent_id: 'agent_test',
  ...overrides
});

let envBackup: string | undefined;

beforeEach(() => {
  envBackup = process.env[ENV_VAR];
});

afterEach(() => {
  if (envBackup === undefined) {
    delete process.env[ENV_VAR];
  } else {
    process.env[ENV_VAR] = envBackup;
  }
  vi.restoreAllMocks();
});

describe('StreamingHandlerResult', () => {
  it('contains handler', () => {
    const result = StreamingResponseHandlerFactory.create(factoryOptions());
    expect(result.handler).toBeDefined();
    expect(result).toBeInstanceOf(StreamingHandlerResult);
  });
});

describe('No tools mode', () => {
  it('uses pass-through when no tools', () => {
    const result = StreamingResponseHandlerFactory.create(factoryOptions({ tool_names: [] }));
    expect(result.handler).toBeInstanceOf(PassThroughStreamingResponseHandler);
    expect(result.tool_schemas).toBeNull();
  });

  it('uses pass-through for empty tool list', () => {
    const result = StreamingResponseHandlerFactory.create(factoryOptions({ tool_names: [] }));
    expect(result.handler).toBeInstanceOf(PassThroughStreamingResponseHandler);
  });
});

describe('API tool call mode', () => {
  it('uses API handler when format is api_tool_call', () => {
    process.env[ENV_VAR] = 'api_tool_call';
    const result = StreamingResponseHandlerFactory.create(factoryOptions());
    expect(result.handler).toBeInstanceOf(ApiToolCallStreamingResponseHandler);
  });

  it('builds tool schemas in API mode', () => {
    process.env[ENV_VAR] = 'api_tool_call';
    const mockSchemas = [{ type: 'function', function: { name: 'test_tool' } }];
    const spy = vi.spyOn(ToolSchemaProvider.prototype, 'buildSchema').mockReturnValue(mockSchemas);

    const result = StreamingResponseHandlerFactory.create(factoryOptions());
    expect(result.tool_schemas).toEqual(mockSchemas);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('API mode without tools uses pass-through', () => {
    process.env[ENV_VAR] = 'api_tool_call';
    const result = StreamingResponseHandlerFactory.create(factoryOptions({ tool_names: [] }));
    expect(result.handler).toBeInstanceOf(PassThroughStreamingResponseHandler);
    expect(result.tool_schemas).toBeNull();
  });
});

describe('Text parsing modes', () => {
  it('xml mode uses parsing handler', () => {
    process.env[ENV_VAR] = 'xml';
    const result = StreamingResponseHandlerFactory.create(factoryOptions());
    expect(result.handler).toBeInstanceOf(ParsingStreamingResponseHandler);
    expect((result.handler as ParsingStreamingResponseHandler).parser_name).toBe('xml');
    expect(result.tool_schemas).toBeNull();
  });

  it('json mode uses parsing handler', () => {
    process.env[ENV_VAR] = 'json';
    const result = StreamingResponseHandlerFactory.create(factoryOptions());
    expect(result.handler).toBeInstanceOf(ParsingStreamingResponseHandler);
    expect((result.handler as ParsingStreamingResponseHandler).parser_name).toBe('json');
    expect(result.tool_schemas).toBeNull();
  });

  it('sentinel mode uses parsing handler', () => {
    process.env[ENV_VAR] = 'sentinel';
    const result = StreamingResponseHandlerFactory.create(factoryOptions());
    expect(result.handler).toBeInstanceOf(ParsingStreamingResponseHandler);
    expect((result.handler as ParsingStreamingResponseHandler).parser_name).toBe('sentinel');
    expect(result.tool_schemas).toBeNull();
  });
});

describe('Provider defaults', () => {
  it('Anthropic defaults to xml', () => {
    const parserName = StreamingResponseHandlerFactory.resolve_parser_name({
      format_override: null,
      provider: LLMProvider.ANTHROPIC
    });
    expect(parserName).toBe('xml');
  });

  it('OpenAI defaults to json', () => {
    const parserName = StreamingResponseHandlerFactory.resolve_parser_name({
      format_override: null,
      provider: LLMProvider.OPENAI
    });
    expect(parserName).toBe('json');
  });

  it('Gemini defaults to json', () => {
    const parserName = StreamingResponseHandlerFactory.resolve_parser_name({
      format_override: null,
      provider: LLMProvider.GEMINI
    });
    expect(parserName).toBe('json');
  });
});

describe('Format override', () => {
  it('xml override for OpenAI', () => {
    process.env[ENV_VAR] = 'xml';
    const result = StreamingResponseHandlerFactory.create(factoryOptions({ provider: LLMProvider.OPENAI }));
    expect(result.handler).toBeInstanceOf(ParsingStreamingResponseHandler);
    expect((result.handler as ParsingStreamingResponseHandler).parser_name).toBe('xml');
  });

  it('api_tool_call override for Anthropic', () => {
    process.env[ENV_VAR] = 'api_tool_call';
    const result = StreamingResponseHandlerFactory.create(factoryOptions({ provider: LLMProvider.ANTHROPIC }));
    expect(result.handler).toBeInstanceOf(ApiToolCallStreamingResponseHandler);
  });
});
