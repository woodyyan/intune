import type { AnalyticsEvent, Progress, RoundResult, SessionRecord, StageId } from '../types';
import { DEFAULT_RANGE } from './curriculum';
import { dayKey, mean, today } from './music';

const KEY = 'intune.progress.v1';

export const STAGE_ORDER: StageId[] = [
  'calibrate',
  'discriminate',
  'longtone',
  'interval',
  'phrase',
  'challenge',
];

export function defaultProgress(): Progress {
  return {
    version: 1,
    stage: 'longtone',
    difficulty: 3,
    range: null,
    history: [],
    events: [],
    hitStreak: 0,
    missStreak: 0,
    lastDay: null,
    streak: 0,
    todayCount: 0,
    todayDay: null,
    unlocked: ['calibrate', 'discriminate', 'longtone'],
  };
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw) as Partial<Progress>;
    const base = defaultProgress();
    return { ...base, ...parsed, unlocked: parsed.unlocked ?? base.unlocked };
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage full or unavailable */
  }
}

export function resetProgress(): Progress {
  const p = defaultProgress();
  saveProgress(p);
  return p;
}

export function rangeOrDefault(p: Progress): { low: number; high: number } {
  return p.range ?? DEFAULT_RANGE;
}

export const UNLOCK_NEED_COUNT = 4;
export const UNLOCK_NEED_AVG = 72;

export type UnlockStatus = {
  target: StageId;
  from: StageId | null;
  unlocked: boolean;
  count: number;
  avg: number | null;
  countDone: boolean;
  avgDone: boolean;
  remainCount: number;
  remainAvg: number | null;
};

export function unlockStatus(p: Progress, target: StageId): UnlockStatus {
  const idx = STAGE_ORDER.indexOf(target);
  const from = idx > 0 ? STAGE_ORDER[idx - 1] : null;
  const recs = from ? p.history.filter((h) => h.stage === from) : [];
  const recent = recs.slice(-3);
  const avg = recent.length === 3 ? Math.round(mean(recent.map((r) => r.score))) : null;
  const countDone = recs.length >= UNLOCK_NEED_COUNT;
  const avgDone = avg !== null && avg >= UNLOCK_NEED_AVG;
  return {
    target,
    from,
    unlocked: p.unlocked.includes(target),
    count: recs.length,
    avg,
    countDone,
    avgDone,
    remainCount: Math.max(0, UNLOCK_NEED_COUNT - recs.length),
    remainAvg: avg === null ? null : Math.max(0, UNLOCK_NEED_AVG - avg),
  };
}

function maybeUnlock(p: Progress): StageId[] {
  const unlocked = new Set(p.unlocked);
  const same = p.history.filter((h) => h.stage === p.stage);
  const recent = same.slice(-3);
  if (same.length >= UNLOCK_NEED_COUNT && recent.length === 3) {
    const avg = mean(recent.map((r) => r.score));
    if (avg >= UNLOCK_NEED_AVG) {
      const idx = STAGE_ORDER.indexOf(p.stage);
      const next = STAGE_ORDER[idx + 1];
      if (next) unlocked.add(next);
    }
  }
  return [...unlocked];
}

export function applyResult(p: Progress, result: RoundResult): Progress {
  const now = Date.now();
  const day = today();

  const record: SessionRecord = {
    ts: now,
    stage: result.stage,
    score: result.score,
    meanAbsCents: result.meanAbsCents,
    hitRate: Number(result.hitRate.toFixed(3)),
    label: result.label,
    intervals: result.intervals,
  };

  const history = [...p.history, record].slice(-400);

  let hitStreak = p.hitStreak;
  let missStreak = p.missStreak;
  let difficulty = p.difficulty;

  if (result.score >= 85) {
    hitStreak += 1;
    missStreak = 0;
  } else if (result.score < 70) {
    missStreak += 1;
    hitStreak = 0;
  } else {
    hitStreak = 0;
    missStreak = 0;
  }

  if (hitStreak >= 2) {
    difficulty = Math.min(10, difficulty + 1);
    hitStreak = 0;
  } else if (missStreak >= 2) {
    difficulty = Math.max(1, difficulty - 1);
    missStreak = 0;
  }

  const lastDay = p.todayDay === day ? p.lastDay : dayKey(Date.now() - 86400000);
  let streak = p.streak;
  if (p.todayDay !== day) {
    streak = p.lastDay === lastDay ? p.streak + 1 : 1;
  }

  const next: Progress = {
    ...p,
    history,
    hitStreak,
    missStreak,
    difficulty,
    lastDay: day,
    streak: p.todayDay === day ? p.streak : streak,
    todayCount: p.todayDay === day ? p.todayCount + 1 : 1,
    todayDay: day,
  };
  next.unlocked = maybeUnlock(next);
  saveProgress(next);
  return next;
}

export function track(p: Progress, type: string, payload: AnalyticsEvent['payload'] = {}): void {
  p.events.push({ ts: Date.now(), type, payload });
  if (p.events.length > 800) p.events.splice(0, p.events.length - 800);
  saveProgress(p);
}

export function exportData(p: Progress): void {
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `intune-data-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function pitchScore(history: SessionRecord[]): number {
  const recent = history.slice(-7);
  if (!recent.length) return 0;
  return Math.round(mean(recent.map((h) => h.score)));
}

export function weakSpot(history: SessionRecord[]): string | null {
  const all = history.flatMap((h) => h.intervals ?? []);
  if (all.length < 6) return null;
  const groups = new Map<string, { cents: number[]; semitones: number; dir: 1 | -1 }>();
  for (const iv of all) {
    const key = `${iv.direction === 1 ? '上行' : '下行'}${iv.semitones}`;
    const g = groups.get(key) ?? { cents: [], semitones: iv.semitones, dir: iv.direction };
    g.cents.push(iv.meanCents);
    groups.set(key, g);
  }
  let worst: { key: string; abs: number; cents: number; dir: 1 | -1; semitones: number } | null = null;
  for (const [key, g] of groups) {
    if (g.cents.length < 3) continue;
    const m = mean(g.cents);
    if (!worst || Math.abs(m) > worst.abs) {
      worst = { key, abs: Math.abs(m), cents: Math.round(m), dir: g.dir, semitones: g.semitones };
    }
  }
  if (!worst || worst.abs < 18) return null;
  const where = worst.dir === 1 ? '上行' : '下行';
  const how = worst.cents < 0 ? '唱低' : '唱高';
  return `${where} ${worst.semitones} 度容易${how}约 ${Math.abs(worst.cents)}¢，建议单独加练这个音程。`;
}
