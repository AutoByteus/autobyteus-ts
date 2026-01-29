import { describe, it, expect } from 'vitest';
import { ParserContext, ParserConfig } from '../../../../../src/agent/streaming/parser/parser_context.js';
import { TextState } from '../../../../../src/agent/streaming/parser/states/text_state.js';
import { XmlTagInitializationState } from '../../../../../src/agent/streaming/parser/states/xml_tag_initialization_state.js';
import { JsonInitializationState } from '../../../../../src/agent/streaming/parser/states/json_initialization_state.js';
import { SegmentEventType, SegmentType } from '../../../../../src/agent/streaming/parser/events.js';

describe('TextState basics', () => {
  it('emits text segment for plain text', () => {
    const ctx = new ParserContext();
    ctx.append('Hello World');
    const state = new TextState(ctx);
    ctx.current_state = state;
    state.run();

    const events = ctx.get_and_clear_events();
    expect(events).toHaveLength(2);
    expect(events[0].event_type).toBe(SegmentEventType.START);
    expect(events[0].segment_type).toBe(SegmentType.TEXT);
    expect(events[1].event_type).toBe(SegmentEventType.CONTENT);
    expect(events[1].payload.delta).toBe('Hello World');
  });

  it('produces no events for empty buffer', () => {
    const ctx = new ParserContext();
    const state = new TextState(ctx);
    ctx.current_state = state;
    state.run();
    const events = ctx.get_and_clear_events();
    expect(events).toHaveLength(0);
  });
});

describe('TextState XML trigger', () => {
  it("transitions on '<' and emits text before it", () => {
    const ctx = new ParserContext();
    ctx.append('Hello <tool>');
    const state = new TextState(ctx);
    ctx.current_state = state;
    state.run();

    expect(ctx.current_state).toBeInstanceOf(XmlTagInitializationState);
    const events = ctx.get_and_clear_events();
    expect(events).toHaveLength(2);
    expect(events[1].payload.delta).toBe('Hello ');
  });

  it("does not emit text when '<' at start", () => {
    const ctx = new ParserContext();
    ctx.append('<tool>');
    const state = new TextState(ctx);
    ctx.current_state = state;
    state.run();

    expect(ctx.current_state).toBeInstanceOf(XmlTagInitializationState);
    const events = ctx.get_and_clear_events();
    expect(events).toHaveLength(0);
  });

  it('emits accumulated text before tag', () => {
    const ctx = new ParserContext();
    ctx.append('abc def ghi<');
    const state = new TextState(ctx);
    ctx.current_state = state;
    state.run();

    const events = ctx.get_and_clear_events();
    expect(events).toHaveLength(2);
    expect(events[1].payload.delta).toBe('abc def ghi');
  });
});

describe('TextState JSON trigger', () => {
  it('does not trigger JSON when default strategy order excludes it', () => {
    const ctx = new ParserContext();
    ctx.append('Test {json}');
    const state = new TextState(ctx);
    ctx.current_state = state;
    state.run();

    const events = ctx.get_and_clear_events();
    expect(events.some((e) => e.event_type === SegmentEventType.CONTENT && e.payload.delta === 'Test {json}')).toBe(
      true
    );
  });

  it('triggers JSON state when enabled', () => {
    const config = new ParserConfig({ parse_tool_calls: true, strategy_order: ['json_tool'] });
    const ctx = new ParserContext(config);
    ctx.append('Before {json}');
    const state = new TextState(ctx);
    ctx.current_state = state;
    state.run();

    expect(ctx.current_state).toBeInstanceOf(JsonInitializationState);
    const events = ctx.get_and_clear_events();
    expect(events).toHaveLength(2);
    expect(events[1].payload.delta).toBe('Before ');
  });

  it('does not trigger JSON when parse_tool_calls is false', () => {
    const config = new ParserConfig({ parse_tool_calls: false, strategy_order: ['json_tool'] });
    const ctx = new ParserContext(config);
    ctx.append('Test {json}');
    const state = new TextState(ctx);
    ctx.current_state = state;
    state.run();

    const events = ctx.get_and_clear_events();
    expect(events.some((e) => e.event_type === SegmentEventType.CONTENT && e.payload.delta === 'Test {json}')).toBe(
      true
    );
  });
});

describe('TextState streaming behavior', () => {
  it('handles partial buffer then more data', () => {
    const ctx = new ParserContext();
    ctx.append('Hello ');
    let state = new TextState(ctx);
    ctx.current_state = state;
    state.run();
    let events = ctx.get_and_clear_events();
    expect(events).toHaveLength(2);
    expect(events[1].payload.delta).toBe('Hello ');

    ctx.append('World');
    state = new TextState(ctx);
    ctx.current_state = state;
    state.run();
    events = ctx.get_and_clear_events();
    expect(events).toHaveLength(1);
    expect(events[0].payload.delta).toBe('World');
  });

  it('handles trigger in later chunk', () => {
    const ctx = new ParserContext();
    ctx.append('Setup text');
    let state = new TextState(ctx);
    ctx.current_state = state;
    state.run();
    ctx.get_and_clear_events();

    ctx.append(' and then <tool');
    state = new TextState(ctx);
    ctx.current_state = state;
    state.run();
    expect(ctx.current_state).toBeInstanceOf(XmlTagInitializationState);
    const events = ctx.get_and_clear_events();
    expect(events[0].payload.delta).toBe(' and then ');
  });
});

describe('TextState finalize', () => {
  it('finalize is no-op', () => {
    const ctx = new ParserContext();
    const state = new TextState(ctx);
    state.finalize();
    const events = ctx.get_and_clear_events();
    expect(events).toHaveLength(0);
  });
});
