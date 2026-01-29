import type { ParserContext } from './parser_context.js';
import type { BaseState } from './states/base_state.js';
import { TextState } from './states/text_state.js';
import { XmlTagInitializationState } from './states/xml_tag_initialization_state.js';
import { CustomXmlTagWriteFileParsingState } from './states/custom_xml_tag_write_file_parsing_state.js';
import { CustomXmlTagRunBashParsingState } from './states/custom_xml_tag_run_bash_parsing_state.js';
import { XmlToolParsingState } from './states/xml_tool_parsing_state.js';
import { JsonInitializationState } from './states/json_initialization_state.js';
import { JsonToolParsingState } from './states/json_tool_parsing_state.js';

export class StateFactory {
  static text_state(context: ParserContext): BaseState {
    return new TextState(context);
  }

  static xml_tag_init_state(context: ParserContext): BaseState {
    return new XmlTagInitializationState(context);
  }

  static write_file_parsing_state(context: ParserContext, openingTag: string): BaseState {
    return new CustomXmlTagWriteFileParsingState(context, openingTag);
  }

  static run_bash_parsing_state(context: ParserContext, openingTag: string): BaseState {
    return new CustomXmlTagRunBashParsingState(context, openingTag);
  }

  static xml_tool_parsing_state(context: ParserContext, signatureBuffer: string): BaseState {
    return new XmlToolParsingState(context, signatureBuffer);
  }

  static json_init_state(context: ParserContext): BaseState {
    return new JsonInitializationState(context);
  }

  static json_tool_parsing_state(context: ParserContext, signatureBuffer: string): BaseState {
    return new JsonToolParsingState(context, signatureBuffer);
  }
}
