import { useMemo } from 'react';
import { BulbOutlined } from '@ant-design/icons';
import type { ChatMessage } from '@/types';

interface Props {
  messages: ChatMessage[];
}

/**
 * PC 模式下常驻在右侧的"思维链 (Chain of Thought)"面板。
 * 自动锁定到最近一条 assistant 消息：
 *   - 若仍在流式生成 → 顶部红点 + "思考中…"
 *   - 已完成 → 显示完整步骤计数
 * 没有思考链时给出占位提示，避免空白割裂感。
 */
export default function ThinkingSidebar({ messages }: Props) {
  const { steps, streaming } = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== 'assistant') continue;
      const t = m.chunks.filter((c) => c.type === 'thinking' && c.content);
      if (t.length === 0 && !m.streaming) continue;
      return { steps: t.map((c) => c.content as string), streaming: m.streaming };
    }
    return { steps: [] as string[], streaming: false };
  }, [messages]);

  return (
    <aside className="cot-sidebar" aria-label="AI 思维链">
      <div className="cot-sidebar-header">
        <BulbOutlined />
        <span>AI 思维链</span>
        <span className="cot-sidebar-status">
          {streaming ? (
            <>
              <span className="dot" aria-hidden />
              思考中…
            </>
          ) : steps.length > 0 ? (
            `${steps.length} 步`
          ) : (
            '就绪'
          )}
        </span>
      </div>
      <div className="cot-sidebar-body">
        {steps.length === 0 ? (
          <div className="cot-empty">
            提问后，AI 会在此处实时展开
            <br />
            它的推理过程与决策依据。
          </div>
        ) : (
          steps.map((s, i) => (
            <div key={i} className="cot-step">
              {s}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
