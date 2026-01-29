import { Singleton } from '../../../utils/singleton.js';
import type { BaseState } from './states/base_state.js';
import { XmlWriteFileToolParsingState } from './states/xml_write_file_tool_parsing_state.js';
import { XmlPatchFileToolParsingState } from './states/xml_patch_file_tool_parsing_state.js';
import { XmlRunBashToolParsingState } from './states/xml_run_bash_tool_parsing_state.js';
import { TOOL_NAME_WRITE_FILE, TOOL_NAME_PATCH_FILE, TOOL_NAME_RUN_BASH } from './tool_constants.js';

export type XmlToolParsingStateClass = new (...args: any[]) => BaseState;

export class XmlToolParsingStateRegistry extends Singleton {
  private toolStates: Map<string, XmlToolParsingStateClass> = new Map();

  constructor() {
    super();
    const existing = (XmlToolParsingStateRegistry as any).instance as XmlToolParsingStateRegistry | undefined;
    if (existing) {
      return existing;
    }
    (XmlToolParsingStateRegistry as any).instance = this;

    this.register_tool_state(TOOL_NAME_WRITE_FILE, XmlWriteFileToolParsingState);
    this.register_tool_state(TOOL_NAME_PATCH_FILE, XmlPatchFileToolParsingState);
    this.register_tool_state(TOOL_NAME_RUN_BASH, XmlRunBashToolParsingState);
  }

  register_tool_state(toolName: string, stateClass: XmlToolParsingStateClass): void {
    this.toolStates.set(toolName, stateClass);
  }

  get_state_for_tool(toolName: string): XmlToolParsingStateClass | undefined {
    return this.toolStates.get(toolName);
  }
}
