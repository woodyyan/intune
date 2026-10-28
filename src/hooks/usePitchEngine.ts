import { useCallback, useEffect, useRef, useState } from 'react';
import { MicPitch, type PitchFrame } from '../lib/detector';
import { ensureAudio, rawContext } from '../lib/audio';
import { midiToFreq } from '../lib/music';

export type EngineStatus = 'idle' | 'starting' | 'running' | 'error';

const EMPTY: PitchFrame = { t: 0, freq: null, clarity: 0, rms: 0 };

export function usePitchEngine() {
  const micRef = useRef<MicPitch | null>(null);
  const sinkRef = useRef<((f: PitchFrame) => void) | null>(null);
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
      setStatus('running');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus('error');
      setError(msg.includes('Permission') || msg.includes('NotAllowed') ? '麦克风权限被拒绝' : '无法访问麦克风');
    }
  }, []);

  const stop = useCallback(() => {
    micRef.current?.stop();
    setStatus('idle');
    setFrame(EMPTY);
  }, []);

  const setSink = useCallback((fn: ((f: PitchFrame) => void) | null) => {
    sinkRef.current = fn;
  }, []);

  const tuneRange = useCallback((lowMidi: number, highMidi: number) => {
    micRef.current?.setRange(midiToFreq(lowMidi - 3) * 0.94, midiToFreq(highMidi + 3) * 1.06);
  }, []);

  useEffect(() => () => micRef.current?.stop(), []);

  return { status, error, frame, start, stop, setSink, tuneRange, mic: micRef };
}
