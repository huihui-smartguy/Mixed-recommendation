import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { mockProductPool, mockProfiles } from '../services/mockData';
import type {
  Allocation,
  Product,
  ReportPayload,
  ReportThinkingEntry,
  UserProfile
} from '../types';
import { normalizeOnerecResponse } from '../services/onerecAdapter';
import { SYSTEM_PROMPT } from '../llm/prompts/system';
import { buildChatUserPrompt } from '../llm/prompts/chat';
import { buildReportUserPrompt, defaultAllocations } from '../llm/prompts/report';
import { readLLMConfig, streamLLM } from '../llm/client';
import { redactBankNames } from '../utils/compliance';

/**
 * 生产中间件（pnpm dev）
 *
 *   /api/v1/users/profiles                  → 读 mockProfiles（生产可换 DB）
 *   /api/v1/onerec/adapter/products         → 优先调真实 onerec (ONEREC_BASE_URL)，
 *                                              失败/缺配则读 mock-data/onerec/products.json
 *   /api/v1/report/{generate,status}        → 异步任务化；payload 由 LLM 生成 markdown
 *   /api/v1/chat/completions  (SSE)         → 真实 LLM；缺 LLM_API_KEY 时回放 chat-cases.json
 *
 * 设计要点：
 * 1. 接口契约与 mock 模式完全一致，前端零感知
 * 2. onerec 仅"预留接口位"，没有真实地址时也能完整跑通
 * 3. LLM 缺凭证时按 prompt 关键词匹配脚本化用例下发，体验仍连贯
 * 4. SSE 头部 X-Accel-Buffering: no 防止 nginx 缓冲
 */

const ROOT_HINT_FALLBACK = process.cwd();

const STAGE_TIMINGS: Array<{ stage: string; message: string; progress: number; delay: number }> = [
  { stage: 'queued', message: '任务已加入队列…', progress: 8, delay: 200 },
  { stage: 'profiling', message: '正在提取客户画像与持仓特征…', progress: 22, delay: 600 },
  { stage: 'recall', message: '调用 onerec 召回候选资产池…', progress: 45, delay: 800 },
  { stage: 'writing', message: 'AI 撰写资产配置逻辑与再平衡纪律…', progress: 78, delay: 1500 },
  { stage: 'rendering', message: '渲染图表与表格、注入合规水印…', progress: 95, delay: 500 }
];

interface ReportTaskInternal {
  taskId: string;
  profileId: string;
  intent: string;
  preferenceTags: string[];
  startedAt: number;
  payload?: ReportPayload;
  error?: string;
  /** 后台异步生成 markdown 时的 promise，避免同一 task 触发多次 LLM */
  pending?: Promise<void>;
  /** LLM 流式期间累积的真实思维链，前端轮询时下发 */
  thinkingTrail: ReportThinkingEntry[];
}

/** 截断超长 reasoning 防止前端面板撑爆（同时合并相邻 reasoning 片段） */
function pushTrail(
  task: ReportTaskInternal,
  entry: Omit<ReportThinkingEntry, 'at'>
): void {
  const trimmed = entry.text.trim();
  if (!trimmed) return;
  const last = task.thinkingTrail[task.thinkingTrail.length - 1];
  // reasoning 流通常被切成很多碎片，与上一条同 kind 时合并
  if (last && last.kind === entry.kind && entry.kind === 'reasoning') {
    last.text = (last.text + ' ' + trimmed).slice(-1200);
    last.at = Date.now();
    return;
  }
  task.thinkingTrail.push({ kind: entry.kind, text: trimmed, at: Date.now() });
  if (task.thinkingTrail.length > 60) task.thinkingTrail.shift();
}

const tasks = new Map<string, ReportTaskInternal>();

interface ChatCase {
  id: string;
  match: string[];
  intent: string;
  events: Array<Record<string, unknown> & { type: string }>;
}

let cachedChatCases: ChatCase[] | null = null;
let cachedOnerecData: Record<string, { items: unknown[] }> | null = null;

