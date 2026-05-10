import type { Product, UserProfile } from '../types';
import { buildOnerecUserProfile } from '../utils/profilePrompt';

/**
 * 5 位 mock 客户 —— 与 docs/customer_sample.md 的样本数据一一对应。
 *
 * 每个客户：
 *   - id / uid 直接采用 onerec 协议的 10 位 Cust_Id
 *   - holdings 来自 customer_sample.md 的 Hold_Market_Val_1~6 + 累计总收益
 *   - user_profile 由 buildOnerecUserProfile() 自动从结构化字段合成，与
 *     onerec /v1/completions 的 prompt 字符串一字不差
 *
 * 这套 5 人池同时服务于：
 *   · 生成式推荐 — useReportStore.startGeneration(profile) 读取
 *   · 交互式推荐 — useProfileStore 读取，做对话上下文锚点
 */

interface CustomerSeed
  extends Omit<UserProfile, 'displayName' | 'user_profile' | 'preferenceTags'> {
  preferenceTags?: string[];
  displayNameSuffix?: string;
}

const RISK_LABEL: Record<string, string> = {
  R1: '保守型',
  R2: '稳健型',
  R3: '平衡型',
  R4: '进取型',
  R5: '激进型'
};

function inferPreferences(p: CustomerSeed): string[] {
  const h = p.holdings;
  if (!h) return [];
  const total = h.cash + h.fixed_income + h.equity + h.insurance + h.alternative + h.other;
  const tags: string[] = [];
  if (total > 0) {
    if (h.cash / total > 0.25) tags.push('现金管理为主');
    if (h.fixed_income / total > 0.25) tags.push('固收偏好');
    if (h.equity / total > 0.18) tags.push('权益占比较高');
    if (h.insurance / total > 0.1) tags.push('注重保障');
    if (h.alternative / total > 0.05) tags.push('涉足另类');
  }
  if (p.riskLevel === 'R1' || p.riskLevel === 'R2') tags.push('稳健');
  if (p.riskLevel === 'R5') tags.push('追求高弹性');
  if ((p.invest_expre ?? '').includes('10年')) tags.push('资深投资人');
  return [...new Set(tags)];
}

function fromSeed(seed: CustomerSeed): UserProfile {
  const profile: UserProfile = {
    ...seed,
    preferenceTags: seed.preferenceTags ?? inferPreferences(seed),
    displayName: `${seed.name}${seed.displayNameSuffix ?? ` · ${RISK_LABEL[seed.riskLevel]}`}`,
    user_profile: '' // 占位，下面填
  };
  // 用结构化字段合成 onerec 端的 prompt 字符串
  profile.user_profile = buildOnerecUserProfile(profile);
  return profile;
}

