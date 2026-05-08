import type { Product, UserProfile } from '@/types';

export interface ReportPromptContext {
  profile: UserProfile;
  candidates: Product[];
  intent?: string;
  preferenceTags: string[];
}

/**
 * 构造生成式报告的 user message。
 * 输出预期是一段长 Markdown，因此不走 SSE 事件协议，
 * 由 prodMiddleware 拼成完整 ReportPayload 后下发。
 */
export function buildReportUserPrompt(ctx: ReportPromptContext): string {
  const { profile, candidates, intent, preferenceTags } = ctx;
  const candidatesBlock = candidates
    .map((p) => `- ${p.code} | ${p.name} | ${p.category} | 近1年 ${p.return1y}% | 近3年 ${p.return3y}% | 最大回撤 ${p.maxDrawdown}% | 夏普 ${p.sharpe}`)
    .join('\n');

  return `请为以下客户生成一份完整的资产配置建议书（Markdown 格式，1500-2500 字）。

【客户画像】
- ID：${profile.id}
- 姓名：${profile.displayName}
- 风险等级：${profile.riskLevel}
- 在管资产：${(profile.aum / 10000).toFixed(0)} 万元
- 年龄：${profile.age}
- 偏好标签：${profile.preferenceTags.join('、')}
${preferenceTags.length ? `- 本次额外偏好：${preferenceTags.join('、')}` : ''}
${intent ? `- 客户意图：${intent}` : ''}

【onerec 召回候选池（请只在此池中挑选）】
${candidatesBlock}

【输出要求】
1. 标题以 H1 开头：${profile.displayName} · 资产配置建议书
2. 必须包含以下章节（H2）：
   - 一、客户画像速览
   - 二、配置主张
   - 三、大类资产权重（用列表给出占比）
   - 四、底层标的精选（用 Markdown 表格）
   - 五、再平衡纪律
   - 六、风险提示
3. 表格必须使用 Markdown GFM 语法
4. 推荐 code 必须严格出自候选池
5. 不要包含任何"保本""稳赚""一定涨"等违规词
6. 末尾不要免责声明（前端会自动注入）`;
}

/**
 * 大类资产权重默认建议（当 LLM 未返回结构化权重时由后端兜底）
 */
export function defaultAllocations(profile: UserProfile) {
  if (profile.riskLevel === 'C3') {
    return [
      { asset: 'bond' as const, label: '中长期债券', weight: 55 },
      { asset: 'equity_a' as const, label: 'A股核心宽基', weight: 18 },
      { asset: 'gold' as const, label: '黄金', weight: 10 },
      { asset: 'cash' as const, label: '货币现金', weight: 12 },
      { asset: 'qdii' as const, label: '海外权益', weight: 5 }
    ];
  }
  if (profile.riskLevel === 'C4') {
    return [
      { asset: 'equity_a' as const, label: 'A股核心宽基', weight: 32 },
      { asset: 'bond' as const, label: '中长期债券', weight: 30 },
      { asset: 'qdii' as const, label: '海外权益', weight: 18 },
      { asset: 'gold' as const, label: '黄金', weight: 10 },
      { asset: 'reits' as const, label: 'REITs', weight: 5 },
      { asset: 'cash' as const, label: '货币现金', weight: 5 }
    ];
  }
  return [
    { asset: 'equity_a' as const, label: 'A股核心宽基', weight: 38 },
    { asset: 'qdii' as const, label: '海外权益', weight: 28 },
    { asset: 'equity_hk' as const, label: '港股通', weight: 14 },
    { asset: 'bond' as const, label: '中长期债券', weight: 10 },
    { asset: 'gold' as const, label: '黄金', weight: 7 },
    { asset: 'cash' as const, label: '货币现金', weight: 3 }
  ];
}
