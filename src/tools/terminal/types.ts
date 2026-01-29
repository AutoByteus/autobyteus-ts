export class TerminalResult {
  stdout: string;
  stderr: string;
  exit_code: number | null;
  timed_out: boolean;

  constructor(stdout: string, stderr: string, exit_code: number | null, timed_out: boolean) {
    this.stdout = stdout;
    this.stderr = stderr;
    this.exit_code = exit_code;
    this.timed_out = timed_out;
  }
}

export class BackgroundProcessOutput {
  output: string;
  is_running: boolean;
  process_id: string;

  constructor(output: string, is_running: boolean, process_id: string) {
    this.output = output;
    this.is_running = is_running;
    this.process_id = process_id;
  }
}

export class ProcessInfo {
  process_id: string;
  command: string;
  started_at: number;
  is_running: boolean;

  constructor(process_id: string, command: string, started_at: number, is_running: boolean) {
    this.process_id = process_id;
    this.command = command;
    this.started_at = started_at;
    this.is_running = is_running;
  }
}
