import { BaseState } from './base_state.js';
import type { ParserContext } from '../parser_context.js';
import { TextState } from './text_state.js';
import { SegmentType } from '../events.js';
import { START_MARKER, MARKER_END } from '../sentinel_format.js';
import { SentinelContentState } from './sentinel_content_state.js';

export class SentinelInitializationState extends BaseState {
  private headerBuffer = '';

  run(): void {
    if (!this.context.has_more_chars()) {
      return;
    }

    const startPos = this.context.get_position();
    const endIdx = this.context.find(MARKER_END, startPos);

    if (endIdx === -1) {
      this.headerBuffer += this.context.consume_remaining();
      if (!this.isPossiblePrefix(this.headerBuffer)) {
        this.context.append_text_segment(this.headerBuffer);
        this.context.transition_to(new TextState(this.context));
      }
      return;
    }

    this.headerBuffer += this.context.consume(endIdx - startPos + MARKER_END.length);

    if (!this.headerBuffer.startsWith(START_MARKER)) {
      this.context.append_text_segment(this.headerBuffer);
      this.context.transition_to(new TextState(this.context));
      return;
    }

    let headerJson = this.headerBuffer.slice(START_MARKER.length);
    if (headerJson.endsWith(MARKER_END)) {
      headerJson = headerJson.slice(0, -MARKER_END.length);
    }
    headerJson = headerJson.trim();

    if (!headerJson) {
      this.context.append_text_segment(this.headerBuffer);
      this.context.transition_to(new TextState(this.context));
      return;
    }

    const data = this.parseHeaderJson(headerJson);
    if (!data) {
      this.context.append_text_segment(this.headerBuffer);
      this.context.transition_to(new TextState(this.context));
      return;
    }

    const typeStr = typeof data.type === 'string' ? data.type : undefined;
    const segmentType = this.mapSegmentType(typeStr);

    if (!segmentType) {
      this.context.append_text_segment(this.headerBuffer);
      this.context.transition_to(new TextState(this.context));
      return;
    }

    const metadata = { ...data } as Record<string, any>;
    delete metadata.type;

    if (this.context.get_current_segment_type() === SegmentType.TEXT) {
      this.context.emit_segment_end();
    }

    this.context.transition_to(new SentinelContentState(this.context, segmentType, metadata));
  }

  finalize(): void {
    if (this.context.has_more_chars()) {
      this.headerBuffer += this.context.consume_remaining();
    }

    if (this.headerBuffer) {
      this.context.append_text_segment(this.headerBuffer);
    }
    this.context.transition_to(new TextState(this.context));
  }

  private isPossiblePrefix(buffer: string): boolean {
    return START_MARKER.startsWith(buffer) || buffer.startsWith(START_MARKER);
  }

  private parseHeaderJson(headerJson: string): Record<string, any> | null {
    try {
      const data = JSON.parse(headerJson);
      return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
    } catch {
      return null;
    }
  }

  private mapSegmentType(typeStr?: string): SegmentType | undefined {
    if (!typeStr) {
      return undefined;
    }
    const value = typeStr.trim().toLowerCase();
    const mapping: Record<string, SegmentType> = {
      text: SegmentType.TEXT,
      tool: SegmentType.TOOL_CALL,
      tool_call: SegmentType.TOOL_CALL,
      write_file: SegmentType.WRITE_FILE,
      patch_file: SegmentType.PATCH_FILE,
      run_bash: SegmentType.RUN_BASH,
      run_terminal_cmd: SegmentType.RUN_BASH
    };
    return mapping[value];
  }
}
