import type { ChatChunk, Product, ReportPayload, UserProfile } from '@/types';
import { readSSEStream } from './sseParser';
import { normalizeOnerecResponse } from './onerecAdapter';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api/v1';
const POLL_INTERVAL_MS = 600;
const POLL_TIMEOUT_MS = 60_000;

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function getJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal
  });
  if (!res.ok) throw new ApiError(res.status, `GET ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

async function postJSON<T, B = unknown>(path: string, body: B, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    signal
  });
  if (!res.ok) throw new ApiError(res.status, `POST ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

/* ------------------------- Profile / onerec ------------------------- */

export async function fetchProfiles(signal?: AbortSignal): Promise<UserProfile[]> {
  return getJSON<UserProfile[]>('/users/profiles', signal);
}

export async function fetchOnerecCandidates(
  userId: string,
  signal?: AbortSignal
): Promise<Product[]> {
  const raw = await getJSON<unknown>(`/onerec/adapter/products?userId=${encodeURIComponent(userId)}`, signal);
  return normalizeOnerecResponse(raw);
}

/* ------------------------- Report (异步轮询) ------------------------- */

export interface ReportStatus {
  taskId: string;
  stage: 'queued' | 'profiling' | 'recall' | 'writing' | 'rendering' | 'done' | 'error';
  message: string;
  progress: number;
  payload?: ReportPayload;
  error?: string;
}

export async function submitReport(
  profileId: string,
  preferenceTags: string[],
  intent: string,
  signal?: AbortSignal
): Promise<{ taskId: string }> {
  return postJSON<{ taskId: string }>('/report/generate', { profileId, preferenceTags, intent }, signal);
}

export async function fetchReportStatus(taskId: string, signal?: AbortSignal): Promise<ReportStatus> {
  return getJSON<ReportStatus>(`/report/status?taskId=${encodeURIComponent(taskId)}`, signal);
}

/**
 * 轮询直到任务终态（done / error），中途下发进度。
 */
export async function pollReportUntilDone(
  taskId: string,
  onProgress: (s: ReportStatus) => void,
  signal?: AbortSignal
): Promise<ReportStatus> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    const s = await fetchReportStatus(taskId, signal);
    onProgress(s);
    if (s.stage === 'done' || s.stage === 'error') return s;
    await sleep(POLL_INTERVAL_MS, signal);
  }
  throw new Error('report poll timeout');
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('aborted', 'AbortError'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new DOMException('aborted', 'AbortError'));
      },
      { once: true }
    );
  });
}

/* ------------------------- Chat (SSE 流) ------------------------- */

export type ChatStreamEvent =
  | { type: 'thinking'; content: string }
  | { type: 'text'; content: string }
  | { type: 'widget'; widgetName: 'FundCard'; data: Product }
  | { type: 'done' };

/**
 * POST /api/v1/chat/completions ，按 SSE 协议消费 chunk。
 * 与设计文档 §3.3 完全一致：data 行内 JSON 含 type 字段。
 */
export async function* chatStream(
  prompt: string,
  signal?: AbortSignal
): AsyncGenerator<ChatChunk> {
  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream'
    },
    body: JSON.stringify({ prompt }),
    signal
  });
  if (!res.ok) throw new ApiError(res.status, `chat stream failed: ${res.status}`);

  for await (const evt of readSSEStream<ChatStreamEvent>(res, signal)) {
    const d = evt.data;
    if (!d || typeof d !== 'object') continue;
    if (d.type === 'done') return;
    if (d.type === 'thinking') {
      yield { id: makeId(), type: 'thinking', content: d.content };
    } else if (d.type === 'text') {
      yield { id: makeId(), type: 'text', content: d.content };
    } else if (d.type === 'widget') {
      yield { id: makeId(), type: 'widget', widgetName: d.widgetName, data: d.data };
    }
  }
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export { ApiError };
