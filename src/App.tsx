import { useState } from 'react';
import { Tabs } from 'antd';
import GlobalHeader from './components/layout/GlobalHeader';
import KeepAlive from './components/layout/KeepAlive';
import ReportWorkspace from './components/generative/ReportWorkspace';
import ChatWorkspace from './components/interactive/ChatWorkspace';
import FloatingRobot from './components/floating/FloatingRobot';
import { DISCLAIMER } from './utils/compliance';

type TabKey = 'report' | 'chat';

export default function App() {
  const [tab, setTab] = useState<TabKey>('report');

  return (
    <div className="app-shell">
      <div className="app-watermark" aria-hidden />
      <GlobalHeader />
      <main className="workspace tabs-shell">
        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as TabKey)}
          size="large"
          items={[
            { key: 'report', label: '生成式推荐 · 深度报告工作台' },
            { key: 'chat', label: '交互式推荐 · AI 动态助手' }
          ]}
        />
        {/* 双 Tab 都常驻挂载，display 控制显隐，实现页面级 Keep-Alive */}
        <KeepAlive active={tab === 'report'}>
          <ReportWorkspace />
        </KeepAlive>
        <KeepAlive active={tab === 'chat'}>
          <ChatWorkspace />
        </KeepAlive>

        <footer className="muted" style={{ marginTop: 24, lineHeight: 1.7 }}>
          <div>⚠ {DISCLAIMER}</div>
          <div>
            合规中心 · 投诉与建议 · 隐私政策 · ©{new Date().getFullYear()} Mixed-Recommendation
          </div>
        </footer>
      </main>

      {/* 全局浮动机器人：常驻所有页签，与对话 store 共享上下文 */}
      <FloatingRobot />
    </div>
  );
}
