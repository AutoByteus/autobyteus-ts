import { ToolCallDelta } from '../utils/tool_call_delta.js';

export function convertGeminiToolCalls(part: any): ToolCallDelta[] | null {
  if (!part || !part.functionCall) {
    return null;
  }

  const functionCall = part.functionCall;
  const args = functionCall.args ?? {};
  let argumentsDelta = '{}';
  try {
    argumentsDelta = JSON.stringify(args);
  } catch {
    argumentsDelta = '{}';
  }

  return [
    {
      index: 0,
      call_id: functionCall.id ?? undefined,
      name: functionCall.name ?? undefined,
      arguments_delta: argumentsDelta
    }
  ];
}
