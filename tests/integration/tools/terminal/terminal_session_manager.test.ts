import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

let TerminalSessionManagerClass: typeof import('../../../../src/tools/terminal/terminal_session_manager.js').TerminalSessionManager | null = null;
let nodePtyAvailable = true;

try {
  await import('node-pty');
  ({ TerminalSessionManager: TerminalSessionManagerClass } = await import(
    '../../../../src/tools/terminal/terminal_session_manager.js'
  ));
} catch {
  nodePtyAvailable = false;
}

const runIntegration = nodePtyAvailable ? describe : describe.skip;

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'autobyteus-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

runIntegration('TerminalSessionManager Integration', () => {
  if (!TerminalSessionManagerClass) {
    return;
  }

  it('executes echo command', async () => {
    await withTempDir(async (tempDir) => {
      const manager = new TerminalSessionManagerClass();
      try {
        await manager.ensure_started(tempDir);
        const result = await manager.execute_command("echo 'test output'");

        expect(result.stdout).toContain('test output');
        expect(result.timed_out).toBe(false);
      } finally {
        await manager.close();
      }
    });
  });

  it('persists working directory across commands', async () => {
    await withTempDir(async (tempDir) => {
      const subdir = path.join(tempDir, 'subdir');
      await mkdir(subdir);

      const manager = new TerminalSessionManagerClass();
      try {
        await manager.ensure_started(tempDir);
        await manager.execute_command('cd subdir');
        const result = await manager.execute_command('pwd');

        expect(result.stdout).toContain('subdir');
      } finally {
        await manager.close();
      }
    });
  });

  it('handles timeouts', async () => {
    await withTempDir(async (tempDir) => {
      const manager = new TerminalSessionManagerClass();
      try {
        await manager.ensure_started(tempDir);
        const result = await manager.execute_command('sleep 10', 1);

        expect(result.timed_out).toBe(true);
      } finally {
        await manager.close();
      }
    });
  });
});
