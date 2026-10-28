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

  async start(
    onFrame: (f: PitchFrame) => void,
    getCtx: () => AudioContext | null,
  ): Promise<void> {
    if (this.timer !== null) return;
    const ctx = getCtx();
    if (!ctx) throw new Error('AudioContext unavailable');
    // 先 resume：此时还在用户手势窗口内，iOS 才认
    if (ctx.state !== 'running') {
      try {
        await ctx.resume();
      } catch {
        /* 忽略，拿到流以后再试 */
      }
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    // iOS 在弹麦克风权限框时会把音频会话挂起，拿到流之后必须再 resume 一次
    if (ctx.state !== 'running') {
      try {
        await ctx.resume();
      } catch {
        /* 忽略 */
      }
    }

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
    try {
      this.analyser?.disconnect();
    } catch {
      /* 忽略 */
    }
    this.analyser = null;
    // 注意：ctx 是与播放共用的 Tone 上下文，这里绝不能 close
    this.ctx = null;
  }
}
