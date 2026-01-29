import { StreamingResponseHandler } from './streaming_response_handler.js';
import { create_streaming_parser, resolve_parser_name, type StreamingParserProtocol } from '../parser/parser_factory.js';
import { SegmentEvent } from '../segments/segment_events.js';
import { ToolInvocationAdapter } from '../adapters/invocation_adapter.js';
import { ParserConfig } from '../parser/parser_context.js';
import { ToolInvocation } from '../../tool_invocation.js';
import { ChunkResponse } from '../../../llm/utils/response_types.js';

export class ParsingStreamingResponseHandler extends StreamingResponseHandler {
  private parserName: string;
  private parserConfig?: ParserConfig;
  private parser: StreamingParserProtocol;
  private adapter: ToolInvocationAdapter;
  private onSegmentEvent?: (event: SegmentEvent) => void;
  private onToolInvocation?: (invocation: ToolInvocation) => void;
  private isFinalized = false;

  private allEvents: SegmentEvent[] = [];
  private allInvocations: ToolInvocation[] = [];

  constructor(options?: {
    on_segment_event?: (event: SegmentEvent) => void;
    on_tool_invocation?: (invocation: ToolInvocation) => void;
    config?: ParserConfig;
    parser_name?: string;
  }) {
    super();
    const parserName = resolve_parser_name(options?.parser_name);
    this.parserName = parserName;
    this.parserConfig = options?.config;
    this.parser = create_streaming_parser({ config: options?.config, parser_name: parserName });
    this.adapter = new ToolInvocationAdapter(this.parser.config.json_tool_parser);
    this.onSegmentEvent = options?.on_segment_event;
    this.onToolInvocation = options?.on_tool_invocation;
  }

  feed(chunk: ChunkResponse): SegmentEvent[] {
    if (this.isFinalized) {
      throw new Error('Handler has been finalized, cannot feed more chunks.');
    }

    const anyChunk = chunk as unknown as ChunkResponse | string;
    const textContent = typeof anyChunk === 'string' ? anyChunk : anyChunk.content;

    if (!textContent) {
      return [];
    }

    const events = this.parser.feed(textContent);
    this.process_events(events);
    return events;
  }

  finalize(): SegmentEvent[] {
    if (this.isFinalized) {
      return [];
    }

    this.isFinalized = true;
    const events = this.parser.finalize();
    this.process_events(events);
    return events;
  }

  get_all_events(): SegmentEvent[] {
    return [...this.allEvents];
  }

  get_all_invocations(): ToolInvocation[] {
    return [...this.allInvocations];
  }

  reset(): void {
    this.parser = create_streaming_parser({ config: this.parserConfig, parser_name: this.parserName });
    this.adapter = new ToolInvocationAdapter(this.parser.config.json_tool_parser);
    this.allEvents = [];
    this.allInvocations = [];
    this.isFinalized = false;
  }

  get parser_name(): string {
    return this.parserName;
  }

  private process_events(events: SegmentEvent[]): void {
    for (const event of events) {
      this.allEvents.push(event);

      if (this.onSegmentEvent) {
        try {
          this.onSegmentEvent(event);
        } catch (error) {
          console.error(`Error in on_segment_event callback: ${error}`);
        }
      }

      const invocation = this.adapter.process_event(event);
      if (invocation) {
        this.allInvocations.push(invocation);
        if (this.onToolInvocation) {
          try {
            this.onToolInvocation(invocation);
          } catch (error) {
            console.error(`Error in on_tool_invocation callback: ${error}`);
          }
        }
      }
    }
  }
}
