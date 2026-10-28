import type { CSSProperties } from 'react';

/**
 * Intune 标识「同心 / Concentric」— 由 brand/v2/build.py 自动生成，请勿手改。
 *
 * 垂直方向是音高轴，缺口开在轴的上下两端；左右两条弧是两个声部（你的音与标准音），
 * 环抱着正中的实心点 —— 两者精确同心、完全重合，就是 in tune。
 *
 * 比例：内半径 360 : 点半径 120 = 3:1；
 *       留白环宽 240 : 点半径 = 2:1；网格 8u，画布 1024 = 128u。
 */

const VIEW = '32 32 960 960';
const CX = 512;
const CY = 512;
const R = 396;
const DOT = 120;
const SW = 72;

/** 两条对称弧：右弧经过 3 点，左弧经过 9 点，缺口在 12 点与 6 点方向各 40° */
const HALF = 20;
const rad = (deg: number) => (deg * Math.PI) / 180;
const pt = (deg: number) =>
  `${(CX + R * Math.cos(rad(deg))).toFixed(1)} ${(CY + R * Math.sin(rad(deg))).toFixed(1)}`;
/** 右弧经过 3 点，左弧经过 9 点；缺口开在 12 点与 6 点 */
const RIGHT = `M ${pt(270 + HALF)} A ${R} ${R} 0 0 1 ${pt(450 - HALF)}`;
const LEFT = `M ${pt(90 + HALF)} A ${R} ${R} 0 0 1 ${pt(270 - HALF)}`;

type Props = {
  /** 边长（px），标识为正方形 */
  size?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
};

export default function Logo({
  size = 30,
  color = 'var(--brand)',
  className,
  style,
}: Props) {
  return (
    <svg
      className={className}
      style={{ display: 'block', ...style }}
      width={size}
      height={size}
      viewBox={VIEW}
      fill="none"
      role="img"
      aria-label="Intune"
    >
      <path d={RIGHT} stroke={color} strokeWidth={SW} strokeLinecap="butt" />
      <path d={LEFT} stroke={color} strokeWidth={SW} strokeLinecap="butt" />
      <circle cx={CX} cy={CY} r={DOT} fill={color} />
    </svg>
  );
}
