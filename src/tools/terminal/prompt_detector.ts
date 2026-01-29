/**
 * Detects when shell prompt returns after command execution.
 */
export class PromptDetector {
  static DEFAULT_PATTERN = '[\\$#]\\s*$';

  private patternValue: string;
  private compiled: RegExp;

  constructor(prompt_pattern?: string | null) {
    this.patternValue = prompt_pattern ?? PromptDetector.DEFAULT_PATTERN;
    this.compiled = new RegExp(this.patternValue, 'm');
  }

  check(output: string): boolean {
    if (!output) {
      return false;
    }

    const trimmed = output.trimEnd();
    if (trimmed.length === 0) {
      return false;
    }

    const lines = trimmed.split('\n');
    if (lines.length === 0) {
      return false;
    }

    const last_line = lines[lines.length - 1];
    return this.compiled.test(last_line);
  }

  set_pattern(pattern: string): void {
    this.patternValue = pattern;
    this.compiled = new RegExp(this.patternValue, 'm');
  }

  get pattern(): string {
    return this.patternValue;
  }
}
