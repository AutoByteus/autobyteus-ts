import { randomUUID } from 'node:crypto';
import { StreamingResponseHandler } from './streaming_response_handler.js';
import { ParsingStreamingResponseHandler } from './parsing_streaming_response_handler.js';
import { PassThroughStreamingResponseHandler } from './pass_through_streaming_response_handler.js';
import { ApiToolCallStreamingResponseHandler } from './api_tool_call_streaming_response_handler.js';
import { ParserConfig } from '../parser/parser_context.js';
import { get_json_tool_parsing_profile } from '../parser/json_parsing_strategies/registry.js';
import { SegmentEvent } from '../segments/segment_events.js';
import { ToolInvocation } from '../../tool_invocation.js';
import { LLMProvider } from '../../../llm/providers.js';
import { resolveToolCallFormat } from '../../../utils/tool_call_format.js';
import { ToolSchemaProvider } from '../../../tools/usage/providers/tool_schema_provider.js';

export class StreamingHandlerResult {
  handler: StreamingResponseHandler;
  tool_schemas: Array<Record<string, any>> | null;

  constructor(handler: StreamingResponseHandler, toolSchemas: Array<Record<string, any>> | null = null) {
    this.handler = handler;
    this.tool_schemas = toolSchemas;
  }
}

export class StreamingResponseHandlerFactory {
  static create(options: {
    tool_names: string[];
    provider?: LLMProvider | null;
    segment_id_prefix?: string | null;
    on_segment_event?: (event: SegmentEvent) => void;
    on_tool_invocation?: (invocation: ToolInvocation) => void;
    agent_id?: string | null;
  }): StreamingHandlerResult {
    const formatOverride = resolveToolCallFormat();
    const parseToolCalls = options.tool_names.length > 0;

    let segmentIdPrefix = options.segment_id_prefix ?? undefined;
    if (!segmentIdPrefix) {
      segmentIdPrefix = `turn_${randomUUID().replace(/-/g, '')}:`;
    }

    if (!parseToolCalls) {
      return new StreamingHandlerResult(
        new PassThroughStreamingResponseHandler({
          on_segment_event: options.on_segment_event,
          on_tool_invocation: options.on_tool_invocation,
          segment_id_prefix: segmentIdPrefix
        }),
        null
      );
    }

    if (formatOverride === 'api_tool_call') {
      const toolSchemas = StreamingResponseHandlerFactory.build_tool_schemas(
        options.tool_names,
        options.provider ?? null
      );
      return new StreamingHandlerResult(
        new ApiToolCallStreamingResponseHandler({
          on_segment_event: options.on_segment_event,
          on_tool_invocation: options.on_tool_invocation,
          segment_id_prefix: segmentIdPrefix
        }),
        toolSchemas
      );
    }

    const parserName = StreamingResponseHandlerFactory.resolve_parser_name({
      format_override: formatOverride,
      provider: options.provider ?? null
    });

    const jsonProfile = get_json_tool_parsing_profile(options.provider ?? null);
    const parserConfig = new ParserConfig({
      parse_tool_calls: parseToolCalls,
      json_tool_patterns: jsonProfile.signature_patterns,
      json_tool_parser: jsonProfile.parser,
      segment_id_prefix: segmentIdPrefix
    });

    return new StreamingHandlerResult(
      new ParsingStreamingResponseHandler({
        on_segment_event: options.on_segment_event,
        on_tool_invocation: options.on_tool_invocation,
        config: parserConfig,
        parser_name: parserName
      }),
      null
    );
  }

  static resolve_parser_name(options: {
    format_override?: string | null;
    provider?: LLMProvider | null;
  }): string {
    const override = options.format_override ?? undefined;
    if (override === 'xml' || override === 'json' || override === 'sentinel') {
      return override;
    }
    return options.provider === LLMProvider.ANTHROPIC ? 'xml' : 'json';
  }

  static build_tool_schemas(toolNames: string[], provider?: LLMProvider | null): Array<Record<string, any>> | null {
    if (!toolNames.length) {
      return null;
    }

    const schemas = new ToolSchemaProvider().buildSchema(toolNames, provider ?? null);
    return schemas.length ? schemas : null;
  }
}
