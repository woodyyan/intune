import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PitchFrame } from '../lib/detector';
import {
  IS_IOS,
  VoiceRecorder,
  ensureAudio,
  phraseSeconds,
  playBlob,
  playNotes,
  stopAll,
} from '../lib/audio';
import { scoreRound, stableWindow, verdictFor, type Sample } from '../lib/scoring';
import { centsBetween, noteLabel } from '../lib/music';
import { generateRound, stageName, toleranceFor, type Range } from '../lib/curriculum';
import { usePitchEngine } from '../hooks/usePitchEngine';
import { STAGE_ORDER, UNLOCK_NEED_AVG, UNLOCK_NEED_COUNT, unlockStatus } from '../lib/storage';
import PitchRuler from './PitchRuler';
import PitchTrail from './PitchTrail';
import NoteTimeline from './NoteTimeline';
import type { Progress, Round, RoundResult, StageId } from '../types';

type Phase = 'intro' | 'listen' | 'silence' | 'sing' | 'result';

const PREPARE_SEC = 0.5;

/** 音高轨迹的指数平滑系数：越大跟得越紧，越小越平 */
const TRAIL_SMOOTH = 0.45;

const STEPS = ['听标准音', '准备开口', '跟着唱', '看结果'];

type Props = {
  stage: StageId;
  progress: Progress;
  range: Range;
  onResult: (r: RoundResult) => void;
  onExit: () => void;
};

function wait(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms));
}

function centsMeaning(cents: number): { label: string; hint: string } {
  const semis = Math.abs(cents) / 100;
  if (semis < 0.2) {
    return { label: '几乎听不出来', hint: '已经接近专业歌手的精度' };
  }
  if (semis < 0.5) {
    return { label: '轻微偏了一点点', hint: '仔细听能听出来，日常唱歌已经算准' };
  }
  if (semis < 1) {
    return { label: `差了大约 ${semis.toFixed(1)} 个半音`, hint: '1 个半音 = 钢琴上相邻两个键的距离' };
  }
  return {
    label: `差了大约 ${semis.toFixed(1)} 个半音`,
    hint: `相当于钢琴上 ${Math.round(semis)} 个键的距离，明显跑调`,
  };
}

