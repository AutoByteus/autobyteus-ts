import { describe, it, expect } from 'vitest';
import { XmlToolParsingStateRegistry } from '../../../../../src/agent/streaming/parser/xml_tool_parsing_state_registry.js';
import { BaseState } from '../../../../../src/agent/streaming/parser/states/base_state.js';
import { TOOL_NAME_WRITE_FILE, TOOL_NAME_PATCH_FILE, TOOL_NAME_RUN_BASH } from '../../../../../src/agent/streaming/parser/tool_constants.js';

class MockState extends BaseState {
  run(): void {
    return;
  }
  finalize(): void {
    return;
  }
}

describe('XmlToolParsingStateRegistry', () => {
  it('returns singleton instance', () => {
    const reg1 = new XmlToolParsingStateRegistry();
    const reg2 = new XmlToolParsingStateRegistry();
    expect(reg1).toBe(reg2);
  });

  it('registers core defaults', () => {
    const registry = new XmlToolParsingStateRegistry();
    expect(registry.get_state_for_tool(TOOL_NAME_WRITE_FILE)).toBeDefined();
    expect(registry.get_state_for_tool(TOOL_NAME_PATCH_FILE)).toBeDefined();
    expect(registry.get_state_for_tool(TOOL_NAME_RUN_BASH)).toBeDefined();
  });

  it('registers custom state', () => {
    const registry = new XmlToolParsingStateRegistry();
    registry.register_tool_state('custom_tool', MockState);
    expect(registry.get_state_for_tool('custom_tool')).toBe(MockState);
  });

  it('is case sensitive for tool names', () => {
    const registry = new XmlToolParsingStateRegistry();
    registry.register_tool_state('MyTool', MockState);
    expect(registry.get_state_for_tool('MyTool')).toBe(MockState);
    expect(registry.get_state_for_tool('mytool')).toBeUndefined();
  });
});
