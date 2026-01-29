import { BaseState } from './base_state.js';
import type { ParserContext } from '../parser_context.js';
import { SegmentType } from '../events.js';
import { TextState } from './text_state.js';

export class DelimitedContentState extends BaseState {
  static CLOSING_TAG = '';
  static SEGMENT_TYPE: SegmentType | undefined = undefined;

  protected openingTag: string;
  protected segmentStarted = false;
  protected tail = '';
  protected segmentTypeOverride?: SegmentType;
  protected closingTag: string;
  protected closingTagLower: string;
  protected holdbackLen: number;

  constructor(context: ParserContext, openingTag: string, closingTagOverride?: string) {
    super(context);
    this.openingTag = openingTag;
    this.closingTag = closingTagOverride ?? (this.constructor as typeof DelimitedContentState).CLOSING_TAG;
    this.closingTagLower = this.closingTag.toLowerCase();
    this.holdbackLen = Math.max(this.closingTag.length - 1, 0);
  }

  protected _can_start_segment(): boolean {
    return true;
  }

  protected _get_start_metadata(): Record<string, any> {
    return {};
  }

  protected _opening_content(): string | undefined {
    return undefined;
  }

  protected _on_segment_complete(): void {
    return;
  }

  protected _should_emit_closing_tag(): boolean {
    return false;
  }

  run(): void {
    if (!this.segmentStarted) {
      if (!this._can_start_segment()) {
        this.context.append_text_segment(this.openingTag);
        this.context.transition_to(new TextState(this.context));
        return;
      }

      const segmentType =
        this.segmentTypeOverride ?? (this.constructor as typeof DelimitedContentState).SEGMENT_TYPE;
      if (!segmentType) {
        throw new Error('SEGMENT_TYPE is not defined for DelimitedContentState.');
      }

      this.context.emit_segment_start(segmentType, this._get_start_metadata());
      this.segmentStarted = true;

      const openingContent = this._opening_content();
      if (openingContent) {
        this.context.emit_segment_content(openingContent);
      }
    }

    if (!this.context.has_more_chars()) {
      return;
    }

    const available = this.context.consume_remaining();
    const combined = this.tail + available;
    const idx = combined ? combined.toLowerCase().indexOf(this.closingTagLower) : -1;

    if (idx !== -1) {
      const contentBefore = combined.slice(0, idx);
      if (contentBefore) {
        this.context.emit_segment_content(contentBefore);
      }

      if (this._should_emit_closing_tag() && this.closingTag) {
        this.context.emit_segment_content(this.closingTag);
      }

      const tailLen = this.tail.length;
      const closingLen = this.closingTag.length;
      const consumedFromAvailable = idx < tailLen ? idx + closingLen - tailLen : idx - tailLen + closingLen;
      const extra = available.length - consumedFromAvailable;
      if (extra > 0) {
        this.context.rewind_by(extra);
      }

      this.tail = '';
      this._on_segment_complete();
      this.context.emit_segment_end();
      this.context.transition_to(new TextState(this.context));
      return;
    }

    if (this.holdbackLen === 0) {
      if (combined) {
        this.context.emit_segment_content(combined);
      }
      this.tail = '';
      return;
    }

    if (combined.length > this.holdbackLen) {
      const safe = combined.slice(0, -this.holdbackLen);
      if (safe) {
        this.context.emit_segment_content(safe);
      }
      this.tail = combined.slice(-this.holdbackLen);
    } else {
      this.tail = combined;
    }
  }

  finalize(): void {
    const remaining = this.context.has_more_chars() ? this.context.consume_remaining() : '';

    if (!this.segmentStarted) {
      const text = `${this.openingTag}${this.tail}${remaining}`;
      if (text) {
        this.context.append_text_segment(text);
      }
    } else {
      if (this.tail || remaining) {
        this.context.emit_segment_content(`${this.tail}${remaining}`);
      }
      this.tail = '';
      this.context.emit_segment_end();
    }

    this.context.transition_to(new TextState(this.context));
  }
}