async function loadChatCases(rootDir: string): Promise<ChatCase[]> {
  if (cachedChatCases) return cachedChatCases;
  const path = join(rootDir, 'mock-data', 'llm', 'chat-cases.json');
  const raw = await readFile(path, 'utf-8');
  const parsed = JSON.parse(raw) as { cases: ChatCase[] };
  cachedChatCases = parsed.cases;
  return parsed.cases;
}

async function loadOnerecMock(rootDir: string): Promise<Record<string, { items: unknown[] }>> {
  if (cachedOnerecData) return cachedOnerecData;
  const path = join(rootDir, 'mock-data', 'onerec', 'products.json');
  const raw = await readFile(path, 'utf-8');
  const parsed = JSON.parse(raw) as { datasets: Record<string, { items: unknown[] }> };
  cachedOnerecData = parsed.datasets;
  return parsed.datasets;
}

/* -------------------- onerec：先打真接口，失败回退 mock -------------------- */

const ONEREC_DEFAULT_TIMEOUT_MS = 5000;
const ONEREC_DEFAULT_TOP_K = 8;

async function fetchOnerec(
  userId: string,
  rootDir: string,
  topK: number = ONEREC_DEFAULT_TOP_K
): Promise<Product[]> {
  const baseUrl = process.env.ONEREC_BASE_URL;
  if (baseUrl) {
    const timeoutMs = Number(process.env.ONEREC_TIMEOUT_MS ?? ONEREC_DEFAULT_TIMEOUT_MS);
    const token = process.env.ONEREC_API_TOKEN;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const url = `${baseUrl.replace(/\/+$/, '')}/products?userId=${encodeURIComponent(userId)}&topK=${encodeURIComponent(String(topK))}`;
      const res = await fetch(url, { headers, signal: ctrl.signal });
      if (res.ok) {
        const raw = await res.json();
        const items = Array.isArray(raw) ? raw : ((raw as { items?: unknown[] }).items ?? []);
        const products = normalizeOnerecResponse(items);
        if (products.length > 0) return products.slice(0, topK);
      } else {
        console.warn(`[prodMiddleware] onerec ${baseUrl} returned ${res.status}, fallback to mock`);
      }
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      console.warn(`[prodMiddleware] onerec ${baseUrl} unreachable (${msg}), fallback to mock`);
    } finally {
      clearTimeout(timer);
    }
  }
  const datasets = await loadOnerecMock(rootDir);
  const items = datasets[userId]?.items ?? datasets['1000000001']?.items ?? [];
  return normalizeOnerecResponse(items).slice(0, topK);
}

/* -------------------- 共享：报告 payload 构造 -------------------- */

function buildBacktest(seed: number) {
  const dates: string[] = [];
  const portfolio: number[] = [];
  const benchmark: number[] = [];
  let p = 1;
  let b = 1;
  const start = new Date('2022-01-04').getTime();
  for (let i = 0; i < 36; i++) {
    const d = new Date(start + i * 30 * 86400000);
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    p *= 1 + (Math.sin((i + seed) / 4) * 0.012 + 0.006);
    b *= 1 + (Math.cos((i + seed) / 5) * 0.014 + 0.003);
    portfolio.push(Number((p * 100).toFixed(2)));
    benchmark.push(Number((b * 100).toFixed(2)));
  }
  return { dates, portfolio, benchmark };
}

function fallbackMarkdown(profile: UserProfile, allocations: Allocation[], products: Product[]) {
  const rows = products
    .slice(0, 4)
    .map(
      (p) =>
        `| ${p.name}（${p.code}） | ${p.category} | ${p.return1y.toFixed(1)}% | ${p.return3y.toFixed(
          1
        )}% | ${p.maxDrawdown.toFixed(1)}% | ${p.sharpe.toFixed(2)} |`
    )
    .join('\n');
  return `# ${profile.displayName} · 资产配置建议书

## 一、客户画像速览

- 风险等级：**${profile.riskLevel}**
- 在管资产规模：${(profile.aum / 10000).toFixed(0)} 万元
- 偏好标签：${profile.preferenceTags.map((t) => '`' + t + '`').join(' ')}

## 二、配置主张

> ⚠ 当前未配置 LLM_API_KEY，下文为脚本化兜底文案。配置真实 LLM 后此段会替换为模型生成内容。

基于客户风险偏好，建议构建多元跨市场组合。

## 三、大类资产权重

${allocations.map((a) => `- **${a.label}**：${a.weight}%`).join('\n')}

## 四、底层标的精选

| 产品 | 类型 | 近一年 | 近三年 | 最大回撤 | 夏普 |
| --- | --- | ---: | ---: | ---: | ---: |
${rows}

## 五、再平衡纪律

1. 每季度末复核偏离度，单类资产偏离 ±5% 即触发再平衡
2. 黄金仓位采用网格策略，分批建仓抚平短期波动
3. 海外权益部分关注汇率对冲成本

## 六、风险提示

历史业绩不代表未来表现。`;
}

