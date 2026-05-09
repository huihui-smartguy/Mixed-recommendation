import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { mockProductPool, mockProfiles } from '../services/mockData';
import type { Allocation, Product, ReportPayload, UserProfile } from '../types';

interface ReportTaskInternal {
  taskId: string;
  profileId: string;
  intent: string;
  startedAt: number;
  stages: Array<{ stage: string; message: string; progress: number; at: number }>;
  payload?: ReportPayload;
  error?: string;
}

const STAGE_TIMINGS: Array<{ stage: string; message: string; progress: number; delay: number }> = [
  { stage: 'queued', message: '任务已加入队列…', progress: 8, delay: 200 },
  { stage: 'profiling', message: '正在提取客户画像与持仓特征…', progress: 22, delay: 700 },
  { stage: 'recall', message: '调用 onerec 召回候选资产池…', progress: 45, delay: 800 },
  { stage: 'writing', message: 'AI 撰写资产配置逻辑与再平衡纪律…', progress: 72, delay: 1100 },
  { stage: 'rendering', message: '渲染图表与表格、注入合规水印…', progress: 92, delay: 700 }
];

const tasks = new Map<string, ReportTaskInternal>();

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

function buildAllocations(profile: UserProfile): Allocation[] {
  if (profile.riskLevel === 'C3') {
    return [
      { asset: 'bond', label: '中长期债券', weight: 55 },
      { asset: 'equity_a', label: 'A股核心宽基', weight: 18 },
      { asset: 'gold', label: '黄金', weight: 10 },
      { asset: 'cash', label: '货币现金', weight: 12 },
      { asset: 'qdii', label: '海外权益', weight: 5 }
    ];
  }
  if (profile.riskLevel === 'C4') {
    return [
      { asset: 'equity_a', label: 'A股核心宽基', weight: 32 },
      { asset: 'bond', label: '中长期债券', weight: 30 },
      { asset: 'qdii', label: '海外权益', weight: 18 },
      { asset: 'gold', label: '黄金', weight: 10 },
      { asset: 'reits', label: 'REITs', weight: 5 },
      { asset: 'cash', label: '货币现金', weight: 5 }
    ];
  }
  return [
    { asset: 'equity_a', label: 'A股核心宽基', weight: 38 },
    { asset: 'qdii', label: '海外权益', weight: 28 },
    { asset: 'equity_hk', label: '港股通', weight: 14 },
    { asset: 'bond', label: '中长期债券', weight: 10 },
    { asset: 'gold', label: '黄金', weight: 7 },
    { asset: 'cash', label: '货币现金', weight: 3 }
  ];
}

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

function pickRecallByProfile(profileId: string): Product[] {
  if (profileId === 'CUST-A') return [mockProductPool[1], mockProductPool[5], mockProductPool[4], mockProductPool[0]];
  if (profileId === 'CUST-B') return [mockProductPool[0], mockProductPool[5], mockProductPool[1], mockProductPool[4]];
  return [mockProductPool[3], mockProductPool[0], mockProductPool[2], mockProductPool[4]];
}

