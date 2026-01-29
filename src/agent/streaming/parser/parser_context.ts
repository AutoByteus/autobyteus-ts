import { StreamScanner } from './stream_scanner.js';
import { EventEmitter } from './event_emitter.js';
import { SegmentEvent, SegmentType } from './events.js';
import { create_detection_strategies, type DetectionStrategy } from './strategies/registry.js';

export class ParserConfig {
  static DEFAULT_JSON_PATTERNS = [
    '{"tool"',
    '{"tool_calls"',
    '{"tools"',
    '{"function"',
    '{"name"',
    '[{"tool"',
    '[{"function"',
    '[{"name"'
  ];

  parse_tool_calls: boolean;
  json_tool_patterns: string[];
  json_tool_parser?: any;
  strategy_order: string[];
  segment_id_prefix?: string;

  constructor(options?: {
    parse_tool_calls?: boolean;
    json_tool_patterns?: string[];
    json_tool_parser?: any;
    strategy_order?: string[];
    segment_id_prefix?: string;
  }) {
    this.parse_tool_calls = options?.parse_tool_calls ?? true;
    this.json_tool_patterns = options?.json_tool_patterns
      ? [...options.json_tool_patterns]
      : [...ParserConfig.DEFAULT_JSON_PATTERNS];
    this.json_tool_parser = options?.json_tool_parser;
    this.strategy_order = options?.strategy_order ? [...options.strategy_order] : ['xml_tag'];
    this.segment_id_prefix = options?.segment_id_prefix;
  }
}

export class ParserContext {
  private configInstance: ParserConfig;
  private scanner: StreamScanner;
  private emitter: EventEmitter;
  private currentState: any;
  private strategies: DetectionStrategy[];

  constructor(config?: ParserConfig) {
    this.configInstance = config ?? new ParserConfig();
    this.scanner = new StreamScanner();
    this.emitter = new EventEmitter(this.configInstance.segment_id_prefix);
    this.currentState = null;
    this.strategies = create_detection_strategies(this.configInstance.strategy_order);
  }

  get config(): ParserConfig {
    return this.configInstance;
  }

  get parse_tool_calls(): boolean {
    return this.configInstance.parse_tool_calls;
  }

  get json_tool_patterns(): string[] {
    return this.configInstance.json_tool_patterns;
  }

  get json_tool_parser(): any {
    return this.configInstance.json_tool_parser;
  }

  get detection_strategies(): DetectionStrategy[] {
    return this.strategies;
  }

  get current_state(): any {
    if (!this.currentState) {
      throw new Error('No current state is set.');
    }
    return this.currentState;
  }

  set current_state(state: any) {
    this.currentState = state;
  }

  transition_to(newState: any): void {
    this.currentState = newState;
  }

  append(text: string): void {
    this.scanner.append(text);
  }

  peek_char(): string | undefined {
    return this.scanner.peek();
  }

  advance(): void {
    this.scanner.advance();
  }

  advance_by(count: number): void {
    this.scanner.advanceBy(count);
  }

  has_more_chars(): boolean {
    return this.scanner.hasMoreChars();
  }

  get_position(): number {
    return this.scanner.getPosition();
  }

  get_buffer_length(): number {
    return this.scanner.getBufferLength();
  }

  set_position(position: number): void {
    this.scanner.setPosition(position);
  }

  rewind_by(count: number): void {
    const newPos = Math.max(0, this.scanner.getPosition() - count);
    this.scanner.setPosition(newPos);
  }

  substring(start: number, end?: number): string {
    return this.scanner.substring(start, end);
  }

  find(sub: string, start?: number): number {
    return this.scanner.find(sub, start);
  }

  consume(count: number): string {
    return this.scanner.consume(count);
  }

  consume_remaining(): string {
    return this.scanner.consumeRemaining();
  }

  compact(minPrefix = 65536): void {
    this.scanner.compact(minPrefix);
  }

  emit_segment_start(segmentType: SegmentType, metadata: Record<string, any> = {}): string {
    return this.emitter.emit_segment_start(segmentType, metadata);
  }

  emit_segment_content(delta: any): void {
    this.emitter.emit_segment_content(delta);
  }

  emit_segment_end(): string | undefined {
    return this.emitter.emit_segment_end();
  }

  get_current_segment_id(): string | undefined {
    return this.emitter.get_current_segment_id();
  }

  get_current_segment_type(): SegmentType | undefined {
    return this.emitter.get_current_segment_type();
  }

  get_current_segment_content(): string {
    return this.emitter.get_current_segment_content();
  }

  get_current_segment_metadata(): Record<string, any> {
    return this.emitter.get_current_segment_metadata();
  }

  update_current_segment_metadata(metadata: Record<string, any>): void {
    this.emitter.update_current_segment_metadata(metadata);
  }

  get_and_clear_events(): SegmentEvent[] {
    return this.emitter.get_and_clear_events();
  }

  get_events(): SegmentEvent[] {
    return this.emitter.get_events();
  }

  append_text_segment(text: string): void {
    this.emitter.append_text_segment(text);
  }
}
