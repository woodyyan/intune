import type { Note } from '../types';
import { noteLabel } from '../lib/music';

type Props = {
  notes: Note[];
  bpm: number;
  elapsed?: number | null;
  activeIndex?: number;
  label?: string;
};

/**
 * 单个音符块的最小宽度占比。
 * 低于这个值音符名（如 F4 · fa）就会被挤掉，此时换一行。
 */
const MIN_SHARE = 0.15;

type Item = { note: Note; index: number };
type Row = { items: Item[]; start: number; end: number };

/**
 * 按「每个音都要看得清」贪心分行。
 * 完整乐句有 14 个音，挤在一行只有 25px/音；分行后每行 6 个左右，约 55px/音。
 */
function layoutRows(notes: Note[]): Row[] {
  const rows: Row[] = [];
  let cur: Item[] = [];

  const flush = () => {
    if (cur.length === 0) return;
    rows.push({
      items: cur,
      start: Math.min(...cur.map((c) => c.note.start)),
      end: Math.max(...cur.map((c) => c.note.start + c.note.dur)),
    });
    cur = [];
  };

  notes.forEach((note, index) => {
    if (cur.length > 0) {
      const start = Math.min(...cur.map((c) => c.note.start));
      const end = Math.max(
        Math.max(...cur.map((c) => c.note.start + c.note.dur)),
        note.start + note.dur,
      );
      const span = Math.max(end - start, 0.001);
      const narrowest = Math.min(...[...cur, { note, index }].map((c) => c.note.dur / span));
      if (narrowest < MIN_SHARE) flush();
    }
    cur.push({ note, index });
  });
  flush();

  return rows;
}

export default function NoteTimeline({ notes, bpm, elapsed = null, activeIndex = -1, label }: Props) {
  const spb = 60 / bpm;
  const totalSeconds = Math.max(...notes.map((n) => (n.start + n.dur) * spb));
  const rows = layoutRows(notes);

  let cursorRow = -1;
  let cursorPct = 0;
  if (elapsed !== null && rows.length > 0) {
    const i = rows.findIndex((r) => elapsed >= r.start && elapsed <= r.end);
    const span = (r: Row) => Math.max(r.end - r.start, 0.001);
    if (i >= 0) {
      cursorRow = i;
      cursorPct = Math.min(100, Math.max(0, ((elapsed - rows[i].start) / span(rows[i])) * 100));
    } else if (elapsed < rows[0].start) {
      cursorRow = 0;
      cursorPct = 0;
    } else {
      cursorRow = rows.length - 1;
      cursorPct = 100;
    }
  }

  return (
    <div>
      {label && (
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
            {label}
          </span>
          <span className="text-[11px] tabular" style={{ color: 'var(--ink-3)' }}>
            共 {totalSeconds.toFixed(1)} 秒{rows.length > 1 ? ` · ${rows.length} 行` : ''}
          </span>
        </div>
      )}

      <div className="space-y-2">
        {rows.map((row, ri) => {
          const span = Math.max(row.end - row.start, 0.001);
          const pctOf = (t: number) => ((t - row.start) / span) * 100;
          return (
            <div key={ri}>
              <div
                className="relative h-10 rounded-xl overflow-hidden"
                style={{ background: 'var(--paper)' }}
              >
                {row.items.map(({ note, index }) => {
                  const isActive = activeIndex === index;
                  const done = elapsed !== null && elapsed > (note.start + note.dur) * spb;
                  return (
                    <div
                      key={index}
                      className="absolute top-1 bottom-1 rounded-lg flex items-center justify-center overflow-hidden"
                      style={{
                        left: `${pctOf(note.start)}%`,
                        width: `${(note.dur / span) * 100}%`,
                        background: isActive
                          ? 'linear-gradient(135deg, var(--brand-2), var(--brand))'
                          : done
                            ? 'var(--line-2)'
                            : 'var(--brand-soft)',
                        color: isActive ? '#fff' : done ? 'var(--ink-2)' : 'var(--brand)',
                        boxShadow: isActive ? '0 2px 8px rgba(79,70,229,0.28)' : undefined,
                        transition: 'background 120ms linear, color 120ms linear',
                      }}
                    >
                      <span className="text-[12px] tabular whitespace-nowrap font-medium px-0.5">
                        {noteLabel(note.midi)}
                      </span>
                    </div>
                  );
                })}

                {cursorRow === ri && (
                  <div
                    className="absolute top-0 bottom-0"
                    style={{
                      left: `${cursorPct}%`,
                      width: '2px',
                      background: 'var(--ink)',
                      transition: 'left 100ms linear',
                    }}
                  />
                )}
              </div>

              <div className="relative h-4">
                {row.items.map(({ note, index }) => (
                  <span
                    key={index}
                    className="absolute text-[11px] tabular"
                    style={{
                      left: `${pctOf(note.start)}%`,
                      width: `${(note.dur / span) * 100}%`,
                      textAlign: 'center',
                      color: 'var(--ink-3)',
                    }}
                  >
                    {(note.dur * spb).toFixed(1)}s
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
