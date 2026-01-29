import { AgentEventHandler } from './base_event_handler.js';
import { LLMCompleteResponseReceivedEvent, BaseEvent } from '../events/agent_events.js';
import type { CompleteResponse } from '../../llm/utils/response_types.js';
import type { AgentContext } from '../context/agent_context.js';

type LLMResponseProcessorLike = {
  get_name: () => string;
  get_order: () => number;
  process_response: (
    response: CompleteResponse,
    context: AgentContext,
    triggering_event: LLMCompleteResponseReceivedEvent
  ) => Promise<boolean>;
};

const isLLMResponseProcessor = (value: unknown): value is LLMResponseProcessorLike => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as LLMResponseProcessorLike;
  return (
    typeof candidate.get_name === 'function' &&
    typeof candidate.get_order === 'function' &&
    typeof candidate.process_response === 'function'
  );
};

export class LLMCompleteResponseReceivedEventHandler extends AgentEventHandler {
  constructor() {
    super();
    console.info('LLMCompleteResponseReceivedEventHandler initialized.');
  }

  async handle(event: BaseEvent, context: AgentContext): Promise<void> {
    if (!(event instanceof LLMCompleteResponseReceivedEvent)) {
      const eventType = event?.constructor?.name ?? typeof event;
      console.warn(
        `LLMCompleteResponseReceivedEventHandler received non-LLMCompleteResponseReceivedEvent: ${eventType}. Skipping.`
      );
      return;
    }

    const completeResponse = event.complete_response;
    const completeResponseText = completeResponse.content;
    const completeResponseReasoning = completeResponse.reasoning ?? '';
    const isErrorResponse = (event as any).is_error ?? false;

    const agentId = context.agent_id;
    console.info(
      `Agent '${agentId}' handling LLMCompleteResponseReceivedEvent. ` +
        `Response Length: ${completeResponseText.length}, ` +
        `Reasoning Length: ${completeResponseReasoning.length}, ` +
        `IsErrorFlagged: ${isErrorResponse}, TokenUsage: ${completeResponse.usage}`
    );
    if (completeResponseReasoning) {
      console.debug(
        `Agent '${agentId}' received LLM reasoning for processing:\n---\n${completeResponseReasoning}\n---`
      );
    }
    console.info(
      `Agent '${agentId}' received full LLM content for processing:\n---\n${completeResponseText}\n---`
    );

    let anyProcessorTookAction = false;
    const notifier = context.status_manager?.notifier;
    if (!notifier) {
      console.error(
        `Agent '${agentId}': Notifier not available in LLMCompleteResponseReceivedEventHandler. Cannot emit complete response event.`
      );
    }

    if (!isErrorResponse) {
      const processorInstances = context.config.llm_response_processors as unknown[];
      if (!processorInstances || processorInstances.length === 0) {
        console.debug(
          `Agent '${agentId}': No LLM response processors configured in agent config. ` +
            'Proceeding to treat LLM response as output for this leg.'
        );
      } else {
        const validProcessors = processorInstances.filter(isLLMResponseProcessor);
        for (const processor of processorInstances) {
          if (!isLLMResponseProcessor(processor)) {
            console.error(
              `Agent '${agentId}': Invalid LLM response processor type in config: ${processor?.constructor?.name ?? typeof processor}. Skipping.`
            );
          }
        }

        const sortedProcessors = validProcessors.sort(
          (left, right) => left.get_order() - right.get_order()
        );
        const processorNames = sortedProcessors.map((processor) => processor.get_name());
        console.debug(
          `Agent '${agentId}': Attempting LLM response processing in order: ${JSON.stringify(processorNames)}`
        );

        for (const processor of sortedProcessors) {
          let processorName = 'unknown';
          try {
            processorName = processor.get_name();
            console.debug(
              `Agent '${agentId}': Attempting to process with LLMResponseProcessor '${processorName}'.`
            );
            const handled = await processor.process_response(
              completeResponse,
              context,
              event
            );
            if (handled) {
              anyProcessorTookAction = true;
              console.info(
                `Agent '${agentId}': LLMResponseProcessor '${processorName}' handled the response.`
              );
            } else {
              console.debug(
                `Agent '${agentId}': LLMResponseProcessor '${processorName}' did not handle the response.`
              );
            }
          } catch (error) {
            console.error(
              `Agent '${agentId}': Error while using LLMResponseProcessor '${processorName}': ${error}. This processor is skipped.`
            );
            notifier?.notify_agent_error_output_generation?.(
              `LLMResponseProcessor.${processorName}`,
              String(error)
            );
          }
        }
      }
    } else {
      console.info(
        `Agent '${agentId}': LLMCompleteResponseReceivedEvent was marked as an error response. ` +
          'Skipping LLMResponseProcessor attempts.'
      );
    }

    if (notifier?.notify_agent_data_assistant_complete_response) {
      const logMessage = anyProcessorTookAction
        ? `Agent '${agentId}': One or more LLMResponseProcessors handled the response. Now emitting AGENT_DATA_ASSISTANT_COMPLETE_RESPONSE as a completion signal.`
        : `Agent '${agentId}': No LLMResponseProcessor handled the response. Emitting the full LLM response as a final answer and completion signal.`;
      console.info(logMessage);
      try {
        notifier.notify_agent_data_assistant_complete_response(completeResponse);
        console.debug(
          `Agent '${agentId}' emitted AGENT_DATA_ASSISTANT_COMPLETE_RESPONSE event successfully.`
        );
      } catch (error) {
        console.error(
          `Agent '${agentId}': Error emitting AGENT_DATA_ASSISTANT_COMPLETE_RESPONSE: ${error}`
        );
      }
    }
  }
}
