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
      <button className="text-[13px] mb-4" style={{ color: 'var(--ink-2)' }} onClick={onExit}>
        ← 返回
      </button>

      <h1 className="text-[22px] font-medium">音域校准</h1>
      <p className="text-[14px] mt-1" style={{ color: 'var(--ink-2)' }}>
        用你平时唱歌最舒服的音高，稳稳地唱一个「啊」，保持 3 秒。
      </p>

      <div className="mt-6 rounded-2xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
        {phase === 'singing' && (
          <>
            <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
              正在听你的声音…
            </p>
            <p className="text-[40px] font-medium tabular mt-2">
              {currentMidi !== null ? noteLabel(currentMidi) : '--'}
            </p>
            <div className="mt-3 h-2 rounded-full" style={{ background: 'var(--brand-soft)' }}>
              <div
                className="h-2 rounded-full"
                style={{ width: `${((3 - left) / 3) * 100}%`, background: 'var(--brand)', transition: 'width 1s linear' }}
              />
            </div>
            <p className="text-[13px] mt-2 tabular" style={{ color: 'var(--ink-3)' }}>
              还剩 {left} 秒
            </p>
          </>
        )}

        {phase === 'idle' && (
          <>
            <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
              当前音域：{noteLabel(existing.low)} — {noteLabel(existing.high)}
            </p>
            <button
              className="mt-4 w-full rounded-xl py-3 text-[15px] text-white"
              style={{ background: 'var(--brand)' }}
              onClick={begin}
              disabled={status === 'starting'}
            >
              {status === 'starting' ? '正在开启麦克风…' : '开始唱 3 秒'}
            </button>
          </>
        )}

        {phase === 'done' && (
          <>
            <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
              检测到你的舒适音高
            </p>
            <p className="text-[40px] font-medium tabular mt-2">
              {median !== null ? noteLabel(median) : '没听清'}
            </p>
            {median === null ? (
              <p className="text-[13px] mt-2" style={{ color: 'var(--bad)' }}>
                环境太安静或声音太小，戴耳机再来一次。
              </p>
            ) : (
              <p className="text-[13px] mt-2" style={{ color: 'var(--ink-2)' }}>
                练习音域将设为 {noteLabel(clamp(median - 8, 36, 84))} — {noteLabel(clamp(median + 8, 40, 88))}
              </p>
            )}
            <div className="flex gap-2 mt-4">
              <button className="flex-1 rounded-xl py-3 text-[15px]" style={{ border: '1px solid var(--line)' }} onClick={begin}>
                重来
              </button>
              <button
                className="flex-1 rounded-xl py-3 text-[15px] text-white"
                style={{ background: median === null ? 'var(--ink-3)' : 'var(--brand)' }}
                onClick={confirm}
                disabled={median === null}
              >
                就用它
              </button>
            </div>
          </>
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
