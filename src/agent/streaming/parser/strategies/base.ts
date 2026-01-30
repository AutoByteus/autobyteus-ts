import type { ParserContext } from '../parser_context.js';
import type { BaseState } from '../states/base_state.js';

export interface DetectionStrategy {
  name: string;
  nextMarker(context: ParserContext, startPos: number): number;
  createState(context: ParserContext): BaseState;
}
