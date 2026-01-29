import { describe, it, expect } from 'vitest';
import { ParserContext, ParserConfig } from '../../../../../src/agent/streaming/parser/parser_context.js';
import { TextState } from '../../../../../src/agent/streaming/parser/states/text_state.js';
import { XmlTagInitializationState } from '../../../../../src/agent/streaming/parser/states/xml_tag_initialization_state.js';
import { CustomXmlTagWriteFileParsingState } from '../../../../../src/agent/streaming/parser/states/custom_xml_tag_write_file_parsing_state.js';
import { CustomXmlTagRunBashParsingState } from '../../../../../src/agent/streaming/parser/states/custom_xml_tag_run_bash_parsing_state.js';
import { XmlToolParsingState } from '../../../../../src/agent/streaming/parser/states/xml_tool_parsing_state.js';
import { XmlWriteFileToolParsingState } from '../../../../../src/agent/streaming/parser/states/xml_write_file_tool_parsing_state.js';
import { XmlRunBashToolParsingState } from '../../../../../src/agent/streaming/parser/states/xml_run_bash_tool_parsing_state.js';
import { SegmentEventType } from '../../../../../src/agent/streaming/parser/events.js';

describe('XmlTagInitializationState constructor', () => {
  it("consumes '<' character", () => {
    const ctx = new ParserContext();
    ctx.append('<tag>');
    expect(ctx.get_position()).toBe(0);

    const state = new XmlTagInitializationState(ctx);
    expect(ctx.get_position()).toBe(1);
    ctx.current_state = state;
  });
});

describe('XmlTagInitializationState write_file detection', () => {
  it('transitions to CustomXmlTagWriteFileParsingState', () => {
    const ctx = new ParserContext();
    ctx.append('<write_file path="/test.py">');

    const state = new XmlTagInitializationState(ctx);
    ctx.current_state = state;
    state.run();

    expect(ctx.current_state).toBeInstanceOf(CustomXmlTagWriteFileParsingState);
  });

  it('is case-insensitive for write_file', () => {
    const ctx = new ParserContext();
    ctx.append('<WRITE_FILE path="/test.py">');

    const state = new XmlTagInitializationState(ctx);
    ctx.current_state = state;
    state.run();

    expect(ctx.current_state).toBeInstanceOf(CustomXmlTagWriteFileParsingState);
  });
});

describe('XmlTagInitializationState run_bash detection', () => {
  it('transitions to CustomXmlTagRunBashParsingState', () => {
    const ctx = new ParserContext();
    ctx.append('<run_bash>command</run_bash>');

    const state = new XmlTagInitializationState(ctx);
    ctx.current_state = state;
    state.run();

    expect(ctx.current_state).toBeInstanceOf(CustomXmlTagRunBashParsingState);
  });

  it('supports run_bash tag with attributes', () => {
    const ctx = new ParserContext();
    ctx.append("<run_bash description='test'>");

    const state = new XmlTagInitializationState(ctx);
    ctx.current_state = state;
    state.run();

    expect(ctx.current_state).toBeInstanceOf(CustomXmlTagRunBashParsingState);
  });
});

describe('XmlTagInitializationState tool detection', () => {
  it('transitions to XmlToolParsingState when parsing enabled', () => {
    const ctx = new ParserContext();
    ctx.append("<tool name='test'>");

    const state = new XmlTagInitializationState(ctx);
    ctx.current_state = state;
    state.run();

    expect(ctx.current_state).toBeInstanceOf(XmlToolParsingState);
  });

  it('treats tool tag as text when parse_tool_calls is false', () => {
    const config = new ParserConfig({ parse_tool_calls: false });
    const ctx = new ParserContext(config);
    ctx.append("<tool name='test'>more text");

    const state = new XmlTagInitializationState(ctx);
    ctx.current_state = state;
    state.run();

    expect(ctx.current_state).toBeInstanceOf(TextState);

    const events = ctx.get_and_clear_events();
    const contentEvents = events.filter((e) => e.event_type === SegmentEventType.CONTENT);
    expect(contentEvents.some((e) => String(e.payload.delta).includes("<tool name='test'>"))).toBe(true);
  });
});

describe('XmlTagInitializationState unknown tags', () => {
  it('emits unknown tag as text', () => {
    const ctx = new ParserContext();
    ctx.append('<div>content');

    const state = new XmlTagInitializationState(ctx);
    ctx.current_state = state;
    state.run();

    expect(ctx.current_state).toBeInstanceOf(TextState);

    const events = ctx.get_and_clear_events();
    const contentEvents = events.filter((e) => e.event_type === SegmentEventType.CONTENT);
    expect(contentEvents.some((e) => String(e.payload.delta).includes('<d'))).toBe(true);
  });

  it('malformed start reverts to text', () => {
    const ctx = new ParserContext();
    ctx.append('<xyz>');

    const state = new XmlTagInitializationState(ctx);
    ctx.current_state = state;
    state.run();

    expect(ctx.current_state).toBeInstanceOf(TextState);
  });
});

describe('XmlTagInitializationState partial buffers', () => {
  it('waits for more characters on partial write_file', () => {
    const ctx = new ParserContext();
    ctx.append('<write_fil');

    const state = new XmlTagInitializationState(ctx);
    ctx.current_state = state;
    state.run();

    const events = ctx.get_and_clear_events();
    expect(events).toHaveLength(0);
  });
});

describe('XmlTagInitializationState finalize', () => {
  it('emits buffered content as text on finalize', () => {
    const ctx = new ParserContext();
    ctx.append('<tool');

    const state = new XmlTagInitializationState(ctx);
    ctx.current_state = state;
    state.run();

    state.finalize();

    const events = ctx.get_and_clear_events();
    const contentEvents = events.filter((e) => e.event_type === SegmentEventType.CONTENT);
    expect(contentEvents.some((e) => String(e.payload.delta).includes('<tool'))).toBe(true);
  });

  it('detects write_file tool name', () => {
    const ctx = new ParserContext();
    ctx.append('<tool name="write_file">');

    const state = new XmlTagInitializationState(ctx);
    ctx.current_state = state;
    state.run();

    expect(ctx.current_state).toBeInstanceOf(XmlWriteFileToolParsingState);
  });

  it('detects write_file tool name case-insensitively', () => {
    const ctx = new ParserContext();
    ctx.append('<tool name="WRITE_FILE">');

    const state = new XmlTagInitializationState(ctx);
    ctx.current_state = state;
    state.run();

    expect(ctx.current_state).toBeInstanceOf(XmlWriteFileToolParsingState);
  });

  it('dispatches other tool names to generic XmlToolParsingState', () => {
    const ctx = new ParserContext();
    ctx.append('<tool name="other">');

    const state = new XmlTagInitializationState(ctx);
    ctx.current_state = state;
    state.run();

    expect(ctx.current_state).toBeInstanceOf(XmlToolParsingState);
  });

  it('detects run_bash tool name', () => {
    const ctx = new ParserContext();
    ctx.append('<tool name="run_bash">');

    const state = new XmlTagInitializationState(ctx);
    ctx.current_state = state;
    state.run();

    expect(ctx.current_state).toBeInstanceOf(XmlRunBashToolParsingState);
  });

  it('detects run_bash tool name case-insensitively', () => {
    const ctx = new ParserContext();
    ctx.append('<tool name="RUN_BASH">');

    const state = new XmlTagInitializationState(ctx);
    ctx.current_state = state;
    state.run();

    expect(ctx.current_state).toBeInstanceOf(XmlRunBashToolParsingState);
  });
});
