import { YinDetector, rmsOf } from './yin';

export type PitchFrame = {
  t: number;
  freq: number | null;
  clarity: number;
  rms: number;
};

const INTERVAL_MS = 60;
const SILENCE_RMS = 0.006;
const MIN_CLARITY = 0.55;

export class MicPitch {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private yin: YinDetector | null = null;
  private raw: Float32Array<ArrayBuffer> | null = null;
  private down: Float32Array<ArrayBuffer> | null = null;
  private timer: number | null = null;
  private onFrame: ((f: PitchFrame) => void) | null = null;

  get running(): boolean {
    return this.timer !== null;
  }

  get mediaStream(): MediaStream | null {
    return this.stream;
  }

  async start(onFrame: (f: PitchFrame) => void): Promise<void> {
    if (this.timer !== null) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    const Ctor: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    if (ctx.state === 'suspended') await ctx.resume();

    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    source.connect(analyser);

    this.stream = stream;
    this.ctx = ctx;
    this.analyser = analyser;
    this.raw = new Float32Array(analyser.fftSize);
    this.down = new Float32Array(analyser.fftSize / 2);
    this.yin = new YinDetector({
      sampleRate: ctx.sampleRate / 2,
      threshold: 0.12,
      minFreq: 80,
      maxFreq: 1000,
    });
    this.onFrame = onFrame;
    this.timer = window.setInterval(() => this.tick(), INTERVAL_MS);
  }

  setRange(minFreq: number, maxFreq: number): void {
    this.yin?.setRange(minFreq, maxFreq);
  }

  private tick(): void {
    if (!this.analyser || !this.raw || !this.down || !this.yin || !this.onFrame) return;
    this.analyser.getFloatTimeDomainData(this.raw);
    const n = this.down.length;
    for (let i = 0; i < n; i++) {
      this.down[i] = (this.raw[2 * i] + this.raw[2 * i + 1]) / 2;
    }
    const rms = rmsOf(this.down);
    let freq: number | null = null;
    let clarity = 0;
    if (rms > SILENCE_RMS) {
      const r = this.yin.detect(this.down);
      if (r && r.clarity >= MIN_CLARITY && r.freq > 70 && r.freq < 1100) {
        freq = r.freq;
        clarity = r.clarity;
      }
    }
    this.onFrame({ t: performance.now(), freq, clarity, rms });
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.onFrame = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.analyser = null;
    void this.ctx?.close();
    this.ctx = null;
  }
}
