import { describe, it, expect } from 'vitest';
import { ToolInvocation, ToolInvocationTurn } from '../../../src/agent/tool_invocation.js';

describe('ToolInvocation', () => {
  it('validates required fields', () => {
    expect(() => new ToolInvocation('', {}, 'id')).toThrow();
    expect(() => new ToolInvocation('tool', null as any, 'id')).toThrow();
    expect(() => new ToolInvocation('tool', {}, '')).toThrow();
  });

  it('reports valid invocations', () => {
    const invocation = new ToolInvocation('tool', { a: 1 }, 'id');
    expect(invocation.is_valid()).toBe(true);
  });
});

describe('ToolInvocationTurn', () => {
  it('tracks completion based on results count', () => {
    const invocation = new ToolInvocation('tool', {}, 'id');
    const turn = new ToolInvocationTurn([invocation]);
    expect(turn.is_complete()).toBe(false);
    turn.results.push({} as any);
    expect(turn.is_complete()).toBe(true);
  });
});
