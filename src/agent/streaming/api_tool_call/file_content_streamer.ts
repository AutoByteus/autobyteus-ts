import { JsonStringFieldExtractor } from './json_string_field_extractor.js';

export class FileContentStreamUpdate {
  content_delta: string;
  path?: string;
  content_complete?: string;

  constructor(data: { content_delta?: string; path?: string; content_complete?: string } = {}) {
    this.content_delta = data.content_delta ?? '';
    this.path = data.path;
    this.content_complete = data.content_complete;
  }
}

class BaseFileContentStreamer {
  private contentKey: string;
  private extractor: JsonStringFieldExtractor;
  path?: string;
  content?: string;

  constructor(contentKey: string) {
    this.contentKey = contentKey;
    this.extractor = new JsonStringFieldExtractor(new Set([contentKey]), new Set(['path', contentKey]));
  }

  feed(jsonDelta: string): FileContentStreamUpdate {
    const result = this.extractor.feed(jsonDelta);

    if (result.completed['path'] && !this.path) {
      this.path = result.completed['path'];
    }

    if (result.completed[this.contentKey]) {
      this.content = result.completed[this.contentKey];
    }

    return new FileContentStreamUpdate({
      content_delta: result.deltas[this.contentKey] ?? '',
      path: result.completed['path'],
      content_complete: result.completed[this.contentKey]
    });
  }
}

export class WriteFileContentStreamer extends BaseFileContentStreamer {
  constructor() {
    super('content');
  }
}

export class PatchFileContentStreamer extends BaseFileContentStreamer {
  constructor() {
    super('patch');
  }
}
