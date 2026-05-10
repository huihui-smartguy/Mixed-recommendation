import type { Product } from '@/types';

export interface ChatPromptContext {
  /** 用户原始问题（已 PII 脱敏） */
  userPrompt: string;
  /** 内置话术兜底素材池（**注意：交互式对话不调用 onerec**，这里是 BFF 自带的产品库） */
  candidates: Product[];
  /** 客户画像速览（可选）—— 由 prodMiddleware.profileSummary() 拼接 */
  profileSummary?: string;
}

/**
 * 构造交互式对话的 user message。
 *
 * 设计要点：
 *   · 交互式推荐**不**走 onerec —— BFF 直接用内置 mockProductPool 作为候选话术素材
 *   · 画像（uid / 风险等级 / 偏好 / 资产）原样注入，让 LLM 与客户风险匹配
 *   · LLM 仍按 SSE 事件协议输出 thinking / text / widget / followup / done
 */
export function buildChatUserPrompt(ctx: ChatPromptContext): string {
  const candidatesBlock = ctx.candidates
    .map(
      (p) =>
        `- ${p.code} | ${p.name} | ${p.category} | 净值 ${p.netValue} | 近1年 ${p.return1y}% | 近3年 ${p.return3y}% | 最大回撤 ${p.maxDrawdown}% | 夏普 ${p.sharpe} | 备注：${p.reason}`
    )
    .join('\n');

  return `【客户问题】
${ctx.userPrompt}

${ctx.profileSummary ? `【客户画像】\n${ctx.profileSummary}\n` : ''}
【可参考的产品话术素材（仅作举例参考，不强制只在此池内推荐）】
${candidatesBlock}

请按系统 prompt 中的 SSE 协议输出。要求：
1. 不超过 3 条 thinking
2. 1-2 段 text 总结
3. 推荐 1-3 张 widget 卡片，code 优先来自上方素材池
4. 可选 1 个 trailing_rec 段
5. 必须给出 3 个 followup 追问
6. 最后 done`;
}
