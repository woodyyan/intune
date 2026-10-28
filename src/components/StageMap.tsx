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
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex items-center justify-center rounded-[13px]"
            style={{
              width: 42,
              height: 42,
              background: 'linear-gradient(135deg, var(--brand-2), var(--brand))',
              boxShadow: 'var(--shadow-brand)',
            }}
          >
            <Logo size={26} color="#fff" />
          </span>
          <div>
            <h1 className="text-[22px] font-semibold leading-[1.2] tracking-[-0.01em]">Intune</h1>
            <p className="text-[12.5px] leading-[1.4]" style={{ color: 'var(--ink-3)' }}>
              每天 5 分钟，把音准练回来
            </p>
          </div>
        </div>
        <button className="it-btn-ghost px-3.5 py-2 text-[13px]" onClick={onProgress}>
          我的进步
        </button>
      </header>

      <section className="it-hero mt-5 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[12px] opacity-80">音准分 · 近 7 次平均</p>
            <p className="text-[42px] font-semibold tabular leading-[1.1] mt-0.5">
              {score || '--'}
            </p>
            <p className="text-[12px] opacity-75 mt-1">
              {score ? (score >= 85 ? '耳朵和嗓子对上了' : score >= 70 ? '稳住了，继续保持' : '再练几关会更稳') : '练完第一关就有分'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[12px] opacity-80">连续练习</p>
            <p className="text-[22px] font-semibold tabular">
              {progress.streak}
              <span className="text-[13px] font-normal opacity-80"> 天</span>
            </p>
          </div>
        </div>

        <div className="mt-4 pt-3.5" style={{ borderTop: '1px solid rgba(255,255,255,0.22)' }}>
          <div className="flex items-baseline justify-between text-[12px]">
            <span className="opacity-85">今日进度</span>
            <span className="tabular font-medium">
              {doneToday} / 3 关
            </span>
          </div>
          <div className="flex gap-1.5 mt-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-1.5 flex-1 rounded-full"
                style={{ background: i < doneToday ? '#fff' : 'rgba(255,255,255,0.28)' }}
              />
            ))}
          </div>
        </div>
      </section>

      {!progress.range && (
        <button className="it-btn w-full mt-3.5 py-3 text-[15px]" onClick={onCalibrate}>
          先做 20 秒音域校准
        </button>
      )}

      <div className="mt-6">
        <div className="flex items-baseline justify-between mb-2.5">
          <h2 className="text-[15px] font-semibold">练习关卡</h2>
          <span className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
            已解锁 {unlocked.length} / {STAGE_META.length}
          </span>
        </div>

        <div className="space-y-2.5">
          {STAGE_META.map((s, i) => {
            const isUnlocked = unlocked.includes(s.id);
            const isCurrent = progress.stage === s.id;
            const lock = isUnlocked ? null : unlockStatus(progress, s.id);
            return (
              <button
                key={s.id}
                className="it-card w-full text-left p-4 flex items-start gap-3 transition-transform"
                style={{
                  border: isCurrent ? '1px solid var(--brand-line)' : undefined,
                  boxShadow: isCurrent
                    ? '0 0 0 2px var(--brand), var(--shadow-1)'
                    : undefined,
                }}
                onClick={() => isUnlocked && onPick(s.id)}
                disabled={!isUnlocked}
              >
                <span
                  className="it-index"
                  style={{
                    background: isUnlocked
                      ? 'linear-gradient(135deg, var(--brand-2), var(--brand))'
                      : 'var(--line)',
                    color: isUnlocked ? '#fff' : 'var(--ink-3)',
                    boxShadow: isCurrent ? 'var(--shadow-brand)' : undefined,
                  }}
                >
                  {i + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-[15.5px] font-semibold truncate"
                      style={{ color: isUnlocked ? 'var(--ink)' : 'var(--ink-2)' }}
                    >
                      {s.name}
                    </span>
                    <span
                      className="it-badge"
                      style={{
                        background: isCurrent
                          ? 'var(--brand)'
                          : isUnlocked
                            ? 'var(--brand-soft)'
                            : 'var(--line)',
                        color: isCurrent ? '#fff' : isUnlocked ? 'var(--brand)' : 'var(--ink-2)',
                      }}
                    >
                      {isCurrent ? '当前' : isUnlocked ? '已解锁' : '未解锁'}
                    </span>
                  </div>
                  <p className="text-[13px] mt-0.5" style={{ color: 'var(--ink-2)' }}>
                    {s.desc}
                  </p>

                  {lock && lock.from && (
                    <div className="mt-2.5 pt-2.5" style={{ borderTop: '1px solid var(--line)' }}>
                      <p className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
                        {unlocked.includes(lock.from)
                          ? `把「${stageName(lock.from)}」练到位即可解锁`
                          : `先解锁「${stageName(lock.from)}」，再练够 ${UNLOCK_NEED_COUNT} 次`}
                      </p>
                      <div className="mt-1.5 space-y-1">
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
                </div>

                <span
                  className="flex-none text-[18px] leading-none mt-1"
                  style={{ color: isUnlocked ? 'var(--brand)' : 'var(--line-2)' }}
                  aria-hidden
                >
                  ›
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="it-inset mt-5 p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
            当前练习音域
          </p>
          <p className="text-[14px] font-medium mt-0.5">
            {progress.range
              ? `${noteLabel(progress.range.low)} — ${noteLabel(progress.range.high)}`
              : '未校准'}
          </p>
        </div>
        <button
          className="it-btn-ghost flex-none px-3.5 py-2 text-[13px]"
          onClick={onCalibrate}
        >
          重新校准
        </button>
      </div>
    </div>
  );
}
