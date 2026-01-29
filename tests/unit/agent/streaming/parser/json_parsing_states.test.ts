import { describe, it, expect } from 'vitest';
import { ParserContext, ParserConfig } from '../../../../../src/agent/streaming/parser/parser_context.js';
import { TextState } from '../../../../../src/agent/streaming/parser/states/text_state.js';
import {
  JsonInitializationState,
  JsonToolSignatureChecker
} from '../../../../../src/agent/streaming/parser/states/json_initialization_state.js';
import { JsonToolParsingState } from '../../../../../src/agent/streaming/parser/states/json_tool_parsing_state.js';
import { SegmentEventType, SegmentType } from '../../../../../src/agent/streaming/parser/events.js';

describe('JsonToolSignatureChecker', () => {
  it('matches name pattern', () => {
    const checker = new JsonToolSignatureChecker();
    expect(checker.check_signature('{"name"')).toBe('match');
  });

  it('matches tool pattern', () => {
    const checker = new JsonToolSignatureChecker();
    expect(checker.check_signature('{"tool"')).toBe('match');
  });

  it('matches array pattern', () => {
    const checker = new JsonToolSignatureChecker();
    expect(checker.check_signature('[{"name"')).toBe('match');
  });

  it('matches tool_calls pattern', () => {
    const checker = new JsonToolSignatureChecker();
    expect(checker.check_signature('{"tool_calls"')).toBe('match');
  });

  it('matches tools pattern', () => {
    const checker = new JsonToolSignatureChecker();
    expect(checker.check_signature('{"tools"')).toBe('match');
  });

  it('returns partial for partial signature', () => {
    const checker = new JsonToolSignatureChecker();
    expect(checker.check_signature('{')).toBe('partial');
    expect(checker.check_signature('{"')).toBe('partial');
    expect(checker.check_signature('{"n')).toBe('partial');
  });

  it('returns no_match for non-tool JSON', () => {
    const checker = new JsonToolSignatureChecker();
    expect(checker.check_signature('{"data"')).toBe('no_match');
    expect(checker.check_signature('{"items"')).toBe('no_match');
  });

  it('supports custom patterns', () => {
    const custom = ['{"action"', '{"command"'];
    const checker = new JsonToolSignatureChecker(custom);
    expect(checker.check_signature('{"action"')).toBe('match');
    expect(checker.check_signature('{"command"')).toBe('match');
    expect(checker.check_signature('{"name"')).toBe('no_match');
  });
});

describe('JsonInitializationState', () => {
  it('transitions on tool signature', () => {
    const config = new ParserConfig({ parse_tool_calls: true, strategy_order: ['json_tool'] });
    const ctx = new ParserContext(config);
    ctx.append('{"name": "test", "arguments": {}}more');
    const state = new JsonInitializationState(ctx);
    ctx.current_state = state;
    state.run();
    expect(ctx.current_state).toBeInstanceOf(JsonToolParsingState);
  });

  it('non-tool JSON becomes text', () => {
    const config = new ParserConfig({ parse_tool_calls: true, strategy_order: ['json_tool'] });
    const ctx = new ParserContext(config);
    ctx.append('{"data": [1,2,3]}more');
    const state = new JsonInitializationState(ctx);
    ctx.current_state = state;
    state.run();
    expect(ctx.current_state).toBeInstanceOf(TextState);
    const events = ctx.get_and_clear_events();
    const contentEvents = events.filter((e) => e.event_type === SegmentEventType.CONTENT);
    expect(contentEvents.length).toBeGreaterThan(0);
  });

  it('tool parsing disabled emits text', () => {
    const config = new ParserConfig({ parse_tool_calls: false, strategy_order: ['json_tool'] });
    const ctx = new ParserContext(config);
    ctx.append('{"name": "test"}more');
    const state = new JsonInitializationState(ctx);
    ctx.current_state = state;
    state.run();
    expect(ctx.current_state).toBeInstanceOf(TextState);
  });

  it('finalize emits buffered content as text', () => {
    const config = new ParserConfig({ parse_tool_calls: true, strategy_order: ['json_tool'] });
    const ctx = new ParserContext(config);
    ctx.append('{"na');
    const state = new JsonInitializationState(ctx);
    ctx.current_state = state;
    state.run();
    state.finalize();
    const events = ctx.get_and_clear_events();
    const contentEvents = events.filter((e) => e.event_type === SegmentEventType.CONTENT);
    expect(contentEvents.some((e) => String(e.payload.delta).includes('{"na'))).toBe(true);
  });
});

