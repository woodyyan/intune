type Props = {
  points: number[];
  tolerance: number;
};

const W = 320;
const H = 74;
const MID = H / 2;

export default function PitchTrail({ points, tolerance }: Props) {
  const band = (tolerance / 100) * MID;
  const step = points.length > 1 ? W / (points.length - 1) : W;
  const path = points
    .map((c, i) => {
      const x = i * step;
      const y = MID - (c / 100) * MID;
      return `${x.toFixed(1)},${Math.max(2, Math.min(H - 2, y)).toFixed(1)}`;
    })
    .join(' ');
  const last = points.length ? points[points.length - 1] : null;
  const lastY = last === null ? MID : Math.max(2, Math.min(H - 2, MID - (last / 100) * MID));

  return (
    <div className="rounded-lg p-2" style={{ border: '1px solid var(--line)' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img">
        <title>音高轨迹</title>
        <rect x="0" y={MID - band} width={W} height={band * 2} fill="#eaf3de" />
        <line x1="0" y1={MID} x2={W} y2={MID} stroke="#b4b2a9" strokeWidth="0.5" strokeDasharray="3 3" />
        {points.length > 1 && (
          <polyline points={path} fill="none" stroke="var(--brand)" strokeWidth="1.5" />
        )}
        {last !== null && <circle cx={W} cy={lastY} r="3.5" fill="var(--brand)" />}
      </svg>
      <p className="text-[11px] mt-1" style={{ color: 'var(--ink-3)' }}>
        绿带是合格范围，线越平稳说明气息越稳
      </p>
    </div>
  );
}
