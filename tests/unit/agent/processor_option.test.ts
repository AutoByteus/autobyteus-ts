import { describe, it, expect } from 'vitest';
import { ProcessorOption, HookOption } from '../../../src/agent/processor_option.js';

describe('ProcessorOption', () => {
  it('stores name and mandatory flag', () => {
    const option = new ProcessorOption('test', true);
    expect(option.name).toBe('test');
    expect(option.is_mandatory).toBe(true);
  });
});

describe('HookOption', () => {
  it('stores name and mandatory flag', () => {
    const option = new HookOption('hook', false);
    expect(option.name).toBe('hook');
    expect(option.is_mandatory).toBe(false);
  });
});
