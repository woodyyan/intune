import * as Tone from 'tone';
import type { Note } from '../types';
import { midiToFreq } from './music';

export const IS_IOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

let synth: Tone.Synth | null = null;
let interacted = false;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, wait(ms).then(() => null)]);
}

/**
 * Tone 底层的原生 AudioContext。
 * 麦克风分析复用同一个上下文 —— iOS 上开第二个 AudioContext 会把第一个的音频会话挂起，
 * 表现就是"麦克风拿到了音高，但标准音完全没声"。
 */
export function rawContext(): AudioContext | null {
  try {
    return Tone.getContext().rawContext as AudioContext;
  } catch {
    return null;
  }
}

export function audioState(): AudioContextState | 'unsupported' {
  const ctx = rawContext();
  return ctx ? ctx.state : 'unsupported';
}

export function userInteracted(): void {
  interacted = true;
}

export function hasInteracted(): boolean {
  return interacted;
}

/**
 * 音频解锁 —— 必须在用户手势回调里**同步**调用（不能先 await 任何东西）。
 * iOS/Safari 的 AudioContext 只在手势里 resume 才生效；一旦手势窗口过期就永远静音。
 */
export function unlockAudio(): void {
  userInteracted();
  const ctx = rawContext();
  if (!ctx) return;
  if (ctx.state !== 'running') void ctx.resume();
  try {
    const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    /* 个别浏览器对 1 采样点 buffer 敏感，忽略即可 */
  }
  void withTimeout(Tone.start(), 2000);
}

/** 每次发声前调用：确认上下文在运行，必要时重试 resume（iOS 弹权限框后会挂起会话） */
export async function ensureAudio(): Promise<boolean> {
  userInteracted();
  await withTimeout(Tone.start(), 2000);
  for (let i = 0; i < 3 && audioState() !== 'running'; i++) {
    const ctx = rawContext();
    if (!ctx) return false;
    try {
      await ctx.resume();
    } catch {
      /* 忽略，下一轮再试 */
    }
    if (audioState() !== 'running') await wait(80);
  }
  if (audioState() !== 'running') return false;
  if (!synth) {
    const s = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.008, decay: 0.4, sustain: 0.18, release: 1.2 },
      volume: -5,
    });
    s.toDestination();
    synth = s;
  }
  return audioState() === 'running';
}

export function phraseSeconds(notes: Note[], bpm: number): number {
  const spb = 60 / bpm;
  let end = 0;
  for (const n of notes) end = Math.max(end, (n.start + n.dur) * spb);
  return end;
}

export async function playNotes(notes: Note[], bpm: number): Promise<number> {
  const ok = await ensureAudio();
  if (!ok || !synth) return 0;
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
  const ok = await ensureAudio();
  if (!ok || !synth) return;
  synth.triggerAttackRelease(midiToFreq(midi), seconds, Tone.now() + 0.05);
  await wait(seconds * 1000 + 250);
}

/** 「开启声音」按钮用：解锁并给一个可听的标准音 A4 */
export async function playTestTone(): Promise<boolean> {
  unlockAudio();
  const ok = await ensureAudio();
  if (!ok || !synth) return false;
  synth.triggerAttackRelease(midiToFreq(69), 0.6, Tone.now() + 0.05);
  return true;
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
    void ensureAudio().then(() => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      void audio.play().catch(() => resolve());
    });
  });
}
