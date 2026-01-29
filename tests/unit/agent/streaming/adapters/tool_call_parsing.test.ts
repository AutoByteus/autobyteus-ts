import { describe, it, expect } from 'vitest';
import { parse_json_tool_call, parse_xml_arguments } from '../../../../../src/agent/streaming/adapters/tool_call_parsing.js';

describe('tool_call_parsing', () => {
  it('parses XML arguments with <arguments> wrapper', () => {
    const xml = '<arguments><arg name="path">/tmp/a.txt</arg><arg name="content">hello</arg></arguments>';
    expect(parse_xml_arguments(xml)).toEqual({ path: '/tmp/a.txt', content: 'hello' });
  });

  it('parses legacy XML arguments without wrapper', () => {
    const xml = '<path>/tmp/b.txt</path><content>hi</content>';
    expect(parse_xml_arguments(xml)).toEqual({ path: '/tmp/b.txt', content: 'hi' });
  });

  it('parses JSON tool call with arguments object or string', () => {
    const direct = parse_json_tool_call(JSON.stringify({ name: 'write_file', arguments: { path: 'a', content: 'b' } }));
    expect(direct).toEqual({ name: 'write_file', arguments: { path: 'a', content: 'b' } });

    const stringArgs = parse_json_tool_call(
      JSON.stringify({ name: 'write_file', arguments: JSON.stringify({ path: 'c', content: 'd' }) })
    );
    expect(stringArgs).toEqual({ name: 'write_file', arguments: { path: 'c', content: 'd' } });
  });

  it('returns null for invalid JSON', () => {
    expect(parse_json_tool_call('{bad json}')).toBeNull();
  });
});
