export const A4_MIDI = 69;
export const A4_FREQ = 440;

export function midiToFreq(midi: number): number {
  return A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12);
}

export function freqToMidi(freq: number): number {
  return A4_MIDI + 12 * Math.log2(freq / A4_FREQ);
}

export function centsBetween(freq: number, targetMidi: number): number {
  if (!Number.isFinite(freq) || freq <= 0) return 0;
  return 1200 * Math.log2(freq / midiToFreq(targetMidi));
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SOLFEGE = ['do', '升do', 're', '升re', 'mi', 'fa', '升fa', 'sol', '升sol', 'la', '升la', 'si'];

export function noteName(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NAMES[pc]}${octave}`;
}

export function solfege(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  return SOLFEGE[pc];
}

export function noteLabel(midi: number): string {
  return `${noteName(midi)} · ${solfege(midi)}`;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) * (x - m))));
}

export function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function dayKey(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function daysAgoKey(n: number, from: number = Date.now()): string {
  return dayKey(from - n * 86400000);
}