async function callLLMForReport(
  profile: UserProfile,
  candidates: Product[],
  intent: string,
  preferenceTags: string[],
  task: ReportTaskInternal,
  signal?: AbortSignal
): Promise<string | null> {
  const config = readLLMConfig();
  if (!config) return null;
  const userPrompt = buildReportUserPrompt({ profile, candidates, intent, preferenceTags });

  let out = '';
  let lastSection = '';
  // 在流式 markdown 里识别 H2 标题（## 一、xxx）作为"章节进展"思维链
  const onContent = (chunk: string) => {
    out += chunk;
    const m = out.match(/##\s*([^\n#]{1,40})\n[^]*$/);
    const section = m ? m[1].trim() : '';
    if (section && section !== lastSection) {
      lastSection = section;
      pushTrail(task, { kind: 'section', text: `正在撰写：${section}` });
    }
  };
  const onReasoning = (text: string) => {
    pushTrail(task, { kind: 'reasoning', text });
  };

  pushTrail(task, { kind: 'system', text: `调用 ${config.provider} 模型 ${config.model}` });
  try {
    for await (const tok of streamLLM(
      config,
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      signal,
      onReasoning
    )) {
      onContent(tok);
    }
    pushTrail(task, { kind: 'system', text: `LLM 流结束，输出 ${out.length} 字` });
    const redacted = redactBankNames(out.trim());
    if (redacted !== out.trim()) {
      pushTrail(task, { kind: 'system', text: '已对生成内容做银行名称脱敏处理' });
    }
    return redacted || null;
  } catch (err) {
    const msg = (err as Error).message;
    console.warn(`[prodMiddleware] LLM report failed: ${msg}`);
    pushTrail(task, { kind: 'system', text: `LLM 调用失败：${msg}` });
    return null;
  }
}

async function buildReportPayload(
  task: ReportTaskInternal,
  rootDir: string
): Promise<ReportPayload> {
  const profile = mockProfiles.find((p) => p.id === task.profileId);
  if (!profile) throw new Error(`unknown profileId: ${task.profileId}`);
  pushTrail(task, { kind: 'system', text: `读取客户画像 ${profile.id} (${profile.riskLevel})` });
  const products = await fetchOnerec(profile.id, rootDir);
  pushTrail(task, {
    kind: 'system',
    text: `onerec 召回 ${products.length} 条候选 (${products.slice(0, 3).map((p) => p.code).join(',')}...)`
  });
  const allocations = defaultAllocations(profile);
  const seed = profile.id.charCodeAt(profile.id.length - 1);

  const llmMarkdown = await callLLMForReport(
    profile,
    products,
    task.intent,
    task.preferenceTags,
    task
  );
  // fallback 兜底也走脱敏，统一对外契约
  const markdown = llmMarkdown ?? redactBankNames(fallbackMarkdown(profile, allocations, products));

  return {
    taskId: task.taskId,
    title: `${profile.displayName} · 资产配置建议书`,
    generatedAt: new Date().toISOString(),
    profileSummary: `${profile.displayName} · ${profile.riskLevel} · 偏好 ${profile.preferenceTags.join('、')}`,
    markdown,
    allocations,
    backtest: buildBacktest(seed),
    products
  };
}

function reportStatus(task: ReportTaskInternal) {
  const elapsed = Date.now() - task.startedAt;
  let acc = 0;
  // 思维链对所有阶段都下发，前端可决定是否展示
  const trail = task.thinkingTrail.slice(-30);
  for (const s of STAGE_TIMINGS) {
    if (elapsed < acc + s.delay) {
      return {
        taskId: task.taskId,
        stage: s.stage,
        message: s.message,
        progress: s.progress,
        thinkingTrail: trail
      };
    }
    acc += s.delay;
  }
  if (task.error) {
    return {
      taskId: task.taskId,
      stage: 'error',
      message: task.error,
      progress: 0,
      error: task.error,
      thinkingTrail: trail
    };
  }
  if (!task.payload) {
    return {
      taskId: task.taskId,
      stage: 'writing',
      message: 'AI 仍在撰写中，请稍候…',
      progress: 95,
      thinkingTrail: trail
    };
  }
  return {
    taskId: task.taskId,
    stage: 'done',
    message: '生成完毕',
    progress: 100,
    payload: task.payload,
    thinkingTrail: trail
  };
}

/* -------------------- chat：真实 LLM 或脚本化用例 -------------------- */

function pickChatCase(prompt: string, cases: ChatCase[]): ChatCase {
  for (const c of cases) {
    if (c.match.includes('*')) continue;
    if (c.match.some((kw) => prompt.toLowerCase().includes(kw.toLowerCase()))) return c;
  }
  return cases.find((c) => c.match.includes('*')) ?? cases[cases.length - 1];
}

function sseWrite(res: ServerResponse, payload: unknown) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function sseHeaders(res: ServerResponse) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
}

