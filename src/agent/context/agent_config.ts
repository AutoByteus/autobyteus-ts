import { BaseSystemPromptProcessor, ToolManifestInjectorProcessor, AvailableSkillsProcessor } from '../system_prompt_processor/index.js';
import { resolveToolCallFormat } from '../../utils/tool_call_format.js';
import { BaseLLM } from '../../llm/base.js';
import type { BaseTool } from '../../tools/base_tool.js';
import type { BaseAgentWorkspace } from '../workspace/base_workspace.js';
import type { BaseAgentUserInputMessageProcessor } from '../input_processor/base_user_input_processor.js';
import type { BaseToolInvocationPreprocessor } from '../tool_invocation_preprocessor/base_preprocessor.js';
import type { BaseToolExecutionResultProcessor } from '../tool_execution_result_processor/base_processor.js';
import type { BaseLLMResponseProcessor } from '../llm_response_processor/base_processor.js';
import type { BaseLifecycleEventProcessor } from '../lifecycle/base_processor.js';

function deepClone<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export class AgentConfig {
  static DEFAULT_LLM_RESPONSE_PROCESSORS: BaseLLMResponseProcessor[] = [];
  static DEFAULT_SYSTEM_PROMPT_PROCESSORS: BaseSystemPromptProcessor[] = [
    new ToolManifestInjectorProcessor(),
    new AvailableSkillsProcessor()
  ];

  name: string;
  role: string;
  description: string;
  llm_instance: BaseLLM;
  system_prompt?: string | null;
  tools: BaseTool[];
  workspace: BaseAgentWorkspace | null;
  auto_execute_tools: boolean;
  input_processors: BaseAgentUserInputMessageProcessor[];
  llm_response_processors: BaseLLMResponseProcessor[];
  system_prompt_processors: BaseSystemPromptProcessor[];
  tool_execution_result_processors: BaseToolExecutionResultProcessor[];
  tool_invocation_preprocessors: BaseToolInvocationPreprocessor[];
  lifecycle_processors: BaseLifecycleEventProcessor[];
  initial_custom_data?: Record<string, any> | null;
  skills: string[];

  constructor(
    name: string,
    role: string,
    description: string,
    llm_instance: BaseLLM,
    system_prompt: string | null = null,
    tools: BaseTool[] | null = null,
    auto_execute_tools = true,
    input_processors: BaseAgentUserInputMessageProcessor[] | null = null,
    llm_response_processors: BaseLLMResponseProcessor[] | null = null,
    system_prompt_processors: BaseSystemPromptProcessor[] | null = null,
    tool_execution_result_processors: BaseToolExecutionResultProcessor[] | null = null,
    tool_invocation_preprocessors: BaseToolInvocationPreprocessor[] | null = null,
    workspace: BaseAgentWorkspace | null = null,
    lifecycle_processors: BaseLifecycleEventProcessor[] | null = null,
    initial_custom_data: Record<string, any> | null = null,
    skills: string[] | null = null
  ) {
    this.name = name;
    this.role = role;
    this.description = description;
    this.llm_instance = llm_instance;
    this.system_prompt = system_prompt;
    this.tools = tools ?? [];
    this.workspace = workspace;
    this.auto_execute_tools = auto_execute_tools;
    this.input_processors = input_processors ?? [];
    this.llm_response_processors =
      llm_response_processors !== null && llm_response_processors !== undefined
        ? llm_response_processors
        : [...AgentConfig.DEFAULT_LLM_RESPONSE_PROCESSORS];

    const default_processors =
      system_prompt_processors !== null && system_prompt_processors !== undefined
        ? system_prompt_processors
        : [...AgentConfig.DEFAULT_SYSTEM_PROMPT_PROCESSORS];

    this.system_prompt_processors = default_processors;
    this.tool_execution_result_processors = tool_execution_result_processors ?? [];
    this.tool_invocation_preprocessors = tool_invocation_preprocessors ?? [];
    this.lifecycle_processors = lifecycle_processors ?? [];
    this.initial_custom_data = initial_custom_data ?? undefined;
    this.skills = skills ?? [];

    const tool_call_format = resolveToolCallFormat();
    if (tool_call_format === 'api_tool_call') {
      this.system_prompt_processors = default_processors.filter(
        (processor) => !(processor instanceof ToolManifestInjectorProcessor)
      );
    } else {
      this.system_prompt_processors = default_processors;
    }

    console.debug(
      `AgentConfig created for name='${this.name}', role='${this.role}'. Tool call format: ${tool_call_format}`
    );
  }

  copy(): AgentConfig {
    return new AgentConfig(
      this.name,
      this.role,
      this.description,
      this.llm_instance,
      this.system_prompt ?? null,
      this.tools.slice(),
      this.auto_execute_tools,
      this.input_processors.slice(),
      this.llm_response_processors.slice(),
      this.system_prompt_processors.slice(),
      this.tool_execution_result_processors.slice(),
      this.tool_invocation_preprocessors.slice(),
      this.workspace,
      this.lifecycle_processors.slice(),
      deepClone(this.initial_custom_data ?? null),
      this.skills.slice()
    );
  }

  toString(): string {
    return (
      `AgentConfig(name='${this.name}', role='${this.role}', ` +
      `llm_instance='${this.llm_instance.constructor.name}', ` +
      `workspace_configured=${this.workspace !== null}, skills=${JSON.stringify(this.skills)})`
    );
  }
}
