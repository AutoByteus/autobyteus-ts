import type { ParserContext } from '../parser_context.js';
import type { BaseState } from '../states/base_state.js';
import { JsonInitializationState } from '../states/json_initialization_state.js';
import type { DetectionStrategy } from './base.js';

export class JsonToolStrategy implements DetectionStrategy {
  name = 'json_tool';

  next_marker(context: ParserContext, startPos: number): number {
    if (!context.parse_tool_calls) {
      return -1;
    }
    const nextCurly = context.find('{', startPos);
    const nextBracket = context.find('[', startPos);
    const candidates = [nextCurly, nextBracket].filter((idx) => idx !== -1);
    return candidates.length ? Math.min(...candidates) : -1;
  }

  create_state(context: ParserContext): BaseState {
    return new JsonInitializationState(context);
  }
}