const _seeds: CustomerSeed[] = [
  // Cust_Id 1000000001 R3-平衡型 男 43 大专 1-3年 总335.2万 收益5.8% 无贷款 VIP3
  {
    id: '1000000001',
    uid: '1000000001',
    name: '陈建国',
    riskLevel: 'R3',
    age: 43,
    gender: '男',
    vocation_cd: 108,
    indus_cd: 208,
    edu_degree: '大专',
    invest_expre: '1-3年',
    aum: 3_352_000,
    holdings: {
      cash: 1_090_000,
      fixed_income: 271_000,
      equity: 147_000,
      insurance: 108_000,
      alternative: 98_000,
      other: 56_000,
      total_profit: 194_000
    },
    profit_rate: 5.8,
    y_income: 1_260_000,
    retail_lev: 'VIP3',
    repay_mode: '无',
    hist_products:
      '<|sid_begin|><s_a_4200><s_b_600><s_c_4580><|sid_end|>: 产品 P01592 属于理财-短期理财，' +
      '风险等级R2，持有市值 67502.00，总收益 8852.00。 ' +
      '<|sid_begin|><s_a_2610><s_b_1283><s_c_8182><|sid_end|>: 产品 P01129 属于基金-混合基金，' +
      '风险等级R3，持有市值 51887.00，总收益 1958.00。'
  },
  // Cust_Id 1000000002 R4-进取型 女 46 本科 10年以上 总589.3万 收益2.9% 消费贷 VIP3
  {
    id: '1000000002',
    uid: '1000000002',
    name: '苏雅婷',
    riskLevel: 'R4',
    age: 46,
    gender: '女',
    vocation_cd: 124,
    indus_cd: 215,
    edu_degree: '本科',
    invest_expre: '10年以上',
    aum: 5_893_000,
    holdings: {
      cash: 2_744_000,
      fixed_income: 1_851_000,
      equity: 1_348_000,
      insurance: 546_000,
      alternative: 382_000,
      other: 61_000,
      total_profit: 171_000
    },
    profit_rate: 2.9,
    y_income: 2_490_000,
    retail_lev: 'VIP3',
    repay_mode: '消费贷',
    hist_products:
      '<|sid_begin|><s_a_1661><s_b_2479><s_c_1254><|sid_end|>: 产品 P01257 属于理财-中期理财，' +
      '风险等级R3，持有市值 160689.00，总收益 17383.00。 ' +
      '<|sid_begin|><s_a_4200><s_b_1283><s_c_5446><|sid_end|>: 产品 P00611 属于基金-指数基金，' +
      '风险等级R4，持有市值 120791.00，总收益 4323.00。'
  },
  // Cust_Id 1000000004 R2-稳健型 男 46 硕士 10年以上 总138.2万 收益4.8% 信用贷 VIP1
  {
    id: '1000000004',
    uid: '1000000004',
    name: '李文博',
    riskLevel: 'R2',
    age: 46,
    gender: '男',
    vocation_cd: 116,
    indus_cd: 203,
    edu_degree: '硕士',
    invest_expre: '10年以上',
    aum: 1_382_000,
    holdings: {
      cash: 944_000,
      fixed_income: 418_000,
      equity: 96_000,
      insurance: 89_000,
      alternative: 47_000,
      other: 13_000,
      total_profit: 66_000
    },
    profit_rate: 4.8,
    y_income: 680_000,
    retail_lev: 'VIP1',
    repay_mode: '信用贷',
    hist_products:
      '<|sid_begin|><s_a_4200><s_b_4828><s_c_4580><|sid_end|>: 产品 P04431 属于理财-短期理财，' +
      '风险等级R2，持有市值 35796.00，总收益 6036.00。 ' +
      '<|sid_begin|><s_a_2610><s_b_2164><s_c_833><|sid_end|>: 产品 P00837 属于基金-股票基金，' +
      '风险等级R3，持有市值 27167.00，总收益 179.00。'
  },
  // Cust_Id 1000000008 R5-激进型 男 55 本科 10年以上 总1882.9万 收益5.9% 组合贷 VIP6
  {
    id: '1000000008',
    uid: '1000000008',
    name: '王志远',
    riskLevel: 'R5',
    age: 55,
    gender: '男',
    vocation_cd: 114,
    indus_cd: 216,
    edu_degree: '本科',
    invest_expre: '10年以上',
    aum: 18_829_000,
    holdings: {
      cash: 2_508_000,
      fixed_income: 2_866_000,
      equity: 2_838_000,
      insurance: 1_264_000,
      alternative: 428_000,
      other: 448_000,
      total_profit: 1_111_000
    },
    profit_rate: 5.9,
    y_income: 7_650_000,
    retail_lev: 'VIP6',
    repay_mode: '组合贷',
    hist_products:
      '<|sid_begin|><s_a_4200><s_b_7077><s_c_4195><|sid_end|>: 产品 P01740 属于基金-ETF基金，' +
      '风险等级R5，持有市值 364925.00，总收益 14140.00。 ' +
      '<|sid_begin|><s_a_8006><s_b_1283><s_c_7661><|sid_end|>: 产品 P00734 属于理财-长期理财，' +
      '风险等级R3，持有市值 636724.00，总收益 50896.00。'
  },
  // Cust_Id 1000000011 R1-保守型 女 29 本科 1-3年 总98.6万 收益4.9% 组合贷 VIP1
  {
    id: '1000000011',
    uid: '1000000011',
    name: '周晓菲',
    riskLevel: 'R1',
    age: 29,
    gender: '女',
    vocation_cd: 102,
    indus_cd: 201,
    edu_degree: '本科',
    invest_expre: '1-3年',
    aum: 986_000,
    holdings: {
      cash: 333_000,
      fixed_income: 121_000,
      equity: 0,
      insurance: 0,
      alternative: 0,
      other: 0,
      total_profit: 49_000
    },
    profit_rate: 4.9,
    y_income: 300_000,
    retail_lev: 'VIP1',
    repay_mode: '组合贷',
    hist_products:
      '<|sid_begin|><s_a_2610><s_b_3184><s_c_1857><|sid_end|>: 产品 P00863 属于理财-结构性存款，' +
      '风险等级R1，持有市值 17252.00，总收益 2019.00。 ' +
      '<|sid_begin|><s_a_4200><s_b_600><s_c_4580><|sid_end|>: 产品 P03489 属于基金-货币基金，' +
      '风险等级R1，持有市值 17042.00，总收益 737.00。'
  }
];

