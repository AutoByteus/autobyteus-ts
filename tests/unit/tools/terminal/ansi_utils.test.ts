import { describe, it, expect } from 'vitest';
import { strip_ansi_codes } from '../../../../src/tools/terminal/ansi_utils.js';

describe('strip_ansi_codes', () => {
  it('removes color escape sequences', () => {
    const input = '\x1b[31mRed text\x1b[0m';
    expect(strip_ansi_codes(input)).toBe('Red text');
  });

  it('removes mixed escape sequences', () => {
    const input = 'Hello\x1b[1;32m World\x1b[0m';
    expect(strip_ansi_codes(input)).toBe('Hello World');
  });

  it('returns empty string when input is empty', () => {
    expect(strip_ansi_codes('')).toBe('');
  });

  it('handles non-ansi content', () => {
    const input = 'plain text';
    expect(strip_ansi_codes(input)).toBe(input);
  });
});
