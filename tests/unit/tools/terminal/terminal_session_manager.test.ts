import { describe, it, expect } from 'vitest';
import { TerminalSessionManager } from '../../../../src/tools/terminal/terminal_session_manager.js';
import { TerminalResult } from '../../../../src/tools/terminal/types.js';

class MockPtySession {
  session_id: string;
  private alive = false;
  private outputQueue: Buffer[] = [];
  private written: Buffer[] = [];

  constructor(session_id: string) {
    this.session_id = session_id;
  }

  get is_alive(): boolean {
    return this.alive;
  }

  async start(cwd: string): Promise<void> {
    this.alive = true;
    void cwd;
    this.outputQueue.push(Buffer.from('$ '));
  }

  async write(data: Buffer): Promise<void> {
    this.written.push(data);
    const cmd = data.toString('utf8').trim();
    if (cmd === 'echo hello') {
      this.outputQueue.push(Buffer.from('echo hello\nhello\n$ '));
    } else if (cmd === 'echo $?') {
      this.outputQueue.push(Buffer.from('echo $?\n0\n$ '));
    } else if (cmd.startsWith('sleep')) {
      this.outputQueue.push(Buffer.from(`${cmd}\n`));
    } else {
      this.outputQueue.push(Buffer.from(`${cmd}\noutput\n$ `));
    }
  }

  async read(): Promise<Buffer | null> {
    if (this.outputQueue.length > 0) {
      return this.outputQueue.shift() ?? null;
    }
    return null;
  }

  resize(): void {
    // no-op
  }

  async close(): Promise<void> {
    this.alive = false;
  }
}

describe('TerminalSessionManager', () => {
  it('ensure_started creates session', async () => {
    const manager = new TerminalSessionManager(MockPtySession);

    expect(manager.is_started).toBe(false);
    await manager.ensure_started('/tmp');
    expect(manager.is_started).toBe(true);

    await manager.close();
  });

  it('ensure_started is idempotent', async () => {
    const manager = new TerminalSessionManager(MockPtySession);

    await manager.ensure_started('/tmp');
    const session1 = manager.current_session;

    await manager.ensure_started('/tmp');
    const session2 = manager.current_session;

    expect(session1).toBe(session2);

    await manager.close();
  });

  it('execute_command before start throws', async () => {
    const manager = new TerminalSessionManager(MockPtySession);

    await expect(manager.execute_command('echo hello')).rejects.toThrow('not started');
  });

  it('execute_command returns TerminalResult', async () => {
    const manager = new TerminalSessionManager(MockPtySession);

    await manager.ensure_started('/tmp');
    const result = await manager.execute_command('echo hello');

    expect(result).toBeInstanceOf(TerminalResult);
    expect(result.stdout).toContain('hello');
    expect(result.timed_out).toBe(false);

    await manager.close();
  });

  it('close cleans up session', async () => {
    const manager = new TerminalSessionManager(MockPtySession);

    await manager.ensure_started('/tmp');
    expect(manager.is_started).toBe(true);

    await manager.close();
    expect(manager.is_started).toBe(false);
    expect(manager.current_session).toBeNull();
  });
});
