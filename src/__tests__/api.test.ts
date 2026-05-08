import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  chatStream,
  fetchOnerecCandidates,
  fetchProfiles,
  fetchReportStatus,
  pollReportUntilDone,
  submitReport
} from '@/services/api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function sseResponse(chunks: string[]): Response {
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

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api · fetchProfiles / fetchOnerecCandidates', () => {
  it('GETs /users/profiles', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([{ id: 'CUST-A', displayName: '客户A' }])
    );
    const out = await fetchProfiles();
    expect(out[0].id).toBe('CUST-A');
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/v1/users/profiles');
  });

  it('passes onerec response through the adapter', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        // dirty input that the adapter must clean
        { product_code: '000001', product_name: 'A', net_value: '1.2' },
        { code: '', name: 'invalid' }
      ])
    );
    const out = await fetchOnerecCandidates('CUST-A');
    expect(out).toHaveLength(1);
    expect(out[0].code).toBe('000001');
    expect(out[0].netValue).toBeCloseTo(1.2, 2);
  });

  it('throws ApiError on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'oops' }, 500));
    await expect(fetchProfiles()).rejects.toThrow(/500/);
  });
});

describe('api · report task lifecycle', () => {
  it('POSTs submitReport with body and returns taskId', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ taskId: 'T-1' }));
    const out = await submitReport('CUST-A', ['稳健'], '生成报告');
    expect(out.taskId).toBe('T-1');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      profileId: 'CUST-A',
      preferenceTags: ['稳健'],
      intent: '生成报告'
    });
  });

  it('pollReportUntilDone yields progress until done stage', async () => {
    const seq = [
      { taskId: 'T-1', stage: 'queued', message: 'q', progress: 8 },
      { taskId: 'T-1', stage: 'profiling', message: 'p', progress: 22 },
      { taskId: 'T-1', stage: 'done', message: 'ok', progress: 100, payload: undefined }
    ];
    fetchMock.mockImplementation(async () => jsonResponse(seq.shift() ?? seq[seq.length - 1]));

    const observed: string[] = [];
    const final = await pollReportUntilDone('T-1', (s) => observed.push(s.stage), undefined);
    expect(observed).toEqual(['queued', 'profiling', 'done']);
    expect(final.stage).toBe('done');
  });

  it('fetchReportStatus encodes the taskId', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ taskId: 'A B', stage: 'done', message: '', progress: 100 })
    );
    await fetchReportStatus('A B');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('taskId=A%20B');
  });
});

describe('api · chatStream parses SSE chunks', () => {
  it('emits typed chunks (thinking/text/widget) and stops on done', async () => {
    fetchMock.mockResolvedValueOnce(
      sseResponse([
        'data: {"type":"thinking","content":"a"}\n\n',
        'data: {"type":"text","content":"hi"}\n\n',
        'data: {"type":"widget","widgetName":"FundCard","data":{"code":"X","name":"NX","category":"c","netValue":1,"changePct":0,"return1y":0,"return3y":0,"maxDrawdown":0,"sharpe":0,"sparkline":[1,1,1,1],"reason":"r"}}\n\n',
        'data: {"type":"done"}\n\n'
      ])
    );

    const out: Array<{ type: string; content?: string; code?: string }> = [];
    for await (const c of chatStream('hello')) {
      out.push({ type: c.type, content: c.content, code: c.data?.code });
    }
    expect(out.map((o) => o.type)).toEqual(['thinking', 'text', 'widget']);
    expect(out[0].content).toBe('a');
    expect(out[2].code).toBe('X');

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Accept).toBe('text/event-stream');
  });

  it('throws when status is not 2xx', async () => {
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 500 }));
    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of chatStream('x')) {
        /* noop */
      }
    }).rejects.toThrow();
  });
});
