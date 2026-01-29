import { randomUUID } from 'node:crypto';
import { AgentEventHandler } from './base_event_handler.js';
import {
  LLMUserMessageReadyEvent,
  LLMCompleteResponseReceivedEvent,
  PendingToolInvocationEvent,
  BaseEvent
} from '../events/agent_events.js';
import { ChunkResponse, CompleteResponse } from '../../llm/utils/response_types.js';
import { StreamingResponseHandlerFactory } from '../streaming/handlers/streaming_handler_factory.js';
import { SegmentEvent, SegmentType } from '../streaming/segments/segment_events.js';
import { ToolInvocationTurn } from '../tool_invocation.js';
import type { AgentContext } from '../context/agent_context.js';
import type { LLMUserMessage } from '../../llm/user_message.js';
import type { TokenUsage } from '../../llm/utils/token_usage.js';

type LLMInstanceLike = {
  streamUserMessage: (message: LLMUserMessage, kwargs?: Record<string, any>) => AsyncGenerator<ChunkResponse, void, unknown>;
  model?: { provider?: any };
};

export class LLMUserMessageReadyEventHandler extends AgentEventHandler {
  constructor() {
    super();
    console.info('LLMUserMessageReadyEventHandler initialized.');
  }

  async handle(event: BaseEvent, context: AgentContext): Promise<void> {
    if (!(event instanceof LLMUserMessageReadyEvent)) {
      console.warn(
        `LLMUserMessageReadyEventHandler received non-LLMUserMessageReadyEvent: ${event?.constructor?.name ?? typeof event}. Skipping.`
      );
      return;
    }

    const agentId = context.agent_id;
    const llmInstance = context.state.llm_instance as LLMInstanceLike | null;
    if (!llmInstance) {
      const errorMsg = `Agent '${agentId}' received LLMUserMessageReadyEvent but LLM instance is not yet initialized.`;
      console.error(errorMsg);
      context.status_manager?.notifier?.notify_agent_error_output_generation(
        'LLMUserMessageReadyEventHandler.pre_llm_check',
        errorMsg
      );
      throw new Error(errorMsg);
    }

    const llmUserMessage = event.llm_user_message;
    console.info(`Agent '${agentId}' handling LLMUserMessageReadyEvent: '${llmUserMessage.content}'`);
    console.debug(
      `Agent '${agentId}' preparing to send full message to LLM:\n---\n${llmUserMessage.content}\n---`
    );

    context.state.add_message_to_history({ role: 'user', content: llmUserMessage.content });

    let completeResponseText = '';
    let completeReasoningText = '';
    let tokenUsage: TokenUsage | null = null;
    const completeImageUrls: string[] = [];
    const completeAudioUrls: string[] = [];
    const completeVideoUrls: string[] = [];

    const notifier = context.status_manager?.notifier ?? null;
    if (!notifier) {
      console.error(
        `Agent '${agentId}': Notifier not available in LLMUserMessageReadyEventHandler. Cannot emit segment events.`
      );
    }

    const emitSegmentEvent = (segmentEvent: SegmentEvent): void => {
      if (!notifier) {
        return;
      }
      try {
        notifier.notify_agent_segment_event(segmentEvent.toDict());
      } catch (error) {
        console.error(`Agent '${agentId}': Error notifying segment event: ${error}`);
      }
    };

    const toolNames: string[] = [];
    const toolInstances = context.state.tool_instances;
    if (toolInstances && Object.keys(toolInstances).length > 0) {
      toolNames.push(...Object.keys(toolInstances));
    } else if (context.config.tools) {
      for (const tool of context.config.tools as any[]) {
        if (typeof tool === 'string') {
          toolNames.push(tool);
        } else if (tool && typeof tool.get_name === 'function') {
          try {
            toolNames.push(tool.get_name());
          } catch {
            console.warn(`Agent '${agentId}': Failed to resolve tool name from ${tool?.constructor?.name ?? typeof tool}.`);
          }
        } else {
          console.warn(`Agent '${agentId}': Unsupported tool entry in config: ${tool?.constructor?.name ?? typeof tool}.`);
        }
      }
    }

    const provider = llmInstance.model?.provider ?? null;
    const handlerResult = StreamingResponseHandlerFactory.create({
      tool_names: toolNames,
      provider,
      on_segment_event: emitSegmentEvent,
      agent_id: agentId
    });
    const streamingHandler = handlerResult.handler;

    console.info(
      `Agent '${agentId}': Streaming handler selected: ${streamingHandler.constructor.name}`
    );

    const streamKwargs: Record<string, any> = {};
    if (handlerResult.tool_schemas) {
      streamKwargs.tools = handlerResult.tool_schemas;
      console.info(
        `Agent '${agentId}': Passing ${handlerResult.tool_schemas.length} tool schemas to LLM API (Provider: ${provider}).`
      );
    }

    const segmentIdPrefix = `turn_${randomUUID().replace(/-/g, '')}:`;
    let currentReasoningPartId: string | null = null;

    try {
      for await (const chunkResponse of llmInstance.streamUserMessage(llmUserMessage, streamKwargs)) {
        if (chunkResponse.content) {
          completeResponseText += chunkResponse.content;
        }
        if (chunkResponse.reasoning) {
          completeReasoningText += chunkResponse.reasoning;
        }

        if (chunkResponse.is_complete) {
          if (chunkResponse.usage) {
            tokenUsage = chunkResponse.usage;
          }
          if (chunkResponse.image_urls?.length) {
            completeImageUrls.push(...chunkResponse.image_urls);
          }
          if (chunkResponse.audio_urls?.length) {
            completeAudioUrls.push(...chunkResponse.audio_urls);
          }
          if (chunkResponse.video_urls?.length) {
            completeVideoUrls.push(...chunkResponse.video_urls);
          }
        }

        if (chunkResponse.reasoning) {
          if (!currentReasoningPartId) {
            currentReasoningPartId = `${segmentIdPrefix}reasoning_${randomUUID().replace(/-/g, '')}`;
            emitSegmentEvent(SegmentEvent.start(currentReasoningPartId, SegmentType.REASONING));
          }
          emitSegmentEvent(SegmentEvent.content(currentReasoningPartId, chunkResponse.reasoning));
        }

        streamingHandler.feed(chunkResponse);
      }

      streamingHandler.finalize();

      if (toolNames.length) {
        const toolInvocations = streamingHandler.get_all_invocations();
        if (toolInvocations.length) {
          context.state.active_multi_tool_call_turn = new ToolInvocationTurn(toolInvocations);
          console.info(
            `Agent '${agentId}': Parsed ${toolInvocations.length} tool invocations from streaming parser.`
          );
          for (const invocation of toolInvocations) {
            await context.input_event_queues.enqueue_tool_invocation_request(
              new PendingToolInvocationEvent(invocation)
            );
          }
        }
      }

      if (currentReasoningPartId) {
        emitSegmentEvent(SegmentEvent.end(currentReasoningPartId));
      }
    } catch (error) {
      console.error(`Agent '${agentId}' error during LLM stream: ${error}`);
      const errorMessage = `Error processing your request with the LLM: ${String(error)}`;
      context.state.add_message_to_history({ role: 'assistant', content: errorMessage, is_error: true });

      if (notifier) {
        try {
          notifier.notify_agent_error_output_generation(
            'LLMUserMessageReadyEventHandler.streamUserMessage',
            errorMessage,
            String(error)
          );
        } catch (notifyError) {
          console.error(
            `Agent '${agentId}': Error notifying agent output error after LLM stream failure: ${notifyError}`
          );
        }
      }

      const errorResponse = new CompleteResponse({ content: errorMessage, usage: null });
      await context.input_event_queues.enqueue_internal_system_event(
        new LLMCompleteResponseReceivedEvent(errorResponse, true)
      );
      console.info(`Agent '${agentId}' enqueued LLMCompleteResponseReceivedEvent with error details.`);
      return;
    }

    const historyEntry: Record<string, any> = { role: 'assistant', content: completeResponseText };
    if (completeReasoningText) {
      historyEntry.reasoning = completeReasoningText;
    }
    if (completeImageUrls.length) {
      historyEntry.image_urls = completeImageUrls;
    }
    if (completeAudioUrls.length) {
      historyEntry.audio_urls = completeAudioUrls;
    }
    if (completeVideoUrls.length) {
      historyEntry.video_urls = completeVideoUrls;
    }
    context.state.add_message_to_history(historyEntry);

    const completeResponse = new CompleteResponse({
      content: completeResponseText,
      reasoning: completeReasoningText || null,
      usage: tokenUsage,
      image_urls: completeImageUrls,
      audio_urls: completeAudioUrls,
      video_urls: completeVideoUrls
    });
    await context.input_event_queues.enqueue_internal_system_event(
      new LLMCompleteResponseReceivedEvent(completeResponse)
    );
    console.info(
      `Agent '${agentId}' enqueued LLMCompleteResponseReceivedEvent from LLMUserMessageReadyEventHandler.`
    );
  }
}
