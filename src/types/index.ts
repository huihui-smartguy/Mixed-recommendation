export type RiskLevel = 'R1' | 'R2' | 'R3' | 'R4' | 'R5';

/**
 * 持仓六大类聚合（万元单位 → 元）。与 docs/customer_sample.md 字段一致：
 * Hold_Market_Val_1 ~ Hold_Market_Val_6 + 累计总收益。
 */
export interface ProfileHoldings {
  /** 现金管理类（元） */
  cash: number;
  /** 固定收益类 */
  fixed_income: number;
  /** 权益类 */
  equity: number;
  /** 保障类 */
  insurance: number;
  /** 另类投资 */
  alternative: number;
  /** 其他 */
  other: number;
  /** 累计总收益 */
  total_profit: number;
}

export interface UserProfile {
  /** 与 onerec 协议一致的 uid；保留 id 别名兼容旧代码 */
  id: string;
  uid: string;
  /** 客户真实姓名（用于卡片展示） */
  name: string;
  /** 旧字段：含称谓后缀的展示名，如"客户A · 稳健型"；保留兼容 */
  displayName: string;
  /** onerec 输入端那段画像描述串，作为 LLM 上下文与 UserProfileCard 详情展示。
   *  通常由 src/utils/profilePrompt.ts::buildOnerecUserProfile() 从结构化字段合成 */
  user_profile?: string;
  riskLevel: RiskLevel;
  /** 资产总额（元） */
  aum: number;
  age: number;
  preferenceTags: string[];

  /** 历史持仓串（onerec hist_products），可选；UserProfileCard 二级展开 */
  hist_products?: string;

  /** ↓↓↓ 与 docs/customer_sample.md 对齐的结构化字段 ↓↓↓ */
  /** Gender_Cd 1=男 2=女 */
  gender?: '男' | '女';
  /** Vocation_Cd 职业代码 */
  vocation_cd?: number;
  /** Indus_Cd 行业代码 */
  indus_cd?: number;
  /** Edu_Degree_Cd 学历名称 */
  edu_degree?: '高中及以下' | '大专' | '本科' | '硕士' | '博士及以上';
  /** Invest_Expre 投资经验 */
  invest_expre?: '1-3年' | '3-5年' | '5-10年' | '10年以上';
  /** 各资产类持仓（元） */
  holdings?: ProfileHoldings;
  /** 综合收益率（%） */
  profit_rate?: number;
  /** 年收入（元） */
  y_income?: number;
  /** 客户等级 */
  retail_lev?: 'VIP1' | 'VIP3' | 'VIP6';
  /** 还款方式 */
  repay_mode?: '无' | '消费贷' | '信用贷' | '组合贷';
}

export type AssetClass =
  | 'equity_a'
  | 'equity_hk'
  | 'equity_us'
  | 'bond'
  | 'gold'
  | 'cash'
  | 'qdii'
  | 'reits';

export interface Allocation {
  asset: AssetClass;
  label: string;
  weight: number;
}

export interface Product {
  code: string;
  name: string;
  category: string;
  netValue: number;
  changePct: number;
  return1y: number;
  return3y: number;
  maxDrawdown: number;
  sharpe: number;
  sparkline: number[];
  reason: string;
}

export interface ReportPayload {
  taskId: string;
  title: string;
  generatedAt: string;
  profileSummary: string;
  markdown: string;
  allocations: Allocation[];
  backtest: { dates: string[]; portfolio: number[]; benchmark: number[] };
  products: Product[];
}

export type ReportStage = 'idle' | 'queued' | 'profiling' | 'recall' | 'writing' | 'rendering' | 'done' | 'error';

export interface ReportThinkingEntry {
  /** 思维链来源：reasoning(模型原生) / section(章节进展) / system(中间件埋点) */
  kind: 'reasoning' | 'section' | 'system';
  text: string;
  at: number;
}

export interface ReportTaskState {
  taskId?: string;
  stage: ReportStage;
  stageMessage: string;
  progress: number;
  error?: string;
  payload?: ReportPayload;
  /** 真实后端思维链 —— 由 prodMiddleware 在 LLM 流式期间持续追加 */
  thinkingTrail?: ReportThinkingEntry[];
}

export type ChatRole = 'user' | 'assistant';

export type ChatChunkType =
  | 'thinking'
  | 'text'
  | 'widget'
  | 'followup'
  | 'trailing_rec';

export interface ChatChunk {
  id: string;
  type: ChatChunkType;
  /** type === 'thinking' | 'text' 时使用 */
  content?: string;
  /** type === 'widget' 时使用 */
  widgetName?: 'FundCard';
  data?: Product;
  /** type === 'followup' 时使用 — 智能追问 chip */
  suggestions?: string[];
  /** type === 'trailing_rec' 时使用 — 尾随推荐组 */
  title?: string;
  products?: Product[];
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  createdAt: number;
  streaming: boolean;
  chunks: ChatChunk[];
  selectableProducts?: string[];
}

export interface CompareSelection {
  products: Product[];
}
