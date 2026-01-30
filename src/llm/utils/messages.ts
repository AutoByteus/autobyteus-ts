/**
 * Core Message types for LLM interaction.
 */

export enum MessageRole {
  SYSTEM = "system",
  USER = "user",
  ASSISTANT = "assistant"
}

export interface MessageOptions {
  content?: string | null;
  reasoning_content?: string | null;
  image_urls?: string[];
  audio_urls?: string[];
  video_urls?: string[];
}

export class Message {
  public role: MessageRole;
  public content: string | null;
  public reasoning_content: string | null;
  public image_urls: string[];
  public audio_urls: string[];
  public video_urls: string[];

  constructor(role: MessageRole, options: MessageOptions | string = {}) {
    this.role = role;
    
    if (typeof options === 'string') {
      this.content = options;
      this.reasoning_content = null;
      this.image_urls = [];
      this.audio_urls = [];
      this.video_urls = [];
    } else {
      this.content = options.content ?? null;
      this.reasoning_content = options.reasoning_content ?? null;
      this.image_urls = options.image_urls ?? [];
      this.audio_urls = options.audio_urls ?? [];
      this.video_urls = options.video_urls ?? [];
    }
  }

  /**
   * Returns a simple dictionary representation of the Message object.
   * This is for internal use and does not format for any specific API.
   */
  public toDict(): Record<string, unknown> {
    return {
      role: this.role,
      content: this.content,
      reasoning_content: this.reasoning_content,
      image_urls: this.image_urls,
      audio_urls: this.audio_urls,
      video_urls: this.video_urls,
    };
  }
}
