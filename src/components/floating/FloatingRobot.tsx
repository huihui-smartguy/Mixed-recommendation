import { useEffect, useRef, useState } from 'react';
import { Tag } from 'antd';
import { CloseOutlined, RobotOutlined, SendOutlined, MinusOutlined } from '@ant-design/icons';
import { useChatStore } from '@/stores/useChatStore';
import ChatBubble from '../interactive/ChatBubble';

const QUICK_PROMPTS = [
  '稳健型客户怎么配？',
  '纳指 QDII 还能上车吗？',
  '金价新高，黄金加仓？'
];

type PanelState = 'closed' | 'mini' | 'open';

/**
 * 浮动机器人 — 类 AI涨乐 / 支付宝小助手
 *
 * 三态：
 *   closed → 仅展示一个圆形机器人按钮
 *   mini   → 弹出问候气泡 + 3 个快捷追问 chip
 *   open   → 完整聊天面板（接入 useChatStore，与主 Tab 共享上下文）
 */
export default function FloatingRobot() {
  const [state, setState] = useState<PanelState>('mini');
  const [input, setInput] = useState('');
  const {
    messages,
    streaming,
    selectedCompare,
    bannedHits,
    send,
    cancel,
    toggleCompare,
    clearBannedHits
  } = useChatStore();
  const streamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state !== 'open') return;
    const el = streamRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, state]);

  // 首次打开自动从 mini 切到 open
  const submit = (text?: string) => {
    const t = (text ?? input).trim();
    if (!t || streaming) return;
    void send(t);
    setInput('');
    setState('open');
  };

  return (
    <div className="floating-robot-root">
      {state === 'closed' && (
        <button
          type="button"
          className="robot-fab"
          aria-label="打开 AI 助手"
          onClick={() => setState('mini')}
        >
          <RobotOutlined />
          <span className="robot-fab-pulse" aria-hidden />
        </button>
      )}

      {state === 'mini' && (
        <div className="robot-mini">
          <button type="button" className="robot-mini-close" aria-label="关闭" onClick={() => setState('closed')}>
            <CloseOutlined />
          </button>
          <div className="robot-mini-avatar">
            <RobotOutlined />
          </div>
          <div className="robot-mini-bubble">
            <div className="robot-mini-greet">
              你好，我是 <strong>小颂</strong>，AI 资产顾问。<br />
              今天想聊点什么？
            </div>
            <div className="robot-mini-chips">
              {QUICK_PROMPTS.map((p) => (
                <Tag.CheckableTag key={p} checked={false} onChange={() => submit(p)}>
                  {p}
                </Tag.CheckableTag>
              ))}
            </div>
            <button
              type="button"
              className="robot-mini-expand"
              onClick={() => setState('open')}
            >
              展开对话 →
            </button>
          </div>
        </div>
      )}

      {state === 'open' && (
        <div className="robot-panel">
          <div className="robot-panel-header">
            <div className="robot-panel-title">
              <RobotOutlined /> 小颂 · AI 资产顾问
            </div>
            <div className="robot-panel-actions">
              <button type="button" aria-label="最小化" onClick={() => setState('mini')}>
                <MinusOutlined />
              </button>
              <button type="button" aria-label="关闭" onClick={() => setState('closed')}>
                <CloseOutlined />
              </button>
            </div>
          </div>
          <div className="robot-panel-stream" ref={streamRef}>
            {messages.map((m) => (
              <ChatBubble
                key={m.id}
                message={m}
                viewMode="pc"
                selectedCompare={selectedCompare}
                onToggleCompare={toggleCompare}
                onFollowupPick={(s) => submit(s)}
              />
            ))}
          </div>
          {bannedHits.length > 0 && (
            <div className="robot-panel-warn" onClick={clearBannedHits}>
              本地风控拦截：「{bannedHits.join('、')}」 · 点击关闭
            </div>
          )}
          <div className="robot-panel-input">
            <input
              type="text"
              placeholder="向小颂提问…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              disabled={streaming}
            />
            {streaming ? (
              <button type="button" className="robot-send" onClick={cancel} aria-label="停止">
                ◼
              </button>
            ) : (
              <button type="button" className="robot-send" onClick={() => submit()} aria-label="发送">
                <SendOutlined />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
