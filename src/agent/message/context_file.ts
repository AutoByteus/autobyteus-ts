import path from 'node:path';
import { URL } from 'node:url';
import { ContextFileType } from './context_file_type.js';

function extractPath(uri: string): string {
  try {
    const parsed = new URL(uri);
    return parsed.pathname;
  } catch {
    return uri;
  }
}

export class ContextFile {
  uri: string;
  file_type: ContextFileType;
  file_name: string | null;
  metadata: Record<string, any>;

  constructor(
    uri: string,
    file_type: ContextFileType = ContextFileType.UNKNOWN,
    file_name: string | null = null,
    metadata: Record<string, any> = {}
  ) {
    if (!uri || typeof uri !== 'string') {
      throw new TypeError(`ContextFile uri must be a non-empty string, got ${typeof uri}`);
    }

    this.uri = uri;
    this.file_type = file_type;
    this.file_name = file_name;
    this.metadata = metadata ?? {};

    if (!this.file_name) {
      try {
        const parsedPath = extractPath(this.uri);
        this.file_name = path.basename(parsedPath);
      } catch {
        this.file_name = 'unknown_file';
      }
    }

    if (this.file_type === ContextFileType.UNKNOWN) {
      const inferred = ContextFileType.fromPath(this.uri);
      if (inferred !== ContextFileType.UNKNOWN) {
        this.file_type = inferred;
      }
    }
  }

  toDict(): Record<string, any> {
    return {
      uri: this.uri,
      file_type: this.file_type,
      file_name: this.file_name,
      metadata: this.metadata
    };
  }

  static fromDict(data: Record<string, any>): ContextFile {
    if (!data || typeof data.uri !== 'string') {
      throw new Error("ContextFile 'uri' in dictionary must be a string.");
    }

    const fileTypeStr = data.file_type ?? ContextFileType.UNKNOWN;
    const fileType = Object.values(ContextFileType).includes(fileTypeStr)
      ? (fileTypeStr as ContextFileType)
      : ContextFileType.UNKNOWN;

    return new ContextFile(
      data.uri,
      fileType,
      data.file_name ?? null,
      data.metadata ?? {}
    );
  }

  toString(): string {
    const metaKeys = Object.keys(this.metadata ?? {});
    return `ContextFile(uri='${this.uri}', file_name='${this.file_name}', file_type='${this.file_type}', metadata_keys=${metaKeys})`;
  }
}
