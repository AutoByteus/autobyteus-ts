import { describe, it, expect } from 'vitest';
import { ToolConfig } from '../../../src/tools/tool_config.js';

describe('ToolConfig (integration)', () => {
  it('supports merge and access patterns used by tools', () => {
    const base = new ToolConfig({ timeout: 10, mode: 'fast' });
    const override = new ToolConfig({ timeout: 25 });
    const merged = base.merge(override);

    expect(base.get('timeout')).toBe(10);
    expect(override.get('timeout')).toBe(25);
    expect(merged.get('timeout')).toBe(25);
    expect(merged.get('mode')).toBe('fast');
  });

  it('exposes constructor kwargs as a safe copy', () => {
    const config = new ToolConfig({ limit: 3 });
    const kwargs = config.getConstructorKwargs();
    expect(kwargs).toEqual({ limit: 3 });
    expect(kwargs).not.toBe(config.params);
  });
});
