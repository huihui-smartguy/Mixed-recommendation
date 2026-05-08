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
          colorPrimary: '#1f4dff',
          colorInfo: '#1f4dff',
          colorSuccess: '#d93333',
          colorError: '#0aa66e',
          borderRadius: 10,
          fontFamily:
            '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif'
        },
        components: {
          Tabs: { titleFontSize: 16, horizontalItemPadding: '12px 20px' }
        }
      }}
    >
      <AntdApp>
        <App />
      </AntdApp>
    </ConfigProvider>
  </StrictMode>
);
