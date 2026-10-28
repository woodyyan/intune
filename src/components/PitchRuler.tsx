import { clamp } from '../lib/music';

type Props = {
  cents: number | null;
  tolerance: number;
};

export default function PitchRuler({ cents, tolerance }: Props) {
  const shown = cents !== null && Number.isFinite(cents);
  const pos = shown ? clamp(50 + cents / 2, 0, 100) : 50;
  const greenHalf = clamp(Math.min(20, tolerance) / 2, 3, 50);
  const amberHalf = clamp(tolerance / 2, 6, 50);
  const tone = !shown
    ? { color: 'var(--ink-3)', text: '等你的声音' }
    : Math.abs(cents) <= Math.min(20, tolerance)
      ? { color: 'var(--good)', text: '很准' }
      : Math.abs(cents) <= tolerance
        ? { color: 'var(--ok)', text: '有点飘' }
        : { color: 'var(--bad)', text: cents > 0 ? '偏高' : '偏低' };

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2 gap-2">
        <span className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
          实时音分偏差
        </span>
        <span
          className="it-badge tabular"
          style={{ background: 'var(--card)', color: tone.color, border: `1px solid ${tone.color}` }}
        >
          {shown ? `${cents > 0 ? '+' : ''}${Math.round(cents)}¢ · ${tone.text}` : tone.text}
        </span>
      </div>

      <div className="relative h-4 rounded-full overflow-hidden" style={{ background: 'var(--bad-fill)' }}>
        <div
          className="absolute top-0 bottom-0"
          style={{ left: `${50 - amberHalf}%`, width: `${amberHalf * 2}%`, background: 'var(--ok-fill)' }}
        />
        <div
          className="absolute top-0 bottom-0"
          style={{ left: `${50 - greenHalf}%`, width: `${greenHalf * 2}%`, background: 'var(--good-fill)' }}
        />
      </div>

      <div className="relative h-4">
        <div
          className="absolute rounded-full"
          style={{
            left: `${pos}%`,
            marginLeft: '-2px',
            width: '4px',
            height: '15px',
            background: 'var(--ink)',
            boxShadow: '0 0 0 2px rgba(255,255,255,0.9)',
            transition: 'left 60ms linear',
          }}
        />
      </div>

      <div className="flex justify-between text-[11px] tabular" style={{ color: 'var(--ink-3)' }}>
        <span>−100</span>
        <span>−50</span>
        <span>0</span>
        <span>+50</span>
        <span>+100</span>
      </div>
    </div>
  );
}
