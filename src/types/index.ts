export type RiskLevel = 'C1' | 'C2' | 'C3' | 'C4' | 'C5';

export interface UserProfile {
  /** 与 onerec 协议一致的 uid；保留 id 别名兼容旧代码 */
  id: string;
  uid: string;
  /** 客户真实姓名（用于卡片展示） */
  name: string;
  /** 旧字段：含称谓后缀的展示名，如"客户A · 稳健型"；保留兼容 */
  displayName: string;
  /** onerec 输入端那段画像描述串，作为 LLM 上下文与 UserProfileCard 详情展示 */
  user_profile?: string;
  riskLevel: RiskLevel;
  aum: number;
  age: number;
  preferenceTags: string[];
  /** 历史持仓串（onerec hist_products），可选；UserProfileCard 二级展开 */
  hist_products?: string;
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
