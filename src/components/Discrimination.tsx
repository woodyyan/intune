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

  const choiceStyle = (v: 1 | -1) => {
    if (picked === null) {
      return { border: '1px solid var(--line-2)', background: 'var(--card)' };
    }
    if (v === answer) {
      return { border: '1px solid var(--good)', background: 'var(--good-soft)' };
    }
    if (v === picked) {
      return { border: '1px solid var(--bad)', background: 'var(--bad-soft)' };
    }
    return { border: '1px solid var(--line)', background: 'var(--card)', opacity: 0.55 };
  };

  return (
    <div className="mx-auto max-w-[480px] px-5 py-6">
      <div className="flex items-center justify-between gap-3">
        <button className="it-btn-ghost px-3 py-1.5 text-[13px]" onClick={onExit}>
          ← 返回
        </button>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: TOTAL }, (_, i) => (
            <span
              key={i}
              className="rounded-full"
              style={{
                width: 7,
                height: 7,
                background:
                  done !== null || i < index
                    ? 'var(--brand)'
                    : i === index
                      ? 'var(--brand-line)'
                      : 'var(--line-2)',
              }}
            />
          ))}
        </div>
      </div>

      <h1 className="text-[21px] font-semibold mt-3.5">听辨训练</h1>
      <p className="text-[13px] mt-0.5" style={{ color: 'var(--ink-2)' }}>
        只听不唱：判断第二个音比第一个更高还是更低。练的是耳朵。
      </p>

      <div className="it-card mt-4 p-5">
        {done === null ? (
          <>
            <button className="it-btn w-full py-3 text-[15px]" onClick={() => void playNotes(q.notes, q.bpm)}>
              播放这两个音
            </button>

            <div className="flex gap-2.5 mt-4">
              <button
                className="flex-1 py-4 text-[15px] font-medium rounded-[14px]"
                style={choiceStyle(1)}
                onClick={() => choose(1)}
                disabled={picked !== null}
              >
                第二个更高
              </button>
              <button
                className="flex-1 py-4 text-[15px] font-medium rounded-[14px]"
                style={choiceStyle(-1)}
                onClick={() => choose(-1)}
                disabled={picked !== null}
              >
                第二个更低
              </button>
            </div>

            <div className="h-6 mt-3.5">
              {picked !== null && (
                <p
                  className="pop text-[14px] text-center font-medium"
                  style={{ color: picked === answer ? 'var(--good)' : 'var(--bad)' }}
                >
                  {picked === answer ? '听对了' : `正确答案是「第二个${answer === 1 ? '更高' : '更低'}」`}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-3">
            <p className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
              本轮正确率
            </p>
            <p
              className="text-[46px] font-semibold tabular leading-none mt-1"
              style={{ color: 'var(--brand)' }}
            >
              {done}%
            </p>
            <p className="text-[13px] mt-2" style={{ color: 'var(--ink-2)' }}>
              {correctRef.current} / {TOTAL} 题听对
            </p>
            <button className="it-btn mt-4 w-full py-3 text-[15px]" onClick={onExit}>
              完成，返回
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