export default function PracticeScreen({ stage, progress, range, onResult, onExit }: Props) {
  const { status, frame, start, stop, setSink, tuneRange, mic } = usePitchEngine();
  const [phase, setPhase] = useState<Phase>('intro');
  const [tick, setTick] = useState(0);
  const [liveCents, setLiveCents] = useState<number | null>(null);
  const [liveNote, setLiveNote] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [trail, setTrail] = useState<number[]>([]);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [recording, setRecording] = useState<Blob | null>(null);
  const [activeNote, setActiveNote] = useState(-1);
  const [notice, setNotice] = useState<string | null>(null);

  const [round, setRound] = useState<Round>(() => generateRound(stage, progress.difficulty, range));
  const [tolerance, setTolerance] = useState<number>(() => toleranceFor(progress.difficulty));
  const spb = 60 / round.bpm;
  const totalSeconds = phraseSeconds(round.notes, round.bpm) + 0.8;

  const phaseRef = useRef<Phase>('intro');
  const samplesRef = useRef<Sample[]>([]);
  const singStartRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const scoredRef = useRef(false);
  const smoothRef = useRef<number | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const prevUnlockedRef = useRef<StageId[]>(progress.unlocked);
  useEffect(() => {
    const added = progress.unlocked.filter((s) => !prevUnlockedRef.current.includes(s));
    prevUnlockedRef.current = progress.unlocked;
    if (added.length === 0) return;
    setNotice(`已解锁：${added.map(stageName).join('、')}`);
    const id = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(id);
  }, [progress.unlocked]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => {
      window.clearTimeout(id);
      window.clearInterval(id);
    });
    timersRef.current = [];
  }, []);

  useEffect(
    () => () => {
      clearTimers();
      setSink(null);
      stop();
    },
    [clearTimers, setSink, stop],
  );

  useEffect(() => {
    tuneRange(range.low, range.high);
  }, [range, tuneRange]);

  const noteIndexAt = useCallback(
    (t: number) => {
      for (let i = 0; i < round.notes.length; i++) {
        const s = round.notes[i].start * spb - 0.15;
        const e = (round.notes[i].start + round.notes[i].dur) * spb + 0.25;
        if (t >= s && t <= e) return i;
      }
      return -1;
    },
    [round, spb],
  );

  useEffect(() => {
    if (phaseRef.current !== 'sing') return;
    const id = window.setInterval(() => {
      const t = (performance.now() - singStartRef.current) / 1000;
      setElapsed(t);
      const idx = noteIndexAt(t);
      if (idx >= 0) setLiveNote(idx);
    }, 100);
    timersRef.current.push(id);
    return () => window.clearInterval(id);
  }, [phase === 'sing', noteIndexAt]);

  const finishSing = useCallback(async () => {
    clearTimers();
    setPhase('result');
    const blob = await recorderRef.current?.stop();
    setRecording(blob ?? null);
    // 唱完立刻释放麦克风：iOS 会切回 playback 分类，
    // 「回放对比」才会走扬声器而不是听筒
    stop();
    if (scoredRef.current) return;
    scoredRef.current = true;
    const res = scoreRound(stage, round.label, round.notes, samplesRef.current, round.bpm, tolerance);
    setResult(res);
    onResult(res);
  }, [clearTimers, onResult, round, stage, stop, tolerance]);

  const runRound = useCallback(async () => {
    scoredRef.current = false;
    samplesRef.current = [];
    smoothRef.current = null;
    setTrail([]);
    setResult(null);
    setRecording(null);
    setLiveCents(null);
    setElapsed(0);
    setLiveNote(0);

    // 先解锁声音。这里【故意不开麦克风】：
    // iOS 一调 getUserMedia 就把音频会话翻成 playAndRecord（不带 defaultToSpeaker），
    // 标准音会被降级到听筒。所以播完再开麦，播放期间保持 playback 分类 → 扬声器。
    await ensureAudio();

    setPhase('listen');
    phaseRef.current = 'listen';
    setActiveNote(0);
    round.notes.forEach((n, i) => {
      const id = window.setTimeout(
        () => setActiveNote(i),
        Math.max(0, n.start * (60 / round.bpm) * 1000),
      );
      timersRef.current.push(id);
    });
    await playNotes(round.notes, round.bpm);
    setActiveNote(-1);

    setPhase('silence');
    phaseRef.current = 'silence';
    setTick(2);
    // 标准音播完了，这时候才开麦克风（首次会弹权限框，正好卡在"准备开口"）
    if (status !== 'running') await start();
    let left = 2;
    setTick(left);
    await new Promise<void>((resolve) => {
      const id = window.setInterval(() => {
        left -= 1;
        setTick(left);
        if (left <= 0) {
          window.clearInterval(id);
          resolve();
        }
      }, 1000);
      timersRef.current.push(id);
    });

    setPhase('sing');
    phaseRef.current = 'sing';
    setSink((f: PitchFrame) => {
      if (phaseRef.current !== 'sing') return;
      const t = (performance.now() - singStartRef.current) / 1000;
      samplesRef.current.push({ t, freq: f.freq, rms: f.rms });
      const idx = noteIndexAt(t);
      const note = idx >= 0 ? round.notes[idx] : null;

      // 只在音符的「稳定段」取点：起音有滑音、收尾有下滑，
      // 换音时声音还停在两个音之间，按旧音算会瞬间跳几百音分。
      let stable = false;
      if (note && f.freq !== null) {
        const w = stableWindow(note, round.bpm);
        stable = t >= w.start && t <= w.end;
      }

      if (note && f.freq !== null && stable) {
        const c = centsBetween(f.freq, note.midi);
        const prev = smoothRef.current;
        const sm = prev === null ? c : prev + TRAIL_SMOOTH * (c - prev);
        smoothRef.current = sm;
        setLiveCents(sm);
        setTrail((p) => [...p.slice(-599), sm]);
        return;
      }

      // 起音 / 换音滑音 / 没出声：轨迹断开，游标保持上一个稳定值
      smoothRef.current = null;
      setTrail((p) => [...p.slice(-599), NaN]);
    });

    const stream = mic.current?.mediaStream;
    if (stream) {
      const rec = recorderRef.current ?? new VoiceRecorder();
      recorderRef.current = rec;
      rec.start(stream);
    }
    singStartRef.current = performance.now() + PREPARE_SEC * 1000;
    await wait((PREPARE_SEC + totalSeconds) * 1000);
    if (phaseRef.current === 'sing') await finishSing();
  }, [finishSing, mic, noteIndexAt, round, setSink, start, status, totalSeconds]);

  const replay = useCallback(async () => {
    await playNotes(round.notes, round.bpm);
    if (recording) {
      await wait(300);
      await playBlob(recording);
    }
  }, [recording, round]);

  const nextRound = useCallback(() => {
    clearTimers();
    setSink(null);
    stopAll();
    setPhase('intro');
    phaseRef.current = 'intro';
    setResult(null);
    setRecording(null);
    setTrail([]);
    smoothRef.current = null;
    setRound(generateRound(stage, progress.difficulty, range));
    setTolerance(toleranceFor(progress.difficulty));
  }, [clearTimers, setSink, stage, progress.difficulty, range]);

  const leave = useCallback(() => {
    clearTimers();
    phaseRef.current = 'intro';
    setSink(null);
    stopAll();
    stop();
    onExit();
  }, [clearTimers, onExit, setSink, stop]);

  const resultTrail = useMemo(() => {
    if (trail.length <= 240) return trail;
    const step = Math.ceil(trail.length / 240);
    const out: number[] = [];
    for (let i = 0; i < trail.length; i += step) {
      const win = trail.slice(i, i + step);
      // 窗口里只要有滑音断点，整段就标记为断开，避免把两个音连成尖峰
      out.push(win.some((v) => !Number.isFinite(v)) ? NaN : win[win.length - 1]);
    }
    return out;
  }, [trail]);

  const target = round.notes[liveNote] ?? round.notes[0];
  const isPreparing = elapsed < 0;
  const noteRemain =
    liveNote >= 0 && !isPreparing ? Math.max(0, (target.start + target.dur) * spb - elapsed) : 0;
  const nextNote = round.notes[(liveNote >= 0 ? liveNote : 0) + 1] ?? null;
  const todayDone = progress.todayCount;

  const nextStageId = STAGE_ORDER[STAGE_ORDER.indexOf(stage) + 1] ?? null;
  const nextLock = nextStageId ? unlockStatus(progress, nextStageId) : null;
  let unlockText = '';
  let unlockPct = 0;
  if (nextLock && !nextLock.unlocked) {
    const parts: string[] = [];
    if (nextLock.remainCount > 0) parts.push(`再练 ${nextLock.remainCount} 次`);
    if (nextLock.avg === null) parts.push('先唱满 3 次拿到成绩');
    else if ((nextLock.remainAvg ?? 0) > 0) parts.push(`近 3 次平均再提 ${nextLock.remainAvg} 分`);
    unlockText = parts.length ? parts.join(' · ') : '已经达标，下一关就会解锁';
    const c = Math.min(1, nextLock.count / UNLOCK_NEED_COUNT);
    const a = nextLock.avg === null ? 0 : Math.min(1, nextLock.avg / UNLOCK_NEED_AVG);
    unlockPct = Math.round((c * 0.6 + a * 0.4) * 100);
  }

  const stepIndex = phase === 'silence' ? 1 : phase === 'sing' ? 2 : phase === 'result' ? 3 : 0;
  const verdict = result ? verdictFor(result.score) : null;

  return (
    <div className="mx-auto max-w-[480px] px-5 py-6">
      {notice && (
        <div className="pop mb-4 rounded-2xl p-3.5" style={{ background: 'var(--good-soft)' }}>
          <p className="text-[14px] font-medium" style={{ color: 'var(--good)' }}>
            {notice}
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--ink-2)' }}>
            回到首页就能看到新阶段
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <button className="it-btn-ghost px-3 py-1.5 text-[13px]" onClick={leave}>
          ← 返回
        </button>
        <span className="text-[12px] tabular" style={{ color: 'var(--ink-3)' }}>
          今日 {Math.min(todayDone, 3)}/3 关 · 难度 {progress.difficulty}
        </span>
      </div>

      <h1 className="text-[21px] font-semibold mt-3.5">{stageName(stage)}</h1>
      <p className="text-[13px] mt-0.5" style={{ color: 'var(--ink-2)' }}>
        {round.hint}
      </p>

      <div className="mt-4 flex items-start gap-1.5">
        {STEPS.map((label, i) => {
          const state = i < stepIndex ? 'done' : i === stepIndex ? 'now' : 'todo';
          return (
            <div key={label} className="flex-1">
              <div
                className="h-1 rounded-full"
                style={{
                  background:
                    state === 'todo' ? 'var(--line)' : state === 'now' ? 'var(--brand)' : 'var(--brand-line)',
                  boxShadow: state === 'now' ? '0 0 0 3px var(--brand-soft)' : undefined,
                }}
              />
              <p
                className="text-[11px] mt-1.5 whitespace-nowrap"
                style={{
                  color: state === 'todo' ? 'var(--ink-3)' : 'var(--brand)',
                  fontWeight: state === 'now' ? 600 : 400,
                }}
              >
                {label}
              </p>
            </div>
          );
        })}
      </div>

      {nextLock && !nextLock.unlocked && (
        <div className="it-inset mt-4 p-3.5" style={{ background: 'var(--brand-soft)', borderColor: 'var(--brand-line)' }}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px]" style={{ color: 'var(--brand)' }}>
              距离解锁「{stageName(nextLock.target)}」
            </span>
            <span className="text-[12px] tabular font-medium" style={{ color: 'var(--brand)' }}>
              {unlockPct}%
            </span>
          </div>
          <p className="text-[13px] mt-0.5">{unlockText}</p>
          <div className="mt-2 h-1.5 rounded-full" style={{ background: 'var(--brand-line)' }}>
            <div
              className="h-1.5 rounded-full"
              style={{ width: `${unlockPct}%`, background: 'var(--brand)' }}
            />
          </div>
        </div>
      )}

      <div className="it-card mt-4 p-5">
        {(phase === 'intro' || phase === 'result') && (
          <div>
            <p className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
              本关目标
            </p>
            <p className="text-[18px] font-semibold mt-0.5">{round.label}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {round.notes.map((n, i) => (
                <span key={i} className="it-chip px-3 py-1 text-[13px] tabular">
                  {noteLabel(n.midi)}
                </span>
              ))}
            </div>
          </div>
        )}

        {phase === 'listen' && (
          <div className="text-center py-4">
            <span
              className="it-badge"
              style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
            >
              <span className="breathe">●</span> 正在播放标准音
            </span>
            <div className="flex items-end justify-center gap-1.5 h-11 mt-3">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <span
                  key={i}
                  className="wave-bar rounded-full"
                  style={{
                    width: '5px',
                    height: '34px',
                    background: 'linear-gradient(180deg, var(--brand-2), var(--brand))',
                    animationDelay: `${i * 100}ms`,
                  }}
                />
              ))}
            </div>
            <div className="mt-4 text-left">
              <NoteTimeline
                notes={round.notes}
                bpm={round.bpm}
                activeIndex={activeNote}
                label="每个音的长短"
              />
            </div>
            <p className="text-[13px] mt-3" style={{ color: 'var(--ink-3)' }}>
              先把它记住，别急着跟唱
            </p>
          </div>
        )}

        {phase === 'silence' && (
          <div className="text-center py-5">
            <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
              接下来这样唱，心里先想一遍
            </p>
            <div className="mt-3 text-left">
              <NoteTimeline notes={round.notes} bpm={round.bpm} label="节奏" />
            </div>
            <div className="relative flex items-center justify-center mt-5" style={{ height: 96 }}>
              <span
                className="halo absolute rounded-full"
                style={{ width: 96, height: 96, background: 'var(--brand-soft)' }}
              />
              <span
                className="absolute rounded-full"
                style={{ width: 96, height: 96, background: 'var(--brand-soft)' }}
              />
              <span className="relative text-[46px] font-semibold tabular" style={{ color: 'var(--brand)' }}>
                {status === 'starting' ? (
                  <span className="breathe" style={{ fontSize: 34 }}>
                    ●
                  </span>
                ) : (
                  Math.max(tick, 0)
                )}
              </span>
            </div>
            <p className="text-[15px] font-semibold mt-1" style={{ color: 'var(--brand)' }}>
              {status === 'starting' ? '正在开启麦克风…' : '该你唱了'}
            </p>
            <p className="text-[13px] mt-1" style={{ color: 'var(--ink-3)' }}>
              {status === 'starting'
                ? '第一次会弹权限框，点「允许」后自动倒计时'
                : '听到 0 就开口，慢半拍也没关系'}
            </p>
          </div>
        )}

        {phase === 'sing' && (
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
                {isPreparing ? '准备' : '现在唱'}
              </span>
              <span className="text-[13px] tabular font-medium" style={{ color: 'var(--brand)' }}>
                {isPreparing ? '马上开始' : noteRemain > 0 ? `还剩 ${noteRemain.toFixed(1)}s` : '换音'}
              </span>
            </div>

            <div
              className="mt-2 rounded-2xl py-3 text-center"
              style={{ background: 'var(--brand-soft)' }}
            >
              <span
                className="text-[38px] font-semibold tabular leading-none"
                style={{ color: 'var(--brand)' }}
              >
                {noteLabel(target.midi)}
              </span>
            </div>

            <div className="mt-3">
              <NoteTimeline
                notes={round.notes}
                bpm={round.bpm}
                elapsed={isPreparing ? null : elapsed}
                activeIndex={isPreparing ? -1 : liveNote}
              />
            </div>

            <p className="text-[13px] mt-2" style={{ color: 'var(--ink-2)' }}>
              {isPreparing
                ? '先吸口气，慢半拍开口也没关系'
                : !nextNote
                  ? '最后一个音，唱完就好'
                  : noteRemain > 0
                    ? `唱满 ${noteRemain.toFixed(1)} 秒后接着唱 ${noteLabel(nextNote.midi)}`
                    : `接着唱 ${noteLabel(nextNote.midi)}`}
            </p>

            <div className="mt-4">
              <PitchRuler cents={liveCents} tolerance={tolerance} />
            </div>
            <div className="mt-3">
              <PitchTrail points={trail.slice(-70)} tolerance={tolerance} />
            </div>
          </div>
        )}

        {phase === 'result' && result && (
          <div className="rise">
            {!result.heard && (
              <div className="rounded-2xl p-4" style={{ background: 'var(--bad-soft)' }}>
                <p className="text-[15px] font-semibold" style={{ color: 'var(--bad)' }}>
                  这次没听到你的声音
                </p>
                <p className="text-[13px] mt-1" style={{ color: 'var(--ink-2)' }}>
                  检查一下麦克风权限有没有开、音量够不够，戴上耳机再点「再来一次」。
                </p>
              </div>
            )}
            {result.heard && (
              <>
                <p className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
                  本关得分 · 满分 100
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[46px] font-semibold tabular leading-none">
                    {result.score}
                  </span>
                  {verdict && (
                    <span
                      className="it-badge"
                      style={{
                        background:
                          verdict.tone === 'good'
                            ? 'var(--good-soft)'
                            : verdict.tone === 'ok'
                              ? 'var(--ok-soft)'
                              : 'var(--bad-soft)',
                        color:
                          verdict.tone === 'good'
                            ? 'var(--good)'
                            : verdict.tone === 'ok'
                              ? 'var(--ok)'
                              : 'var(--bad)',
                      }}
                    >
                      {verdict.text}
                    </span>
                  )}
                </div>
                <p className="text-[12px] mt-1.5" style={{ color: 'var(--ink-3)' }}>
                  命中率占 60% + 稳不稳占 20% + 起音准不准占 20%
                </p>

                <div className="grid grid-cols-2 gap-2.5 mt-3.5">
                  <div className="it-inset p-3">
                    <p className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
                      你唱得差了多少
                    </p>
                    <p className="text-[22px] font-semibold tabular mt-0.5">
                      {result.meanAbsCents}¢
                    </p>
                    <p className="text-[12.5px] mt-0.5">{centsMeaning(result.meanAbsCents).label}</p>
                  </div>
                  <div className="it-inset p-3">
                    <p className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
                      唱在合格范围内
                    </p>
                    <p className="text-[22px] font-semibold tabular mt-0.5">
                      {Math.round(result.hitRate * 100)}%
                    </p>
                    <p className="text-[12.5px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
                      {centsMeaning(result.meanAbsCents).hint}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-[12px] mb-2" style={{ color: 'var(--ink-2)' }}>
                    你的音高轨迹
                  </p>
                  <PitchTrail points={resultTrail} tolerance={tolerance} />
                </div>

                <div className="mt-4 space-y-2">
                  <p className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
                    每个音的表现 · ＋ 偏高，− 偏低
                  </p>
                  {result.noteResults.map((r, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-[13px] tabular w-16 flex-none" style={{ color: 'var(--ink-2)' }}>
                        {noteLabel(r.midi)}
                      </span>
                      <div
                        className="flex-1 h-2 rounded-full overflow-hidden"
                        style={{ background: 'var(--line)' }}
                      >
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: r.hitRate > 0 ? `max(6px, ${Math.round(r.hitRate * 100)}%)` : 0,
                            background:
                              r.hitRate > 0.6
                                ? 'var(--good-fill)'
                                : r.hitRate > 0.3
                                  ? 'var(--ok-fill)'
                                  : 'var(--bad-fill)',
                          }}
                        />
                      </div>
                      <span
                        className="text-[12px] tabular w-16 flex-none text-right"
                        style={{ color: 'var(--ink-2)' }}
                      >
                        {r.frames < 3 ? '没唱出' : `${r.meanCents > 0 ? '+' : ''}${Math.round(r.meanCents)}¢`}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-4">
        {phase === 'intro' && (
          <div className="flex gap-2">
            <button
              className="it-btn flex-1 py-3 text-[15px]"
              onClick={runRound}
              disabled={status === 'starting'}
            >
              {status === 'starting' ? '准备中…' : '开始这关'}
            </button>
            <button
              className="it-btn-ghost px-4 py-3 text-[15px]"
              onClick={() => void playNotes(round.notes, round.bpm)}
            >
              试听
            </button>
          </div>
        )}

        {IS_IOS && phase === 'intro' && (
          <p className="text-[11.5px] mt-2.5 text-center" style={{ color: 'var(--ink-3)' }}>
            标准音用扬声器播放，开唱时才启用麦克风；若仍无声，检查机身左侧静音键。
          </p>
        )}

        {phase === 'result' && (
          <div className="space-y-2">
            <button className="it-btn w-full py-3 text-[15px]" onClick={nextRound}>
              下一关
            </button>
            <div className="flex gap-2">
              <button className="it-btn-ghost flex-1 py-3 text-[15px]" onClick={() => void replay()}>
                回放对比
              </button>
              <button className="it-btn-ghost flex-1 py-3 text-[15px]" onClick={() => void runRound()}>
                再来一次
              </button>
            </div>
          </div>
        )}

        {(phase === 'listen' || phase === 'silence' || phase === 'sing') && (
          <p className="text-[13px] text-center" style={{ color: 'var(--ink-3)' }}>
            {phase === 'listen'
              ? '正在播放标准音，先把它记住'
              : phase === 'silence'
                ? '准备开口'
                : '正在录音并分析你的音高…'}
          </p>
        )}
      </div>

      {status === 'error' && (
        <p className="text-[13px] mt-3" style={{ color: 'var(--bad)' }}>
          需要麦克风权限，请在浏览器弹窗里允许后重试。
        </p>
      )}
      <p className="text-[12px] mt-4 text-center" style={{ color: 'var(--ink-3)' }}>
        戴耳机、清唱，效果最好。
      </p>
    </div>
  );
}
