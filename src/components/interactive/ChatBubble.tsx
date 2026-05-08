import type { ChatMessage, Product } from '@/types';
import FundCard from './FundCard';
import ThinkingAccordion from './ThinkingAccordion';

interface Props {
  message: ChatMessage;
  selectedCompare: Product[];
  onToggleCompare: (p: Product) => void;
}

export default function ChatBubble({ message, selectedCompare, onToggleCompare }: Props) {
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
            return null;
          })}
        </div>
      )}
    </>
  );
}
