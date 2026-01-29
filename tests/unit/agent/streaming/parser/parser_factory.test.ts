import { describe, it, expect } from 'vitest';
import { ENV_PARSER_NAME, create_streaming_parser, resolve_parser_name } from '../../../../../src/agent/streaming/parser/parser_factory.js';
import { ParserConfig } from '../../../../../src/agent/streaming/parser/parser_context.js';
import { StreamingParser } from '../../../../../src/agent/streaming/parser/streaming_parser.js';

describe('parser_factory', () => {
  it('defaults to xml when env is unset', () => {
    const prev = process.env[ENV_PARSER_NAME];
    delete process.env[ENV_PARSER_NAME];
    expect(resolve_parser_name()).toBe('xml');
    if (prev !== undefined) {
      process.env[ENV_PARSER_NAME] = prev;
    }
  });

  it('uses env override when set', () => {
    const prev = process.env[ENV_PARSER_NAME];
    process.env[ENV_PARSER_NAME] = 'api_tool_call';
    expect(resolve_parser_name()).toBe('api_tool_call');
    if (prev !== undefined) {
      process.env[ENV_PARSER_NAME] = prev;
    } else {
      delete process.env[ENV_PARSER_NAME];
    }
  });

  it('creates xml parser', () => {
    const parser = create_streaming_parser({ parser_name: 'xml' });
    expect(parser).toBeInstanceOf(StreamingParser);
  });

  it('api_tool_call parser disables tool parsing', () => {
    const config = new ParserConfig({ parse_tool_calls: true, strategy_order: ['xml_tag'] });
    const parser = create_streaming_parser({ config, parser_name: 'api_tool_call' });
    expect(parser.config.parse_tool_calls).toBe(false);
  });

  it('native parser removed raises', () => {
    expect(() => create_streaming_parser({ parser_name: 'native' })).toThrowError(/Unknown parser strategy/i);
  });

  it('creates sentinel parser', () => {
    const parser = create_streaming_parser({ parser_name: 'sentinel' });
    expect(parser).toBeInstanceOf(StreamingParser);
  });

  it('unknown parser raises', () => {
    expect(() => create_streaming_parser({ parser_name: 'unknown' })).toThrowError(/Unknown parser strategy/i);
  });
});
