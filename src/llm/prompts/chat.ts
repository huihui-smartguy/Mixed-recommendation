import type { Product } from '@/types';

export interface ChatPromptContext {
  /** 用户原始问题（已 PII 脱敏） */
  userPrompt: string;
  /** onerec 召回的候选池（已通过 onerecAdapter 清洗） */
  candidates: Product[];
  /** 客户画像速览（可选） */
  profileSummary?: string;
}

/**
 * 构造交互式对话的 user message。
 * 该函数纯字符串拼接，便于自由调试 prompt 工程。
 */
export function buildChatUserPrompt(ctx: ChatPromptContext): string {
  const candidatesBlock = ctx.candidates
    .map((p) =>
      `- ${p.code} | ${p.name} | ${p.category} | 净值 ${p.netValue} | 近1年 ${p.return1y}% | 近3年 ${p.return3y}% | 最大回撤 ${p.maxDrawdown}% | 夏普 ${p.sharpe} | 推荐理由：${p.reason}`
    )
    .join('\n');

  return `【客户问题】
${ctx.userPrompt}

${ctx.profileSummary ? `【客户画像】\n${ctx.profileSummary}\n` : ''}
【onerec 候选池（请只在此池中挑选产品）】
${candidatesBlock}

请按系统 prompt 中的 SSE 协议输出。要求：
1. 不超过 3 条 thinking
2. 1-2 段 text 总结
3. 推荐 1-3 张 widget 卡片，code 必须来自候选池
4. 可选 1 个 trailing_rec 段
5. 必须给出 3 个 followup 追问
6. 最后 done`;
}
