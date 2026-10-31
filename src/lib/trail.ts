export type TrailPt = { x: number; y: number };

/**
 * 把音分序列转成轨迹坐标，并按滑音断点切分成多段。
 *
 * 完整乐句这类短音符密集的关卡，换音时声音会经过两个音之间的中间地带，
 * 按旧音算音分会瞬间跳几百音分再弹回 —— 轨迹上就是一根根尖刺。
 * 采集端把这些位置标成 NaN，这里就把折线断开，只画每个音的稳定段。
 */
export function buildTrail(
  points: number[],
  width: number,
  height: number,
): { segments: TrailPt[][]; last: TrailPt | null } {
  const mid = height / 2;
  const step = points.length > 1 ? width / (points.length - 1) : width;

  const coords = points.map((c, i): TrailPt | null => {
    if (!Number.isFinite(c)) return null;
    const y = mid - (c / 100) * mid;
    return { x: i * step, y: Math.max(2, Math.min(height - 2, y)) };
  });

  const segments: TrailPt[][] = [];
  let cur: TrailPt[] = [];
  for (const p of coords) {
    if (p === null) {
      if (cur.length > 0) segments.push(cur);
      cur = [];
    } else {
      cur.push(p);
    }
  }
  if (cur.length > 0) segments.push(cur);

  let last: TrailPt | null = null;
  for (let i = coords.length - 1; i >= 0; i--) {
    if (coords[i]) {
      last = coords[i];
      break;
    }
  }

  return { segments, last };
}
