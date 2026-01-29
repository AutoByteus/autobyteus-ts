import { AgentInputUserMessage } from './agent_input_user_message.js';
import { ContextFileType } from './context_file_type.js';
import { LLMUserMessage } from '../../llm/user_message.js';

export function buildLLMUserMessage(agentInputUserMessage: AgentInputUserMessage): LLMUserMessage {
  const imageUrls: string[] = [];
  const audioUrls: string[] = [];
  const videoUrls: string[] = [];

  if (agentInputUserMessage.context_files) {
    for (const contextFile of agentInputUserMessage.context_files) {
      const fileType = contextFile.file_type;
      if (fileType === ContextFileType.IMAGE) {
        imageUrls.push(contextFile.uri);
      } else if (fileType === ContextFileType.AUDIO) {
        audioUrls.push(contextFile.uri);
      } else if (fileType === ContextFileType.VIDEO) {
        videoUrls.push(contextFile.uri);
      }
    }
  }

  return new LLMUserMessage({
    content: agentInputUserMessage.content,
    image_urls: imageUrls.length > 0 ? imageUrls : undefined,
    audio_urls: audioUrls.length > 0 ? audioUrls : undefined,
    video_urls: videoUrls.length > 0 ? videoUrls : undefined
  });
}
