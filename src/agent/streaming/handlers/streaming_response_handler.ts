import { SegmentEvent } from '../segments/segment_events.js';
import { ToolInvocation } from '../../tool_invocation.js';
import { ChunkResponse } from '../../../llm/utils/response_types.js';

export abstract class StreamingResponseHandler {
  abstract feed(chunk: ChunkResponse): SegmentEvent[];

  abstract finalize(): SegmentEvent[];

  abstract getAllInvocations(): ToolInvocation[];

  abstract getAllEvents(): SegmentEvent[];

  abstract reset(): void;
}
