import type { Product } from '@/types';

/**
 * onerec 适配器 (Anti-Corruption Layer)
 *
 * 真实 onerec 后端返回字段命名风格各异（snake_case、嵌套对象、字符串数字…），
 * 本适配器把任意 raw 数据清洗成标准化 Product[]：
 *   - 强制必备字段 (code, name) 缺失即丢弃
 *   - 数值字段用 toFiniteNumber 兜底（NaN/null/'' → 默认值）
 *   - sparkline 长度归一到 [4, 64]，过短补齐，过长抽样
 *   - 同一 code 去重，保留首条
 *   - reason 为空时给出降级文案
 *
 * 该函数纯函数，无副作用，便于 Jest/Vitest 覆盖。
 */

interface OnerecRawItem {
  code?: unknown;
  product_code?: unknown;
  name?: unknown;
  product_name?: unknown;
  category?: unknown;
  type?: unknown;
  net_value?: unknown;
  netValue?: unknown;
  change_pct?: unknown;
  changePct?: unknown;
  return_1y?: unknown;
  return1y?: unknown;
  return_3y?: unknown;
  return3y?: unknown;
  max_drawdown?: unknown;
  maxDrawdown?: unknown;
  sharpe?: unknown;
  sparkline?: unknown;
  spark?: unknown;
  reason?: unknown;
  recommendation?: unknown;
}

const SPARK_MIN = 4;
const SPARK_MAX = 64;

export function toFiniteNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (!trimmed) return fallback;
    const n = Number(trimmed.replace(/[%,_\s]/g, ''));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function pickString(...values: unknown[]): string | undefined {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

function normalizeSparkline(raw: unknown): number[] {
  if (!Array.isArray(raw)) return Array(SPARK_MIN).fill(1);
  const cleaned = raw
    .map((x) => toFiniteNumber(x, NaN))
    .filter((n) => Number.isFinite(n));
  if (cleaned.length === 0) return Array(SPARK_MIN).fill(1);
  if (cleaned.length < SPARK_MIN) {
    // 用首值补齐
    return [
      ...Array(SPARK_MIN - cleaned.length).fill(cleaned[0]),
      ...cleaned
    ];
  }
  if (cleaned.length > SPARK_MAX) {
    // 等距抽样
    const step = cleaned.length / SPARK_MAX;
    const sampled: number[] = [];
    for (let i = 0; i < SPARK_MAX; i++) sampled.push(cleaned[Math.floor(i * step)]);
    return sampled;
  }
  return cleaned;
}

export function normalizeOnerecResponse(raw: unknown): Product[] {
  // 1) 真实 onerec 返回形态：{ uid, user_profile, recommendations_by_type: { 基金: {...}, 理财: {...} } }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if (obj.recommendations_by_type && typeof obj.recommendations_by_type === 'object') {
      return parseRecommendationsByType(obj.recommendations_by_type as Record<string, unknown>);
    }
    // 包了一层 items 的扁平形态（常见兼容写法）
    if (Array.isArray(obj.items)) return normalizeFlatArray(obj.items);
  }

  // 2) 旧形态：直接是 Product-like 对象数组
  if (Array.isArray(raw)) return normalizeFlatArray(raw);
  return [];
}

/** 真实 onerec 形态：把 recommendations_by_type 解析成 Product[]。
 *  recommended_pids[i] 与 recommended_texts[i] 一一对应；
 *  texts 形如 "FOF - 基金类产品，风险等级为R3，产品名称为ESG责任号。历史收益水平(%)2.1。"
 *  我们用正则把 name / 风险 / 历史收益 拽出来，category 用 hash key（基金/理财）+ 类型前缀。 */
function parseRecommendationsByType(map: Record<string, unknown>): Product[] {
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const [bigCategory, group] of Object.entries(map)) {
    if (!group || typeof group !== 'object') continue;
    const g = group as Record<string, unknown>;
    const pids = Array.isArray(g.recommended_pids) ? (g.recommended_pids as unknown[]) : [];
    const texts = Array.isArray(g.recommended_texts) ? (g.recommended_texts as unknown[]) : [];
    const sims = Array.isArray(g.similarity) ? (g.similarity as unknown[]) : [];
    pids.forEach((pidRaw, i) => {
      const code = typeof pidRaw === 'string' ? pidRaw.trim() : '';
      if (!code || seen.has(code)) return;
      const text = typeof texts[i] === 'string' ? (texts[i] as string).trim() : '';
      const nameMatch = text.match(/产品名称为([^。]+)/);
      const riskMatch = text.match(/风险等级为(R\d)/);
      const yieldMatch = text.match(/历史收益水平\(%\)\s*([\d.]+)/);
      const subCat = text.split(/[-,，]/)[0].trim() || bigCategory;
      seen.add(code);
      out.push({
        code,
        name: (nameMatch ? nameMatch[1].trim() : code).replace(/[（(][^）)]*[）)]/g, ''),
        category: `${bigCategory} · ${subCat}${riskMatch ? ` · ${riskMatch[1]}` : ''}`,
        netValue: 1,
        changePct: 0,
        return1y: yieldMatch ? toFiniteNumber(yieldMatch[1], 0) : 0,
        return3y: 0,
        maxDrawdown: 0,
        sharpe: typeof sims[i] === 'number' ? (sims[i] as number) : 0,
        sparkline: Array(SPARK_MIN).fill(1),
        reason: text || `由 onerec ${bigCategory} 类型召回`
      });
    });
  }
  return out;
}

/** 旧"扁平 Product-like 数组"形态保持不变，多种字段命名都兼容。 */
function normalizeFlatArray(raw: unknown[]): Product[] {
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const item of raw as OnerecRawItem[]) {
    if (!item || typeof item !== 'object') continue;
    const code = pickString(item.code, item.product_code);
    const name = pickString(item.name, item.product_name);
    if (!code || !name) continue;
    if (seen.has(code)) continue;
    seen.add(code);

    out.push({
      code,
      name,
      category: pickString(item.category, item.type) ?? '其他',
      netValue: toFiniteNumber(item.netValue ?? item.net_value, 1),
      changePct: toFiniteNumber(item.changePct ?? item.change_pct, 0),
      return1y: toFiniteNumber(item.return1y ?? item.return_1y, 0),
      return3y: toFiniteNumber(item.return3y ?? item.return_3y, 0),
      maxDrawdown: toFiniteNumber(item.maxDrawdown ?? item.max_drawdown, 0),
      sharpe: toFiniteNumber(item.sharpe, 0),
      sparkline: normalizeSparkline(item.sparkline ?? item.spark),
      reason: pickString(item.reason, item.recommendation) ?? '由 onerec 召回的候选资产'
    });
  }
  return out;
}

/**
 * 防幻觉守卫：大模型输出中提到的产品代码必须出现在 onerec 召回池中。
 * 不在池内的 code 会被过滤掉，并通过 onDrop 回调上报，便于后端日志。
 */
export function gateProductCodes(
  poolCodes: Iterable<string>,
  candidates: string[],
  onDrop?: (code: string) => void
): string[] {
  const allow = new Set(poolCodes);
  const out: string[] = [];
  for (const c of candidates) {
    if (allow.has(c)) out.push(c);
    else onDrop?.(c);
  }
  return out;
}
