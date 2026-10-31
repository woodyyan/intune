import { buildTrail } from '../lib/trail';

type Props = {
  /** 音分偏差序列；NaN 表示换音滑音区，轨迹在此断开 */
  points: number[];
  tolerance: number;
};

const W = 320;
const H = 74;
const MID = H / 2;

export default function PitchTrail({ points, tolerance }: Props) {
  const band = (tolerance / 100) * MID;
  const { segments, last } = buildTrail(points, W, H);

  return (
    <div className="it-inset p-2">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img">
        <title>音高轨迹</title>
        <rect x="0" y={MID - band} width={W} height={band * 2} fill="var(--good-soft)" />
        <line
          x1="0"
          y1={MID}
          x2={W}
          y2={MID}
          stroke="var(--grid)"
          strokeWidth="0.5"
          strokeDasharray="3 3"
        />
        {segments.map((seg, i) =>
          seg.length > 1 ? (
            <polyline
              key={i}
              points={seg.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
              fill="none"
              stroke="var(--brand)"
              strokeWidth="1.6"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : (
            <circle key={i} cx={seg[0].x} cy={seg[0].y} r="1.8" fill="var(--brand)" />
          ),
        )}
        {last && <circle cx={last.x} cy={last.y} r="3.6" fill="var(--accent)" />}
      </svg>
      <p className="text-[11px] mt-1 text-center" style={{ color: 'var(--ink-3)' }}>
        带内 = 合格范围，换音时的滑音已跳过
      </p>
    </div>
  );
}
