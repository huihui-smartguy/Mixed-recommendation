// 本地风控：违禁词与诱导性词汇前置阻断
const BANNED_WORDS: string[] = [
  '保本',
  '保收益',
  '稳赚',
  '内幕',
  '一定涨',
  '必涨',
  '包赚',
  '老鼠仓',
  '操纵',
  '杠杆配资'
];

export interface ComplianceVerdict {
  ok: boolean;
  hits: string[];
}

export function checkBannedWords(text: string): ComplianceVerdict {
  const hits = BANNED_WORDS.filter((w) => text.includes(w));
  return { ok: hits.length === 0, hits };
}

// PII 脱敏：掩码身份证、手机号、银行卡号
export function maskPII(text: string): string {
  return text
    .replace(/\b\d{17}[\dXx]\b/g, '***身份证已脱敏***')
    .replace(/\b1[3-9]\d{9}\b/g, '***手机号已脱敏***')
    .replace(/\b\d{16,19}\b/g, '***卡号已脱敏***');
}

export const DISCLAIMER =
  'AI 辅助生成内容仅供参考，历史业绩不代表未来表现，不构成实质投资建议。投资有风险，决策需谨慎。';
