import { describe, it, expect } from 'vitest';
import { EventEmitter } from '../../../../../src/agent/streaming/parser/event_emitter.js';
import { SegmentEventType, SegmentType } from '../../../../../src/agent/streaming/parser/events.js';

describe('EventEmitter basics', () => {
  it('emits full segment lifecycle', () => {
    const emitter = new EventEmitter();

    const segId = emitter.emit_segment_start(SegmentType.TEXT);
    expect(segId).toBe('seg_1');
    expect(emitter.get_current_segment_id()).toBe('seg_1');

    emitter.emit_segment_content('Hello');
    expect(emitter.get_current_segment_content()).toBe('Hello');

    const endedId = emitter.emit_segment_end();
    expect(endedId).toBe('seg_1');
    expect(emitter.get_current_segment_id()).toBeUndefined();

    const events = emitter.get_and_clear_events();
    expect(events).toHaveLength(3);
  });

  it('generates unique segment ids', () => {
    const emitter = new EventEmitter();
    const id1 = emitter.emit_segment_start(SegmentType.TEXT);
    emitter.emit_segment_end();
    const id2 = emitter.emit_segment_start(SegmentType.WRITE_FILE);
    emitter.emit_segment_end();

    expect(id1).toBe('seg_1');
    expect(id2).toBe('seg_2');
  });

  it('throws when emitting content without active segment', () => {
    const emitter = new EventEmitter();
    expect(() => emitter.emit_segment_content('test')).toThrow(/Cannot emit content/);
  });

  it('returns undefined when ending without active segment', () => {
    const emitter = new EventEmitter();
    const result = emitter.emit_segment_end();
    expect(result).toBeUndefined();
  });
});

describe('EventEmitter metadata', () => {
  it('captures metadata on start', () => {
    const emitter = new EventEmitter();
    emitter.emit_segment_start(SegmentType.WRITE_FILE, { path: '/test.py' });
    expect(emitter.get_current_segment_metadata()).toEqual({ path: '/test.py' });
  });

  it('updates metadata', () => {
    const emitter = new EventEmitter();
    emitter.emit_segment_start(SegmentType.TOOL_CALL, { tool_name: 'test' });
    emitter.update_current_segment_metadata({ arg1: 'value1' });
    expect(emitter.get_current_segment_metadata()).toEqual({ tool_name: 'test', arg1: 'value1' });
  });
});

describe('EventEmitter text helper', () => {
  it('append_text_segment emits start + content', () => {
    const emitter = new EventEmitter();
    emitter.append_text_segment('Hello World');
    const events = emitter.get_and_clear_events();
    expect(events).toHaveLength(2);
    expect(events[0].event_type).toBe(SegmentEventType.START);
    expect(events[1].event_type).toBe(SegmentEventType.CONTENT);
  });

  it('append_text_segment ignores empty text', () => {
    const emitter = new EventEmitter();
    emitter.append_text_segment('');
    const events = emitter.get_and_clear_events();
    expect(events).toHaveLength(0);
  });
});
