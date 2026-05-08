import { describe, it, expect } from 'vitest';
import {
  createSSEState,
  pushSSEChunk,
  readSSEStream,
  type SSEEvent
} from '@/services/sseParser';

describe('sseParser · pushSSEChunk', () => {
  it('parses a single complete event', () => {
    const s = createSSEState();
    const evts = pushSSEChunk(s, 'data: {"type":"text","content":"hi"}\n\n');
    expect(evts).toHaveLength(1);
    expect(evts[0].event).toBe('message');
    expect(evts[0].data).toEqual({ type: 'text', content: 'hi' });
    expect(s.buffer).toBe('');
  });

  it('parses multiple events delivered in one chunk', () => {
    const s = createSSEState();
    const chunk = 'data: 1\n\ndata: 2\n\ndata: 3\n\n';
    const evts = pushSSEChunk<number>(s, chunk);
    expect(evts.map((e) => e.data)).toEqual([1, 2, 3]);
  });

  it('continues a partial event across chunks', () => {
    const s = createSSEState();
    const e1 = pushSSEChunk(s, 'data: {"a":');
    expect(e1).toHaveLength(0);
    const e2 = pushSSEChunk(s, '1}\n');
    expect(e2).toHaveLength(0);
    const e3 = pushSSEChunk<{ a: number }>(s, '\n');
    expect(e3).toHaveLength(1);
    expect(e3[0].data).toEqual({ a: 1 });
  });

  it('joins multi-line data with \\n', () => {
    const s = createSSEState();
    const evts = pushSSEChunk<string>(s, 'data: line1\ndata: line2\n\n');
    expect(evts[0].data).toBe('line1\nline2');
    expect(evts[0].raw).toBe('line1\nline2');
  });

  it('honors event:, id:, and retry: fields', () => {
    const s = createSSEState();
    const evts = pushSSEChunk(s, 'event: ping\nid: 42\nretry: 3000\ndata: ok\n\n');
    expect(evts[0].event).toBe('ping');
    expect(evts[0].id).toBe('42');
    expect(evts[0].retry).toBe(3000);
    expect(evts[0].data).toBe('ok');
  });

  it('skips comment lines starting with ":"', () => {
    const s = createSSEState();
    const evts = pushSSEChunk(s, ': keepalive\ndata: hello\n\n');
    expect(evts).toHaveLength(1);
    expect(evts[0].data).toBe('hello');
  });

  it('drops events that have no data field', () => {
    const s = createSSEState();
    const evts = pushSSEChunk(s, 'event: ping\n\n');
    expect(evts).toHaveLength(0);
  });

  it('falls back to raw string when data is not valid JSON', () => {
    const s = createSSEState();
    const evts = pushSSEChunk<string>(s, 'data: not-json{\n\n');
    expect(evts).toHaveLength(1);
    expect(evts[0].data).toBe('not-json{');
  });

  it('normalizes \\r\\n line endings', () => {
    const s = createSSEState();
    const evts = pushSSEChunk(s, 'data: a\r\ndata: b\r\n\r\n');
    expect(evts[0].raw).toBe('a\nb');
  });

  it('handles SSE field with no space after colon', () => {
    const s = createSSEState();
    const evts = pushSSEChunk<string>(s, 'data:no-space\n\n');
    expect(evts[0].data).toBe('no-space');
  });
});

describe('sseParser · readSSEStream', () => {
  function bodyFromChunks(chunks: string[]): Response {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const c of chunks) controller.enqueue(encoder.encode(c));
        controller.close();
      }
    });
    return new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' }
    });
  }

  it('yields events from a streamed response', async () => {
    const res = bodyFromChunks([
      'data: {"type":"thinking","content":"a"}\n\n',
      'data: {"type":"text","content":"hello"}\n\n',
      'data: {"type":"done"}\n\n'
    ]);
    const out: unknown[] = [];
    for await (const evt of readSSEStream<{ type: string }>(res)) {
      out.push(evt.data);
    }
    expect(out).toEqual([
      { type: 'thinking', content: 'a' },
      { type: 'text', content: 'hello' },
      { type: 'done' }
    ]);
  });

  it('reassembles events split mid-chunk', async () => {
    const res = bodyFromChunks(['data: {"a":', '42}', '\n', '\n']);
    const events: SSEEvent<{ a: number }>[] = [];
    for await (const evt of readSSEStream<{ a: number }>(res)) events.push(evt);
    expect(events).toHaveLength(1);
    expect(events[0].data).toEqual({ a: 42 });
  });

  it('flushes a final event without trailing blank line', async () => {
    const res = bodyFromChunks(['data: {"x":1}\n']);
    const events: SSEEvent<{ x: number }>[] = [];
    for await (const evt of readSSEStream<{ x: number }>(res)) events.push(evt);
    expect(events).toHaveLength(1);
    expect(events[0].data).toEqual({ x: 1 });
  });

  it('throws when response has no body', async () => {
    const res = new Response(null, { status: 200 });
    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of readSSEStream(res)) {
        /* noop */
      }
    }).rejects.toThrow();
  });
});