function buildReportPayload(taskId: string, profile: UserProfile): ReportPayload {
  const allocations = buildAllocations(profile);
  const products = pickRecallByProfile(profile.id);
  const seed = profile.id.charCodeAt(profile.id.length - 1);
  const rows = products
    .slice(0, 4)
    .map(
      (p) =>
        `| ${p.name}（${p.code}） | ${p.category} | ${p.return1y.toFixed(1)}% | ${p.return3y.toFixed(
          1
        )}% | ${p.maxDrawdown.toFixed(1)}% | ${p.sharpe.toFixed(2)} |`
    )
    .join('\n');
  const markdown = `# ${profile.displayName} · 资产配置建议书

## 一、客户画像速览

- 风险等级：**${profile.riskLevel}**
- 在管资产规模：${(profile.aum / 10000).toFixed(0)} 万元
- 偏好标签：${profile.preferenceTags.map((t) => '`' + t + '`').join(' ')}
- 报告日期：${new Date().toLocaleDateString('zh-CN')}

## 二、配置主张

基于当前宏观环境（盈利底部修复 + 流动性宽松预期），结合客户风险偏好，建议以**${
    profile.riskLevel === 'C3' ? '稳健保值' : profile.riskLevel === 'C4' ? '股债平衡' : '权益主导'
  }**为主轴，构建多元跨市场组合。

## 三、大类资产权重

${allocations.map((a) => `- **${a.label}**：${a.weight}%`).join('\n')}

## 四、底层标的精选

| 产品 | 类型 | 近一年 | 近三年 | 最大回撤 | 夏普 |
| --- | --- | ---: | ---: | ---: | ---: |
${rows}

## 五、再平衡纪律

1. 每季度末复核偏离度，单类资产偏离 ±5% 即触发再平衡。
2. 黄金仓位采用网格策略，分批建仓抚平短期波动。
3. 海外权益部分关注汇率对冲成本。

## 六、风险提示

历史业绩不代表未来表现，本报告由 AI 辅助生成，最终投资决策需由理财师与客户共同确认。
`;

  return {
    taskId,
    title: `${profile.displayName} · 资产配置建议书`,
    generatedAt: new Date().toISOString(),
    profileSummary: `${profile.displayName} · ${profile.riskLevel} · 偏好 ${profile.preferenceTags.join('、')}`,
    markdown,
    allocations,
    backtest: buildBacktest(seed),
    products
  };
}

function thinkingForPrompt(prompt: string): string[] {
  const wantsBond = /稳健|债|低波|保守|压舱/.test(prompt);
  return [
    '解析客户问题与隐含意图…',
    wantsBond ? '识别为稳健诉求，优先筛选低波组合…' : '识别为均衡/进取诉求，加入成长资产…',
    '调用 onerec 候选池并按夏普比率排序…',
    '校验产品代码合法性，避免幻觉资产…'
  ];
}

function pickProductsForPrompt(prompt: string): Product[] {
  const lower = prompt.toLowerCase();
  const wantsBond = /稳健|债|低波|保守|压舱/.test(prompt);
  const wantsTech = /科技|纳指|海外|qdii|成长/.test(lower);
  const wantsGold = /黄金|避险|通胀/.test(prompt);
  const list: Product[] = [];
  if (wantsBond) list.push(mockProductPool[1], mockProductPool[5]);
  if (wantsTech) list.push(mockProductPool[3], mockProductPool[0]);
  if (wantsGold) list.push(mockProductPool[4]);
  if (list.length === 0) list.push(mockProductPool[0], mockProductPool[1], mockProductPool[4]);
  return list;
}

function introForPrompt(prompt: string): string {
  if (/稳健|债|低波|保守|压舱/.test(prompt)) {
    return '考虑到您的风险承受度偏稳健，我建议以中长期债券为压舱石，叠加少量红利策略与黄金做风险对冲。';
  }
  if (/科技|纳指|海外|qdii|成长/i.test(prompt)) {
    return '当前海外科技板块景气度回暖，可在权益核心仓位上加入纳指 QDII，提升组合进取性。';
  }
  return '基于股债平衡视角，下面是我为您筛选的核心标的，建议分批建仓。';
}

function sseWrite(res: ServerResponse, payload: unknown) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function streamChatResponse(prompt: string, res: ServerResponse) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  let aborted = false;
  res.on('close', () => (aborted = true));

  for (const t of thinkingForPrompt(prompt)) {
    if (aborted) return;
    await new Promise((r) => setTimeout(r, 350));
    sseWrite(res, { type: 'thinking', content: t });
  }

  const intro = introForPrompt(prompt);
  for (const ch of intro) {
    if (aborted) return;
    await new Promise((r) => setTimeout(r, 16));
    sseWrite(res, { type: 'text', content: ch });
  }

  sseWrite(res, { type: 'text', content: '\n\n以下是为您挑选的标的：\n' });

  for (const p of pickProductsForPrompt(prompt)) {
    if (aborted) return;
    await new Promise((r) => setTimeout(r, 240));
    sseWrite(res, { type: 'widget', widgetName: 'FundCard', data: p });
  }

  for (const ch of '\n\n以上推荐均来自 onerec 候选池，结果仅供参考。如需深度比较，可勾选多只产品后点击「对比」。') {
    if (aborted) return;
    await new Promise((r) => setTimeout(r, 14));
    sseWrite(res, { type: 'text', content: ch });
  }
  sseWrite(res, { type: 'done' });
  res.end();
}

