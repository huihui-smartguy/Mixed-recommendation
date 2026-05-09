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

/**
 * 中国主要银行名称清单，命中即在生成的报告/对话中替换为占位符 [XX 银行]。
 * 当真实 LLM 输出复用了 prompt 中"浦发银行"模板内容时，这里负责脱敏，
 * 让对外文档不暴露具体行别。
 *
 * 顺序：先匹配长名（"中国工商银行"），再匹配短名（"工商银行"），避免被截断。
 */
const BANK_NAMES: string[] = [
  '中国工商银行',
  '中国建设银行',
  '中国农业银行',
  '中国银行',
  '交通银行',
  '中国邮政储蓄银行',
  '邮储银行',
  '招商银行',
  '中信银行',
  '兴业银行',
  '浦发银行',
  '上海浦东发展银行',
  '平安银行',
  '民生银行',
  '光大银行',
  '华夏银行',
  '广发银行',
  '北京银行',
  '上海银行',
  '南京银行',
  '宁波银行',
  '江苏银行',
  '渤海银行',
  '浙商银行',
  '恒丰银行'
];

const BANK_NAME_REGEX = new RegExp(BANK_NAMES.join('|'), 'g');

export function redactBankNames(text: string): string {
  if (!text) return text;
  return text.replace(BANK_NAME_REGEX, '[XX银行]');
}
