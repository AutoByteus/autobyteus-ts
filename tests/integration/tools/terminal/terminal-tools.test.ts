import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { registerRunBashTool } from '../../../../src/tools/terminal/tools/run-bash.js';
import { registerStartBackgroundProcessTool } from '../../../../src/tools/terminal/tools/start-background-process.js';
import { registerGetProcessOutputTool } from '../../../../src/tools/terminal/tools/get-process-output.js';
import { registerStopBackgroundProcessTool } from '../../../../src/tools/terminal/tools/stop-background-process.js';
import { TerminalResult } from '../../../../src/tools/terminal/types.js';

let nodePtyAvailable = true;
try {
  await import('node-pty');
} catch {
  nodePtyAvailable = false;
}

const runIntegration = nodePtyAvailable ? describe : describe.skip;
const runBashTool = registerRunBashTool();
const startBackgroundProcessTool = registerStartBackgroundProcessTool();
const getProcessOutputTool = registerGetProcessOutputTool();
const stopBackgroundProcessTool = registerStopBackgroundProcessTool();

class MockWorkspace {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  getBasePath(): string {
    return this.basePath;
  }
}

class MockContext {
  workspace: MockWorkspace;
  agentId: string;

  constructor(basePath: string) {
    this.workspace = new MockWorkspace(basePath);
    this.agentId = 'test-agent-001';
  }
}

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'autobyteus-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

runIntegration('terminal tools integration', () => {
  it('run_bash executes simple echo', async () => {
    await withTempDir(async (tempDir) => {
      const context = new MockContext(tempDir);
      const result = await runBashTool.execute(context, { command: 'echo hello' });

      expect(result).toBeInstanceOf(TerminalResult);
      expect(result.stdout).toContain('hello');
      expect(result.timedOut).toBe(false);
    });
  });

  it('run_bash preserves working directory across calls', async () => {
    await withTempDir(async (tempDir) => {
      const context = new MockContext(tempDir);
      const subdir = path.join(tempDir, 'mysubdir');
      await mkdir(subdir);

      await runBashTool.execute(context, { command: 'cd mysubdir' });
      const result = await runBashTool.execute(context, { command: 'pwd' });

      expect(result.stdout).toContain('mysubdir');
    });
  });

  it('run_bash respects timeout', async () => {
    await withTempDir(async (tempDir) => {
      const context = new MockContext(tempDir);
      const result = await runBashTool.execute(context, { command: 'sleep 5', timeout_seconds: 1 });

      expect(result.timedOut).toBe(true);
    });
  });

  it('background process lifecycle', async () => {
    await withTempDir(async (tempDir) => {
      const context = new MockContext(tempDir);

      const startResult = await startBackgroundProcessTool.execute(context, {
        command: 'for i in 1 2 3; do echo line$i; sleep 0.1; done; sleep 10'
      });

      expect(startResult.status).toBe('started');
      const processId = startResult.processId as string;

      await new Promise((resolve) => setTimeout(resolve, 500));

      const outputResult = await getProcessOutputTool.execute(context, { process_id: processId });
      expect(outputResult.output).toContain('line');
      expect(outputResult.isRunning).toBe(true);

      const stopResult = await stopBackgroundProcessTool.execute(context, { process_id: processId });
      expect(stopResult.status).toBe('stopped');
    });
  });

  it('stop_background_process reports missing process', async () => {
    await withTempDir(async (tempDir) => {
      const context = new MockContext(tempDir);
      const result = await stopBackgroundProcessTool.execute(context, { process_id: 'nonexistent_123' });

      expect(result.status).toBe('not_found');
    });
  });

  it('get_process_output reports missing process', async () => {
    await withTempDir(async (tempDir) => {
      const context = new MockContext(tempDir);
      const result = await getProcessOutputTool.execute(context, { process_id: 'nonexistent_123' });

      expect(result.error).toBeTruthy();
      expect(result.isRunning).toBe(false);
    });
  });
});
