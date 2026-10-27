import * as Tone from 'tone';
import type { Note } from '../types';
import { midiToFreq } from './music';

let synth: Tone.Synth | null = null;

export async function ensureAudio(): Promise<void> {
  await Tone.start();
  if (!synth) {
    const s = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.008, decay: 0.4, sustain: 0.18, release: 1.2 },
      volume: -8,
    });
    s.toDestination();
    synth = s;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function phraseSeconds(notes: Note[], bpm: number): number {
  const spb = 60 / bpm;
  let end = 0;
  for (const n of notes) end = Math.max(end, (n.start + n.dur) * spb);
  return end;
}

export async function playNotes(notes: Note[], bpm: number): Promise<number> {
  await ensureAudio();
  if (!synth) return 0;
  const spb = 60 / bpm;
  const t0 = Tone.now() + 0.1;
  for (const n of notes) {
    synth.triggerAttackRelease(midiToFreq(n.midi), Math.max(0.12, n.dur * spb * 0.92), t0 + n.start * spb);
  }
  const total = phraseSeconds(notes, bpm) + 0.35;
  await wait(total * 1000);
  return total;
}

export async function playSingle(midi: number, seconds: number): Promise<void> {
  await ensureAudio();
  if (!synth) return;
  synth.triggerAttackRelease(midiToFreq(midi), seconds, Tone.now() + 0.05);
  await wait(seconds * 1000 + 250);
}

export function stopAll(): void {
  synth?.triggerRelease(Tone.now());
}

export class VoiceRecorder {
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  get recording(): boolean {
    return this.rec !== null;
  }

  start(stream: MediaStream): void {
    if (this.rec) return;
    const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : undefined;
    this.chunks = [];
    this.rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    this.rec.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.rec.start();
  }

  stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.rec) {
        resolve(null);
        return;
      }
      const rec = this.rec;
      rec.onstop = () => {
        const blob = this.chunks.length ? new Blob(this.chunks, { type: this.chunks[0].type }) : null;
        this.chunks = [];
        this.rec = null;
        resolve(blob);
      };
      rec.stop();
    });
  }
}

export function playBlob(blob: Blob): Promise<void> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    void audio.play().catch(() => resolve());
  });
}
