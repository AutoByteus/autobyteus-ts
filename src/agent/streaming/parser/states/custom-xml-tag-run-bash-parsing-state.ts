import { DelimitedContentState } from './delimited-content-state.js';
import type { ParserContext } from '../parser-context.js';
import { SegmentType } from '../events.js';

export class CustomXmlTagRunBashParsingState extends DelimitedContentState {
  static CLOSING_TAG = '</run_bash>';
  static SEGMENT_TYPE = SegmentType.RUN_BASH;

  constructor(context: ParserContext, openingTag: string) {
    super(context, openingTag);
  }
}
