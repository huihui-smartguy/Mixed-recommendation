import { Tag } from 'antd';
import { BulbOutlined } from '@ant-design/icons';
import type { ChatMessage, Product } from '@/types';
import FundCard from './FundCard';
import ThinkingAccordion from './ThinkingAccordion';

interface Props {
  message: ChatMessage;
  selectedCompare: Product[];
  onToggleCompare: (p: Product) => void;
  /** 智能追问被点击时回填到输入框 */
  onFollowupPick?: (suggestion: string) => void;
}

export default function ChatBubble({
  message,
  selectedCompare,
  onToggleCompare,
  onFollowupPick
}: Props) {
  if (message.role === 'user') {
    const text = message.chunks.map((c) => c.content ?? '').join('');
    return <div className="bubble user">{text}</div>;
  }

  // 合并相邻的 thinking chunks 形成思考折叠
  const thinking: string[] = [];
  const visible: typeof message.chunks = [];
  for (const c of message.chunks) {
    if (c.type === 'thinking') {
      if (c.content) thinking.push(c.content);
    } else {
      visible.push(c);
    }
  }

  // 是否仍在持续输出（光标显示在最后一段 text 末尾）
  const lastTextIdx = [...visible].map((c) => c.type).lastIndexOf('text');

  return (
    <>
      <ThinkingAccordion steps={thinking} active={message.streaming && visible.length === 0} />
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
              const selected = selectedCompare.some((x) => x.code === c.data!.code);
              return (
                <FundCard
                  key={c.id}
                  product={c.data}
                  selected={selected}
                  onToggle={onToggleCompare}
                />
              );
            }
            if (c.type === 'trailing_rec' && c.products && c.products.length > 0) {
              return (
                <div key={c.id} className="trailing-rec">
                  <div className="trailing-rec-title">{c.title ?? '尾随推荐'}</div>
                  {c.products.map((p) => {
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
