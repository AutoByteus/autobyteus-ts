import { ParserContext, ParserConfig } from './parser_context.js';
import { TextState } from './states/text_state.js';
import { SegmentEvent, SegmentEventType, SegmentType } from './events.js';

export class StreamingParser {
  private context: ParserContext;
  private isFinalized = false;

  constructor(config?: ParserConfig) {
    this.context = new ParserContext(config);
    this.context.current_state = new TextState(this.context);
  }

  get config(): ParserConfig {
    return this.context.config;
  }

  feed(chunk: string): SegmentEvent[] {
    if (this.isFinalized) {
      throw new Error('Cannot feed chunks after finalize() has been called');
    }

    if (!chunk) {
      return [];
    }

    this.context.append(chunk);

    while (this.context.has_more_chars()) {
      this.context.current_state.run();
    }

    this.context.compact();

    return this.context.get_and_clear_events();
  }

  finalize(): SegmentEvent[] {
    if (this.isFinalized) {
      throw new Error('finalize() has already been called');
    }

    this.isFinalized = true;

    this.context.current_state.finalize();

    if (this.context.get_current_segment_type() === SegmentType.TEXT) {
      this.context.emit_segment_end();
    }

    this.context.compact();

    return this.context.get_and_clear_events();
  }

  feed_and_finalize(text: string): SegmentEvent[] {
    const events = this.feed(text);
    events.push(...this.finalize());
    return events;
  }

  get is_finalized(): boolean {
    return this.isFinalized;
  }

  get_current_segment_id(): string | undefined {
    return this.context.get_current_segment_id();
  }

  get_current_segment_type(): SegmentType | undefined {
    return this.context.get_current_segment_type();
  }
}

export function parse_complete_response(text: string, config?: ParserConfig): SegmentEvent[] {
  const parser = new StreamingParser(config);
  return parser.feed_and_finalize(text);
}

export function extract_segments(events: SegmentEvent[]): Array<{ id: string; type: string; content: string; metadata: Record<string, any> }> {
  const segments: Array<{ id: string; type: string; content: string; metadata: Record<string, any> }> = [];
  let current: { id: string; type: string; content: string; metadata: Record<string, any> } | null = null;

  for (const event of events) {
    if (event.event_type === SegmentEventType.START) {
      current = {
        id: event.segment_id,
        type: event.segment_type ?? 'unknown',
        content: '',
        metadata: (event.payload?.metadata as Record<string, any>) ?? {}
      };
    } else if (event.event_type === SegmentEventType.CONTENT) {
      if (current) {
        const delta = event.payload?.delta;
        if (typeof delta === 'string') {
          current.content += delta;
        }
      }
    } else if (event.event_type === SegmentEventType.END) {
      if (current) {
        segments.push(current);
        current = null;
      }
    }
  }

  if (current) {
    segments.push(current);
  }

  return segments;
}
