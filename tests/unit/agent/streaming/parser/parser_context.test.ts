import { describe, it, expect } from 'vitest';
import { ParserContext, ParserConfig } from '../../../../../src/agent/streaming/parser/parser_context.js';
import { SegmentEventType, SegmentType } from '../../../../../src/agent/streaming/parser/events.js';

describe('ParserConfig', () => {
  it('uses default values', () => {
    const config = new ParserConfig();
    expect(config.parse_tool_calls).toBe(true);
    expect(config.strategy_order).toEqual(['xml_tag']);
  });

  it('respects custom values', () => {
    const config = new ParserConfig({ parse_tool_calls: false, strategy_order: ['json_tool'] });
    expect(config.parse_tool_calls).toBe(false);
    expect(config.strategy_order).toEqual(['json_tool']);
  });
});

describe('ParserContext initialization', () => {
  it('defaults to built-in config', () => {
    const ctx = new ParserContext();
    expect(ctx.parse_tool_calls).toBe(true);
    expect(ctx.config.strategy_order).toEqual(['xml_tag']);
    expect(ctx.has_more_chars()).toBe(false);
    expect(ctx.get_current_segment_id()).toBeUndefined();
  });

  it('accepts custom config', () => {
    const config = new ParserConfig({ parse_tool_calls: false });
    const ctx = new ParserContext(config);
    expect(ctx.parse_tool_calls).toBe(false);
  });
});

describe('ParserContext scanner delegation', () => {
  it('appends and peeks', () => {
    const ctx = new ParserContext();
    ctx.append('hello');
    expect(ctx.peek_char()).toBe('h');
  });

  it('advances cursor', () => {
    const ctx = new ParserContext();
    ctx.append('abc');
    ctx.advance();
    expect(ctx.peek_char()).toBe('b');
  });

  it('advance_by moves cursor', () => {
    const ctx = new ParserContext();
    ctx.append('hello world');
    ctx.advance_by(6);
    expect(ctx.peek_char()).toBe('w');
  });

  it('tracks remaining chars', () => {
    const ctx = new ParserContext();
    expect(ctx.has_more_chars()).toBe(false);
    ctx.append('a');
    expect(ctx.has_more_chars()).toBe(true);
    ctx.advance();
    expect(ctx.has_more_chars()).toBe(false);
  });

  it('gets and sets position', () => {
    const ctx = new ParserContext();
    ctx.append('hello');
    ctx.advance_by(3);
    expect(ctx.get_position()).toBe(3);
    ctx.set_position(1);
    expect(ctx.get_position()).toBe(1);
    expect(ctx.peek_char()).toBe('e');
  });

  it('extracts substrings', () => {
    const ctx = new ParserContext();
    ctx.append('hello world');
    expect(ctx.substring(0, 5)).toBe('hello');
    expect(ctx.substring(6)).toBe('world');
  });
});

describe('ParserContext segment emission', () => {
  it('emits segment lifecycle events', () => {
    const ctx = new ParserContext();
    const segId = ctx.emit_segment_start(SegmentType.TEXT);
    expect(segId).toBe('seg_1');
    expect(ctx.get_current_segment_id()).toBe('seg_1');
    expect(ctx.get_current_segment_type()).toBe(SegmentType.TEXT);

    ctx.emit_segment_content('Hello ');
    ctx.emit_segment_content('World');
    expect(ctx.get_current_segment_content()).toBe('Hello World');

    const endedId = ctx.emit_segment_end();
    expect(endedId).toBe('seg_1');
    expect(ctx.get_current_segment_id()).toBeUndefined();

    const events = ctx.get_and_clear_events();
    expect(events).toHaveLength(4);
    expect(events[0].event_type).toBe(SegmentEventType.START);
    expect(events[0].segment_id).toBe('seg_1');
    expect(events[0].segment_type).toBe(SegmentType.TEXT);
    expect(events[1].event_type).toBe(SegmentEventType.CONTENT);
    expect(events[1].payload.delta).toBe('Hello ');
    expect(events[2].event_type).toBe(SegmentEventType.CONTENT);
    expect(events[2].payload.delta).toBe('World');
    expect(events[3].event_type).toBe(SegmentEventType.END);
    expect(events[3].segment_id).toBe('seg_1');
  });

  it('emits segment metadata', () => {
    const ctx = new ParserContext();
    ctx.emit_segment_start(SegmentType.TOOL_CALL, { tool_name: 'weather_api' });
    const events = ctx.get_events();
    expect(events).toHaveLength(1);
    expect(events[0].payload).toEqual({ metadata: { tool_name: 'weather_api' } });
  });

  it('generates unique segment ids', () => {
    const ctx = new ParserContext();
    const id1 = ctx.emit_segment_start(SegmentType.TEXT);
    ctx.emit_segment_end();
    const id2 = ctx.emit_segment_start(SegmentType.WRITE_FILE);
    ctx.emit_segment_end();
    const id3 = ctx.emit_segment_start(SegmentType.TOOL_CALL);
    ctx.emit_segment_end();
    expect(id1).toBe('seg_1');
    expect(id2).toBe('seg_2');
    expect(id3).toBe('seg_3');
  });

  it('throws when emitting content without active segment', () => {
    const ctx = new ParserContext();
    expect(() => ctx.emit_segment_content('test')).toThrow(/Cannot emit content/);
  });

  it('returns undefined when ending without segment', () => {
    const ctx = new ParserContext();
    const result = ctx.emit_segment_end();
    expect(result).toBeUndefined();
  });

  it('get_and_clear_events clears queue', () => {
    const ctx = new ParserContext();
    ctx.emit_segment_start(SegmentType.TEXT);
    ctx.emit_segment_content('test');
    ctx.emit_segment_end();
    const events1 = ctx.get_and_clear_events();
    expect(events1).toHaveLength(3);
    const events2 = ctx.get_and_clear_events();
    expect(events2).toHaveLength(0);
  });
});

describe('ParserContext text helper', () => {
  it('append_text_segment emits start + content', () => {
    const ctx = new ParserContext();
    ctx.append_text_segment('Hello World');
    const events = ctx.get_and_clear_events();
    expect(events).toHaveLength(2);
    expect(events[0].event_type).toBe(SegmentEventType.START);
    expect(events[0].segment_type).toBe(SegmentType.TEXT);
    expect(events[1].event_type).toBe(SegmentEventType.CONTENT);
    expect(events[1].payload.delta).toBe('Hello World');
    expect(ctx.get_current_segment_type()).toBe(SegmentType.TEXT);
  });

  it('reuses open text segment', () => {
    const ctx = new ParserContext();
    ctx.append_text_segment('Hello ');
    ctx.get_and_clear_events();
    ctx.append_text_segment('World');
    const events = ctx.get_and_clear_events();
    expect(events).toHaveLength(1);
    expect(events[0].event_type).toBe(SegmentEventType.CONTENT);
    expect(events[0].payload.delta).toBe('World');
  });

  it('ignores empty text', () => {
    const ctx = new ParserContext();
    ctx.append_text_segment('');
    const events = ctx.get_and_clear_events();
    expect(events).toHaveLength(0);
  });
});

describe('ParserContext metadata updates', () => {
  it('updates current segment metadata', () => {
    const ctx = new ParserContext();
    ctx.emit_segment_start(SegmentType.TOOL_CALL, { tool_name: 'test' });
    expect(ctx.get_current_segment_metadata()).toEqual({ tool_name: 'test' });
    ctx.update_current_segment_metadata({ arg1: 'value1' });
    expect(ctx.get_current_segment_metadata()).toEqual({ tool_name: 'test', arg1: 'value1' });
  });
});
