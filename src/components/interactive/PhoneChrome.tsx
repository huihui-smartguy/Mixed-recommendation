import { useEffect, useState } from 'react';
import RobotMascot from '../floating/RobotMascot';

/**
 * 模拟 iPhone 状态栏 + 应用栏。
 * 仅用于手机预览模式的"画框装饰"，不参与真实业务逻辑。
 */
function formatTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function SignalBars() {
  return (
    <svg viewBox="0 0 18 12" width={16} height={11} aria-hidden>
      <rect x="0" y="8" width="3" height="4" rx="0.6" fill="currentColor" />
      <rect x="5" y="5" width="3" height="7" rx="0.6" fill="currentColor" />
      <rect x="10" y="2" width="3" height="10" rx="0.6" fill="currentColor" />
      <rect x="15" y="0" width="3" height="12" rx="0.6" fill="currentColor" opacity="0.45" />
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

function BatteryGlyph({ percent = 88 }: { percent?: number }) {
  const fillW = Math.max(0, Math.min(percent / 100, 1)) * 18;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize: 10,
        fontWeight: 600
      }}
    >
      <span style={{ marginRight: 1 }}>{percent}</span>
      <svg viewBox="0 0 26 12" width={24} height={11} aria-hidden>
        <rect
          x="0.6"
          y="0.6"
          width="22.8"
          height="10.8"
          rx="2.6"
          ry="2.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.7"
        />
        <rect x="24" y="3.5" width="1.8" height="5" rx="0.6" fill="currentColor" opacity="0.7" />
        <rect x="2" y="2" width={fillW} height="8" rx="1.5" fill="currentColor" />
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
    <div className="phone-statusbar" role="presentation">
      <span className="phone-time">{now}</span>
      {/* 给灵动岛留出中央空间 */}
      <span className="phone-island-spacer" aria-hidden />
      <span className="phone-indicators">
        <SignalBars />
        <WifiArc />
        <BatteryGlyph percent={88} />
      </span>
    </div>
  );
}

export function PhoneAppBar() {
  return (
    <div className="phone-appbar">
      <span className="phone-app-icon">
        <RobotMascot size={22} />
      </span>
      <span className="phone-app-title">
        DeepRec+
        <small className="phone-app-subtitle">智能推荐 · 交互式</small>
      </span>
      <span className="phone-app-status">在线</span>
    </div>
  );
}

export default function PhoneChrome() {
  return (
    <>
      <PhoneStatusBar />
      <PhoneAppBar />
    </>
  );
}
