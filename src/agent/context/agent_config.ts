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
  llmInstance: BaseLLM;
  systemPrompt?: string | null;
  tools: BaseTool[];
  workspace: BaseAgentWorkspace | null;
  autoExecuteTools: boolean;
  inputProcessors: BaseAgentUserInputMessageProcessor[];
  llmResponseProcessors: BaseLLMResponseProcessor[];
  systemPromptProcessors: BaseSystemPromptProcessor[];
  toolExecutionResultProcessors: BaseToolExecutionResultProcessor[];
  toolInvocationPreprocessors: BaseToolInvocationPreprocessor[];
  lifecycleProcessors: BaseLifecycleEventProcessor[];
  initialCustomData?: Record<string, any> | null;
  skills: string[];

  constructor(
    name: string,
    role: string,
    description: string,
    llmInstance: BaseLLM,
    systemPrompt: string | null = null,
    tools: BaseTool[] | null = null,
    autoExecuteTools = true,
    inputProcessors: BaseAgentUserInputMessageProcessor[] | null = null,
    llmResponseProcessors: BaseLLMResponseProcessor[] | null = null,
    systemPromptProcessors: BaseSystemPromptProcessor[] | null = null,
    toolExecutionResultProcessors: BaseToolExecutionResultProcessor[] | null = null,
    toolInvocationPreprocessors: BaseToolInvocationPreprocessor[] | null = null,
    workspace: BaseAgentWorkspace | null = null,
    lifecycleProcessors: BaseLifecycleEventProcessor[] | null = null,
    initialCustomData: Record<string, any> | null = null,
    skills: string[] | null = null
  ) {
    this.name = name;
    this.role = role;
    this.description = description;
    this.llmInstance = llmInstance;
    this.systemPrompt = systemPrompt;
    this.tools = tools ?? [];
    this.workspace = workspace;
    this.autoExecuteTools = autoExecuteTools;
    this.inputProcessors = inputProcessors ?? [];
    this.llmResponseProcessors =
      llmResponseProcessors !== null && llmResponseProcessors !== undefined
        ? llmResponseProcessors
        : [...AgentConfig.DEFAULT_LLM_RESPONSE_PROCESSORS];

    const defaultProcessors =
      systemPromptProcessors !== null && systemPromptProcessors !== undefined
        ? systemPromptProcessors
        : [...AgentConfig.DEFAULT_SYSTEM_PROMPT_PROCESSORS];

    this.systemPromptProcessors = defaultProcessors;
    this.toolExecutionResultProcessors = toolExecutionResultProcessors ?? [];
    this.toolInvocationPreprocessors = toolInvocationPreprocessors ?? [];
    this.lifecycleProcessors = lifecycleProcessors ?? [];
    this.initialCustomData = initialCustomData ?? undefined;
    this.skills = skills ?? [];

    const toolCallFormat = resolveToolCallFormat();
    if (toolCallFormat === 'api_tool_call') {
      this.systemPromptProcessors = defaultProcessors.filter(
        (processor) => !(processor instanceof ToolManifestInjectorProcessor)
      );
    } else {
      this.systemPromptProcessors = defaultProcessors;
    }

    console.debug(
      `AgentConfig created for name='${this.name}', role='${this.role}'. Tool call format: ${toolCallFormat}`
    );
  }

  copy(): AgentConfig {
    return new AgentConfig(
      this.name,
      this.role,
      this.description,
      this.llmInstance,
      this.systemPrompt ?? null,
      this.tools.slice(),
      this.autoExecuteTools,
      this.inputProcessors.slice(),
      this.llmResponseProcessors.slice(),
      this.systemPromptProcessors.slice(),
      this.toolExecutionResultProcessors.slice(),
      this.toolInvocationPreprocessors.slice(),
      this.workspace,
      this.lifecycleProcessors.slice(),
      deepClone(this.initialCustomData ?? null),
      this.skills.slice()
    );
  }

  toString(): string {
    return (
      `AgentConfig(name='${this.name}', role='${this.role}', ` +
      `llmInstance='${this.llmInstance.constructor.name}', ` +
      `workspace_configured=${this.workspace !== null}, skills=${JSON.stringify(this.skills)})`
    );
  }
}
