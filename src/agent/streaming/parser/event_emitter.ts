import { SegmentEvent, SegmentEventType, SegmentType } from './events.js';

export class EventEmitter {
  private eventQueue: SegmentEvent[] = [];
  private segmentCounter = 0;
  private currentSegmentId?: string;
  private currentSegmentType?: SegmentType;
  private currentSegmentContent = '';
  private currentSegmentMetadata: Record<string, any> = {};
  private segmentIdPrefix?: string;

  constructor(segmentIdPrefix?: string) {
    this.segmentIdPrefix = segmentIdPrefix;
  }

  private generateSegmentId(): string {
    this.segmentCounter += 1;
    const baseId = `seg_${this.segmentCounter}`;
    if (this.segmentIdPrefix) {
      return `${this.segmentIdPrefix}${baseId}`;
    }
    return baseId;
  }

  emit_segment_start(segmentType: SegmentType, metadata: Record<string, any> = {}): string {
    const segmentId = this.generateSegmentId();
    this.currentSegmentId = segmentId;
    this.currentSegmentType = segmentType;
    this.currentSegmentContent = '';
    this.currentSegmentMetadata = { ...metadata };

    const event = SegmentEvent.start(segmentId, segmentType, metadata);
    this.eventQueue.push(event);
    return segmentId;
  }

  emit_segment_content(delta: any): void {
    if (!this.currentSegmentId) {
      throw new Error('Cannot emit content without an active segment.');
    }

    if (typeof delta === 'string') {
      this.currentSegmentContent += delta;
    }

    const event = SegmentEvent.content(this.currentSegmentId, delta);
    this.eventQueue.push(event);
  }

  emit_segment_end(): string | undefined {
    if (!this.currentSegmentId) {
      return undefined;
    }

    const segmentId = this.currentSegmentId;
    const payload = Object.keys(this.currentSegmentMetadata).length
      ? { metadata: { ...this.currentSegmentMetadata } }
      : {};
    const event = new SegmentEvent({
      event_type: SegmentEventType.END,
      segment_id: segmentId,
      payload
    });
    this.eventQueue.push(event);

    this.currentSegmentId = undefined;
    this.currentSegmentType = undefined;

    return segmentId;
  }

  get_current_segment_id(): string | undefined {
    return this.currentSegmentId;
  }

  get_current_segment_type(): SegmentType | undefined {
    return this.currentSegmentType;
  }

  get_current_segment_content(): string {
    return this.currentSegmentContent;
  }

  get_current_segment_metadata(): Record<string, any> {
    return { ...this.currentSegmentMetadata };
  }

  update_current_segment_metadata(metadata: Record<string, any>): void {
    this.currentSegmentMetadata = { ...this.currentSegmentMetadata, ...metadata };
  }

  get_and_clear_events(): SegmentEvent[] {
    const events = [...this.eventQueue];
    this.eventQueue = [];
    return events;
  }

  get_events(): SegmentEvent[] {
    return [...this.eventQueue];
  }

  append_text_segment(text: string): void {
    if (!text) {
      return;
    }

    if (this.currentSegmentType !== SegmentType.TEXT) {
      if (this.currentSegmentId) {
        console.warn(
          `append_text_segment called while non-text segment is active (${this.currentSegmentType}); ending it before starting a text segment.`
        );
        this.emit_segment_end();
      }
      this.emit_segment_start(SegmentType.TEXT);
    }

    this.emit_segment_content(text);
  }
}
