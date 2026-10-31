import { useCallback, useEffect, useRef, useState } from 'react';
import { MicPitch, type PitchFrame } from '../lib/detector';
import { declareAuto, declarePlayAndRecord, ensureAudio, rawContext } from '../lib/audio';
import { midiToFreq } from '../lib/music';

export type EngineStatus = 'idle' | 'starting' | 'running' | 'error';

const EMPTY: PitchFrame = { t: 0, freq: null, clarity: 0, rms: 0 };

export function usePitchEngine() {
  const micRef = useRef<MicPitch | null>(null);
  const sinkRef = useRef<((f: PitchFrame) => void) | null>(null);
  const rangeRef = useRef<[number, number] | null>(null);
  const [status, setStatus] = useState<EngineStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [frame, setFrame] = useState<PitchFrame>(EMPTY);

  const start = useCallback(async () => {
    if (micRef.current?.running) return;
    setStatus('starting');
    setError(null);
    try {
      const mic = micRef.current ?? new MicPitch();
      micRef.current = mic;
      // 播放与采集共用同一个 AudioContext，避免 iOS 上第二个上下文把播放会话挂起
      await ensureAudio();
      await mic.start((f) => {
        setFrame(f);
        sinkRef.current?.(f);
      }, rawContext);
      // 必须在拿到流之后声明：这一步 iOS 才会重新计算输出路由
      declarePlayAndRecord();
      if (rangeRef.current) {
        const [lo, hi] = rangeRef.current;
        mic.setRange(lo, hi);
      }
      setStatus('running');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus('error');
      setError(msg.includes('Permission') || msg.includes('NotAllowed') ? '麦克风权限被拒绝' : '无法访问麦克风');
    }
  }, []);

  const stop = useCallback(() => {
    micRef.current?.stop();
    declareAuto();
    setStatus('idle');
    setFrame(EMPTY);
  }, []);

  const setSink = useCallback((fn: ((f: PitchFrame) => void) | null) => {
    sinkRef.current = fn;
  }, []);

  const tuneRange = useCallback((lowMidi: number, highMidi: number) => {
    const lo = midiToFreq(lowMidi - 3) * 0.94;
    const hi = midiToFreq(highMidi + 3) * 1.06;
    // 麦克风可能在音域设定之后才打开，存下来等 start() 时再套用
    rangeRef.current = [lo, hi];
    micRef.current?.setRange(lo, hi);
  }, []);

  useEffect(() => () => micRef.current?.stop(), []);

  return { status, error, frame, start, stop, setSink, tuneRange, mic: micRef };
}
