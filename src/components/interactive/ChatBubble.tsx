import { Tag } from 'antd';
import { BulbOutlined } from '@ant-design/icons';
import type { ChatMessage, Product } from '@/types';
import FundCard from './FundCard';
import ThinkingAccordion from './ThinkingAccordion';

export type ChatViewMode = 'pc' | 'mobile';

interface Props {
  message: ChatMessage;
  selectedCompare: Product[];
  viewMode: ChatViewMode;
  onToggleCompare: (p: Product) => void;
  /** 智能追问被点击时回填到输入框 */
  onFollowupPick?: (suggestion: string) => void;
  /** 移动端：点击产品卡或引用角标时拉起底抽屉 */
  onProductOpen?: (p: Product) => void;
}

/**
 * 渲染策略：
 *  · PC 模式 — 思维链由右侧 ThinkingSidebar 常驻展示，气泡内不再重复
 *  · Mobile 模式 — 单列瀑布流；trailing_rec 多于 1 条 → 横向 Swiper；
 *                 FundCard 用引用徽章 [n] 替代，点击拉起 Bottom Sheet
 */
export default function ChatBubble({
  message,
  selectedCompare,
  viewMode,
  onToggleCompare,
  onFollowupPick,
  onProductOpen
}: Props) {
  if (message.role === 'user') {
    const text = message.chunks.map((c) => c.content ?? '').join('');
    return <div className="bubble user">{text}</div>;
  }

  // 拆分 thinking / 其余可见 chunks
  const thinking: string[] = [];
  const visible: typeof message.chunks = [];
  for (const c of message.chunks) {
    if (c.type === 'thinking') {
      if (c.content) thinking.push(c.content);
    } else {
      visible.push(c);
    }
  }

  const lastTextIdx = [...visible].map((c) => c.type).lastIndexOf('text');

  // 移动端：把所有 widget 收集为引用列表，气泡内只渲染 [n]
  const isMobile = viewMode === 'mobile';
  const widgetCitations: Product[] = isMobile
    ? visible.filter((c) => c.type === 'widget' && c.data).map((c) => c.data as Product)
    : [];
  const widgetIndex = new Map<string, number>();
  widgetCitations.forEach((p, i) => widgetIndex.set(p.code, i + 1));

  return (
    <>
      {/* PC 模式：思维链不在气泡内显示（已经在右侧栏） */}
      {!isMobile && (
        <ThinkingAccordion
          steps={thinking}
          active={message.streaming && visible.length === 0}
        />
      )}

      {visible.length > 0 && (
        <div className="bubble assistant">
          {visible.map((c, i) => {
            if (c.type === 'text') {
              const isLast = i === lastTextIdx && message.streaming;
              return (
                <span key={c.id} className={isLast ? 'cursor' : undefined}>
                  {c.content}
                </span>
              );
            }
            if (c.type === 'widget' && c.data) {
              const product = c.data;
              if (isMobile) {
                const idx = widgetIndex.get(product.code) ?? 1;
                return (
                  <span
                    key={c.id}
                    className="citation-chip"
                    role="button"
                    tabIndex={0}
                    onClick={() => onProductOpen?.(product)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') onProductOpen?.(product);
                    }}
                    title={`查看 ${product.name} 详情`}
                  >
                    [{idx}] {product.name}
                  </span>
                );
              }
              const selected = selectedCompare.some((x) => x.code === product.code);
              return (
                <FundCard
                  key={c.id}
                  product={product}
                  selected={selected}
                  onToggle={onToggleCompare}
                />
              );
            }
            if (c.type === 'trailing_rec' && c.products && c.products.length > 0) {
              const products = c.products;
              if (isMobile && products.length > 1) {
                return (
                  <div key={c.id} className="trailing-rec">
                    <div className="trailing-rec-title">{c.title ?? '尾随推荐'}</div>
                    <div className="mobile-swiper">
                      {products.map((p) => {
                        const selected = selectedCompare.some((x) => x.code === p.code);
                        return (
                          <div key={p.code} className="swiper-slide">
                            <FundCard
                              product={p}
                              selected={selected}
                              onToggle={onToggleCompare}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="swiper-hint">← 左右滑动浏览 {products.length} 项 →</div>
                  </div>
                );
              }
              return (
                <div key={c.id} className="trailing-rec">
                  <div className="trailing-rec-title">{c.title ?? '尾随推荐'}</div>
                  {products.map((p) => {
                    const selected = selectedCompare.some((x) => x.code === p.code);
                    return (
                      <FundCard
                        key={p.code}
                        product={p}
                        selected={selected}
                        onToggle={onToggleCompare}
                      />
                    );
                  })}
                </div>
              );
            }
            if (c.type === 'followup' && c.suggestions && c.suggestions.length > 0) {
              return (
                <div key={c.id} className="followup">
                  <div className="followup-title">
                    <BulbOutlined /> 您可能想继续追问
                  </div>
                  <div className="followup-chips">
                    {c.suggestions.map((s) => (
                      <Tag.CheckableTag
                        key={s}
                        checked={false}
                        onChange={() => onFollowupPick?.(s)}
                      >
                        {s}
                      </Tag.CheckableTag>
                    ))}
                  </div>
                </div>
              );
            }
            return null;
          })}
        </div>
      )}
    </>
  );
}
