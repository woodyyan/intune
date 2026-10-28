import { dayKey, daysAgoKey, mean } from '../lib/music';
import { exportData, pitchScore, weakSpot } from '../lib/storage';
import type { Progress } from '../types';

type Props = {
  progress: Progress;
  onExit: () => void;
};

const W = 460;
const H = 96;

export default function ProgressPanel({ progress, onExit }: Props) {
  const history = progress.history;
  const score = pitchScore(history);
  const recent = history.slice(-7);
  const avgCents = recent.length ? Math.round(mean(recent.map((h) => h.meanAbsCents))) : 0;

  const days = Array.from({ length: 14 }, (_, i) => daysAgoKey(13 - i));
  const series = days.map((d) => {
    const recs = history.filter((h) => dayKey(h.ts) === d);
    return recs.length ? Math.round(mean(recs.map((r) => r.score))) : null;
  });
  const valid = series.filter((v): v is number => v !== null);
  const best = valid.length ? Math.max(...valid) : 0;

  const last30 = history.slice(-30);
  const near = last30.filter((h) => h.meanAbsCents <= 20).length;
  const mid = last30.filter((h) => h.meanAbsCents > 20 && h.meanAbsCents <= 50).length;
  const far = last30.filter((h) => h.meanAbsCents > 50).length;
  const total = last30.length || 1;

  const points: string[] = [];
  series.forEach((v, i) => {
    if (v === null) return;
    const x = 10 + (i * (W - 30)) / 13;
    const y = H - 26 - ((v - 40) / 60) * (H - 40);
    points.push(`${x.toFixed(1)},${Math.max(6, Math.min(H - 28, y)).toFixed(1)}`);
  });

  const spot = weakSpot(history);

  return (
    <div className="mx-auto max-w-[480px] px-5 py-6">
      <button className="text-[13px] mb-4" style={{ color: 'var(--ink-2)' }} onClick={onExit}>
        ← 返回
      </button>

      <h1 className="text-[22px] font-medium">你的音准进步</h1>

      <div className="grid grid-cols-3 gap-3 mt-5">
        <div className="rounded-xl p-3" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
          <p className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
            音准分
          </p>
          <p className="text-[24px] font-medium tabular">{score || '--'}</p>
          <p className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
            近 7 次平均
          </p>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
          <p className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
            平均偏差
          </p>
          <p className="text-[24px] font-medium tabular">{avgCents || '--'}¢</p>
          <p className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
            越小越好
          </p>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
          <p className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
            连续练习
          </p>
          <p className="text-[24px] font-medium tabular">{progress.streak} 天</p>
          <p className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
            每天 3 关
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
        <p className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
          音准分趋势 · 近 14 天{valid.length ? `（最高 ${best}）` : ''}
        </p>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="mt-2" role="img">
          <title>近 14 天音准分趋势</title>
          <line x1="10" y1={H - 26} x2={W - 20} y2={H - 26} stroke="#e8e6df" strokeWidth="1" />
          {points.length > 1 && (
            <polyline points={points.join(' ')} fill="none" stroke="var(--brand)" strokeWidth="1.5" />
          )}
          {points.length === 1 && (
            <circle cx={10} cy={Number(points[0].split(',')[1])} r="3" fill="var(--brand)" />
          )}
          <text x="10" y={H - 8} fontSize="11" fill="#8a8983">
            14 天前
          </text>
          <text x={W - 50} y={H - 8} fontSize="11" fill="#8a8983">
            今天
          </text>
        </svg>
        {valid.length === 0 && (
          <p className="text-[13px] mt-2" style={{ color: 'var(--ink-3)' }}>
            还没有数据，先去练一关。
          </p>
        )}
      </div>

      {last30.length > 0 && (
        <div className="mt-4 rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
          <p className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
            偏差分布 · 近 {last30.length} 次（100¢ = 1 个半音）
          </p>
          <div className="flex h-3.5 rounded-full overflow-hidden mt-2">
            <div style={{ width: `${(near / total) * 100}%`, background: '#97c459' }} />
            <div style={{ width: `${(mid / total) * 100}%`, background: '#ef9f27' }} />
            <div style={{ width: `${(far / total) * 100}%`, background: '#f09595' }} />
          </div>
          <div className="flex justify-between text-[11px] mt-2 tabular" style={{ color: 'var(--ink-3)' }}>
            <span>很准 {Math.round((near / total) * 100)}%</span>
            <span>有点飘 {Math.round((mid / total) * 100)}%</span>
            <span>明显跑调 {Math.round((far / total) * 100)}%</span>
          </div>
        </div>
      )}

      <div className="mt-4 rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
        <p className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
          薄弱点
        </p>
        <p className="text-[14px] mt-1">{spot ?? '再练几次，这里会告诉你哪个音程最容易跑。'}</p>
      </div>

      <button
        className="w-full mt-4 rounded-xl py-3 text-[15px]"
        style={{ border: '1px solid var(--line)' }}
        onClick={() => exportData(progress)}
      >
        导出练习数据（JSON）
      </button>
      <p className="text-[12px] mt-2" style={{ color: 'var(--ink-3)' }}>
        数据只存在这台设备的浏览器里，导出后可自己复盘。
      </p>
    </div>
  );
}
