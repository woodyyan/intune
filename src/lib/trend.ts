import type { SessionRecord } from '../types';
import { dayKey, daysAgoKey, mean } from './music';

export const DAY_SPAN = 14;
export const MAX_ROUNDS = 14;

export type TrendUnit = 'day' | 'round' | 'empty';

export type TrendPoint = {
  /** 0..1，在横轴上的相对位置 */
  pos: number;
  value: number;
};

export type Trend = {
  unit: TrendUnit;
  points: TrendPoint[];
  best: number;
  /** 按天聚合时的有效天数 */
  dayCount: number;
};

/**
 * 音准分趋势。
 *
 * 优先按「天」聚合（更适合看长期进步）；但当天数不足 2 天时画不出折线
 * （一条线至少需要两个点），此时降级为按「每次练习」展示 ——
 * 否则用户当天练了再多关，图表也永远是一片空白。
 */
export function buildTrend(history: SessionRecord[], now = Date.now()): Trend {
  if (history.length === 0) {
    return { unit: 'empty', points: [], best: 0, dayCount: 0 };
  }

  const days = Array.from({ length: DAY_SPAN }, (_, i) => daysAgoKey(DAY_SPAN - 1 - i, now));
  const buckets = days.map((d) => history.filter((h) => dayKey(h.ts) === d).map((h) => h.score));

  let dayCount = 0;
  const dayPoints: TrendPoint[] = [];
  buckets.forEach((scores, i) => {
    if (scores.length === 0) return;
    dayCount += 1;
    dayPoints.push({ pos: i / (DAY_SPAN - 1), value: Math.round(mean(scores)) });
  });

  if (dayCount >= 2) {
    return {
      unit: 'day',
      points: dayPoints,
      best: Math.max(...dayPoints.map((p) => p.value)),
      dayCount,
    };
  }

  const rounds = history.slice(-MAX_ROUNDS);
  const n = Math.max(1, rounds.length - 1);
  const points: TrendPoint[] = rounds.map((r, i) => ({
    pos: rounds.length === 1 ? 0.5 : i / n,
    value: Math.round(r.score),
  }));

  return {
    unit: 'round',
    points,
    best: Math.max(...points.map((p) => p.value)),
    dayCount,
  };
}