describe('JsonToolParsingState', () => {
  it('parses simple tool call', () => {
    const ctx = new ParserContext();
    const signature = '{"name"';
    ctx.append('{"name": "weather", "arguments": {"city": "NYC"}}after');
    const state = new JsonToolParsingState(ctx, signature);
    ctx.current_state = state;
    state.run();
    const events = ctx.get_and_clear_events();
    const startEvents = events.filter((e) => e.event_type === SegmentEventType.START);
    expect(startEvents).toHaveLength(1);
    expect(startEvents[0].segment_type).toBe(SegmentType.TOOL_CALL);
  });

  it('handles nested JSON', () => {
    const ctx = new ParserContext();
    const signature = '{"name"';
    ctx.append('{"name": "api", "arguments": {"data": {"nested": true}}}after');
    const state = new JsonToolParsingState(ctx, signature);
    ctx.current_state = state;
    state.run();
    const events = ctx.get_and_clear_events();
    const endEvents = events.filter((e) => e.event_type === SegmentEventType.END);
    expect(endEvents).toHaveLength(1);
  });

  it('handles array format', () => {
    const ctx = new ParserContext();
    const signature = '[{"name"';
    ctx.append('[{"name": "tool1", "arguments": {}}]after');
    const state = new JsonToolParsingState(ctx, signature);
    ctx.current_state = state;
    state.run();
    const events = ctx.get_and_clear_events();
    const endEvents = events.filter((e) => e.event_type === SegmentEventType.END);
    expect(endEvents).toHaveLength(1);
  });

  it('handles braces inside strings', () => {
    const ctx = new ParserContext();
    const signature = '{"name"';
    ctx.append('{"name": "test", "arguments": {"code": "if (a) { b }"}}after');
    const state = new JsonToolParsingState(ctx, signature);
    ctx.current_state = state;
    state.run();
    const events = ctx.get_and_clear_events();
    const endEvents = events.filter((e) => e.event_type === SegmentEventType.END);
    expect(endEvents).toHaveLength(1);
    expect(ctx.current_state).toBeInstanceOf(TextState);
  });

  it('finalize handles incomplete JSON', () => {
    const ctx = new ParserContext();
    const signature = '{"name"';
    ctx.append('{"name": "test", "arguments": {');
    const state = new JsonToolParsingState(ctx, signature);
    ctx.current_state = state;
    state.run();
    state.finalize();
    const events = ctx.get_and_clear_events();
    const endEvents = events.filter((e) => e.event_type === SegmentEventType.END);
    expect(endEvents.length).toBeGreaterThan(0);
  });

  it('streams raw JSON content without arguments metadata', () => {
    const ctx = new ParserContext();
    const signature = '{"name"';
    ctx.append('{"name": "search", "args": {"query": "autobyteus"}}after');
    const state = new JsonToolParsingState(ctx, signature);
    ctx.current_state = state;
    state.run();
    const events = ctx.get_and_clear_events();
    const contentEvents = events.filter((e) => e.event_type === SegmentEventType.CONTENT);
    const fullContent = contentEvents.map((e) => e.payload.delta ?? '').join('');
    expect(fullContent).toContain('"args"');
    const endEvents = events.filter((e) => e.event_type === SegmentEventType.END);
    expect(endEvents).toHaveLength(1);
    const metadata = endEvents[0].payload.metadata ?? {};
    expect(metadata.arguments).toBeUndefined();
  });
});
