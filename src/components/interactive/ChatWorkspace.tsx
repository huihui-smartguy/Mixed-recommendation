import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Space, Tag } from 'antd';
import { SendOutlined, StopOutlined, SwapOutlined, ClearOutlined } from '@ant-design/icons';
import { useChatStore } from '@/stores/useChatStore';
import ChatBubble from './ChatBubble';
import CompareDrawer from './CompareDrawer';

const PROMPT_CHIPS = [
  '稳健型客户下半年怎么配？',
  '纳指QDII现在还能上车吗？',
  '金价创新高，黄金怎么操作？',
  '高股息+低波动有什么标的？'
];

export default function ChatWorkspace() {
  const {
    messages,
    streaming,
    selectedCompare,
    bannedHits,
    send,
    cancel,
    toggleCompare,
    clearCompare,
    clearBannedHits,
    reset
  } = useChatStore();

  const [input, setInput] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const streamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = streamRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const submit = () => {
    if (!input.trim() || streaming) return;
    void send(input);
    setInput('');
  };

  return (
    <div className="chat-shell">
      <div className="chat-stream" ref={streamRef}>
        {messages.map((m) => (
          <ChatBubble
            key={m.id}
            message={m}
            selectedCompare={selectedCompare}
            onToggleCompare={toggleCompare}
          />
        ))}

        {selectedCompare.length > 0 && (
          <div className="compare-bar">
            <SwapOutlined />
            <span>已选 {selectedCompare.length} 项：</span>
            <Space size={4} wrap>
              {selectedCompare.map((p) => (
                <Tag
                  key={p.code}
                  closable
                  color="processing"
                  onClose={() => toggleCompare(p)}
                >
                  {p.name}
                </Tag>
              ))}
            </Space>
            <span style={{ flex: 1 }} />
            <Button size="small" type="primary" onClick={() => setDrawerOpen(true)}>
              对比
            </Button>
            <Button size="small" type="text" style={{ color: '#fff' }} onClick={clearCompare}>
              清空
            </Button>
          </div>
        )}
      </div>

      <div className="chat-input-area">
        {bannedHits.length > 0 && (
          <Alert
            type="error"
            showIcon
            closable
            onClose={clearBannedHits}
            message={`本地风控拦截：检测到敏感词「${bannedHits.join('、')}」，请调整后再发送`}
          />
        )}
        <div className="prompt-chips">
          {PROMPT_CHIPS.map((c) => (
            <Tag.CheckableTag
              key={c}
              checked={false}
              onChange={() => setInput(c)}
            >
              {c}
            </Tag.CheckableTag>
          ))}
          <span style={{ flex: 1 }} />
          <Button
            size="small"
            type="text"
            icon={<ClearOutlined />}
            onClick={reset}
            disabled={streaming}
          >
            清空对话
          </Button>
        </div>
        <div className="compose">
          <textarea
            placeholder="向 AI 助手提问，Enter 发送，Shift+Enter 换行"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            disabled={streaming}
          />
          {streaming ? (
            <Button danger icon={<StopOutlined />} onClick={cancel}>
              停止
            </Button>
          ) : (
            <Button type="primary" icon={<SendOutlined />} onClick={submit}>
              发送
            </Button>
          )}
        </div>
      </div>

      <CompareDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        products={selectedCompare}
      />
    </div>
  );
}
