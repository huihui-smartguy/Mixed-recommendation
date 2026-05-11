import { create } from 'zustand';

/**
 * 全局主题与界面偏好。
 *
 * 主题颜色通过 <html data-theme="...">  + global.css 的 :root[data-theme="..."]
 * 复写 CSS 变量来切换；Antd 的 colorPrimary 同步在 App.tsx 里读取本 store 重新渲染
 * ConfigProvider，所以视觉、组件、控件保持一致。
 *
 * 选择项与 localStorage 持久化挂钩，刷新后保持。
 */

export type ThemeKey = 'warm' | 'cream' | 'green' | 'blue' | 'gray' | 'gold';

export interface ThemeTokens {
  /** Antd ConfigProvider 用的主色 */
  colorPrimary: string;
  /** 同色系的深色，按钮 hover、链接等 */
  colorPrimaryDark: string;
  /** 同色系强调色（按钮渐变第二段） */
  colorAccent: string;
  /** 主色阴影色（rgba） */
  shadow: string;
  /** 中文显示名 */
  label: string;
}

export const THEMES: Record<ThemeKey, ThemeTokens> = {
  warm: {
    colorPrimary: '#c97a4f',
    colorPrimaryDark: '#a85d3b',
    colorAccent: '#b8584a',
    shadow: 'rgba(168, 93, 59, 0.18)',
    label: '陶土暖橙'
  },
  cream: {
    // 淡暖米色 —— 比 warm 更"淡"、更柔和，文字采用近黑色保证强对比
    colorPrimary: '#d4a574',
    colorPrimaryDark: '#a8784e',
    colorAccent: '#c08652',
    shadow: 'rgba(168, 120, 78, 0.18)',
    label: '淡暖（高对比）'
  },
  green: {
    colorPrimary: '#6ba87f',
    colorPrimaryDark: '#4f8763',
    colorAccent: '#88b07c',
    shadow: 'rgba(79, 135, 99, 0.18)',
    label: '浅绿'
  },
  blue: {
    colorPrimary: '#6c9bcf',
    colorPrimaryDark: '#4c79a8',
    colorAccent: '#88abce',
    shadow: 'rgba(76, 121, 168, 0.18)',
    label: '天蓝'
  },
  gray: {
    colorPrimary: '#7d7a78',
    colorPrimaryDark: '#5e5b58',
    colorAccent: '#908a85',
    shadow: 'rgba(94, 91, 88, 0.16)',
    label: '浅灰'
  },
  gold: {
    colorPrimary: '#c89e3f',
    colorPrimaryDark: '#8e6f24',
    colorAccent: '#d4a843',
    shadow: 'rgba(142, 111, 36, 0.2)',
    label: '金色'
  }
};

const THEME_STORAGE_KEY = 'deeprec-theme';
const ROBOT_STORAGE_KEY = 'deeprec-robot-visible';

function loadTheme(): ThemeKey {
  if (typeof window === 'undefined') return 'warm';
  const v = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeKey | null;
  return v && v in THEMES ? v : 'warm';
}

function loadRobotVisible(): boolean {
  if (typeof window === 'undefined') return true;
  const v = window.localStorage.getItem(ROBOT_STORAGE_KEY);
  return v === null ? true : v === '1';
}

interface UIPrefsState {
  theme: ThemeKey;
  robotVisible: boolean;
  setTheme: (t: ThemeKey) => void;
  setRobotVisible: (v: boolean) => void;
}

export const useUIPrefsStore = create<UIPrefsState>((set) => ({
  theme: loadTheme(),
  robotVisible: loadRobotVisible(),
  setTheme: (t) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, t);
      document.documentElement.setAttribute('data-theme', t);
    }
    set({ theme: t });
  },
  setRobotVisible: (v) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ROBOT_STORAGE_KEY, v ? '1' : '0');
    }
    set({ robotVisible: v });
  }
}));

/** 应用启动时同步 <html data-theme> —— 在 React 渲染前执行可避免一帧闪烁。 */
export function applyInitialTheme(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', loadTheme());
}
