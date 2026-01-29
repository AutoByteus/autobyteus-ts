import { describe, it, expect } from 'vitest';
import { ContextFile } from '../../../../src/agent/message/context_file.js';
import { ContextFileType } from '../../../../src/agent/message/context_file_type.js';

describe('ContextFile', () => {
  it('infers file_name and file_type when not provided', () => {
    const file = new ContextFile('https://example.com/docs/report.pdf');
    expect(file.file_name).toBe('report.pdf');
    expect(file.file_type).toBe(ContextFileType.PDF);
  });

  it('respects provided file_name and file_type', () => {
    const file = new ContextFile('notes.txt', ContextFileType.TEXT, 'custom.txt');
    expect(file.file_name).toBe('custom.txt');
    expect(file.file_type).toBe(ContextFileType.TEXT);
  });

  it('serializes and deserializes via toDict/fromDict', () => {
    const file = new ContextFile('notes.md');
    const data = file.toDict();
    expect(data.file_type).toBe(ContextFileType.MARKDOWN);

    const restored = ContextFile.fromDict(data);
    expect(restored.uri).toBe('notes.md');
    expect(restored.file_type).toBe(ContextFileType.MARKDOWN);
  });

  it('defaults to UNKNOWN for invalid file_type in fromDict', () => {
    const restored = ContextFile.fromDict({
      uri: 'file.bin',
      file_type: 'not-a-type',
      file_name: 'file.bin',
      metadata: {}
    });
    expect(restored.file_type).toBe(ContextFileType.UNKNOWN);
  });

  it('throws when uri is invalid', () => {
    expect(() => ContextFile.fromDict({ file_type: 'text' } as any)).toThrow();
  });
});
