import { describe, it, expect } from 'vitest';
import { ParserContext } from '../../../../../src/agent/streaming/parser/parser_context.js';
import { StateFactory } from '../../../../../src/agent/streaming/parser/state_factory.js';
import { BaseState } from '../../../../../src/agent/streaming/parser/states/base_state.js';

describe('StateFactory', () => {
  it('creates TextState', () => {
    const ctx = new ParserContext();
    const state = StateFactory.text_state(ctx);
    expect(state).toBeInstanceOf(BaseState);
    expect(state.constructor.name).toBe('TextState');
  });

  it('creates XmlTagInitializationState', () => {
    const ctx = new ParserContext();
    ctx.append('<test');
    const state = StateFactory.xml_tag_init_state(ctx);
    expect(state.constructor.name).toBe('XmlTagInitializationState');
  });

  it('creates CustomXmlTagWriteFileParsingState', () => {
    const ctx = new ParserContext();
    ctx.append('content</write_file>');
    const state = StateFactory.write_file_parsing_state(ctx, "<write_file path='/test.py'>");
    expect(state.constructor.name).toBe('CustomXmlTagWriteFileParsingState');
  });

  it('creates CustomXmlTagRunBashParsingState', () => {
    const ctx = new ParserContext();
    const state = StateFactory.run_bash_parsing_state(ctx, '<run_bash>');
    expect(state.constructor.name).toBe('CustomXmlTagRunBashParsingState');
  });

  it('creates XmlToolParsingState', () => {
    const ctx = new ParserContext();
    ctx.append('content</tool>');
    const state = StateFactory.xml_tool_parsing_state(ctx, "<tool name='test'>");
    expect(state.constructor.name).toBe('XmlToolParsingState');
  });

  it('creates JsonInitializationState', () => {
    const ctx = new ParserContext();
    ctx.append('{"name": "test"}');
    const state = StateFactory.json_init_state(ctx);
    expect(state.constructor.name).toBe('JsonInitializationState');
  });

  it('creates JsonToolParsingState', () => {
    const ctx = new ParserContext();
    ctx.append('{"name": "test", "arguments": {}}');
    const state = StateFactory.json_tool_parsing_state(ctx, '{"name"');
    expect(state.constructor.name).toBe('JsonToolParsingState');
  });

  it('all states expose run/finalize', () => {
    const ctx = new ParserContext();
    ctx.append('content</test>');

    const states = [
      StateFactory.text_state(ctx),
      StateFactory.write_file_parsing_state(ctx, "<write_file path='/test'>"),
      StateFactory.run_bash_parsing_state(ctx, '<run_bash>')
    ];

    for (const state of states) {
      expect(typeof (state as any).run).toBe('function');
      expect(typeof (state as any).finalize).toBe('function');
    }
  });
});
