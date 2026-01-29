import { describe, it, expect } from 'vitest';
import { BackgroundProcessOutput, ProcessInfo, TerminalResult } from '../../../../src/tools/terminal/types.js';

describe('terminal types', () => {
  it('creates TerminalResult with provided values', () => {
    const result = new TerminalResult('out', 'err', 0, false);

    expect(result.stdout).toBe('out');
    expect(result.stderr).toBe('err');
    expect(result.exit_code).toBe(0);
    expect(result.timed_out).toBe(false);
  });

  it('allows null exit_code for TerminalResult', () => {
    const result = new TerminalResult('out', '', null, true);

    expect(result.exit_code).toBeNull();
    expect(result.timed_out).toBe(true);
  });

  it('creates BackgroundProcessOutput with provided values', () => {
    const output = new BackgroundProcessOutput('log', true, 'bg_001');

    expect(output.output).toBe('log');
    expect(output.is_running).toBe(true);
    expect(output.process_id).toBe('bg_001');
  });

  it('creates ProcessInfo with provided values', () => {
    const info = new ProcessInfo('bg_002', 'npm run dev', 123.45, false);

    expect(info.process_id).toBe('bg_002');
    expect(info.command).toBe('npm run dev');
    expect(info.started_at).toBe(123.45);
    expect(info.is_running).toBe(false);
  });
});
