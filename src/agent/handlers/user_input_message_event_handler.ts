import { AgentEventHandler } from './base_event_handler.js';
import { UserMessageReceivedEvent, LLMUserMessageReadyEvent, BaseEvent } from '../events/agent_events.js';
import { AgentInputUserMessage } from '../message/agent_input_user_message.js';
import { buildLLMUserMessage } from '../message/multimodal_message_builder.js';
import { SenderType } from '../sender_type.js';
import type { AgentContext } from '../context/agent_context.js';

type InputProcessorLike = {
  get_name: () => string;
  get_order: () => number;
  process: (
    message: AgentInputUserMessage,
    context: AgentContext,
    triggering_event: UserMessageReceivedEvent
  ) => Promise<AgentInputUserMessage>;
};

function isInputProcessor(value: unknown): value is InputProcessorLike {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as InputProcessorLike;
  return (
    typeof candidate.get_name === 'function' &&
    typeof candidate.get_order === 'function' &&
    typeof candidate.process === 'function'
  );
}

function cloneAgentInputUserMessage(message: AgentInputUserMessage): AgentInputUserMessage {
  return AgentInputUserMessage.fromDict(message.toDict());
}

export class UserInputMessageEventHandler extends AgentEventHandler {
  constructor() {
    super();
    console.info('UserInputMessageEventHandler initialized.');
  }

  async handle(event: BaseEvent, context: AgentContext): Promise<void> {
    if (!(event instanceof UserMessageReceivedEvent)) {
      const eventType = event?.constructor?.name ?? typeof event;
      console.warn(
        `UserInputMessageEventHandler received non-UserMessageReceivedEvent: ${eventType}. Skipping.`
      );
      return;
    }

    const originalMessage = event.agent_input_user_message;

    if (originalMessage.sender_type === SenderType.SYSTEM) {
      const statusManager: any = context.status_manager;
      const notifier = statusManager?.notifier;
      if (notifier?.notify_agent_data_system_task_notification_received) {
        const notificationData = {
          sender_id: originalMessage.metadata?.sender_id ?? 'system',
          content: originalMessage.content
        };
        notifier.notify_agent_data_system_task_notification_received(notificationData);
        console.info(
          `Agent '${context.agent_id}' emitted system task notification for TUI based on SYSTEM sender_type.`
        );
      }
    }

    let processedMessage = cloneAgentInputUserMessage(originalMessage);

    console.info(
      `Agent '${context.agent_id}' handling UserMessageReceivedEvent (type: ${originalMessage.sender_type}): ` +
        `'${originalMessage.content}'`
    );

    const processorInstances = context.config.input_processors as unknown[];
    if (processorInstances && processorInstances.length > 0) {
      const validProcessors: InputProcessorLike[] = [];
      for (const processor of processorInstances) {
        if (isInputProcessor(processor)) {
          validProcessors.push(processor);
        } else {
          console.error(
            `Agent '${context.agent_id}': Invalid input processor type in config: ${processor?.constructor?.name ?? typeof processor}. Skipping.`
          );
        }
      }

      const sortedProcessors = validProcessors.sort(
        (left, right) => left.get_order() - right.get_order()
      );
      const processorNames = sortedProcessors.map((processor) => processor.get_name());
      console.debug(
        `Agent '${context.agent_id}': Applying input processors in order: ${JSON.stringify(processorNames)}`
      );

      for (const processor of sortedProcessors) {
        let messageBeforeProcessor = processedMessage;
        let processorName = 'unknown';
        try {
          processorName = processor.get_name();
          console.debug(
            `Agent '${context.agent_id}': Applying input processor '${processorName}'.`
          );
          messageBeforeProcessor = processedMessage;
          processedMessage = await processor.process(
            messageBeforeProcessor,
            context,
            event
          );
          console.info(
            `Agent '${context.agent_id}': Input processor '${processorName}' applied successfully.`
          );
        } catch (error) {
          console.error(
            `Agent '${context.agent_id}': Error applying input processor '${processorName}': ${error}. ` +
              'Skipping this processor and continuing with message from before this processor.'
          );
          processedMessage = messageBeforeProcessor;
        }
      }
    } else {
      console.debug(`Agent '${context.agent_id}': No input processors configured in agent config.`);
    }

    const llmUserMessage = buildLLMUserMessage(processedMessage);
    const llmUserMessageReadyEvent = new LLMUserMessageReadyEvent(llmUserMessage);
    await context.input_event_queues.enqueue_internal_system_event(llmUserMessageReadyEvent);

    console.info(
      `Agent '${context.agent_id}' processed AgentInputUserMessage and enqueued LLMUserMessageReadyEvent.`
    );
  }
}
