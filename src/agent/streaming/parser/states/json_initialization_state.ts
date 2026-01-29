import { BaseState } from './base_state.js';
import type { ParserContext } from '../parser_context.js';
import { SegmentType } from '../events.js';
import { TextState } from './text_state.js';
import { JsonToolParsingState } from './json_tool_parsing_state.js';
import { ParserConfig } from '../parser_context.js';

export class JsonToolSignatureChecker {
  private patterns: string[];

  constructor(patterns?: string[]) {
    this.patterns = patterns ?? ParserConfig.DEFAULT_JSON_PATTERNS;
  }

  check_signature(buffer: string): 'match' | 'partial' | 'no_match' {
    const normalized = buffer.replace(/[\s]/g, '');

    for (const pattern of this.patterns) {
      const normalizedPattern = pattern.replace(/\s/g, '');
      if (normalized.startsWith(normalizedPattern)) {
        return 'match';
      }
      if (normalizedPattern.startsWith(normalized)) {
        return 'partial';
      }
    }

    if (normalized.length < 8) {
      if (
        ['', '{', '[', '{"', '[{', '{"n', '{"na', '{"nam'].includes(normalized)
      ) {
        return 'partial';
      }
    }

    return 'no_match';
  }
}

export class JsonInitializationState extends BaseState {
  private signatureBuffer: string;
  private checker: JsonToolSignatureChecker;

  constructor(context: ParserContext) {
    super(context);
    const trigger = this.context.peek_char();
    this.context.advance();
    this.signatureBuffer = trigger ?? '';
    this.checker = new JsonToolSignatureChecker(context.json_tool_patterns);
  }

  run(): void {
    while (this.context.has_more_chars()) {
      const char = this.context.peek_char();
      if (char === undefined) {
        break;
      }
      this.signatureBuffer += char;
      this.context.advance();

      const match = this.checker.check_signature(this.signatureBuffer);

      if (match === 'match') {
        if (this.context.parse_tool_calls) {
          if (this.context.get_current_segment_type() === SegmentType.TEXT) {
            this.context.emit_segment_end();
          }
          this.context.transition_to(
            new JsonToolParsingState(this.context, this.signatureBuffer, true)
          );
        } else {
          this.context.append_text_segment(this.signatureBuffer);
          this.context.transition_to(new TextState(this.context));
        }
        return;
      }

      if (match === 'no_match') {
        this.context.append_text_segment(this.signatureBuffer);
        this.context.transition_to(new TextState(this.context));
        return;
      }
    }
  }

  finalize(): void {
    if (this.signatureBuffer) {
      this.context.append_text_segment(this.signatureBuffer);
      this.signatureBuffer = '';
    }
    this.context.transition_to(new TextState(this.context));
  }
}
