import { ParserConfig } from './parser_context.js';
import { StreamingParser } from './streaming_parser.js';
import type { SegmentEvent } from './events.js';
import type { JsonToolParsingStrategy } from './json_parsing_strategies/base.js';

export interface StreamingParserProtocol {
  readonly config: ParserConfig;
  feed(chunk: string): SegmentEvent[];
  finalize(): SegmentEvent[];
}

export const ENV_PARSER_NAME = 'AUTOBYTEUS_STREAM_PARSER';
export const DEFAULT_PARSER_NAME = 'xml';

type ParserBuilder = (config?: ParserConfig) => StreamingParserProtocol;

function cloneConfig(
  config: ParserConfig | undefined,
  options: {
    parse_tool_calls?: boolean;
    json_tool_patterns?: string[];
    json_tool_parser?: JsonToolParsingStrategy;
    strategy_order?: string[];
    segment_id_prefix?: string;
  }
): ParserConfig {
  const base = config ?? new ParserConfig();
  return new ParserConfig({
    parse_tool_calls: options.parse_tool_calls ?? base.parse_tool_calls,
    json_tool_patterns: options.json_tool_patterns ?? [...base.json_tool_patterns],
    json_tool_parser: options.json_tool_parser ?? base.json_tool_parser,
    strategy_order: options.strategy_order ?? [...base.strategy_order],
    segment_id_prefix: options.segment_id_prefix ?? base.segment_id_prefix
  });
}

function buildXml(config?: ParserConfig): StreamingParserProtocol {
  const xmlConfig = cloneConfig(config, { parse_tool_calls: true, strategy_order: ['xml_tag'] });
  return new StreamingParser(xmlConfig);
}

function buildJson(config?: ParserConfig): StreamingParserProtocol {
  const jsonConfig = cloneConfig(config, { parse_tool_calls: true, strategy_order: ['json_tool'] });
  return new StreamingParser(jsonConfig);
}

function buildApiToolCall(config?: ParserConfig): StreamingParserProtocol {
  const apiToolCallConfig = cloneConfig(config, { parse_tool_calls: false });
  return new StreamingParser(apiToolCallConfig);
}

function buildSentinel(config?: ParserConfig): StreamingParserProtocol {
  const sentinelConfig = cloneConfig(config, { parse_tool_calls: true, strategy_order: ['sentinel'] });
  return new StreamingParser(sentinelConfig);
}

export const PARSER_REGISTRY: Record<string, ParserBuilder> = {
  xml: buildXml,
  json: buildJson,
  api_tool_call: buildApiToolCall,
  sentinel: buildSentinel
};

export function resolve_parser_name(explicitName?: string): string {
  const name = explicitName ?? process.env[ENV_PARSER_NAME] ?? DEFAULT_PARSER_NAME;
  return name.trim().toLowerCase();
}

export function create_streaming_parser(options?: {
  config?: ParserConfig;
  parser_name?: string;
}): StreamingParserProtocol {
  const name = resolve_parser_name(options?.parser_name);
  const builder = PARSER_REGISTRY[name];
  if (!builder) {
    throw new Error(`Unknown parser strategy '${name}'. Supported: ${Object.keys(PARSER_REGISTRY).sort().join(', ')}.`);
  }
  return builder(options?.config);
}