/** mock 模式下的"伪思维链"——按阶段拼出来，与 prod 通用结构一致 */
function mockThinkingTrail(elapsed: number): Array<{ kind: string; text: string; at: number }> {
  const t0 = Date.now() - elapsed;
  const trail: Array<{ kind: string; text: string; at: number }> = [];
  let acc = 0;
  const add = (kind: string, text: string, delay: number) => {
    if (elapsed >= acc + delay) trail.push({ kind, text, at: t0 + acc + delay });
    acc += delay;
  };
  add('system', '读取客户画像与持仓特征…', 200);
  add('system', '调用 onerec 召回候选池…', 700);
  add('reasoning', '基于风险等级裁剪候选池，按夏普比率初排序…', 600);
  add('section', '正在撰写：客户画像速览', 400);
  add('section', '正在撰写：配置主张', 500);
  add('section', '正在撰写：大类资产权重', 400);
  add('section', '正在撰写：底层标的精选', 500);
  add('section', '正在撰写：再平衡纪律', 300);
  add('section', '正在撰写：风险提示', 200);
  add('system', '渲染图表与表格、注入合规水印…', 300);
  return trail;
}

function reportStatus(t: ReportTaskInternal) {
  const elapsed = Date.now() - t.startedAt;
  const thinkingTrail = mockThinkingTrail(elapsed);
  let acc = 0;
  for (const s of STAGE_TIMINGS) {
    if (elapsed < acc + s.delay) {
      return {
        taskId: t.taskId,
        stage: s.stage,
        message: s.message,
        progress: s.progress,
        thinkingTrail
      };
    }
    acc += s.delay;
  }
  // 完成
  if (!t.payload) {
    const profile = mockProfiles.find((p) => p.id === t.profileId);
    if (!profile) {
      t.error = `unknown profile ${t.profileId}`;
      return {
        taskId: t.taskId,
        stage: 'error',
        message: t.error,
        progress: 0,
        error: t.error,
        thinkingTrail
      };
    }
    t.payload = buildReportPayload(t.taskId, profile);
  }
  return {
    taskId: t.taskId,
    stage: 'done',
    message: '生成完毕',
    progress: 100,
    payload: t.payload,
    thinkingTrail
  };
}

export function mockBackendPlugin(): Plugin {
  return {
    name: 'mixed-rec-mock-backend',
    configureServer(server) {
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
            return json(res, 200, pickRecallByProfile(userId));
          }
          if (req.method === 'POST' && url.startsWith('/api/v1/report/generate')) {
            const body = await readBody(req);
            const parsed = body ? (JSON.parse(body) as { profileId: string; intent?: string }) : { profileId: '' };
            const taskId = `T-${Date.now().toString(36)}`;
            tasks.set(taskId, {
              taskId,
              profileId: parsed.profileId,
              intent: parsed.intent ?? '',
              startedAt: Date.now(),
              stages: []
            });
            return json(res, 200, { taskId });
          }
          if (req.method === 'GET' && url.startsWith('/api/v1/report/status')) {
            const q = new URL(url, 'http://localhost').searchParams;
            const taskId = q.get('taskId') ?? '';
            const t = tasks.get(taskId);
            if (!t) return json(res, 404, { error: 'task not found' });
            return json(res, 200, reportStatus(t));
          }
          if (req.method === 'POST' && url.startsWith('/api/v1/chat/completions')) {
            const body = await readBody(req);
            const parsed = body
              ? (JSON.parse(body) as { prompt?: string; profile?: UserProfile })
              : {};
            // mock 模式下 profile 仅作为打印调试存在；真实个性化由 prodMiddleware 处理
            if (parsed.profile?.id) {
              console.log(`[devMock] chat with profile=${parsed.profile.id}`);
            }
            return streamChatResponse(parsed.prompt ?? '', res);
          }
          return json(res, 404, { error: 'mock route not found', url });
        } catch (err) {
          return json(res, 500, { error: (err as Error).message });
        }
      });
    }
  };
}
