import { randomBytes } from 'node:crypto';
import { OutputBuffer } from './output_buffer.js';
import { get_default_session_factory } from './session_factory.js';
import { BackgroundProcessOutput, ProcessInfo } from './types.js';
import { strip_ansi_codes } from './ansi_utils.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class BackgroundProcess {
  process_id: string;
  command: string;
  session: any;
  output_buffer: OutputBuffer;
  started_at: number;
  readerPromise: Promise<void> | null = null;
  cancelled = false;

  constructor(process_id: string, command: string, session: any, output_buffer: OutputBuffer) {
    this.process_id = process_id;
    this.command = command;
    this.session = session;
    this.output_buffer = output_buffer;
    this.started_at = Date.now() / 1000;
  }

  get is_running(): boolean {
    return this.session.is_alive;
  }

  to_info(): ProcessInfo {
    return new ProcessInfo(this.process_id, this.command, this.started_at, this.is_running);
  }
}

export class BackgroundProcessManager {
  private sessionFactory: new (session_id: string) => any;
  private maxOutputBytes: number;
  private processes: Map<string, BackgroundProcess> = new Map();
  private counter = 0;

  constructor(session_factory?: new (session_id: string) => any, max_output_bytes: number = 1_000_000) {
    this.sessionFactory = session_factory ?? get_default_session_factory();
    this.maxOutputBytes = max_output_bytes;
  }

  private _generate_id(): string {
    this.counter += 1;
    return `bg_${String(this.counter).padStart(3, '0')}`;
  }

  async start_process(command: string, cwd: string): Promise<string> {
    const process_id = this._generate_id();
    const session_id = `bg-${randomBytes(4).toString('hex')}`;

    const session = new this.sessionFactory(session_id);
    const output_buffer = new OutputBuffer(this.maxOutputBytes);

    await session.start(cwd);

    const bg_process = new BackgroundProcess(process_id, command, session, output_buffer);

    let normalized = command;
    if (!normalized.endsWith('\n')) {
      normalized += '\n';
    }
    await session.write(Buffer.from(normalized, 'utf8'));

    bg_process.readerPromise = this._read_loop(bg_process);
    this.processes.set(process_id, bg_process);

    return process_id;
  }

  private async _read_loop(process: BackgroundProcess): Promise<void> {
    try {
      while (process.session.is_alive && !process.cancelled) {
        try {
          const data = await process.session.read(0.1);
          if (data) {
            process.output_buffer.append(data);
          }
        } catch {
          break;
        }
        await sleep(50);
      }
    } catch {
      // swallow background errors
    }
  }

  get_output(process_id: string, lines: number = 100): BackgroundProcessOutput {
    const process = this.processes.get(process_id);
    if (!process) {
      throw new Error(`Process ${process_id} not found`);
    }

    const raw_output = process.output_buffer.get_lines(lines);
    const clean_output = strip_ansi_codes(raw_output);
    return new BackgroundProcessOutput(clean_output, process.is_running, process_id);
  }

  async stop_process(process_id: string): Promise<boolean> {
    const process = this.processes.get(process_id);
    if (!process) {
      return false;
    }

    process.cancelled = true;

    if (process.readerPromise) {
      await process.readerPromise;
    }

    await process.session.close();
    this.processes.delete(process_id);
    return true;
  }

  async stop_all(): Promise<number> {
    const ids = Array.from(this.processes.keys());
    for (const process_id of ids) {
      await this.stop_process(process_id);
    }
    return ids.length;
  }

  list_processes(): Record<string, ProcessInfo> {
    const result: Record<string, ProcessInfo> = {};
    for (const [process_id, process] of this.processes.entries()) {
      result[process_id] = process.to_info();
    }
    return result;
  }

  get process_count(): number {
    return this.processes.size;
  }
}
