import type { Product, UserProfile } from '@/types';

export interface ReportPromptContext {
  profile: UserProfile;
  candidates: Product[];
  intent?: string;
  preferenceTags: string[];
}

/**
 * 资产配置报告 user prompt —— 依据 docs/prompt.md 的私行级模板拼装。
 *
 * 关键点：
 *  · Role 在 SYSTEM_PROMPT 已定义；本函数只往 user message 里填变量
 *  · 强制要求 LLM 按 docs/prompt.md 的 Markdown 大纲输出
 *  · 注入"超配无减持""新增补足型黄金三段论"等核心业务规则
 *  · onerec 候选池作为 {Product_Pool} 注入，LLM 不得跳出此池推荐
 *  · 输出后再由 src/utils/compliance.ts::redactBankNames() 在中间件里脱敏
 */
export function buildReportUserPrompt(ctx: ReportPromptContext): string {
  const { profile, candidates, intent, preferenceTags } = ctx;

  const aumWan = (profile.aum / 10000).toFixed(2);

  const candidatesBlock = candidates
    .map(
      (p) =>
        `- ${p.code} | ${p.name} | ${p.category} | 净值 ${p.netValue} | 近1年 ${p.return1y}% | 近3年 ${p.return3y}% | 最大回撤 ${p.maxDrawdown}% | 夏普 ${p.sharpe} | onerec 推荐理由：${p.reason}`
    )
    .join('\n');

  const profileLine = profile.user_profile
    ? `\n- onerec 原始 user_profile：${profile.user_profile}`
    : '';

  return `请基于以下变量数据，严格遵循系统 prompt 中的【核心业务红线】与【输出 Markdown 模板】，生成一份高度定制化、专业、数据自洽的《私人银行资产配置建议报告》。

# 📥 Input Data Context

## {Client_Info}
- 姓名：${profile.name ?? profile.displayName}
- 客户编号 / UID：${profile.uid ?? profile.id}
- 年龄：${profile.age} 岁
- 风险等级：${profile.riskLevel}
- 偏好标签：${profile.preferenceTags.join('、')}${preferenceTags.length ? `（本次额外偏好：${preferenceTags.join('、')}）` : ''}
- 投资经验：5-10 年
- 所属行业：制造业${profileLine}
${intent ? `- 客户本次意图：${intent}` : ''}

## {Holdings}
- 总资产 (AUM)：${aumWan} 万元
- 五大类资产当前金额（自动检测）：参考 user_profile 描述的现金管理 / 固定收益 / 权益 / 保障 / 另类金额；保持金额加总等于 AUM
- 临到期产品：近 30 天内 0 款产品到期，可继续围绕现有节奏优化

## {Target_Allocation}（按风险等级 ${profile.riskLevel} 取建议区间）
- 现金管理：建议 10%
- 固定收益：建议区间 ${
    profile.riskLevel === 'R5'
      ? '15%-30%'
      : profile.riskLevel === 'R4'
      ? '30%-55%'
      : profile.riskLevel === 'R3'
      ? '45%-65%'
      : '60%-85%'
  }
- 权益类：建议区间 ${
    profile.riskLevel === 'R5'
      ? '40%-65%'
      : profile.riskLevel === 'R4'
      ? '20%-35%'
      : profile.riskLevel === 'R3'
      ? '8%-14%'
      : '0%-5%'
  }
- 保障类：建议 10%
- 另类：建议 ${profile.riskLevel === 'R1' ? '0%' : '5%'}

## {Macro_Views}（本季度大类资产评级）
- 全球：地缘冲突推升油价，美联储 Q2 维稳，海外股债短期震荡
- 国内：流动性维持均衡偏松，A 股估值低位，权益结构性机会值得布局
- 大类资产评级：固收（标配）、A 股 / 港股（标配）、美股（中低配）、黄金（中高配）

## {Product_Pool}（必须严格只在此池中推荐 product_code）
${candidatesBlock}

# 🎯 输出要求

1. 严格遵守系统 prompt 中的【核心业务红线】：数据一致性、超配无减持、新增补足型黄金三段论
2. 严格按 docs/prompt.md 的 Markdown 大纲与表格结构输出，章节顺序不得调换
3. 推荐产品的 product_code 必须严格存在于上面的 {Product_Pool}
4. 在"二、客户分析"中渲染包含五大类金额、配比、收益的表格，配比之和必须 = 100.00%
5. 在"三、资产配置建议"中输出"建议配比 vs 存量配比 vs 新增配置缺口"对比表，缺口列严格选用以下专用词汇：
   适度补充 / 建议增配 / 维持配置 / 暂不新增 / 建议新增
6. 在"四、产品推荐"中先给概览表，再给每条产品的"黄金三段论"独立论述
7. 不得使用"保本""稳赚""一定涨"等违规词；末尾不要再写免责声明（前端会自动注入）
8. 输出长度：1500-2500 字`;
}

/**
 * 大类资产权重默认建议（当 LLM 未返回结构化权重时由后端兜底）
 */
export function defaultAllocations(profile: UserProfile) {
  if (profile.riskLevel === 'R1') {
    return [
      { asset: 'cash' as const, label: '货币现金', weight: 35 },
      { asset: 'bond' as const, label: '中长期债券', weight: 55 },
      { asset: 'gold' as const, label: '黄金', weight: 5 },
      { asset: 'equity_a' as const, label: 'A股核心宽基', weight: 5 }
    ];
  }
  if (profile.riskLevel === 'R2') {
    return [
      { asset: 'bond' as const, label: '中长期债券', weight: 60 },
      { asset: 'cash' as const, label: '货币现金', weight: 18 },
      { asset: 'equity_a' as const, label: 'A股核心宽基', weight: 12 },
      { asset: 'gold' as const, label: '黄金', weight: 7 },
      { asset: 'qdii' as const, label: '海外权益', weight: 3 }
    ];
  }
  if (profile.riskLevel === 'R3') {
    return [
      { asset: 'bond' as const, label: '中长期债券', weight: 55 },
      { asset: 'equity_a' as const, label: 'A股核心宽基', weight: 18 },
      { asset: 'gold' as const, label: '黄金', weight: 10 },
      { asset: 'cash' as const, label: '货币现金', weight: 12 },
      { asset: 'qdii' as const, label: '海外权益', weight: 5 }
    ];
  }
  if (profile.riskLevel === 'R4') {
    return [
      { asset: 'equity_a' as const, label: 'A股核心宽基', weight: 32 },
      { asset: 'bond' as const, label: '中长期债券', weight: 30 },
      { asset: 'qdii' as const, label: '海外权益', weight: 18 },
      { asset: 'gold' as const, label: '黄金', weight: 10 },
      { asset: 'reits' as const, label: 'REITs', weight: 5 },
      { asset: 'cash' as const, label: '货币现金', weight: 5 }
    ];
  }
  // R5
  return [
    { asset: 'equity_a' as const, label: 'A股核心宽基', weight: 38 },
    { asset: 'qdii' as const, label: '海外权益', weight: 28 },
    { asset: 'equity_hk' as const, label: '港股通', weight: 14 },
    { asset: 'bond' as const, label: '中长期债券', weight: 10 },
    { asset: 'gold' as const, label: '黄金', weight: 7 },
    { asset: 'cash' as const, label: '货币现金', weight: 3 }
  ];
}
