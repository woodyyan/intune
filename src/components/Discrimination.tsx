import { useRef, useState } from 'react';
import { playNotes } from '../lib/audio';
import { generateRound, stageName, type Range } from '../lib/curriculum';
import type { Progress, RoundResult } from '../types';

type Props = {
  progress: Progress;
  range: Range;
  onResult: (r: RoundResult) => void;
  onExit: () => void;
};

const TOTAL = 5;

export default function Discrimination({ progress, range, onResult, onExit }: Props) {
  const [q, setQ] = useState(() => generateRound('discriminate', progress.difficulty, range));
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<1 | -1 | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const correctRef = useRef(0);
  const finishedRef = useRef(false);

  const answer: 1 | -1 = q.notes[1].midi > q.notes[0].midi ? 1 : -1;

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const score = Math.round((correctRef.current / TOTAL) * 100);
    setDone(score);
    onResult({
      stage: 'discriminate',
      label: `${stageName('discriminate')} ${TOTAL} 题`,
      score,
      meanAbsCents: 0,
      hitRate: score / 100,
      noteResults: [],
      intervals: [],
      heard: true,
      passed: score >= 70,
    });
  };

  const choose = (v: 1 | -1) => {
    if (picked !== null) return;
    setPicked(v);
    const right = v === answer;
    if (right) correctRef.current += 1;
    window.setTimeout(() => {
      if (index + 1 >= TOTAL) {
        finish();
        return;
      }
      setIndex((i) => i + 1);
      setQ(generateRound('discriminate', progress.difficulty, range));
      setPicked(null);
    }, 1100);
  };

  return (
    <div className="mx-auto max-w-[480px] px-5 py-6">
      <div className="flex items-center justify-between mb-4">
        <button className="text-[13px]" style={{ color: 'var(--ink-2)' }} onClick={onExit}>
          ← 返回
        </button>
        <span className="text-[12px] tabular" style={{ color: 'var(--ink-3)' }}>
          第 {Math.min(index + 1, TOTAL)} / {TOTAL} 题
        </span>
      </div>

      <h1 className="text-[20px] font-medium">听辨训练</h1>
      <p className="text-[13px] mt-1" style={{ color: 'var(--ink-2)' }}>
        只听不唱：判断第二个音比第一个更高还是更低。练的是耳朵。
      </p>

      <div className="mt-5 rounded-2xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
        {done === null ? (
          <>
            <button
              className="w-full rounded-xl py-3 text-[15px] text-white"
              style={{ background: 'var(--brand)' }}
              onClick={() => void playNotes(q.notes, q.bpm)}
            >
              播放这两个音
            </button>

            <div className="flex gap-3 mt-4">
              <button
                className="flex-1 rounded-xl py-4 text-[15px]"
                style={{
                  border: `1px solid ${picked === 1 ? 'var(--brand)' : 'var(--line)'}`,
                  background: picked === 1 ? 'var(--brand-soft)' : 'var(--card)',
                }}
                onClick={() => choose(1)}
              >
                第二个更高
              </button>
              <button
                className="flex-1 rounded-xl py-4 text-[15px]"
                style={{
                  border: `1px solid ${picked === -1 ? 'var(--brand)' : 'var(--line)'}`,
                  background: picked === -1 ? 'var(--brand-soft)' : 'var(--card)',
                }}
                onClick={() => choose(-1)}
              >
                第二个更低
              </button>
            </div>

            {picked !== null && (
              <p className="text-[14px] mt-4 text-center" style={{ color: picked === answer ? 'var(--good)' : 'var(--bad)' }}>
                {picked === answer ? '听对了' : `正确答案是「第二个${answer === 1 ? '更高' : '更低'}」`}
              </p>
            )}
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
              本轮正确率
            </p>
            <p className="text-[46px] font-medium tabular">{done}%</p>
            <button
              className="mt-4 w-full rounded-xl py-3 text-[15px] text-white"
              style={{ background: 'var(--brand)' }}
              onClick={onExit}
            >
              完成，返回
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
