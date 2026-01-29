import { DelimitedContentState } from './delimited_content_state.js';
import type { ParserContext } from '../parser_context.js';
import { END_MARKER } from '../sentinel_format.js';
import type { SegmentType } from '../events.js';

export class SentinelContentState extends DelimitedContentState {
  private metadata: Record<string, any>;

  constructor(context: ParserContext, segmentType: SegmentType, metadata: Record<string, any>) {
    super(context, '', END_MARKER);
    this.segmentTypeOverride = segmentType;
    this.metadata = metadata;
  }

  protected _get_start_metadata(): Record<string, any> {
    return this.metadata;
  }
}
