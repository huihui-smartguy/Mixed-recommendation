import type { UserProfile } from '../types';

/**
 * 把结构化的 UserProfile 合成成 onerec /v1/completions 端的 prompt 字符串
 * （即 user_profile 描述串）。
 *
 * 输出格式严格对齐 docs/request.md / docs/onerec_example.md：
 *   "客户风险等级R3，金融资产总额335.20万元。已投资资产335.20万元，
 *    其中现金管理类109.00万元、固定收益类27.10万元、权益类14.70万元、
 *    保障类10.80万元、另类9.80万元、其他5.60万元。
 *    累计总收益19.40万元。
 *    该客户 年龄43，职业108.00，性别男，学历大专，投资经验1-3年。"
 *
 * 使用场景：
 *   1) src/services/mockData.ts 启动时同步合成各客户的 user_profile
 *   2) backend/onerec_service/app/recommender.py 接入真实 onerec 时，本函数用于
 *      把 BFF 拉到的客户特征拼成 prompt 后下发 /v1/completions
 *   3) 当上游 onerec 没有返回 user_profile 时，本地兜底再合成一份
 */
export function buildOnerecUserProfile(p: UserProfile): string {
  const wan = (n: number) => (n / 10000).toFixed(2);
  const h = p.holdings;
  const aumWan = wan(p.aum);
  const totalInvested = h
    ? h.cash + h.fixed_income + h.equity + h.insurance + h.alternative + h.other
    : p.aum;
  const totalProfit = h ? wan(h.total_profit) : '0.00';

  const cash = h ? wan(h.cash) : '0.00';
  const fi = h ? wan(h.fixed_income) : '0.00';
  const eq = h ? wan(h.equity) : '0.00';
  const ins = h ? wan(h.insurance) : '0.00';
  const alt = h ? wan(h.alternative) : '0.00';
  const other = h ? wan(h.other) : '0.00';

  const vocation = p.vocation_cd != null ? `${p.vocation_cd}.00` : '未知';
  const gender = p.gender ?? '未知';
  const edu = p.edu_degree ?? '未知';
  const exp = p.invest_expre ?? '未知';

  return (
    `客户风险等级${p.riskLevel}，金融资产总额${aumWan}万元。` +
    `已投资资产${wan(totalInvested)}万元，` +
    `其中现金管理类${cash}万元、固定收益类${fi}万元、权益类${eq}万元、` +
    `保障类${ins}万元、另类${alt}万元、其他${other}万元。` +
    `累计总收益${totalProfit}万元。` +
    `该客户 年龄${p.age}，职业${vocation}，性别${gender}，学历${edu}，投资经验${exp}。`
  );
}

export interface OnerecCompletionRequest {
  model: string;
  prompt: string;
  max_tokens: number;
  temperature: number;
  top_p: number;
  n: number;
  frequency_penalty: number;
  presence_penalty: number;
}

/**
 * 构造完整的 onerec /v1/completions 请求体（POST body）。
 * 默认参数沿用 docs/request.md 的样例值；上层可以覆盖。
 */
export function buildOnerecCompletionRequest(
  p: UserProfile,
  overrides: Partial<OnerecCompletionRequest> = {}
): OnerecCompletionRequest {
  return {
    model: 'OneRec-8B-full-tunning',
    prompt: p.user_profile ?? buildOnerecUserProfile(p),
    max_tokens: 512,
    temperature: 0.9,
    top_p: 0.95,
    n: 3,
    frequency_penalty: 0.5,
    presence_penalty: 0.5,
    ...overrides
  };
}
