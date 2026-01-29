import { BaseBootstrapStep } from './base_bootstrap_step.js';
import { BaseSystemPromptProcessor } from '../system_prompt_processor/base_processor.js';
import { AgentErrorEvent } from '../events/agent_events.js';
import type { AgentContext } from '../context/agent_context.js';

type SystemPromptProcessorLike = BaseSystemPromptProcessor;

export class SystemPromptProcessingStep extends BaseBootstrapStep {
  constructor() {
    super();
    console.debug('SystemPromptProcessingStep initialized.');
  }

  async execute(context: AgentContext): Promise<boolean> {
    const agentId = context.agent_id;
    console.info(`Agent '${agentId}': Executing SystemPromptProcessingStep.`);

    try {
      const llmInstance = context.llm_instance;
      if (!llmInstance) {
        throw new Error('LLM instance not found in agent state. It must be provided in AgentConfig.');
      }

      const baseSystemPrompt =
        context.config.system_prompt ?? llmInstance.config.system_message;
      console.debug(`Agent '${agentId}': Retrieved base system prompt.`);

      const processorInstances = context.config.system_prompt_processors as SystemPromptProcessorLike[];
      const toolInstancesForProcessor = context.tool_instances;

      let currentSystemPrompt = baseSystemPrompt;
      if (!processorInstances || processorInstances.length === 0) {
        console.debug(
          `Agent '${agentId}': No system prompt processors configured. Using system prompt as is.`
        );
      } else {
        const sortedProcessors = processorInstances.sort(
          (left, right) => left.get_order() - right.get_order()
        );
        const processorNames = sortedProcessors.map((processor) => processor.get_name());
        console.debug(
          `Agent '${agentId}': Found ${sortedProcessors.length} configured system prompt processors. ` +
            `Applying sequentially in order: ${JSON.stringify(processorNames)}`
        );

        for (const processor of sortedProcessors) {
          const processorName = processor.get_name();
          try {
            console.debug(
              `Agent '${agentId}': Applying system prompt processor '${processorName}'.`
            );
            currentSystemPrompt = processor.process(
              currentSystemPrompt,
              toolInstancesForProcessor,
              agentId,
              context
            );
            console.info(
              `Agent '${agentId}': System prompt processor '${processorName}' applied successfully.`
            );
          } catch (error) {
            const errorMessage = `Agent '${agentId}': Error applying system prompt processor '${processorName}': ${error}`;
            console.error(errorMessage);
            if (context.state.input_event_queues) {
              await context.state.input_event_queues.enqueue_internal_system_event(
                new AgentErrorEvent(errorMessage, String(error))
              );
            }
            return false;
          }
        }
      }

      context.state.processed_system_prompt = currentSystemPrompt;

      const configurePrompt =
        (llmInstance as any).configure_system_prompt ??
        (llmInstance as any).configureSystemPrompt;
      if (typeof configurePrompt === 'function') {
        configurePrompt.call(llmInstance, currentSystemPrompt);
        console.info(
          `Agent '${agentId}': Final processed system prompt configured on LLM instance. Final length: ${currentSystemPrompt.length}.`
        );
      } else {
        console.warn(
          `Agent '${agentId}': LLM instance (${llmInstance.constructor.name}) does not have a 'configure_system_prompt' method. ` +
            'The system prompt cannot be dynamically updated on the LLM instance after initialization. This may lead to incorrect agent behavior.'
        );
      }

      console.info(
        `Agent '${agentId}': Final processed system prompt:\n---\n${currentSystemPrompt}\n---`
      );
      return true;
    } catch (error) {
      const errorMessage = `Agent '${context.agent_id}': Critical failure during system prompt processing step: ${error}`;
      console.error(errorMessage);
      if (context.state.input_event_queues) {
        await context.state.input_event_queues.enqueue_internal_system_event(
          new AgentErrorEvent(errorMessage, String(error))
        );
      }
      return false;
    }
  }
}
