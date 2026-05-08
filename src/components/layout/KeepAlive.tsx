import type { ReactNode } from 'react';

interface KeepAliveProps {
  active: boolean;
  children: ReactNode;
}

/**
 * 借助 CSS display 切换实现页面级状态保活：
 * 切换到非激活页签时仅隐藏 DOM，组件状态、定时器、SSE 连接都不会被卸载，
 * 报告生成进度与对话上下文得以延续。
 */
export default function KeepAlive({ active, children }: KeepAliveProps) {
  return <div style={{ display: active ? 'block' : 'none' }}>{children}</div>;
}
