import { useEffect, useRef, useState } from 'react';
import { usePitchEngine } from '../hooks/usePitchEngine';
import { freqToMidi, noteLabel, clamp } from '../lib/music';
import type { Progress } from '../types';
import { rangeOrDefault, saveProgress, track } from '../lib/storage';

type Props = {
  progress: Progress;
  onDone: (p: Progress) => void;
  onExit: () => void;
};

export default function Calibration({ progress, onDone, onExit }: Props) {
  const { status, frame, start, stop } = usePitchEngine();
  const [phase, setPhase] = useState<'idle' | 'singing' | 'done'>('idle');
  const [left, setLeft] = useState(3);
  const [median, setMedian] = useState<number | null>(null);
  const collected = useRef<number[]>([]);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
    stop();
  }, [stop]);

  const begin = async () => {
    collected.current = [];
    setMedian(null);
    setPhase('singing');
    setLeft(3);
    await start();
    timer.current = window.setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          if (timer.current) window.clearInterval(timer.current);
          finish();
          return 0;
        }
        return v - 1;
      });
    }, 1000);
  };

  const finish = () => {
    const xs = collected.current;
    if (xs.length >= 5) {
      const sorted = [...xs].sort((a, b) => a - b);
      const mid = sorted[Math.floor(sorted.length / 2)];
      setMedian(Math.round(mid));
    } else {
      setMedian(null);
    }
    stop();
    setPhase('done');
  };

  useEffect(() => {
    if (phase === 'singing' && frame.freq !== null && frame.clarity >= 0.6) {
      collected.current.push(freqToMidi(frame.freq));
    }
  }, [frame, phase]);

  const currentMidi = frame.freq !== null ? Math.round(freqToMidi(frame.freq)) : null;
  const existing = rangeOrDefault(progress);

  const confirm = () => {
    if (median === null) return;
    const low = clamp(median - 8, 36, 84);
    const high = clamp(median + 8, 40, 88);
    const next: Progress = { ...progress, range: { low, high } };
    track(next, 'calibrated', { median, low, high });
    saveProgress(next);
    onDone(next);
  };

  return (
    <div className="mx-auto max-w-[480px] px-5 py-6">
      <button className="it-btn-ghost px-3 py-1.5 text-[13px]" onClick={onExit}>
        ← 返回
      </button>

      <h1 className="text-[22px] font-semibold mt-3.5">音域校准</h1>
      <p className="text-[13.5px] mt-1" style={{ color: 'var(--ink-2)' }}>
        用你平时唱歌最舒服的音高，稳稳地唱一个「啊」，保持 3 秒。
      </p>

      <div className="it-card mt-5 p-5">
        {phase === 'singing' && (
          <div className="text-center">
            <span className="it-badge" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
              <span className="breathe">●</span> 正在听你的声音
            </span>
            <p
              className="text-[44px] font-semibold tabular mt-3 leading-none"
              style={{ color: 'var(--brand)' }}
            >
              {currentMidi !== null ? noteLabel(currentMidi) : '--'}
            </p>
            <div className="mt-4 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--brand-soft)' }}>
              <div
                className="h-1.5 rounded-full"
                style={{
                  width: `${((3 - left) / 3) * 100}%`,
                  background: 'linear-gradient(90deg, var(--brand-2), var(--brand))',
                  transition: 'width 1s linear',
                }}
              />
            </div>
            <p className="text-[13px] mt-2 tabular" style={{ color: 'var(--ink-3)' }}>
              还剩 {left} 秒
            </p>
          </div>
        )}

        {phase === 'idle' && (
          <div>
            <p className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
              当前音域
            </p>
            <p className="text-[20px] font-semibold tabular mt-0.5">
              {noteLabel(existing.low)} — {noteLabel(existing.high)}
            </p>
            <p className="text-[13px] mt-3" style={{ color: 'var(--ink-2)' }}>
              校准后，每关的标准音都会落在你唱得最舒服的区间里。
            </p>
            <button
              className="it-btn mt-4 w-full py-3 text-[15px]"
              onClick={begin}
              disabled={status === 'starting'}
            >
              {status === 'starting' ? '正在开启麦克风…' : '开始唱 3 秒'}
            </button>
          </div>
        )}

        {phase === 'done' && (
          <div className="text-center">
            <p className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
              检测到你的舒适音高
            </p>
            <p
              className="text-[44px] font-semibold tabular mt-1 leading-none"
              style={{ color: median === null ? 'var(--ink-3)' : 'var(--brand)' }}
            >
              {median !== null ? noteLabel(median) : '没听清'}
            </p>
            {median === null ? (
              <p className="text-[13px] mt-3" style={{ color: 'var(--bad)' }}>
                环境太安静或声音太小，戴耳机再来一次。
              </p>
            ) : (
              <p className="text-[13px] mt-3" style={{ color: 'var(--ink-2)' }}>
                练习音域将设为{' '}
                <span className="font-medium" style={{ color: 'var(--ink)' }}>
                  {noteLabel(clamp(median - 8, 36, 84))} — {noteLabel(clamp(median + 8, 40, 88))}
                </span>
              </p>
            )}
            <div className="flex gap-2 mt-4">
              <button className="it-btn-ghost flex-1 py-3 text-[15px]" onClick={begin}>
                重来
              </button>
              <button
                className="it-btn flex-1 py-3 text-[15px]"
                onClick={confirm}
                disabled={median === null}
              >
                就用它
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <p className="text-[13px] mt-3" style={{ color: 'var(--bad)' }}>
            需要麦克风权限才能校准，请在浏览器弹窗里允许。
          </p>
        )}
      </div>
    </div>
  );
}