async function streamChatScripted(prompt: string, rootDir: string, res: ServerResponse) {
  sseHeaders(res);
  let aborted = false;
  res.on('close', () => (aborted = true));

  const cases = await loadChatCases(rootDir);
  const chosen = pickChatCase(prompt, cases);

  for (const evt of chosen.events) {
    if (aborted) return;
    // 文本事件按字符切，模拟打字机
    if (evt.type === 'text' && typeof evt.content === 'string') {
      for (const ch of evt.content) {
        if (aborted) return;
        await new Promise((r) => setTimeout(r, 14));
        sseWrite(res, { type: 'text', content: ch });
      }
      continue;
    }
    // 思考事件附 350ms 节奏
    if (evt.type === 'thinking') {
      await new Promise((r) => setTimeout(r, 320));
    } else {
      await new Promise((r) => setTimeout(r, 240));
    }
    sseWrite(res, evt);
  }
  res.end();
}

function profileSummary(p?: UserProfile): string | undefined {
  if (!p) return undefined;
  const tags = p.preferenceTags?.length ? p.preferenceTags.join('、') : '无';
  return `${p.displayName} (${p.id}) · 风险等级 ${p.riskLevel} · 在管 ${(p.aum / 10000).toFixed(0)} 万 · ${p.age} 岁 · 偏好：${tags}`;
}

async function streamChatLLM(
  prompt: string,
  profile: UserProfile | undefined,
  _rootDir: string,
  res: ServerResponse
): Promise<boolean> {
  const config = readLLMConfig();
  if (!config) return false;

  // ⚠️ 设计选择：交互式推荐**不**调 onerec。
  // 交互场景是开放式对话，强制圈一个 top-k 候选池反而会限制 LLM 的覆盖面。
  // 这里直接用 mockProductPool 作为内置话术兜底素材；profile 仍会注入 prompt
  // 让 LLM 理解风险等级与偏好。
  const candidates = mockProductPool.slice(0, 6);
  const userPrompt = buildChatUserPrompt({
    userPrompt: prompt,
    candidates,
    profileSummary: profileSummary(profile)
  });
  sseHeaders(res);

  const ctrl = new AbortController();
  res.on('close', () => ctrl.abort());

  let buffer = '';
  let aborted = false;
  res.on('close', () => (aborted = true));
  // 把模型原生 reasoning 流（Anthropic thinking_delta / DeepSeek R1
  // reasoning_content）合成为 SSE thinking 事件，前端 ThinkingSidebar 自动接收。
  const onReasoning = (text: string) => {
    if (aborted) return;
    sseWrite(res, { type: 'thinking', content: text });
  };
  try {
    for await (const tok of streamLLM(
      config,
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      ctrl.signal,
      onReasoning
    )) {
      if (aborted) break;
      buffer += tok;
      // LLM 输出多 JSON 行；按 \n\n 切块尝试 parse
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 2);
        if (!block) continue;
        const data = block.startsWith('data:') ? block.slice(5).trim() : block;
        try {
          const evt = JSON.parse(data);
          if (evt && typeof evt === 'object') sseWrite(res, evt);
        } catch {
          // 无法 parse → 当作 text 段下发
          sseWrite(res, { type: 'text', content: data });
        }
      }
    }
    if (buffer.trim()) {
      try {
        const evt = JSON.parse(buffer.trim());
        sseWrite(res, evt);
      } catch {
        sseWrite(res, { type: 'text', content: buffer.trim() });
      }
    }
    sseWrite(res, { type: 'done' });
    res.end();
    return true;
  } catch (err) {
    console.warn(`[prodMiddleware] LLM chat failed: ${(err as Error).message}`);
    return false;
  }
}

