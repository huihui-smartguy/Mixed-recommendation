import { useState } from 'react';
import { App as AntdApp, ConfigProvider, Tabs, theme as antdTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import GlobalHeader from './components/layout/GlobalHeader';
import KeepAlive from './components/layout/KeepAlive';
import ReportWorkspace from './components/generative/ReportWorkspace';
import ChatWorkspace from './components/interactive/ChatWorkspace';
import FloatingRobot from './components/floating/FloatingRobot';
import { THEMES, useUIPrefsStore } from './stores/useUIPrefsStore';
import { DISCLAIMER } from './utils/compliance';

type TabKey = 'report' | 'chat';

export default function App() {
  const [tab, setTab] = useState<TabKey>('report');
  const themeKey = useUIPrefsStore((s) => s.theme);
  const robotVisible = useUIPrefsStore((s) => s.robotVisible);
  const tokens = THEMES[themeKey];

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: tokens.colorPrimary,
          colorInfo: tokens.colorPrimary,
          colorLink: tokens.colorPrimaryDark,
          // 金融语义色：红涨绿跌（不动）
          colorSuccess: '#d93333',
          colorError: '#0aa66e',
          colorWarning: '#d99070',
          borderRadius: 12,
          fontFamily:
            '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif'
        },
        components: {
          Tabs: { titleFontSize: 16, horizontalItemPadding: '12px 20px' },
          Button: { primaryShadow: `0 6px 14px ${tokens.shadow}` }
        }
      }}
    >
      <AntdApp>
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
                合规中心 · 投诉与建议 · 隐私政策 · ©{new Date().getFullYear()} DeepRec
              </div>
            </footer>
          </main>

          {/* 全局浮动机器人：常驻所有页签，与对话 store 共享上下文。可在 Header 切换显隐 */}
          {robotVisible && <FloatingRobot />}
        </div>
      </AntdApp>
    </ConfigProvider>
  );
}
