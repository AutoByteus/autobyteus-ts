import { Singleton } from '../../../utils/singleton.js';
import type { BaseState } from './states/base_state.js';
import type { ParserContext } from './parser_context.js';
import { XmlWriteFileToolParsingState } from './states/xml_write_file_tool_parsing_state.js';
import { XmlPatchFileToolParsingState } from './states/xml_patch_file_tool_parsing_state.js';
import { XmlRunBashToolParsingState } from './states/xml_run_bash_tool_parsing_state.js';
import { TOOL_NAME_WRITE_FILE, TOOL_NAME_PATCH_FILE, TOOL_NAME_RUN_BASH } from './tool_constants.js';

export type XmlToolParsingStateClass = new (context: ParserContext, openingTag: string) => BaseState;

export class XmlToolParsingStateRegistry extends Singleton {
  protected static instance?: XmlToolParsingStateRegistry;

  private toolStates: Map<string, XmlToolParsingStateClass> = new Map();

  constructor() {
    super();
    if (XmlToolParsingStateRegistry.instance) {
      return XmlToolParsingStateRegistry.instance;
    }
    XmlToolParsingStateRegistry.instance = this;

    this.registerToolState(TOOL_NAME_WRITE_FILE, XmlWriteFileToolParsingState);
    this.registerToolState(TOOL_NAME_PATCH_FILE, XmlPatchFileToolParsingState);
    this.registerToolState(TOOL_NAME_RUN_BASH, XmlRunBashToolParsingState);
  }

  registerToolState(toolName: string, stateClass: XmlToolParsingStateClass): void {
    this.toolStates.set(toolName, stateClass);
  }

  getStateForTool(toolName: string): XmlToolParsingStateClass | undefined {
    return this.toolStates.get(toolName);
  }
}
