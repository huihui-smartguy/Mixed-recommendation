import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Segmented, Space, Tag } from 'antd';
import {
  SendOutlined,
  StopOutlined,
  SwapOutlined,
  ClearOutlined,
  DesktopOutlined,
  MobileOutlined
} from '@ant-design/icons';
import { useChatStore } from '@/stores/useChatStore';
import type { Product } from '@/types';
import ChatBubble, { type ChatViewMode } from './ChatBubble';
import CompareDrawer from './CompareDrawer';
import ThinkingSidebar from './ThinkingSidebar';
import ProductSheet from './ProductSheet';

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
  const [viewMode, setViewMode] = useState<ChatViewMode>('pc');
  const [sheetProduct, setSheetProduct] = useState<Product | null>(null);
  const streamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = streamRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, viewMode]);

  const submit = () => {
    if (!input.trim() || streaming) return;
    void send(input);
    setInput('');
  };

  const composer = (
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
          placeholder={
            viewMode === 'mobile'
              ? '提问后会以单列气泡流呈现，Enter 发送'
              : '向 AI 助手提问，Enter 发送，Shift+Enter 换行'
          }
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
  );

  const stream = (
    <div className="chat-stream" ref={streamRef}>
      {messages.map((m) => (
        <ChatBubble
          key={m.id}
          message={m}
          viewMode={viewMode}
          selectedCompare={selectedCompare}
          onToggleCompare={toggleCompare}
          onFollowupPick={(s) => setInput(s)}
          onProductOpen={(p) => setSheetProduct(p)}
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
  );

  return (
    <div className="chat-mode-shell">
      <div className="chat-mode-toolbar">
        <Segmented
          value={viewMode}
          onChange={(v) => setViewMode(v as ChatViewMode)}
          options={[
            { label: '电脑端', value: 'pc', icon: <DesktopOutlined /> },
            { label: '手机端', value: 'mobile', icon: <MobileOutlined /> }
          ]}
        />
        <span className="toolbar-hint">
          {viewMode === 'pc'
            ? '宽幅布局：左侧主干气泡流，右侧常驻 AI 思维链'
            : '竖屏单列气泡流；多卡横向滑动；点 [引用] 拉起半屏抽屉'}
        </span>
      </div>

      {viewMode === 'pc' ? (
        <div className="chat-shell pc-layout">
          <div className="chat-main">
            {stream}
            {composer}
          </div>
          <ThinkingSidebar messages={messages} />
        </div>
      ) : (
        <div className="mobile-frame-wrap">
          <div className="mobile-bezel">
            <div className="mobile-screen">
              <div className="chat-shell mobile-layout">
                {stream}
                {composer}
              </div>
            </div>
          </div>
        </div>
      )}

      <CompareDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        products={selectedCompare}
      />

      <ProductSheet
        open={!!sheetProduct}
        product={sheetProduct}
        selectedCompare={selectedCompare}
        onToggleCompare={toggleCompare}
        onClose={() => setSheetProduct(null)}
      />
    </div>
  );
}
