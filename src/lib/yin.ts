export type YinResult = {
  freq: number;
  clarity: number;
};

export type YinConfig = {
  sampleRate: number;
  threshold: number;
  minFreq: number;
  maxFreq: number;
};

function diff(buf: Float32Array, out: Float32Array, minTau: number, maxTau: number): void {
  const n = buf.length;
  for (let tau = minTau; tau <= maxTau; tau++) {
    let sum = 0;
    const limit = n - tau;
    for (let i = 0; i < limit; i++) {
      const d = buf[i] - buf[i + tau];
      sum += d * d;
    }
    out[tau] = sum;
  }
}

function cumulativeMeanNorm(
  d: Float32Array,
  out: Float32Array,
  minTau: number,
  maxTau: number,
): void {
  out[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= maxTau; tau++) {
    running += d[tau];
    if (tau < minTau) {
      out[tau] = Number.POSITIVE_INFINITY;
      continue;
    }
    out[tau] = running / tau === 0 ? Number.POSITIVE_INFINITY : (d[tau] * tau) / running;
  }
}

export class YinDetector {
  private readonly sampleRate: number;
  private readonly threshold: number;
  private minTau: number;
  private maxTau: number;
  private buffer: Float32Array;
  private d: Float32Array;
  private cmnd: Float32Array;

  constructor(config: YinConfig) {
    this.sampleRate = config.sampleRate;
    this.threshold = config.threshold;
    this.buffer = new Float32Array(2048);
    this.d = new Float32Array(2048);
    this.cmnd = new Float32Array(2048);
    this.minTau = this.tauFor(config.maxFreq);
    this.maxTau = this.tauFor(config.minFreq);
  }

  private tauFor(freq: number): number {
    const tau = Math.round(this.sampleRate / freq);
    return Math.min(Math.max(tau, 2), Math.floor(this.buffer.length / 2) - 1);
  }

  setRange(minFreq: number, maxFreq: number): void {
    this.minTau = this.tauFor(maxFreq);
    this.maxTau = this.tauFor(minFreq);
    if (this.maxTau <= this.minTau) this.maxTau = this.minTau + 1;
  }

  private ensure(size: number): void {
    if (this.buffer.length !== size) {
      this.buffer = new Float32Array(size);
      this.d = new Float32Array(size);
      this.cmnd = new Float32Array(size);
    }
  }

  detect(input: Float32Array): YinResult | null {
    this.ensure(input.length);
    this.buffer.set(input);

    const maxTau = Math.min(this.maxTau, Math.floor(input.length / 2) - 1);
    if (maxTau <= this.minTau) return null;

    diff(this.buffer, this.d, 0, maxTau);
    cumulativeMeanNorm(this.d, this.cmnd, this.minTau, maxTau);

    let bestTau = -1;
    for (let tau = this.minTau; tau < maxTau; tau++) {
      if (this.cmnd[tau] < this.threshold) {
        while (tau + 1 < maxTau && this.cmnd[tau + 1] < this.cmnd[tau]) tau++;
        bestTau = tau;
        break;
      }
    }
    if (bestTau < 0) {
      let min = Number.POSITIVE_INFINITY;
      for (let tau = this.minTau; tau < maxTau; tau++) {
        if (this.cmnd[tau] < min) {
          min = this.cmnd[tau];
          bestTau = tau;
        }
      }
      if (!Number.isFinite(min) || min > 0.6) return null;
    }

    const clarity = 1 - this.cmnd[bestTau];
    const interpolated = parabolic(this.cmnd, bestTau, maxTau);
    const freq = this.sampleRate / interpolated;
    return { freq, clarity };
  }
}

function parabolic(arr: Float32Array, tau: number, maxTau: number): number {
  if (tau <= 0 || tau >= maxTau - 1) return tau;
  const s0 = arr[tau - 1];
  const s1 = arr[tau];
  const s2 = arr[tau + 1];
  const denom = 2 * (2 * s1 - s2 - s0);
  if (denom === 0) return tau;
  return tau + (s2 - s0) / denom;
}

export function rmsOf(buf: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}
