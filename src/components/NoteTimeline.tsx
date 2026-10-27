import type { Note } from '../types';
import { noteLabel } from '../lib/music';

type Props = {
  notes: Note[];
  bpm: number;
  elapsed?: number | null;
  activeIndex?: number;
  label?: string;
};

export default function NoteTimeline({ notes, bpm, elapsed = null, activeIndex = -1, label }: Props) {
  const spb = 60 / bpm;
  const total = Math.max(...notes.map((n) => (n.start + n.dur) * spb));

  return (
    <div>
      {label && (
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
            {label}
          </span>
          <span className="text-[11px] tabular" style={{ color: 'var(--ink-3)' }}>
            共 {total.toFixed(1)} 秒
          </span>
        </div>
      )}

      <div className="relative h-11 rounded-lg overflow-hidden" style={{ background: 'var(--paper)' }}>
        {notes.map((n, i) => {
          const left = ((n.start * spb) / total) * 100;
          const width = ((n.dur * spb) / total) * 100;
          const isActive = activeIndex === i;
          const done = elapsed !== null && elapsed > (n.start + n.dur) * spb;
          return (
            <div
              key={i}
              className="absolute top-1.5 bottom-1.5 rounded-md flex items-center justify-center overflow-hidden"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                background: isActive ? 'var(--brand)' : done ? '#d3d1c7' : 'var(--brand-soft)',
                color: isActive ? '#fff' : done ? 'var(--ink-2)' : 'var(--brand)',
                transition: 'background 120ms linear, color 120ms linear',
              }}
            >
              <span className="text-[12px] tabular whitespace-nowrap">{noteLabel(n.midi)}</span>
            </div>
          );
        })}

        {elapsed !== null && (
          <div
            className="absolute top-0 bottom-0"
            style={{
              left: `${Math.min(100, Math.max(0, (elapsed / total) * 100))}%`,
              width: '2px',
              background: 'var(--ink)',
              transition: 'left 100ms linear',
            }}
          />
        )}
      </div>

      <div className="relative h-4">
        {notes.map((n, i) => {
          const left = ((n.start * spb) / total) * 100;
          const width = ((n.dur * spb) / total) * 100;
          return (
            <span
              key={i}
              className="absolute text-[11px] tabular"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                textAlign: 'center',
                color: 'var(--ink-3)',
              }}
            >
              {(n.dur * spb).toFixed(1)}s
            </span>
          );
        })}
      </div>
    </div>
  );
}
