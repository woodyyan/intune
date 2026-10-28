import Logo from './Logo';
import { STAGE_META, stageName } from '../lib/curriculum';
import { noteLabel } from '../lib/music';
import {
  UNLOCK_NEED_AVG,
  UNLOCK_NEED_COUNT,
  pitchScore,
  unlockStatus,
} from '../lib/storage';
import type { Progress, StageId } from '../types';

type Props = {
  progress: Progress;
  onPick: (stage: StageId) => void;
  onProgress: () => void;
  onCalibrate: () => void;
};

export default function StageMap({ progress, onPick, onProgress, onCalibrate }: Props) {
  const score = pitchScore(progress.history);
  const doneToday = Math.min(progress.todayCount, 3);
  const unlocked = progress.unlocked;

  return (
    <div className="mx-auto max-w-[480px] px-5 py-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Logo size={34} />
          <div>
            <h1 className="text-[24px] font-medium leading-[1.2] tracking-[-0.01em]">Intune</h1>
            <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
              每天 5 分钟，把音准练回来
            </p>
          </div>
        </div>
        <button className="text-[13px]" style={{ color: 'var(--brand)' }} onClick={onProgress}>
          我的进步 →
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-5">
        <div className="rounded-xl p-3" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
          <p className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
            音准分
          </p>
          <p className="text-[24px] font-medium tabular">{score || '--'}</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
          <p className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
            连续练习
          </p>
          <p className="text-[24px] font-medium tabular">{progress.streak} 天</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
          <p className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
            今日
          </p>
          <p className="text-[24px] font-medium tabular">
            {doneToday}
            <span className="text-[14px]" style={{ color: 'var(--ink-3)' }}>
              /3
            </span>
          </p>
        </div>
      </div>

      {!progress.range && (
        <button
          className="w-full mt-4 rounded-xl py-3 text-[15px] text-white"
          style={{ background: 'var(--brand)' }}
          onClick={onCalibrate}
        >
          先做 20 秒音域校准
        </button>
      )}

      <div className="mt-6 space-y-3">
        {STAGE_META.map((s, i) => {
          const isUnlocked = unlocked.includes(s.id);
          const isCurrent = progress.stage === s.id;
          const lock = isUnlocked ? null : unlockStatus(progress, s.id);
          return (
            <button
              key={s.id}
              className="w-full text-left rounded-xl p-4"
              style={{
                background: 'var(--card)',
                border: isCurrent ? '2px solid var(--brand)' : '1px solid var(--line)',
                opacity: isUnlocked ? 1 : 0.5,
              }}
              onClick={() => isUnlocked && onPick(s.id)}
              disabled={!isUnlocked}
            >
              <div className="flex items-center justify-between">
                <span className="text-[16px] font-medium">
                  {i + 1}. {s.name}
                </span>
                <span className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
                  {isUnlocked ? (isCurrent ? '当前' : '已解锁') : '未解锁'}
                </span>
              </div>
              <p className="text-[13px] mt-1" style={{ color: 'var(--ink-2)' }}>
                {s.desc}
              </p>

              {lock && lock.from && (
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
                  <p className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
                    {unlocked.includes(lock.from)
                      ? `解锁条件：把「${stageName(lock.from)}」练到位`
                      : `解锁条件：先解锁「${stageName(lock.from)}」再练够 ${UNLOCK_NEED_COUNT} 次`}
                  </p>
                  <div className="mt-1 space-y-0.5">
                    <p
                      className="text-[12px] tabular"
                      style={{ color: lock.countDone ? 'var(--good)' : 'var(--ink-2)' }}
                    >
                      {lock.countDone ? '已达成' : `还差 ${lock.remainCount} 次`} · 完成{' '}
                      {Math.min(lock.count, UNLOCK_NEED_COUNT)}/{UNLOCK_NEED_COUNT} 次
                    </p>
                    <p
                      className="text-[12px] tabular"
                      style={{ color: lock.avgDone ? 'var(--good)' : 'var(--ink-2)' }}
                    >
                      {lock.avgDone
                        ? '已达成'
                        : lock.avg === null
                          ? '还没成绩'
                          : `再提 ${lock.remainAvg} 分`}{' '}
                      · 近 3 次平均 {lock.avg ?? '--'}/{UNLOCK_NEED_AVG} 分
                    </p>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-xl p-4" style={{ background: 'var(--paper)', border: '1px solid var(--line)' }}>
        <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
          当前练习音域：
          {progress.range ? `${noteLabel(progress.range.low)} — ${noteLabel(progress.range.high)}` : '未校准'}
        </p>
        <button className="text-[13px] mt-1" style={{ color: 'var(--brand)' }} onClick={onCalibrate}>
          重新校准 →
        </button>
      </div>
    </div>
  );
}
