import type { Note, NoteResult, RoundResult, SessionRecord, StageId } from '../types';
import { centsBetween, clamp, mean, stdev } from './music';

export type Sample = {
  t: number;
  freq: number | null;
  rms: number;
};

const MISS_PENALTY = 120;
const ATTACK_GRACE = 0.1;
const LATENESS_MIN = 0.05;
const LATENESS_MAX = 0.8;

/**
 * 音符的「稳定段」—— 起音有滑音、收尾有下滑，换音时声音还停在两个音之间，
 * 按旧音去算音分会瞬间跳几百音分。实时轨迹只画这一段，滑音处断开。
 * 返回相对乐句起点的秒数区间。
 */
export function stableWindow(note: Note, bpm: number): { start: number; end: number } {
  const spb = 60 / bpm;
  const s = note.start * spb;
  const e = (note.start + note.dur) * spb;
  const dur = Math.max(0.12, e - s);
  const grace = Math.min(ATTACK_GRACE, dur * 0.3);
  const tail = Math.min(0.06, dur * 0.2);
  const start = s + grace;
  const end = e - tail;
  return { start, end: Math.max(start, end) };
}

function alignToFirstAudible(samples: Sample[], expectedFirstStart: number): Sample[] {
  const first = samples.find((s) => s.freq !== null && s.rms >= 0.006);
  if (!first) return samples;
  const lateness = first.t - expectedFirstStart;
  if (lateness <= LATENESS_MIN || lateness >= LATENESS_MAX) return samples;
  const shift = -lateness;
  return samples.map((s) => ({ ...s, t: s.t + shift }));
}

function frameCents(samples: Sample[], midi: number, from: number, to: number): number[] {
  const out: number[] = [];
  for (const s of samples) {
    if (s.t < from || s.t > to) continue;
    if (s.freq === null) continue;
    const c = centsBetween(s.freq, midi);
    if (Math.abs(c) > 600) continue;
    out.push(c);
  }
  return out;
}

function robustFilter(cents: number[]): number[] {
  if (cents.length < 4) return cents;
  const sorted = [...cents].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  return cents.filter((c) => Math.abs(c - med) <= 250);
}

export function scoreNote(
  note: Note,
  nextStartSeconds: number,
  samples: Sample[],
  bpm: number,
  tolerance: number,
): NoteResult {
  const spb = 60 / bpm;
  const durSec = note.dur * spb;
  const grace = Math.min(ATTACK_GRACE, durSec * 0.3);
  const from = note.start * spb + grace;
  const rawTo = (note.start + note.dur) * spb + 0.22;
  const to = Math.max(from + 0.12, Math.min(rawTo, nextStartSeconds - 0.05));
  const raw = frameCents(samples, note.midi, from, to);
  const cents = robustFilter(raw);

  if (raw.length < 3 || cents.length < 3) {
    return {
      midi: note.midi,
      meanCents: 0,
      meanAbsCents: MISS_PENALTY,
      onsetCents: 0,
      hitRate: 0,
      std: 0,
      frames: raw.length,
    };
  }

  const meanCents = mean(cents);
  const meanAbsCents = mean(cents.map(Math.abs));
  const hits = cents.filter((c) => Math.abs(c) <= tolerance).length;
  const onsetCount = Math.max(2, Math.min(6, Math.round(cents.length * 0.3)));
  const onsetCents = mean(cents.slice(0, onsetCount));

  return {
    midi: note.midi,
    meanCents,
    meanAbsCents,
    onsetCents,
    hitRate: hits / cents.length,
    std: stdev(cents),
    frames: cents.length,
  };
}

export function scoreRound(
  stage: StageId,
  label: string,
  notes: Note[],
  samples: Sample[],
  bpm: number,
  tolerance: number,
): RoundResult {
  const spb = 60 / bpm;
  const aligned = alignToFirstAudible(samples, notes.length ? notes[0].start * spb : 0);
  const noteResults = notes.map((n, i) =>
    scoreNote(n, i + 1 < notes.length ? notes[i + 1].start * spb : Number.POSITIVE_INFINITY, aligned, bpm, tolerance),
  );
  const perNote = noteResults.map((r) => {
    if (r.frames < 3) return 0;
    const stability = clamp(1 - r.std / 45, 0, 1);
    const onsetScore = clamp(1 - Math.abs(r.onsetCents) / 80, 0, 1);
    return r.hitRate * 60 + stability * 20 + onsetScore * 20;
  });

  const score = Math.round(mean(perNote));
  const meanAbsCents = Math.round(mean(noteResults.map((r) => r.meanAbsCents)));
  const hitRate = mean(noteResults.map((r) => r.hitRate));

  return {
    stage,
    label,
    score,
    meanAbsCents,
    hitRate,
    noteResults,
    intervals: intervalsOf(notes, noteResults),
    heard: noteResults.some((r) => r.frames >= 3),
    passed: score >= 70,
  };
}

export function intervalsOf(
  notes: Note[],
  results: NoteResult[],
): { semitones: number; direction: 1 | -1; meanCents: number }[] {
  const out: { semitones: number; direction: 1 | -1; meanCents: number }[] = [];
  for (let i = 1; i < notes.length; i++) {
    const semitones = notes[i].midi - notes[i - 1].midi;
    if (semitones === 0) continue;
    out.push({
      semitones: Math.abs(semitones),
      direction: semitones > 0 ? 1 : -1,
      meanCents: Math.round(results[i].meanCents),
    });
  }
  return out;
}

export function verdictFor(score: number): { text: string; tone: 'good' | 'ok' | 'bad' } {
  if (score >= 85) return { text: '太准了', tone: 'good' };
  if (score >= 70) return { text: '唱对了，再稳一点', tone: 'ok' };
  return { text: '再来一次，慢一点', tone: 'bad' };
}
