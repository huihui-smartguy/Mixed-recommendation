import type { Product, UserProfile } from '@/types';

export const mockProfiles: UserProfile[] = [
  {
    id: 'CUST-A',
    displayName: '客户A · 稳健型',
    riskLevel: 'C3',
    aum: 1_280_000,
    age: 42,
    preferenceTags: ['稳健', '权益偏低', '债券为主']
  },
  {
    id: 'CUST-B',
    displayName: '客户B · 平衡型',
    riskLevel: 'C4',
    aum: 3_600_000,
    age: 36,
    preferenceTags: ['股债平衡', '关注红利', '可接受波动']
  },
  {
    id: 'CUST-C',
    displayName: '客户C · 进取型',
    riskLevel: 'C5',
    aum: 8_400_000,
    age: 31,
    preferenceTags: ['权益主导', '科技成长', '海外配置']
  }
];

export const mockProductPool: Product[] = [
  {
    code: '000961',
    name: '天弘沪深300ETF联接A',
    category: '宽基指数',
    netValue: 1.6234,
    changePct: 0.82,
    return1y: 12.4,
    return3y: 26.1,
    maxDrawdown: -18.2,
    sharpe: 0.74,
    sparkline: [1.0, 1.02, 0.98, 1.05, 1.08, 1.04, 1.11, 1.15, 1.13, 1.18, 1.22, 1.2],
    reason: '锚定核心资产，估值分位低于近五年中位数'
  },
  {
    code: '003376',
    name: '汇添富中债3-5年政策金融债',
    category: '中长期纯债',
    netValue: 1.1428,
    changePct: 0.04,
    return1y: 4.7,
    return3y: 14.9,
    maxDrawdown: -1.8,
    sharpe: 1.32,
    sparkline: [1.0, 1.005, 1.012, 1.018, 1.024, 1.03, 1.036, 1.04, 1.045, 1.05, 1.058, 1.063],
    reason: '提供组合压舱石作用，久期适中、违约风险低'
  },
  {
    code: '161725',
    name: '招商中证白酒指数(LOF)',
    category: '行业主题',
    netValue: 0.8421,
    changePct: -1.42,
    return1y: -8.1,
    return3y: -12.4,
    maxDrawdown: -42.5,
    sharpe: -0.18,
    sparkline: [1.0, 0.96, 1.04, 0.92, 0.85, 0.88, 0.81, 0.78, 0.83, 0.79, 0.82, 0.84],
    reason: '估值已处于历史底部区间，适合左侧逢低分批'
  },
  {
    code: '513100',
    name: '国泰纳斯达克100ETF',
    category: 'QDII · 海外权益',
    netValue: 4.5621,
    changePct: 1.65,
    return1y: 28.6,
    return3y: 64.2,
    maxDrawdown: -33.1,
    sharpe: 0.96,
    sparkline: [1.0, 1.05, 1.12, 1.08, 1.18, 1.25, 1.32, 1.28, 1.4, 1.45, 1.5, 1.56],
    reason: '配置全球科技龙头，对冲单一市场系统性风险'
  },
  {
    code: '518880',
    name: '华安黄金易ETF',
    category: '商品 · 黄金',
    netValue: 5.4123,
    changePct: 0.58,
    return1y: 18.2,
    return3y: 42.5,
    maxDrawdown: -12.4,
    sharpe: 1.08,
    sparkline: [1.0, 1.04, 1.06, 1.08, 1.12, 1.15, 1.18, 1.22, 1.26, 1.3, 1.33, 1.36],
    reason: '抗通胀与避险属性，与权益资产相关性较低'
  },
  {
    code: '180202',
    name: '南方红利低波50ETF',
    category: '红利策略',
    netValue: 1.4218,
    changePct: 0.36,
    return1y: 9.8,
    return3y: 22.7,
    maxDrawdown: -14.6,
    sharpe: 0.82,
    sparkline: [1.0, 1.01, 1.03, 1.04, 1.05, 1.07, 1.08, 1.1, 1.12, 1.13, 1.15, 1.16],
    reason: '高股息+低波动，匹配稳健型客户现金流诉求'
  }
];
