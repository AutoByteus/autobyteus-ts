import { describe, it, expect } from 'vitest';
import { ParserContext } from '../../../../../../src/agent/streaming/parser/parser_context.js';
import { SegmentEventType, SegmentType } from '../../../../../../src/agent/streaming/parser/events.js';
import { CustomXmlTagRunBashParsingState } from '../../../../../../src/agent/streaming/parser/states/custom_xml_tag_run_bash_parsing_state.js';
import { TextState } from '../../../../../../src/agent/streaming/parser/states/text_state.js';

describe('CustomXmlTagRunBashParsingState basics', () => {
  it('parses simple command', () => {
    const ctx = new ParserContext();
    ctx.append('ls -la</run_bash>');

    const state = new CustomXmlTagRunBashParsingState(ctx, '<run_bash>');
    ctx.currentState = state;
    state.run();

    const events = ctx.getAndClearEvents();
    const startEvents = events.filter((e) => e.event_type === SegmentEventType.START);
    expect(startEvents).toHaveLength(1);
    expect(startEvents[0].segment_type).toBe(SegmentType.RUN_BASH);

    const contentEvents = events.filter((e) => e.event_type === SegmentEventType.CONTENT);
    const content = contentEvents.map((e) => e.payload.delta).join('');
    expect(content).toContain('ls -la');

    expect(ctx.currentState).toBeInstanceOf(TextState);
  });

  it('ignores tag attributes', () => {
    const ctx = new ParserContext();
    ctx.append('ls -la</run_bash>');

    const state = new CustomXmlTagRunBashParsingState(ctx, "<run_bash description='List files'>");
    ctx.currentState = state;
    state.run();

    const events = ctx.getAndClearEvents();
    const startEvents = events.filter((e) => e.event_type === SegmentEventType.START);
    const metadata = startEvents[0].payload.metadata;
    expect(metadata === undefined || Object.keys(metadata).length === 0).toBe(true);
  });

  it('preserves comments in content', () => {
    const ctx = new ParserContext();
    ctx.append('# Install deps\nnpm install</run_bash>');

    const state = new CustomXmlTagRunBashParsingState(ctx, '<run_bash>');
    ctx.currentState = state;
    state.run();

    const events = ctx.getAndClearEvents();
    const contentEvents = events.filter((e) => e.event_type === SegmentEventType.CONTENT);
    const content = contentEvents.map((e) => e.payload.delta).join('');
    expect(content).toContain('# Install deps');
    expect(content).toContain('npm install');
  });
});

describe('CustomXmlTagRunBashParsingState streaming', () => {
  it('holds back partial closing tags', () => {
    const ctx = new ParserContext();
    ctx.append('echo hello world command</run');

    const state = new CustomXmlTagRunBashParsingState(ctx, '<run_bash>');
    ctx.currentState = state;
    state.run();

    const events = ctx.getAndClearEvents();
    const contentEvents = events.filter((e) => e.event_type === SegmentEventType.CONTENT);
    const content = contentEvents.map((e) => e.payload.delta).join('');
    expect(content).toContain('echo hello');
    expect(content).not.toContain('</run');
  });
});

describe('CustomXmlTagRunBashParsingState finalize', () => {
  it('finalize closes incomplete command', () => {
    const ctx = new ParserContext();
    ctx.append('partial command');

    const state = new CustomXmlTagRunBashParsingState(ctx, '<run_bash>');
    ctx.currentState = state;
    state.run();
    state.finalize();

    const events = ctx.getAndClearEvents();
    const endEvents = events.filter((e) => e.event_type === SegmentEventType.END);
    expect(endEvents).toHaveLength(1);
  });
});
