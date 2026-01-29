import { ContextFile } from './context_file.js';
import { SenderType } from '../sender_type.js';

export class AgentInputUserMessage {
  content: string;
  sender_type: SenderType;
  context_files: ContextFile[] | null;
  metadata: Record<string, any>;

  constructor(
    content: string,
    sender_type: SenderType = SenderType.USER,
    context_files: ContextFile[] | null = null,
    metadata: Record<string, any> = {}
  ) {
    if (typeof content !== 'string') {
      throw new TypeError("AgentInputUserMessage 'content' must be a string.");
    }
    if (!Object.values(SenderType).includes(sender_type)) {
      throw new TypeError("AgentInputUserMessage 'sender_type' must be a SenderType enum.");
    }
    if (context_files !== null) {
      if (!Array.isArray(context_files) || !context_files.every((cf) => cf instanceof ContextFile)) {
        throw new TypeError("AgentInputUserMessage 'context_files' must be a list of ContextFile objects if provided.");
      }
    }
    if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
      throw new TypeError("AgentInputUserMessage 'metadata' must be a dictionary.");
    }

    this.content = content;
    this.sender_type = sender_type;
    this.context_files = context_files;
    this.metadata = metadata;
  }

  toDict(): Record<string, any> {
    const contextFiles = this.context_files
      ? this.context_files.map((cf) => cf.toDict())
      : null;

    return {
      content: this.content,
      sender_type: this.sender_type,
      context_files: contextFiles,
      metadata: this.metadata
    };
  }

  static fromDict(data: Record<string, any>): AgentInputUserMessage {
    const content = data?.content;
    if (typeof content !== 'string') {
      throw new Error("AgentInputUserMessage 'content' in dictionary must be a string.");
    }

    const senderTypeVal = data?.sender_type ?? SenderType.USER;
    const senderType = Object.values(SenderType).includes(senderTypeVal)
      ? (senderTypeVal as SenderType)
      : SenderType.USER;

    const contextFilesData = data?.context_files;
    let contextFiles: ContextFile[] | null = null;
    if (contextFilesData !== null && contextFilesData !== undefined) {
      if (!Array.isArray(contextFilesData)) {
        throw new Error("AgentInputUserMessage 'context_files' in dictionary must be a list if provided.");
      }
      contextFiles = contextFilesData.map((cfData) => ContextFile.fromDict(cfData));
    }

    const metadata = data?.metadata ?? {};
    if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
      throw new Error("AgentInputUserMessage 'metadata' in dictionary must be a dict if provided.");
    }

    return new AgentInputUserMessage(content, senderType, contextFiles, metadata);
  }

  toString(): string {
    const contentPreview = this.content.length > 100 ? `${this.content.slice(0, 100)}...` : this.content;
    const contextCount = this.context_files ? this.context_files.length : 0;
    const contextInfo = this.context_files ? `, context_files=[${contextCount} ContextFile(s)]` : '';
    const metaInfo = Object.keys(this.metadata).length > 0 ? `, metadata_keys=${Object.keys(this.metadata)}` : '';
    return `AgentInputUserMessage(sender_type='${this.sender_type}', content='${contentPreview}'${contextInfo}${metaInfo})`;
  }
}
