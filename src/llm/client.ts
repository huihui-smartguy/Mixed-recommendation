/**
 * LLM 抽象客户端 (服务端使用)。
 *
 * 设计目标：
 * 1. 在 Vite middleware（Node 进程）里调用，不让 API key 暴露到浏览器
 * 2. 同一接口同时支持 Anthropic Messages API 与 OpenAI 兼容协议（DeepSeek/Qwen/Moonshot/通义千问/智谱…）
 * 3. 输出 async generator，每次 yield 一个文本 token，由上层组装成 SSE 事件
 *
 * 配置（环境变量）：
 *   LLM_PROVIDER         anthropic | openai-compatible   默认 anthropic
 *   LLM_BASE_URL         自定义 API 端点                  默认按 provider 取
 *   LLM_API_KEY          密钥；缺失则上层降级到脚本化用例
 *   LLM_MODEL            模型名                            默认 claude-sonnet-4-6 / gpt-4o-mini
 *   LLM_TEMPERATURE      生成温度（0-1）                   默认 0.4
 *   LLM_MAX_TOKENS       最大输出 token                    默认 2048
 */

export interface LLMConfig {
  provider: 'anthropic' | 'openai-compatible';
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function readLLMConfig(env: NodeJS.ProcessEnv = process.env): LLMConfig | null {
  const apiKey = env.LLM_API_KEY ?? '';
  const provider = (env.LLM_PROVIDER ?? 'anthropic') as LLMConfig['provider'];
  const defaults =
    provider === 'anthropic'
      ? { baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-6' }
      : { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' };
  const baseUrl = env.LLM_BASE_URL ?? defaults.baseUrl;
  const model = env.LLM_MODEL ?? defaults.model;
  const temperature = Number(env.LLM_TEMPERATURE ?? '0.4');
  const maxTokens = Number(env.LLM_MAX_TOKENS ?? '2048');

  if (!apiKey) return null;
  return { provider, baseUrl, apiKey, model, temperature, maxTokens };
}

/**
 * 流式调用 LLM，逐 token yield。出错时抛异常，由上层降级处理。
 *
 * onReasoning：可选回调。如果模型开启了"原生 reasoning 流"（Anthropic Extended
 * Thinking 的 thinking_delta、DeepSeek R1 / OpenAI o1 的 reasoning_content），
 * 这部分内容不会作为 token yield 给上层，而是单独通过 onReasoning 回流；
 * 上层（prodMiddleware）拿来做思维链可视化。
 */
export async function* streamLLM(
  config: LLMConfig,
  messages: LLMMessage[],
  signal?: AbortSignal,
  onReasoning?: (text: string) => void
): AsyncGenerator<string> {
  if (config.provider === 'anthropic') {
    yield* streamAnthropic(config, messages, signal, onReasoning);
    return;
  }
  yield* streamOpenAICompatible(config, messages, signal, onReasoning);
}

/* ----------------------- Anthropic Messages API ----------------------- */

async function* streamAnthropic(
  config: LLMConfig,
  messages: LLMMessage[],
  signal?: AbortSignal,
  onReasoning?: (text: string) => void
): AsyncGenerator<string> {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const turns = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  const res = await fetch(`${config.baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      system,
      messages: turns,
      stream: true
    }),
    signal
  });
  if (!res.ok || !res.body) {
    throw new Error(`anthropic ${res.status}: ${await res.text().catch(() => '')}`);
  }
  yield* parseLLMSSE(res, (data) => {
    if (data.type !== 'content_block_delta') return null;
    // 文本 token
    if (data.delta?.type === 'text_delta') {
      return { content: data.delta.text as string };
    }
    // Anthropic Extended Thinking — 原生思维链
    if (data.delta?.type === 'thinking_delta' && typeof data.delta.thinking === 'string') {
      onReasoning?.(data.delta.thinking);
      return null;
    }
    return null;
  });
}

/* ----------------------- OpenAI 兼容协议 ----------------------- */

async function* streamOpenAICompatible(
  config: LLMConfig,
  messages: LLMMessage[],
  signal?: AbortSignal,
  onReasoning?: (text: string) => void
): AsyncGenerator<string> {
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      stream: true
    }),
    signal
  });
  if (!res.ok || !res.body) {
    throw new Error(`openai ${res.status}: ${await res.text().catch(() => '')}`);
  }
  yield* parseLLMSSE(res, (data) => {
    const delta = data.choices?.[0]?.delta;
    if (!delta) return null;
    // DeepSeek R1 / OpenAI o1 等 reasoning 流字段
    const reason = delta.reasoning_content ?? delta.reasoning;
    if (typeof reason === 'string' && reason) {
      onReasoning?.(reason);
    }
    if (typeof delta.content === 'string') return { content: delta.content };
    return null;
  });
}

/* ----------------------- SSE 解析（服务端简版） ----------------------- */

async function* parseLLMSSE(
  res: Response,
  pickToken: (data: any) => string | { content: string } | null
): AsyncGenerator<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder('utf-8');
  let buf = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        for (const line of block.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const raw = line.slice(5).trim();
          if (!raw || raw === '[DONE]') continue;
          try {
            const data = JSON.parse(raw);
            const tok = pickToken(data);
            if (!tok) continue;
            if (typeof tok === 'string') yield tok;
            else if (tok.content) yield tok.content;
          } catch {
            /* swallow malformed chunk */
          }
        }
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
  }
}
