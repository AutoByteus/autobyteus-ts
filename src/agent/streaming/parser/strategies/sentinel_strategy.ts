import type { ParserContext } from '../parser_context.js';
import type { BaseState } from '../states/base_state.js';
import { SentinelInitializationState } from '../states/sentinel_initialization_state.js';
import { START_MARKER } from '../sentinel_format.js';
import type { DetectionStrategy } from './base.js';

export class SentinelStrategy implements DetectionStrategy {
  name = 'sentinel';

  nextMarker(context: ParserContext, startPos: number): number {
    return context.find(START_MARKER, startPos);
  }

  createState(context: ParserContext): BaseState {
    return new SentinelInitializationState(context);
  }
}
