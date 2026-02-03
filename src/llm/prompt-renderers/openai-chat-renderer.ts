import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions.mjs';
import { BasePromptRenderer } from './base-prompt-renderer.js';
import {
  Message,
  ToolCallPayload,
  ToolResultPayload
} from '../utils/messages.js';
import {
  mediaSourceToBase64,
  createDataUri,
  getMimeType,
  isValidMediaPath
} from '../utils/media-payload-formatter.js';

type RenderedMessage = ChatCompletionMessageParam;

export class OpenAIChatRenderer extends BasePromptRenderer {
  async render(messages: Message[]): Promise<RenderedMessage[]> {
    const rendered: RenderedMessage[] = [];

    for (const msg of messages) {
      let content: any = msg.content;

      if (msg.image_urls.length || msg.audio_urls.length || msg.video_urls.length) {
        const contentParts: Record<string, unknown>[] = [];

        if (msg.content) {
          contentParts.push({ type: 'text', text: msg.content });
        }

        const base64Images = await Promise.allSettled(
          msg.image_urls.map((url) => mediaSourceToBase64(url))
        );

        for (let index = 0; index < base64Images.length; index += 1) {
          const result = base64Images[index];
          const source = msg.image_urls[index];
          if (result.status !== 'fulfilled') {
            console.error(`Error processing image ${source}: ${result.reason}`);
            continue;
          }

          const hasLocalPath = source ? await isValidMediaPath(source) : false;
          const mimeType = hasLocalPath ? getMimeType(source) : 'image/jpeg';
          contentParts.push(createDataUri(mimeType, result.value));
        }

        if (msg.audio_urls.length) {
          console.warn('OpenAI compatible layer does not yet support audio; skipping.');
        }
        if (msg.video_urls.length) {
          console.warn('OpenAI compatible layer does not yet support video; skipping.');
        }

        content = contentParts;
      }

      if (msg.tool_payload instanceof ToolCallPayload) {
        const toolCalls = msg.tool_payload.toolCalls.map((call) => ({
          id: call.id,
          type: 'function' as const,
          function: {
            name: call.name,
            arguments: JSON.stringify(call.arguments)
          }
        }));
        rendered.push({
          role: 'assistant',
          content,
          tool_calls: toolCalls
        });
        continue;
      }

      if (msg.tool_payload instanceof ToolResultPayload) {
        rendered.push({
          role: 'tool',
          tool_call_id: msg.tool_payload.toolCallId,
          content: formatToolResult(msg.tool_payload)
        });
        continue;
      }

      const role = msg.role === 'system'
        ? 'system'
        : msg.role === 'assistant'
          ? 'assistant'
          : msg.role === 'tool'
            ? 'tool'
            : 'user';
      rendered.push({ role, content } as RenderedMessage);
    }

    return rendered;
  }
}

function formatToolResult(payload: ToolResultPayload): string {
  if (payload.toolError) {
    return `Error: ${payload.toolError}`;
  }
  if (payload.toolResult === null || payload.toolResult === undefined) {
    return '';
  }
  if (Array.isArray(payload.toolResult) || typeof payload.toolResult === 'object') {
    return JSON.stringify(payload.toolResult);
  }
  return String(payload.toolResult);
}
