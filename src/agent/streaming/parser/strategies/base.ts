import type { ParserContext } from '../parser_context.js';
import type { BaseState } from '../states/base_state.js';

export interface DetectionStrategy {
  name: string;
  next_marker(context: ParserContext, startPos: number): number;
  create_state(context: ParserContext): BaseState;
}
