import { DelimitedContentState } from './delimited_content_state.js';
import type { ParserContext } from '../parser_context.js';
import { SegmentType } from '../events.js';

export class CustomXmlTagWriteFileParsingState extends DelimitedContentState {
  static PATH_PATTERN = /path\s*=\s*["']([^"']+)["']/i;
  static CLOSING_TAG = '</write_file>';
  static SEGMENT_TYPE = SegmentType.WRITE_FILE;

  private filePath?: string;

  constructor(context: ParserContext, openingTag: string) {
    super(context, openingTag);

    const match = (this.constructor as typeof CustomXmlTagWriteFileParsingState).PATH_PATTERN.exec(openingTag);
    if (match) {
      this.filePath = match[1];
    }
  }

  protected _can_start_segment(): boolean {
    return this.filePath !== undefined;
  }

  protected _get_start_metadata(): Record<string, any> {
    return this.filePath ? { path: this.filePath } : {};
  }
}
