import type { ParserContext } from '../parser_context.js';
import type { BaseState } from '../states/base_state.js';
import { XmlTagInitializationState } from '../states/xml_tag_initialization_state.js';
import type { DetectionStrategy } from './base.js';

export class XmlTagStrategy implements DetectionStrategy {
  name = 'xml_tag';

  next_marker(context: ParserContext, startPos: number): number {
    return context.find('<', startPos);
  }

  create_state(context: ParserContext): BaseState {
    return new XmlTagInitializationState(context);
  }
}
