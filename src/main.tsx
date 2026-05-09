import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyInitialTheme } from './stores/useUIPrefsStore';
import './styles/global.css';

// 在 React 渲染之前同步设置 <html data-theme="..">，避免首屏闪烁
applyInitialTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
