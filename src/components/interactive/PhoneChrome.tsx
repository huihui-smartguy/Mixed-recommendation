import { useEffect, useState } from 'react';
import RobotMascot from '../floating/RobotMascot';

/**
 * 模拟华为旗舰（Mate 60 / Pura 70）状态栏 + 应用栏。
 *
 * 与 iPhone 视觉差异：
 *   · 中央"灵动岛"改为单孔前置摄像头（punch-hole），由 .mobile-bezel::before 渲染
 *   · 状态栏右侧加运营商文字 + 5G+ 徽标
 *   · 信号格 4 条等差，电量图标更扁平
 *   · 字号略小，字重 500（接近 HarmonyOS Sans）
 */

function formatTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function HuaweiSignal() {
  return (
    <svg viewBox="0 0 18 12" width={16} height={11} aria-hidden>
      <rect x="0" y="9" width="3" height="3" rx="0.5" fill="currentColor" />
      <rect x="5" y="6" width="3" height="6" rx="0.5" fill="currentColor" />
      <rect x="10" y="3" width="3" height="9" rx="0.5" fill="currentColor" />
      <rect x="15" y="0" width="3" height="12" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function WifiArc() {
  return (
    <svg viewBox="0 0 16 12" width={15} height={11} aria-hidden>
      <path
        d="M2 5 Q8 -1 14 5"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M4 7.5 Q8 3 12 7.5"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="8" cy="10" r="1.4" fill="currentColor" />
    </svg>
  );
}

function HuaweiBattery({ percent = 88 }: { percent?: number }) {
  const fillW = Math.max(0, Math.min(percent / 100, 1)) * 18;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600 }}>
      <span style={{ marginRight: 1 }}>{percent}%</span>
      <svg viewBox="0 0 26 11" width={24} height={10} aria-hidden>
        <rect x="0.5" y="0.5" width="22" height="10" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="0.9" opacity="0.75" />
        <rect x="22.6" y="3.5" width="2.6" height="4" rx="0.4" fill="currentColor" opacity="0.75" />
        <rect x="2" y="2" width={fillW} height="7" rx="1" fill="currentColor" />
      </svg>
    </span>
  );
}

export function PhoneStatusBar() {
  const [now, setNow] = useState(() => formatTime(new Date()));
  useEffect(() => {
    const t = window.setInterval(() => setNow(formatTime(new Date())), 30_000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="phone-statusbar phone-statusbar-huawei" role="presentation">
      <span className="phone-time">{now}</span>
      {/* 给前置摄像孔留中央空位 */}
      <span className="phone-island-spacer" aria-hidden />
      <span className="phone-indicators">
        <span className="carrier-text">中国电信</span>
        <span className="fiveg-badge">5G+</span>
        <HuaweiSignal />
        <WifiArc />
        <HuaweiBattery percent={88} />
      </span>
    </div>
  );
}

export function PhoneAppBar() {
  return (
    <div className="phone-appbar phone-appbar-huawei">
      <span className="phone-app-icon">
        <RobotMascot size={22} />
      </span>
      <span className="phone-app-title">
        DeepRec
        <small className="phone-app-subtitle">智能推荐 · 交互式</small>
      </span>
      <span className="phone-app-status">在线</span>
    </div>
  );
}

/** 底部 Android 手势条（华为风格） */
export function PhoneHomeIndicator() {
  return <div className="phone-home-indicator" aria-hidden />;
}

export default function PhoneChrome() {
  return (
    <>
      <PhoneStatusBar />
      <PhoneAppBar />
    </>
  );
}
