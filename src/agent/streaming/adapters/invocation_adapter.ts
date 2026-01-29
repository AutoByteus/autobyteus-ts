import { SegmentEvent, SegmentEventType, SegmentType } from '../segments/segment_events.js';
import { get_tool_syntax_spec } from './tool_syntax_registry.js';
import { parse_json_tool_call, parse_xml_arguments, type JsonToolParsingStrategy } from './tool_call_parsing.js';
import { ToolInvocation } from '../../tool_invocation.js';

export class ToolInvocationAdapter {
  private activeSegments: Map<string, Record<string, any>> = new Map();
  private jsonToolParser?: JsonToolParsingStrategy;

  constructor(jsonToolParser?: JsonToolParsingStrategy) {
    this.jsonToolParser = jsonToolParser;
  }

  process_event(event: SegmentEvent): ToolInvocation | null {
    if (event.event_type === SegmentEventType.START) {
      this.handleStart(event);
      return null;
    }
    if (event.event_type === SegmentEventType.CONTENT) {
      this.handleContent(event);
      return null;
    }
    if (event.event_type === SegmentEventType.END) {
      return this.handleEnd(event);
    }
    return null;
  }

  process_events(events: SegmentEvent[]): ToolInvocation[] {
    const invocations: ToolInvocation[] = [];
    for (const event of events) {
      const result = this.process_event(event);
      if (result) {
        invocations.push(result);
      }
    }
    return invocations;
  }

  reset(): void {
    this.activeSegments.clear();
  }

  get_active_segment_ids(): string[] {
    return Array.from(this.activeSegments.keys());
  }

  private handleStart(event: SegmentEvent): void {
    if (event.segment_type !== SegmentType.TOOL_CALL && !get_tool_syntax_spec(event.segment_type!)) {
      return;
    }

    const metadata = event.payload?.metadata ?? {};
    let toolName = metadata.tool_name;
    const syntaxSpec = event.segment_type ? get_tool_syntax_spec(event.segment_type) : undefined;
    if (syntaxSpec) {
      toolName = syntaxSpec.tool_name;
    }

    this.activeSegments.set(event.segment_id, {
      segment_type: event.segment_type,
      tool_name: toolName,
      content_buffer: '',
      arguments: {},
      syntax_spec: syntaxSpec,
      metadata
    });
  }

  private handleContent(event: SegmentEvent): void {
    const segmentData = this.activeSegments.get(event.segment_id);
    if (!segmentData) {
      return;
    }

    const delta = event.payload?.delta ?? '';
    segmentData.content_buffer += delta;
  }

  private handleEnd(event: SegmentEvent): ToolInvocation | null {
    const segmentData = this.activeSegments.get(event.segment_id);
    if (!segmentData) {
      return null;
    }

    this.activeSegments.delete(event.segment_id);

    const metadata = event.payload?.metadata ?? {};
    const segmentType = segmentData.segment_type as SegmentType | undefined;
    let toolName = metadata.tool_name || segmentData.tool_name;
    let argumentsValue: Record<string, any> = segmentData.arguments ?? {};
    const contentBuffer = segmentData.content_buffer ?? '';
    const startMetadata = segmentData.metadata ?? {};
    const syntaxSpec = segmentData.syntax_spec;

    if (syntaxSpec) {
      toolName = syntaxSpec.tool_name;
      const args = syntaxSpec.build_arguments({ ...startMetadata, ...metadata }, contentBuffer);
      if (!args) {
        console.warn(`Tool segment ${event.segment_id} ended without required arguments for ${toolName}`);
        return null;
      }
      argumentsValue = args;
    } else if (segmentType === SegmentType.TOOL_CALL) {
      const content = contentBuffer;
      const stripped = content.trimStart();
      let parsedCall: { name?: string; arguments?: any } | null = null;

      if (startMetadata.arguments) {
        argumentsValue = startMetadata.arguments;
      } else if (metadata.arguments) {
        argumentsValue = metadata.arguments;
      } else if (stripped.startsWith('{') || stripped.startsWith('[')) {
        parsedCall = parse_json_tool_call(stripped, this.jsonToolParser);
      } else {
        argumentsValue = parse_xml_arguments(content);
      }

      if (parsedCall) {
        toolName = toolName || parsedCall.name;
        argumentsValue = parsedCall.arguments ?? {};
      }
    }

    if (!toolName) {
      console.warn(`Tool segment ${event.segment_id} ended without tool_name`);
      return null;
    }

    const invocation = new ToolInvocation(toolName, argumentsValue, event.segment_id);
    return invocation;
  }
}