/* -------------------- HTTP 工具 -------------------- */

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

/* -------------------- 插件入口 -------------------- */

export function prodBackendPlugin(): Plugin {
  let rootDir = ROOT_HINT_FALLBACK;
  return {
    name: 'mixed-rec-prod-backend',
    configResolved(cfg) {
      rootDir = cfg.root;
    },
    configureServer(server) {
      const llmReady = !!readLLMConfig();
      const onerecReady = !!process.env.ONEREC_BASE_URL;
      // eslint-disable-next-line no-console
      console.log(
        `\n  [生产模式] LLM=${llmReady ? '已配置' : '未配置(降级脚本化)'}  ` +
          `onerec=${onerecReady ? '已配置' : '本地 mock'}\n`
      );

      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith('/api/v1/')) return next();
        try {
          if (req.method === 'GET' && url.startsWith('/api/v1/users/profiles')) {
            return json(res, 200, mockProfiles);
          }
          if (req.method === 'GET' && url.startsWith('/api/v1/onerec/adapter/products')) {
            const q = new URL(url, 'http://localhost').searchParams;
            const userId = q.get('userId') ?? '';
            const products = await fetchOnerec(userId, rootDir);
            return json(res, 200, products);
          }
          if (req.method === 'POST' && url.startsWith('/api/v1/report/generate')) {
            const body = await readBody(req);
            const parsed = body
              ? (JSON.parse(body) as { profileId: string; intent?: string; preferenceTags?: string[] })
              : { profileId: '' };
            const taskId = `T-${Date.now().toString(36)}`;
            const task: ReportTaskInternal = {
              taskId,
              profileId: parsed.profileId,
              intent: parsed.intent ?? '',
              preferenceTags: parsed.preferenceTags ?? [],
              startedAt: Date.now(),
              thinkingTrail: []
            };
            tasks.set(taskId, task);
            // 后台异步构造 payload；不 await
            task.pending = buildReportPayload(task, rootDir)
              .then((p) => {
                task.payload = p;
              })
              .catch((err) => {
                task.error = (err as Error).message;
              });
            return json(res, 200, { taskId });
          }
          if (req.method === 'GET' && url.startsWith('/api/v1/report/status')) {
            const q = new URL(url, 'http://localhost').searchParams;
            const taskId = q.get('taskId') ?? '';
            const task = tasks.get(taskId);
            if (!task) return json(res, 404, { error: 'task not found' });
            return json(res, 200, reportStatus(task));
          }
          if (req.method === 'POST' && url.startsWith('/api/v1/chat/completions')) {
            const body = await readBody(req);
            const parsed = body
              ? (JSON.parse(body) as { prompt?: string; profile?: UserProfile })
              : {};
            const prompt = parsed.prompt ?? '';
            const profile = parsed.profile;
            const ok = await streamChatLLM(prompt, profile, rootDir, res);
            if (!ok) {
              await streamChatScripted(prompt, rootDir, res);
            }
            return;
          }
          return json(res, 404, { error: 'route not found', url });
        } catch (err) {
          return json(res, 500, { error: (err as Error).message });
        }
      });
    }
  };
}
