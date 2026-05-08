/**
 * 标准 text/event-stream 解析器（W3C EventSource 规范子集）。
 *
 * 设计要点：
 *   1. 纯函数 + 状态对象，便于单元测试与跨运行时复用（浏览器 / Node）。
 *   2. 支持事件被网络分片切断时的缓冲区延续。
 *   3. 兼容多行 data: 拼接（'\n' 连接，去除末尾换行）。
 *   4. 行首 ':' 注释行直接忽略；空行视为事件分隔。
 *   5. data 字段优先尝试 JSON 反序列化，失败则保留原始字符串。
 */

export interface SSEEvent<T = unknown> {
  /** event: 字段，未指定时为 'message' */
  event: string;
  /** id: 字段（可选） */
  id?: string;
  /** retry: 字段（毫秒，可选） */
  retry?: number;
  /** data 反序列化结果；非 JSON 则原样返回字符串 */
  data: T;
  /** 原始 data 字符串（多行已用 \n 拼接） */
  raw: string;
}

export interface SSEDecoderState {
  buffer: string;
}

export function createSSEState(): SSEDecoderState {
  return { buffer: '' };
}

/**
 * 增量推入一段网络数据（已转码为 string），返回本次能完整解析的事件列表。
 * 未完成的尾部继续保留在 state.buffer 内等待下次 push。
 */
export function pushSSEChunk<T = unknown>(
  state: SSEDecoderState,
  chunk: string
): SSEEvent<T>[] {
  // 兼容 \r\n 和 \r 行终止符
  state.buffer += chunk.replace(/\r\n?/g, '\n');

  const events: SSEEvent<T>[] = [];
  let idx: number;
  // 事件以空行 (\n\n) 分隔
  while ((idx = state.buffer.indexOf('\n\n')) !== -1) {
    const block = state.buffer.slice(0, idx);
    state.buffer = state.buffer.slice(idx + 2);
    const parsed = parseEventBlock<T>(block);
    if (parsed) events.push(parsed);
  }
  return events;
}

function parseEventBlock<T>(block: string): SSEEvent<T> | null {
  if (!block) return null;

  let event = 'message';
  let id: string | undefined;
  let retry: number | undefined;
  const dataLines: string[] = [];

  for (const line of block.split('\n')) {
    if (line === '' || line.startsWith(':')) continue; // 空行或注释
    const colonIdx = line.indexOf(':');
    let field: string;
    let value: string;
    if (colonIdx === -1) {
      field = line;
      value = '';
    } else {
      field = line.slice(0, colonIdx);
      // SSE 规范：冒号后第一个空格属于分隔符，需跳过
      value = line[colonIdx + 1] === ' ' ? line.slice(colonIdx + 2) : line.slice(colonIdx + 1);
    }
    switch (field) {
      case 'event':
        event = value;
        break;
      case 'id':
        id = value;
        break;
      case 'retry': {
        const n = Number.parseInt(value, 10);
        if (Number.isFinite(n)) retry = n;
        break;
      }
      case 'data':
        dataLines.push(value);
        break;
      default:
        // 未知字段忽略
        break;
    }
  }

  if (dataLines.length === 0) return null;
  const raw = dataLines.join('\n');
  let data: T;
  try {
    data = JSON.parse(raw) as T;
  } catch {
    data = raw as unknown as T;
  }
  return { event, id, retry, data, raw };
}

/**
 * 把 fetch Response 的 body 当作 SSE 流逐事件吐出。
 * 调用方常用于：
 *   for await (const evt of readSSEStream<ChatChunk>(resp, signal)) { ... }
 */
export async function* readSSEStream<T = unknown>(
  response: Response,
  signal?: AbortSignal
): AsyncGenerator<SSEEvent<T>> {
  if (!response.body) throw new Error('Response has no readable body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  const state = createSSEState();

  try {
    while (true) {
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
      const { value, done } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const evt of pushSSEChunk<T>(state, text)) yield evt;
    }
    // flush 末尾未带空行的事件
    const tail = decoder.decode();
    if (tail) for (const evt of pushSSEChunk<T>(state, tail)) yield evt;
    if (state.buffer.length > 0) {
      // 服务器未以 \n\n 结尾时尽力 flush
      for (const evt of pushSSEChunk<T>(state, '\n\n')) yield evt;
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
  }
}