export const mockProfiles: UserProfile[] = _seeds.map(fromSeed);

export const mockProductPool: Product[] = [
  {
    code: 'P01129',
    name: '混合基金（成长股选）',
    category: '基金 · 混合基金',
    netValue: 1.04,
    changePct: 0.38,
    return1y: 12.4,
    return3y: 26.1,
    maxDrawdown: -18.2,
    sharpe: 0.74,
    sparkline: [1.0, 1.02, 0.98, 1.05, 1.08, 1.04, 1.11, 1.15, 1.13, 1.18, 1.22, 1.2],
    reason: '锚定核心资产，估值分位低于近五年中位数'
  },
  {
    code: 'P01592',
    name: '短期理财（稳健季季利）',
    category: '理财 · 短期理财',
    netValue: 1.0103,
    changePct: 0.04,
    return1y: 4.7,
    return3y: 14.9,
    maxDrawdown: -1.8,
    sharpe: 1.32,
    sparkline: [1.0, 1.005, 1.012, 1.018, 1.024, 1.03, 1.036, 1.04, 1.045, 1.05, 1.058, 1.063],
    reason: '组合压舱石，久期适中、违约风险低'
  },
  {
    code: 'P00837',
    name: '股票基金（消费机遇）',
    category: '基金 · 股票基金',
    netValue: 1.0124,
    changePct: -0.42,
    return1y: -2.1,
    return3y: -4.4,
    maxDrawdown: -22.5,
    sharpe: 0.18,
    sparkline: [1.0, 0.96, 1.04, 0.92, 0.85, 0.88, 0.81, 0.78, 0.83, 0.79, 0.82, 0.84],
    reason: '估值已处于历史底部区间，左侧逢低分批'
  },
  {
    code: 'P03771',
    name: 'ETF基金（纳斯达克100跨境）',
    category: '基金 · ETF · 海外权益',
    netValue: 1.0448,
    changePct: 1.65,
    return1y: 28.6,
    return3y: 64.2,
    maxDrawdown: -33.1,
    sharpe: 0.96,
    sparkline: [1.0, 1.05, 1.12, 1.08, 1.18, 1.25, 1.32, 1.28, 1.4, 1.45, 1.5, 1.56],
    reason: '配置全球科技龙头，对冲单一市场系统性风险'
  },
  {
    code: 'P02382',
    name: 'FOF基金（黄金主题）',
    category: '基金 · FOF',
    netValue: 1.0147,
    changePct: 0.58,
    return1y: 18.2,
    return3y: 42.5,
    maxDrawdown: -12.4,
    sharpe: 1.08,
    sparkline: [1.0, 1.04, 1.06, 1.08, 1.12, 1.15, 1.18, 1.22, 1.26, 1.3, 1.33, 1.36],
    reason: '抗通胀与避险属性，与权益资产相关性较低'
  },
  {
    code: 'P02174',
    name: '大额存单（180 天封闭）',
    category: '理财 · 大额存单',
    netValue: 1.0317,
    changePct: 0.36,
    return1y: 3.1,
    return3y: 9.4,
    maxDrawdown: -0.6,
    sharpe: 1.82,
    sparkline: [1.0, 1.01, 1.03, 1.04, 1.05, 1.07, 1.08, 1.1, 1.12, 1.13, 1.15, 1.16],
    reason: '锁定中短期收益，匹配稳健客户现金流诉求'
  }
];
