import { BaseState } from './base_state.js';
import type { ParserContext } from '../parser_context.js';

export class TextState extends BaseState {
  constructor(context: ParserContext) {
    super(context);
  }

  run(): void {
    const startPos = this.context.get_position();

    if (!this.context.has_more_chars()) {
      return;
    }

    const strategies = this.context.detection_strategies;
    let bestIdx = -1;
    let bestStrategy: any = null;

    for (const strategy of strategies) {
      const idx = strategy.next_marker(this.context, startPos);
      if (idx === -1) {
        continue;
      }
      if (bestIdx === -1 || idx < bestIdx) {
        bestIdx = idx;
        bestStrategy = strategy;
      }
    }

    if (bestIdx === -1) {
      const text = this.context.substring(startPos);
      if (text) {
        this.context.append_text_segment(text);
      }
      this.context.set_position(this.context.get_buffer_length());
      return;
    }

    if (bestIdx > startPos) {
      const text = this.context.substring(startPos, bestIdx);
      if (text) {
        this.context.append_text_segment(text);
      }
    }

    this.context.set_position(bestIdx);

    if (!bestStrategy) {
      throw new Error('No detection strategy available for marker.');
    }
    this.context.transition_to(bestStrategy.create_state(this.context));
  }

  finalize(): void {
    // No-op: text already emitted in run
  }
}
