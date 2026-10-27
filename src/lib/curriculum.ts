import type { Note, Phrase, Round, StageId } from '../types';
import { PHRASES } from '../data/songs';
import { clamp, mean, noteLabel } from './music';

export type Range = { low: number; high: number };

export const DEFAULT_RANGE: Range = { low: 48, high: 72 };

export const STAGE_META: { id: StageId; name: string; short: string; desc: string }[] = [
  { id: 'calibrate', name: '音域校准', short: '校准', desc: '唱一个舒服的长音，找到你的起音区' },
  { id: 'discriminate', name: '听辨训练', short: '听辨', desc: '两个音，听出哪个更高' },
  { id: 'longtone', name: '长音模唱', short: '长音', desc: '一个音，稳住不飘' },
  { id: 'interval', name: '音程跳进', short: '音程', desc: '两个音之间的跳跃' },
  { id: 'phrase', name: '旋律短句', short: '短句', desc: '唱熟悉的旋律' },
  { id: 'challenge', name: '完整乐句', short: '挑战', desc: '一整句，不看提示' },
];

export function stageName(id: StageId): string {
  return STAGE_META.find((s) => s.id === id)?.name ?? id;
}

export function toleranceFor(difficulty: number): number {
  return Math.round(clamp(62 - (difficulty - 1) * 3.8, 25, 62));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const NATURAL_PC = [0, 2, 4, 5, 7, 9, 11];

export function snapToNatural(midi: number): number {
  const pc = ((midi % 12) + 12) % 12;
  let best = pc;
  let diff = 99;
  for (const n of NATURAL_PC) {
    const d = Math.abs(n - pc);
    if (d < diff) {
      diff = d;
      best = n;
    }
  }
  return midi + (best - pc);
}

function randInt(lo: number, hi: number): number {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function transposeNotes(notes: Note[], shift: number): Note[] {
  return notes.map((n) => ({ ...n, midi: n.midi + shift }));
}

export function fitToRange(notes: Note[], range: Range): Note[] {
  const center = (range.low + range.high) / 2;
  const avg = mean(notes.map((n) => n.midi));
  let shift = Math.round(center - avg);
  const lo = Math.min(...notes.map((n) => n.midi)) + shift;
  const hi = Math.max(...notes.map((n) => n.midi)) + shift;
  if (hi > range.high + 2) shift -= Math.ceil((hi - range.high - 2) / 12) * 12;
  else if (lo < range.low - 2) shift += Math.ceil((range.low + 2 - lo) / 12) * 12;
  return transposeNotes(notes, shift);
}

function levelFor(difficulty: number): 1 | 2 | 3 {
  if (difficulty <= 3) return 1;
  if (difficulty <= 7) return 2;
  return 3;
}

function longTone(difficulty: number, range: Range): Round {
  const span = range.high - range.low;
  const edgeBias = clamp((difficulty - 1) / 9, 0, 1) * 0.35;
  const center = (range.low + range.high) / 2;
  const offset = (Math.random() * 2 - 1) * (span / 2) * (0.35 + edgeBias);
  const midi = snapToNatural(Math.round(clamp(center + offset, range.low, range.high)));
  const beats = difficulty >= 7 ? 4 : 3;
  return {
    stage: 'longtone',
    label: `长音 ${noteLabel(midi)}`,
    hint: '把这个音稳住，别让它往下掉',
    bpm: 60,
    notes: [{ midi, start: 0, dur: beats }],
  };
}

function intervalRound(difficulty: number, range: Range): Round {
  const pool = difficulty <= 3 ? [3, 4, 5] : difficulty <= 7 ? [4, 5, 7, 12] : [5, 7, 9, 12];
  const gap = pick(pool);
  const down = difficulty >= 4 && Math.random() < 0.45;
  let root = snapToNatural(randInt(range.low, range.high - 2));
  let second = down ? root - gap : root + gap;
  if (second < range.low - 3 || second > range.high + 3) {
    root = down ? range.low + gap : range.high - gap;
    second = down ? root - gap : root + gap;
  }
  const notes: Note[] = [
    { midi: root, start: 0, dur: 1.2 },
    { midi: second, start: 1.4, dur: 1.6 },
  ];
  const dir = second > root ? '上行' : '下行';
  return {
    stage: 'interval',
    label: `${dir} ${gap} 度`,
    hint: `先听清楚，再跳到${dir === '上行' ? '高' : '低'}的那个音`,
    bpm: 88,
    notes,
  };
}

function phraseRound(difficulty: number, range: Range, count: number): Round {
  const level = levelFor(difficulty);
  const candidates = PHRASES.filter((p) => p.level === level);
  const phrase: Phrase = pick(candidates.length ? candidates : PHRASES);
  const take = clamp(count, 3, phrase.notes.length);
  const notes = fitToRange(phrase.notes.slice(0, take), range);
  return {
    stage: 'phrase',
    label: `${phrase.name} · 前 ${take} 个音`,
    hint: '用钢琴弹你熟悉的旋律，跟着唱',
    bpm: phrase.bpm,
    notes,
    phraseName: phrase.name,
  };
}

function challengeRound(difficulty: number, range: Range): Round {
  const level = levelFor(difficulty);
  const candidates = PHRASES.filter((p) => p.level >= Math.min(3, level + 1));
  const phrase: Phrase = pick(candidates.length ? candidates : PHRASES);
  const notes = fitToRange(phrase.notes, range);
  return {
    stage: 'challenge',
    label: `${phrase.name} · 完整乐句`,
    hint: '整句一次唱完，中途不看提示',
    bpm: Math.round(phrase.bpm * 1.12),
    notes,
    phraseName: phrase.name,
  };
}

function discriminateRound(difficulty: number, range: Range): Round {
  const gapPool = difficulty <= 3 ? [4, 5, 7] : difficulty <= 7 ? [2, 3, 4] : [1, 2];
  const gap = pick(gapPool);
  const down = Math.random() < 0.5;
  const root = randInt(range.low + 1, range.high - gap - 1);
  const second = down ? root - gap : root + gap;
  return {
    stage: 'discriminate',
    label: '哪个音更高',
    hint: '只听不唱：判断第二个音比第一个高还是低',
    bpm: 90,
    notes: [
      { midi: root, start: 0, dur: 1 },
      { midi: second, start: 1.4, dur: 1 },
    ],
  };
}

export function generateRound(stage: StageId, difficulty: number, range: Range): Round {
  switch (stage) {
    case 'longtone':
      return longTone(difficulty, range);
    case 'interval':
      return intervalRound(difficulty, range);
    case 'phrase':
      return phraseRound(difficulty, range, 3 + Math.floor(difficulty / 2));
    case 'challenge':
      return challengeRound(difficulty, range);
    case 'discriminate':
      return discriminateRound(difficulty, range);
    default:
      return longTone(difficulty, range);
  }
}

export function stageUnlocked(unlocked: StageId[], stage: StageId): boolean {
  return unlocked.includes(stage);
}
