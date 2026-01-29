import { XmlToolParsingState } from './xml_tool_parsing_state.js';
import type { ParserContext } from '../parser_context.js';
import { SegmentType } from '../events.js';
import { TextState } from './text_state.js';

export class XmlRunBashToolParsingState extends XmlToolParsingState {
  static SEGMENT_TYPE = SegmentType.RUN_BASH;

  private foundContentStart = false;
  private contentBuffering = '';
  private swallowingRemaining = false;

  constructor(context: ParserContext, openingTag: string) {
    super(context, openingTag);
    if (this.toolName !== undefined && this.toolName !== 'run_bash') {
      // No-op: specialized state expects run_bash but falls back gracefully.
    }
  }

  run(): void {
    if (this.swallowingRemaining) {
      this.handleSwallowing();
      return;
    }

    if (!this.segmentStarted) {
      this.context.emit_segment_start((this.constructor as typeof XmlRunBashToolParsingState).SEGMENT_TYPE, this._get_start_metadata());
      this.segmentStarted = true;
    }

    if (!this.context.has_more_chars()) {
      return;
    }

    const chunk = this.context.consume_remaining();

    if (!this.foundContentStart) {
      this.contentBuffering += chunk;
      const match = /<arg\s+name=["']command["']>/i.exec(this.contentBuffering);
      if (match) {
        this.foundContentStart = true;
        const endOfTag = match.index + match[0].length;
        const realContent = this.contentBuffering.slice(endOfTag);
        this.contentBuffering = '';
        this.processContentChunk(realContent);
      } else {
        if (this.contentBuffering.includes('</tool>')) {
          this._on_segment_complete();
          this.context.emit_segment_end();
          this.context.transition_to(new TextState(this.context));
        }
      }
      return;
    }

    this.processContentChunk(chunk);
  }

  private processContentChunk(chunk: string): void {
    const closingTag = '</arg>';
    const combined = `${this.tail}${chunk}`;

    const idx = combined.indexOf(closingTag);
    if (idx !== -1) {
      const actualContent = combined.slice(0, idx);
      if (actualContent) {
        this.context.emit_segment_content(actualContent);
      }

      this.tail = '';
      const remainder = combined.slice(idx + closingTag.length);
      this.contentBuffering = remainder;
      this.swallowingRemaining = true;
      this.handleSwallowing();
      return;
    }

    const holdbackLen = closingTag.length - 1;
    if (combined.length > holdbackLen) {
      const safe = combined.slice(0, -holdbackLen);
      if (safe) {
        this.context.emit_segment_content(safe);
      }
      this.tail = combined.slice(-holdbackLen);
    } else {
      this.tail = combined;
    }
  }

  private handleSwallowing(): void {
    this.contentBuffering += this.context.consume_remaining();

    const closingTag = '</tool>';
    const idx = this.contentBuffering.indexOf(closingTag);

    if (idx !== -1) {
      const remainder = this.contentBuffering.slice(idx + closingTag.length);
      this._on_segment_complete();
      this.context.emit_segment_end();
      if (remainder) {
        this.context.rewind_by(remainder.length);
      }
      this.context.transition_to(new TextState(this.context));
      return;
    }

    const holdbackLen = closingTag.length - 1;
    if (this.contentBuffering.length > holdbackLen) {
      this.contentBuffering = this.contentBuffering.slice(-holdbackLen);
    }
  }

  protected _on_segment_complete(): void {
    return;
  }
}
