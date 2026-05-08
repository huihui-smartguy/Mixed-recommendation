export type RiskLevel = 'C1' | 'C2' | 'C3' | 'C4' | 'C5';

export interface UserProfile {
  id: string;
  displayName: string;
  riskLevel: RiskLevel;
  aum: number;
  age: number;
  preferenceTags: string[];
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

export interface ReportTaskState {
  taskId?: string;
  stage: ReportStage;
  stageMessage: string;
  progress: number;
  error?: string;
  payload?: ReportPayload;
}

export type ChatRole = 'user' | 'assistant';

export interface ChatChunk {
  id: string;
  type: 'thinking' | 'text' | 'widget';
  content?: string;
  widgetName?: 'FundCard';
  data?: Product;
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
