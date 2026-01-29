import { ToolCallDelta } from '../utils/tool_call_delta.js';

export function convertMistralToolCalls(toolCalls: any[] | null | undefined): ToolCallDelta[] | null {
  if (!toolCalls || toolCalls.length === 0) {
    return null;
  }

  return toolCalls.map((toolCall, idx) => {
    const callIndex = typeof toolCall?.index === 'number' ? toolCall.index : idx;
    const fn = toolCall?.function ?? {};
    return {
      index: callIndex,
      call_id: toolCall?.id ?? undefined,
      name: fn?.name ?? undefined,
      arguments_delta: fn?.arguments ?? undefined
    } as ToolCallDelta;
  });
}
