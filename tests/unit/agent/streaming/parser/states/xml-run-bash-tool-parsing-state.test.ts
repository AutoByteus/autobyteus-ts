import { describe, it, expect } from 'vitest';
import { ParserContext } from '../../../../../../src/agent/streaming/parser/parser-context.js';
import { XmlRunBashToolParsingState } from '../../../../../../src/agent/streaming/parser/states/xml-run-bash-tool-parsing-state.js';
import { SegmentEventType, SegmentType } from '../../../../../../src/agent/streaming/parser/events.js';

describe('XmlRunBashToolParsingState', () => {
  it('parses run_bash tool', () => {
    const ctx = new ParserContext();
    const signature = '<tool name="run_bash">';
    const content = "<arguments><arg name='command'>ls -la</arg></arguments></tool>";
    ctx.append(signature + content);

    const state = new XmlRunBashToolParsingState(ctx, signature);
    ctx.currentState = state;
    state.run();

    const events = ctx.getAndClearEvents();
    const startEvents = events.filter((e) => e.event_type === SegmentEventType.START);
    expect(startEvents).toHaveLength(1);
    expect(startEvents[0].segment_type).toBe(SegmentType.RUN_BASH);

    const contentEvents = events.filter((e) => e.event_type === SegmentEventType.CONTENT);
    const fullContent = contentEvents.map((e) => e.payload.delta).join('');
    expect(fullContent).toContain('ls -la');
    expect(fullContent).not.toContain('<arg');

    const endEvents = events.filter((e) => e.event_type === SegmentEventType.END);
    expect(endEvents).toHaveLength(1);
  });

  it('exposes run_bash segment type', () => {
    const ctx = new ParserContext();
    const signature = '<tool name="run_bash">';
    const state = new XmlRunBashToolParsingState(ctx, signature);
    expect((state.constructor as typeof XmlRunBashToolParsingState).SEGMENT_TYPE).toBe(SegmentType.RUN_BASH);
  });

  it('handles fragmented streaming', () => {
    const ctx = new ParserContext();
    const signature = '<tool name="run_bash">';
    const chunks = [
      '<arguments><arg ',
      "name='command'>",
      'ls ',
      '-la /var/log',
      '</arg></arguments></tool>'
    ];

    ctx.append(signature);
    const state = new XmlRunBashToolParsingState(ctx, signature);
    ctx.currentState = state;

    for (const chunk of chunks) {
      ctx.append(chunk);
      state.run();
    }

    const events = ctx.getAndClearEvents();
    const contentEvents = events.filter((e) => e.event_type === SegmentEventType.CONTENT);
    const fullContent = contentEvents.map((e) => e.payload.delta).join('');
    expect(fullContent).toContain('ls -la /var/log');
    expect(fullContent).not.toContain('<arg');

    const endEvents = events.filter((e) => e.event_type === SegmentEventType.END);
    expect(endEvents).toHaveLength(1);
  });

  it('swallows closing tags and preserves following text', () => {
    const ctx = new ParserContext();
    const signature = '<tool name="run_bash">';
    const fullText =
      "<arguments><arg name='command'>echo test</arg></arguments></tool>" + 'Post command text';

    ctx.append(fullText);
    const state = new XmlRunBashToolParsingState(ctx, signature);
    ctx.currentState = state;
    state.run();

    while (ctx.hasMoreChars()) {
      ctx.currentState.run();
    }

    const events = ctx.getAndClearEvents();
    const fullDump = events.filter((e) => e.event_type === SegmentEventType.CONTENT).map((e) => e.payload.delta).join('');

    expect(fullDump).toContain('echo test');
    expect(fullDump).toContain('Post command text');
    expect(fullDump).not.toContain('</arguments>');
    expect(fullDump).not.toContain('</tool>');
  });
});
