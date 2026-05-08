import type {
  Allocation,
  Product,
  ReportPayload,
  UserProfile
} from '@/types';
import { mockProductPool, mockProfiles } from './mockData';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchProfiles(): Promise<UserProfile[]> {
  await sleep(120);
  return mockProfiles;
}

export async function fetchOnerecCandidates(profileId: string): Promise<Product[]> {
  await sleep(180);
  // 不同画像下的召回顺序差异化
  if (profileId === 'CUST-A') {
    return [mockProductPool[1], mockProductPool[5], mockProductPool[4], mockProductPool[0]];
  }
  if (profileId === 'CUST-B') {
    return [mockProductPool[0], mockProductPool[5], mockProductPool[1], mockProductPool[4]];
  }
  return [mockProductPool[3], mockProductPool[0], mockProductPool[2], mockProductPool[4]];
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

function generateBacktest(seed: number) {
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

function buildMarkdown(profile: UserProfile, allocations: Allocation[], products: Product[]): string {
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
}

export interface ReportProgressEvent {
  stage: 'queued' | 'profiling' | 'recall' | 'writing' | 'rendering' | 'done';
  message: string;
  progress: number;
  payload?: ReportPayload;
}

export async function generateReportTask(
  profile: UserProfile,
  onProgress: (e: ReportProgressEvent) => void,
  signal?: AbortSignal
): Promise<ReportPayload> {
  const taskId = `T-${Date.now().toString(36)}`;

  const stages: Array<Omit<ReportProgressEvent, 'payload'>> = [
    { stage: 'queued', message: '任务已加入队列…', progress: 8 },
    { stage: 'profiling', message: '正在提取客户画像与持仓特征…', progress: 22 },
    { stage: 'recall', message: '调用 onerec 召回候选资产池…', progress: 45 },
    { stage: 'writing', message: 'AI 撰写资产配置逻辑与再平衡纪律…', progress: 72 },
    { stage: 'rendering', message: '渲染图表与表格、注入合规水印…', progress: 92 }
  ];

  for (const s of stages) {
    if (signal?.aborted) throw new Error('aborted');
    await sleep(700 + Math.random() * 600);
    onProgress(s);
  }

  const allocations = buildAllocations(profile);
  const products = await fetchOnerecCandidates(profile.id);
  const seed = profile.id.charCodeAt(profile.id.length - 1);

  const payload: ReportPayload = {
    taskId,
    title: `${profile.displayName} · 资产配置建议书`,
    generatedAt: new Date().toISOString(),
    profileSummary: `${profile.displayName} · ${profile.riskLevel} · 偏好 ${profile.preferenceTags.join('、')}`,
    markdown: buildMarkdown(profile, allocations, products),
    allocations,
    backtest: generateBacktest(seed),
    products
  };

  onProgress({ stage: 'done', message: '生成完毕', progress: 100, payload });
  return payload;
}

/**
 * Mock SSE-style streaming chat. Emits chunks via async iterator.
 * Mirrors the contract:
 *   { type: 'thinking' | 'text' | 'widget', content?, widgetName?, data? }
 */
export async function* streamChatCompletion(prompt: string, signal?: AbortSignal): AsyncGenerator<{
  type: 'thinking' | 'text' | 'widget';
  content?: string;
  widgetName?: 'FundCard';
  data?: Product;
}> {
  const lower = prompt.toLowerCase();
  const wantsBond = /稳健|债|低波|保守|压舱/.test(prompt);
  const wantsTech = /科技|纳指|海外|qdii|成长/.test(lower);
  const wantsGold = /黄金|避险|通胀/.test(prompt);

  const thinkingSteps = [
    '解析客户问题与隐含意图…',
    wantsBond ? '识别为稳健诉求，优先筛选低波组合…' : '识别为均衡/进取诉求，加入成长资产…',
    '调用 onerec 候选池并按夏普比率排序…',
    '校验产品代码合法性，避免幻觉资产…'
  ];

  for (const t of thinkingSteps) {
    if (signal?.aborted) return;
    await sleep(380);
    yield { type: 'thinking', content: t };
  }

  const intro = wantsBond
    ? '考虑到您的风险承受度偏稳健，我建议以中长期债券为压舱石，叠加少量红利策略与黄金做风险对冲。'
    : wantsTech
      ? '当前海外科技板块景气度回暖，可在权益核心仓位上加入纳指 QDII，提升组合进取性。'
      : '基于股债平衡视角，下面是我为您筛选的核心标的，建议分批建仓。';

  for (const ch of intro) {
    if (signal?.aborted) return;
    await sleep(18);
    yield { type: 'text', content: ch };
  }

  const candidates: Product[] = [];
  if (wantsBond) candidates.push(mockProductPool[1], mockProductPool[5]);
  if (wantsTech) candidates.push(mockProductPool[3], mockProductPool[0]);
  if (wantsGold) candidates.push(mockProductPool[4]);
  if (candidates.length === 0) candidates.push(mockProductPool[0], mockProductPool[1], mockProductPool[4]);

  yield { type: 'text', content: '\n\n以下是为您挑选的标的：\n' };

  for (const p of candidates) {
    if (signal?.aborted) return;
    await sleep(260);
    yield { type: 'widget', widgetName: 'FundCard', data: p };
  }

  const tail = '\n\n以上推荐均来自 onerec 候选池，结果仅供参考。如需深度比较，可勾选多只产品后点击「对比」。';
  for (const ch of tail) {
    if (signal?.aborted) return;
    await sleep(14);
    yield { type: 'text', content: ch };
  }
}
