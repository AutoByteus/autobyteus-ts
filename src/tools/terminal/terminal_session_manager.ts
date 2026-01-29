import { randomBytes } from 'node:crypto';
import { OutputBuffer } from './output_buffer.js';
import { PromptDetector } from './prompt_detector.js';
import { get_default_session_factory } from './session_factory.js';
import { TerminalResult } from './types.js';
import { strip_ansi_codes } from './ansi_utils.js';

const DEFAULT_TIMEOUT_SECONDS = 30;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class TerminalSessionManager {
  private sessionFactory: new (session_id: string) => any;
  private promptDetector: PromptDetector;
  private session: any | null = null;
  private outputBuffer: OutputBuffer = new OutputBuffer();
  private cwd: string | null = null;
  private started = false;

  constructor(
    session_factory?: new (session_id: string) => any,
    prompt_detector?: PromptDetector
  ) {
    this.sessionFactory = session_factory ?? get_default_session_factory();
    this.promptDetector = prompt_detector ?? new PromptDetector();
  }

  get current_session(): any | null {
    return this.session;
  }

  get is_started(): boolean {
    return this.started && this.session !== null;
  }

  async ensure_started(cwd: string): Promise<void> {
    if (this.session && this.session.is_alive) {
      return;
    }

    if (this.session) {
      await this.session.close();
    }

    const session_id = `term-${randomBytes(4).toString('hex')}`;
    this.session = new this.sessionFactory(session_id);
    await this.session.start(cwd);
    this.cwd = cwd;
    this.started = true;

    await this._drain_output(0.5);
    this.outputBuffer.clear();
  }

  async execute_command(command: string, timeout_seconds: number = DEFAULT_TIMEOUT_SECONDS): Promise<TerminalResult> {
    if (!this.session) {
      throw new Error('Session not started. Call ensure_started first.');
    }

    this.outputBuffer.clear();

    let normalized = command;
    if (!normalized.endsWith('\n')) {
      normalized += '\n';
    }

    await this.session.write(Buffer.from(normalized, 'utf8'));

    let timed_out = false;
    const start = Date.now();

    while (true) {
      const elapsed = (Date.now() - start) / 1000;
      if (elapsed >= timeout_seconds) {
        timed_out = true;
        break;
      }

      try {
        const data = await this.session.read(0.1);
        if (data) {
          this.outputBuffer.append(data);
          const current = this.outputBuffer.get_all();
          if (this.promptDetector.check(current)) {
            break;
          }
        }
      } catch (error) {
        break;
      }
    }

    const output = this.outputBuffer.get_all();
    const clean_output = strip_ansi_codes(output);

    let exit_code: number | null = null;
    if (!timed_out) {
      exit_code = await this._get_exit_code();
    }

    return new TerminalResult(clean_output, '', exit_code, timed_out);
  }

  async close(): Promise<void> {
    if (this.session) {
      await this.session.close();
      this.session = null;
    }
    this.started = false;
    this.outputBuffer.clear();
  }

  private async _get_exit_code(): Promise<number | null> {
    try {
      this.outputBuffer.clear();
      await this.session.write(Buffer.from('echo $?\n', 'utf8'));
      await sleep(200);
      await this._drain_output(0.3);

      const output = strip_ansi_codes(this.outputBuffer.get_all());
      const lines = output.trim().split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (/^\d+$/.test(trimmed)) {
          return parseInt(trimmed, 10);
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  private async _drain_output(timeout: number = 0.5): Promise<void> {
    if (!this.session) {
      return;
    }

    const start = Date.now();
    while ((Date.now() - start) / 1000 < timeout) {
      try {
        const data = await this.session.read(0.05);
        if (data) {
          this.outputBuffer.append(data);
        } else {
          await sleep(50);
        }
      } catch {
        break;
      }
    }
  }
}
