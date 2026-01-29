import { BaseState } from './base_state.js';
import type { ParserContext } from '../parser_context.js';
import { TextState } from './text_state.js';
import { SegmentType } from '../events.js';
import { CustomXmlTagWriteFileParsingState } from './custom_xml_tag_write_file_parsing_state.js';
import { CustomXmlTagRunBashParsingState } from './custom_xml_tag_run_bash_parsing_state.js';
import { XmlToolParsingState } from './xml_tool_parsing_state.js';
import { XmlToolParsingStateRegistry } from '../xml_tool_parsing_state_registry.js';

export class XmlTagInitializationState extends BaseState {
  static POSSIBLE_WRITE_FILE = '<write_file';
  static POSSIBLE_RUN_BASH = '<run_bash';
  static POSSIBLE_TOOL = '<tool';

  private tagBuffer: string;

  constructor(context: ParserContext) {
    super(context);
    this.context.advance();
    this.tagBuffer = '<';
  }

  run(): void {
    if (!this.context.has_more_chars()) {
      return;
    }

    const startPos = this.context.get_position();
    const endIdx = this.context.find('>', startPos);

    if (endIdx === -1) {
      this.tagBuffer += this.context.consume_remaining();

      const lowerBuffer = this.tagBuffer.toLowerCase();
      const possibleWriteFile =
        XmlTagInitializationState.POSSIBLE_WRITE_FILE.startsWith(lowerBuffer) ||
        lowerBuffer.startsWith(XmlTagInitializationState.POSSIBLE_WRITE_FILE);
      const possibleRunBash =
        XmlTagInitializationState.POSSIBLE_RUN_BASH.startsWith(lowerBuffer) ||
        lowerBuffer.startsWith(XmlTagInitializationState.POSSIBLE_RUN_BASH);
      const possibleTool =
        XmlTagInitializationState.POSSIBLE_TOOL.startsWith(lowerBuffer) ||
        lowerBuffer.startsWith(XmlTagInitializationState.POSSIBLE_TOOL);

      if (!(possibleWriteFile || possibleRunBash || possibleTool)) {
        this.context.append_text_segment(this.tagBuffer);
        this.context.transition_to(new TextState(this.context));
      }
      return;
    }

    this.tagBuffer += this.context.consume(endIdx - startPos + 1);
    const lowerBuffer = this.tagBuffer.toLowerCase();

    if (lowerBuffer.startsWith(XmlTagInitializationState.POSSIBLE_WRITE_FILE)) {
      if (this.context.get_current_segment_type() === SegmentType.TEXT) {
        this.context.emit_segment_end();
      }
      this.context.transition_to(new CustomXmlTagWriteFileParsingState(this.context, this.tagBuffer));
      return;
    }

    if (lowerBuffer.startsWith(XmlTagInitializationState.POSSIBLE_RUN_BASH)) {
      if (this.context.get_current_segment_type() === SegmentType.TEXT) {
        this.context.emit_segment_end();
      }
      this.context.transition_to(new CustomXmlTagRunBashParsingState(this.context, this.tagBuffer));
      return;
    }

    if (lowerBuffer.startsWith(XmlTagInitializationState.POSSIBLE_TOOL)) {
      if (this.context.parse_tool_calls) {
        if (this.context.get_current_segment_type() === SegmentType.TEXT) {
          this.context.emit_segment_end();
        }

        const nameMatch = /name\s*=\s*["']([^"']+)["']/i.exec(this.tagBuffer);
        if (nameMatch) {
          const toolName = nameMatch[1].toLowerCase();
          const registry = new XmlToolParsingStateRegistry();
          const stateClass = registry.get_state_for_tool(toolName);
          if (stateClass) {
            this.context.transition_to(new stateClass(this.context, this.tagBuffer));
          } else {
            this.context.transition_to(new XmlToolParsingState(this.context, this.tagBuffer));
          }
        } else {
          this.context.transition_to(new XmlToolParsingState(this.context, this.tagBuffer));
        }
      } else {
        this.context.append_text_segment(this.tagBuffer);
        this.context.transition_to(new TextState(this.context));
      }
      return;
    }

    this.context.append_text_segment(this.tagBuffer);
    this.context.transition_to(new TextState(this.context));
  }

  finalize(): void {
    if (this.tagBuffer) {
      this.context.append_text_segment(this.tagBuffer);
      this.tagBuffer = '';
    }
    this.context.transition_to(new TextState(this.context));
  }
}
