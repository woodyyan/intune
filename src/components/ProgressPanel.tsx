import { mean } from '../lib/music';
import { exportData, pitchScore, weakSpot } from '../lib/storage';
import { buildTrend } from '../lib/trend';
import type { Progress } from '../types';

type Props = {
  progress: Progress;
  onExit: () => void;
};

const W = 460;
const H = 108;
const BASE = H - 26;
const PAD_L = 26;
const PAD_R = 26;
const PASS_LINE = 70;

/** 分数 20..100 映射到图表高度 */
function yOf(value: number): number {
  const y = BASE - ((value - 20) / 80) * (H - 40);
  return Math.max(6, Math.min(BASE, y));
}

function Stat({ label, value, unit, hint }: { label: string; value: string; unit?: string; hint: string }) {
  return (
    <div className="it-card p-3.5">
      <p className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
        {label}
      </p>
      <p className="text-[24px] font-semibold tabular leading-[1.2] mt-0.5">
        {value}
        {unit && <span className="text-[14px] font-normal" style={{ color: 'var(--ink-3)' }}>{unit}</span>}
      </p>
      <p className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
        {hint}
      </p>
    </div>
  );
}

export default function ProgressPanel({ progress, onExit }: Props) {
  const history = progress.history;
  const score = pitchScore(history);
  const recent = history.slice(-7);
  const avgCents = recent.length ? Math.round(mean(recent.map((h) => h.meanAbsCents))) : 0;

  const trend = buildTrend(history);
  const best = trend.best;

  const last30 = history.slice(-30);
  const near = last30.filter((h) => h.meanAbsCents <= 20).length;
  const mid = last30.filter((h) => h.meanAbsCents > 20 && h.meanAbsCents <= 50).length;
  const far = last30.filter((h) => h.meanAbsCents > 50).length;
  const total = last30.length || 1;

  const pts = trend.points.map((p) => ({
    x: PAD_L + p.pos * (W - PAD_L - PAD_R),
    y: yOf(p.value),
    value: p.value,
  }));
  const line = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area =
    pts.length > 1
      ? `M ${pts[0].x.toFixed(1)},${BASE} L ${line.split(' ').join(' L ')} L ${pts[pts.length - 1].x.toFixed(1)},${BASE} Z`
      : '';
  const passY = yOf(PASS_LINE);
  const trendTitle =
    trend.unit === 'day'
      ? '音准分趋势 · 近 14 天'
      : trend.unit === 'round'
        ? `音准分趋势 · 最近 ${trend.points.length} 次`
        : '音准分趋势';

  const spot = weakSpot(history);

  return (
    <div className="mx-auto max-w-[480px] px-5 py-6">
      <div className="flex items-center justify-between gap-3">
        <button className="it-btn-ghost px-3 py-1.5 text-[13px]" onClick={onExit}>
          ← 返回
        </button>
        <button
          className="text-[13px] font-medium"
          style={{ color: 'var(--brand)' }}
          onClick={() => exportData(progress)}
        >
          导出数据
        </button>
      </div>

      <h1 className="text-[22px] font-semibold mt-3.5">你的音准进步</h1>
      <p className="text-[13px] mt-0.5" style={{ color: 'var(--ink-2)' }}>
        练得越连续，曲线越平滑
      </p>

      <div className="grid grid-cols-3 gap-2.5 mt-4">
        <Stat label="音准分" value={String(score || '--')} hint="近 7 次平均" />
        <Stat label="平均偏差" value={String(avgCents || '--')} unit="¢" hint="越小越好" />
        <Stat label="连续练习" value={String(progress.streak)} unit=" 天" hint="每天 3 关" />
      </div>

      <div className="it-card mt-4 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
            {trendTitle}
          </p>
          {trend.points.length > 0 && (
            <span className="it-badge" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
              最高 {best}
            </span>
          )}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="mt-1.5" role="img">
          <title>近 14 天音准分趋势</title>
          <defs>
            <linearGradient id="itArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line
            x1={PAD_L - 8}
            y1={passY}
            x2={W - PAD_R + 8}
            y2={passY}
            stroke="var(--line-2)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <text x={PAD_L - 12} y={passY} fontSize="10" fill="var(--ink-3)" textAnchor="end" dominantBaseline="central">
            {PASS_LINE}
          </text>
          <line x1={PAD_L - 8} y1={BASE} x2={W - PAD_R + 8} y2={BASE} stroke="var(--line)" strokeWidth="1" />
          {area && <path d={area} fill="url(#itArea)" />}
          {pts.length > 1 && (
            <polyline
              points={line}
              fill="none"
              stroke="var(--brand)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {pts.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={pts.length === 1 ? 4.5 : 2.8}
              fill="var(--card)"
              stroke="var(--brand)"
              strokeWidth="1.8"
            />
          ))}
          {pts.length === 1 && (
            <text
              x={pts[0].x}
              y={pts[0].y - 12}
              fontSize="12"
              fontWeight="500"
              fill="var(--brand)"
              textAnchor="middle"
            >
              {pts[0].value}
            </text>
          )}
          <text x={PAD_L - 8} y={H - 8} fontSize="11" fill="var(--ink-3)">
            {trend.unit === 'day' ? '14 天前' : '最早'}
          </text>
          <text x={W - PAD_R + 8} y={H - 8} fontSize="11" fill="var(--ink-3)" textAnchor="end">
            {trend.unit === 'day' ? '今天' : '最近'}
          </text>
        </svg>
        {trend.unit === 'empty' && (
          <p className="text-[13px] mt-1" style={{ color: 'var(--ink-3)' }}>
            还没有数据，先去练一关。
          </p>
        )}
        {trend.unit === 'round' && trend.points.length > 1 && (
          <p className="text-[11.5px] mt-1" style={{ color: 'var(--ink-3)' }}>
            练满两天后，这里会自动切换成按天看的长期趋势。
          </p>
        )}
      </div>

      {last30.length > 0 && (
        <div className="it-card mt-4 p-4">
          <p className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
            偏差分布 · 近 {last30.length} 次（100¢ = 1 个半音）
          </p>
          <div className="flex h-3.5 rounded-full overflow-hidden mt-2.5">
            <div style={{ width: `${(near / total) * 100}%`, background: 'var(--good-fill)' }} />
            <div style={{ width: `${(mid / total) * 100}%`, background: 'var(--ok-fill)' }} />
            <div style={{ width: `${(far / total) * 100}%`, background: 'var(--bad-fill)' }} />
          </div>
          <div className="flex justify-between text-[11.5px] mt-2.5 tabular" style={{ color: 'var(--ink-3)' }}>
            {[
              ['很准', near, 'var(--good-fill)'],
              ['有点飘', mid, 'var(--ok-fill)'],
              ['明显跑调', far, 'var(--bad-fill)'],
            ].map(([label, n, color]) => (
              <span key={label as string} className="flex items-center gap-1.5">
                <span
                  className="inline-block rounded-full"
                  style={{ width: 8, height: 8, background: color as string }}
                />
                {label as string} {Math.round(((n as number) / total) * 100)}%
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="it-card mt-4 p-4">
        <p className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
          薄弱点
        </p>
        <p className="text-[14px] mt-1">
          {spot ?? '再练几次，这里会告诉你哪个音程最容易跑。'}
        </p>
      </div>

      <p className="text-[12px] mt-4 text-center" style={{ color: 'var(--ink-3)' }}>
        数据只存在这台设备的浏览器里，导出后可自己复盘。
      </p>
    </div>
  );
}
