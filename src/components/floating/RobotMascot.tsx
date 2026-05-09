interface Props {
  /** 视觉尺寸；默认沿用父容器，传值时覆盖宽高 */
  size?: number;
  /** 让眼睛"眨眼"动一下，用在 mini/bubble 入场动画里 */
  animated?: boolean;
}

/**
 * 卡通版"小颂" —— 圆头 + 大眼 + 微笑 + 天线，
 * 主体颜色随主题色变化（fill="currentColor"），可放在任何容器里。
 *
 * 选用 SVG 而非位图，是因为：
 *   1. 主题切换时颜色直接复用 currentColor，不需要再换图
 *   2. 矢量绘制在所有 DPR / 缩放下都不糊
 *   3. 体积只有几百字节，无需额外 HTTP 请求
 */
export default function RobotMascot({ size, animated = false }: Props) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      style={{ display: 'block' }}
      aria-hidden
    >
      {/* 天线 */}
      <line
        x1="32"
        y1="6"
        x2="32"
        y2="14"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.85"
      />
      <circle cx="32" cy="5" r="2.6" fill="currentColor" />

      {/* 头部主体 —— 椭圆，圆润 */}
      <rect
        x="10"
        y="14"
        width="44"
        height="36"
        rx="14"
        ry="14"
        fill="currentColor"
      />

      {/* 面部凹槽（亮色） */}
      <rect
        x="14"
        y="20"
        width="36"
        height="22"
        rx="10"
        ry="10"
        fill="rgba(255,255,255,0.95)"
      />

      {/* 左眼 */}
      <circle cx="24" cy="30" r="3" fill="#1f1f1f">
        {animated && (
          <animate
            attributeName="r"
            values="3;0.6;3"
            dur="3s"
            repeatCount="indefinite"
            keyTimes="0;0.05;0.1"
          />
        )}
      </circle>
      {/* 高光 */}
      <circle cx="25" cy="29" r="0.9" fill="#ffffff" />

      {/* 右眼 */}
      <circle cx="40" cy="30" r="3" fill="#1f1f1f">
        {animated && (
          <animate
            attributeName="r"
            values="3;0.6;3"
            dur="3s"
            repeatCount="indefinite"
            keyTimes="0;0.05;0.1"
          />
        )}
      </circle>
      <circle cx="41" cy="29" r="0.9" fill="#ffffff" />

      {/* 腮红（与主色同色，半透明） */}
      <circle cx="20" cy="36" r="2.4" fill="currentColor" opacity="0.4" />
      <circle cx="44" cy="36" r="2.4" fill="currentColor" opacity="0.4" />

      {/* 微笑 */}
      <path
        d="M26 36 Q32 41 38 36"
        stroke="#1f1f1f"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />

      {/* 双手（俏皮地往两边伸） */}
      <circle cx="9" cy="36" r="3" fill="currentColor" />
      <circle cx="55" cy="36" r="3" fill="currentColor" />

      {/* 底座小阴影 */}
      <ellipse cx="32" cy="56" rx="14" ry="2" fill="rgba(0,0,0,0.08)" />
    </svg>
  );
}
