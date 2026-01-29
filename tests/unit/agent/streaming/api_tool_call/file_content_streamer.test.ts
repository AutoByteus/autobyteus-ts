import { describe, it, expect } from 'vitest';
import { WriteFileContentStreamer, PatchFileContentStreamer } from '../../../../../src/agent/streaming/api_tool_call/file_content_streamer.js';

describe('FileContentStreamers', () => {
  it('write_file streamer emits content and path', () => {
    const streamer = new WriteFileContentStreamer();

    const update1 = streamer.feed('{"path":"a.txt","content":"hi');
    expect(update1.content_delta).toBe('hi');
    expect(update1.path).toBe('a.txt');
    expect(update1.content_complete).toBeUndefined();

    const update2 = streamer.feed('\\');
    expect(update2.content_delta).toBe('');

    const update3 = streamer.feed('nthere"}');
    expect(update3.content_delta).toBe('\nthere');
    expect(update3.content_complete).toBe('hi\nthere');
    expect(streamer.path).toBe('a.txt');
    expect(streamer.content).toBe('hi\nthere');
  });

  it('patch_file streamer emits patch content', () => {
    const streamer = new PatchFileContentStreamer();

    const update1 = streamer.feed('{"patch":"@@ -1 +1 @@');
    expect(update1.content_delta).toBe('@@ -1 +1 @@');

    const update2 = streamer.feed('\\');
    expect(update2.content_delta).toBe('');

    const update3 = streamer.feed('n-foo\\n+bar"}');
    expect(update3.content_delta).toBe('\n-foo\n+bar');
    expect(update3.content_complete).toBe('@@ -1 +1 @@\n-foo\n+bar');
  });

  it('handles content before path', () => {
    const streamer = new WriteFileContentStreamer();

    const update1 = streamer.feed('{"content":"h');
    expect(update1.content_delta).toBe('h');
    expect(update1.content_complete).toBeUndefined();

    const update2 = streamer.feed('i","path":"later.txt"}');
    expect(update2.content_delta).toBe('i');
    expect(update2.content_complete).toBe('hi');
    expect(update2.path).toBe('later.txt');
    expect(streamer.path).toBe('later.txt');
  });
});
