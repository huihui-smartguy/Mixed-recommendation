import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App as AntdApp, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import './styles/global.css';

const { defaultAlgorithm } = theme;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: defaultAlgorithm,
        token: {
          // 暖色品牌主色（橙红，类 AI涨乐 / 支付宝）
          colorPrimary: '#f97316',
          colorInfo: '#f97316',
          colorLink: '#ea580c',
          // 金融语义色：红涨绿跌（不动）
          colorSuccess: '#d93333',
          colorError: '#0aa66e',
          colorWarning: '#f59e0b',
          // 视觉
          borderRadius: 12,
          colorBgLayout: '#fff7ed',
          fontFamily:
            '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif'
        },
        components: {
          Tabs: { titleFontSize: 16, horizontalItemPadding: '12px 20px' },
          Button: { primaryShadow: '0 6px 14px rgba(239, 68, 68, 0.22)' },
          Tag: {
            defaultBg: '#fff4e6',
            defaultColor: '#7c4a16'
          }
        }
      }}
    >
      <AntdApp>
        <App />
      </AntdApp>
    </ConfigProvider>
  </StrictMode>
);
