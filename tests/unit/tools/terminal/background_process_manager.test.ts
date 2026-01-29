import { describe, it, expect } from 'vitest';
import { BackgroundProcessManager } from '../../../../src/tools/terminal/background_process_manager.js';
import { BackgroundProcessOutput, ProcessInfo } from '../../../../src/tools/terminal/types.js';

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
  }

  async write(data: Buffer): Promise<void> {
    this.written.push(data);
    const cmd = data.toString('utf8').trim();
    this.outputQueue.push(Buffer.from(`Started: ${cmd}\n`));
  }

  async read(): Promise<Buffer | null> {
    if (this.outputQueue.length > 0) {
      return this.outputQueue.shift() ?? null;
    }
    return null;
  }

  async close(): Promise<void> {
    this.alive = false;
  }
}

describe('BackgroundProcessManager', () => {
  it('start_process returns process id', async () => {
    const manager = new BackgroundProcessManager(MockPtySession);
    const processId = await manager.start_process('echo hello', '/tmp');

    expect(processId).toBeTruthy();
    expect(processId.startsWith('bg_')).toBe(true);

    await manager.stop_all();
  });

  it('assigns unique ids', async () => {
    const manager = new BackgroundProcessManager(MockPtySession);
    const id1 = await manager.start_process('cmd1', '/tmp');
    const id2 = await manager.start_process('cmd2', '/tmp');
    const id3 = await manager.start_process('cmd3', '/tmp');

    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);

    await manager.stop_all();
  });

  it('get_output returns BackgroundProcessOutput', async () => {
    const manager = new BackgroundProcessManager(MockPtySession);
    const processId = await manager.start_process('echo hello', '/tmp');

    await new Promise((resolve) => setTimeout(resolve, 200));
    const result = manager.get_output(processId);

    expect(result).toBeInstanceOf(BackgroundProcessOutput);
    expect(result.process_id).toBe(processId);
    expect(result.is_running).toBe(true);

    await manager.stop_all();
  });

  it('get_output throws for unknown process', async () => {
    const manager = new BackgroundProcessManager(MockPtySession);

    expect(() => manager.get_output('nonexistent')).toThrow('Process nonexistent not found');
  });

  it('stop_process removes process', async () => {
    const manager = new BackgroundProcessManager(MockPtySession);
    const processId = await manager.start_process('cmd', '/tmp');

    expect(manager.process_count).toBe(1);
    const success = await manager.stop_process(processId);
    expect(success).toBe(true);
    expect(manager.process_count).toBe(0);
  });

  it('stop_process returns false for unknown process', async () => {
    const manager = new BackgroundProcessManager(MockPtySession);

    const success = await manager.stop_process('nonexistent');
    expect(success).toBe(false);
  });

  it('stop_all stops all processes', async () => {
    const manager = new BackgroundProcessManager(MockPtySession);
    await manager.start_process('cmd1', '/tmp');
    await manager.start_process('cmd2', '/tmp');
    await manager.start_process('cmd3', '/tmp');

    expect(manager.process_count).toBe(3);
    const count = await manager.stop_all();
    expect(count).toBe(3);
    expect(manager.process_count).toBe(0);
  });

  it('list_processes returns process info', async () => {
    const manager = new BackgroundProcessManager(MockPtySession);
    const id1 = await manager.start_process('cmd1', '/tmp');
    const id2 = await manager.start_process('cmd2', '/tmp');

    const processes = manager.list_processes();
    expect(Object.keys(processes).length).toBe(2);
    expect(processes[id1]).toBeInstanceOf(ProcessInfo);
    expect(processes[id2]).toBeInstanceOf(ProcessInfo);

    await manager.stop_all();
  });
});
