import { useCallback, useEffect, useMemo, useState } from 'react';
import StageMap from './components/StageMap';
import PracticeScreen from './components/PracticeScreen';
import Calibration from './components/Calibration';
import Discrimination from './components/Discrimination';
import ProgressPanel from './components/ProgressPanel';
import SoundBar from './components/SoundBar';
import { applyResult, loadProgress, rangeOrDefault, saveProgress, track } from './lib/storage';
import { ensureAudio, unlockAudio } from './lib/audio';
import type { Progress, RoundResult, StageId } from './types';

type View = 'home' | 'practice' | 'progress' | 'calibrate' | 'discriminate';

export default function App() {
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const [view, setView] = useState<View>('home');
  const [stage, setStage] = useState<StageId>(progress.stage || 'longtone');

  const range = useMemo(() => rangeOrDefault(progress), [progress.range]);

  // iOS/Safari：AudioContext 必须在真实用户手势里 resume，否则全程静音。
  // 这里在第一次触摸/点击时就同步解锁，不等任何 await。
  useEffect(() => {
    const onFirstGesture = () => {
      unlockAudio();
      detach();
    };
    const events: (keyof DocumentEventMap)[] = ['touchend', 'pointerdown', 'mousedown', 'keydown'];
    const detach = () => {
      events.forEach((e) => document.removeEventListener(e, onFirstGesture, true));
    };
    events.forEach((e) => document.addEventListener(e, onFirstGesture, { capture: true }));
    return detach;
  }, []);

  // 从后台切回来 / 被系统电话中断后，iOS 会挂起音频会话，这里兜底恢复
  const reviveAudio = useCallback(() => {
    void ensureAudio();
  }, []);

  useEffect(() => {
    document.addEventListener('visibilitychange', reviveAudio);
    return () => document.removeEventListener('visibilitychange', reviveAudio);
  }, [reviveAudio]);

  const pick = (s: StageId) => {
    setStage(s);
    const next: Progress = { ...progress, stage: s };
    saveProgress(next);
    setProgress(next);
    track(next, 'stage_pick', { stage: s });
    if (s === 'calibrate') setView('calibrate');
    else if (s === 'discriminate') setView('discriminate');
    else setView('practice');
  };

  const handleResult = (r: RoundResult) => {
    setProgress((p) => applyResult(p, r));
  };

  let screen = null;
  if (view === 'home') {
    screen = (
      <StageMap
        progress={progress}
        onPick={pick}
        onProgress={() => setView('progress')}
        onCalibrate={() => setView('calibrate')}
      />
    );
  } else if (view === 'progress') {
    screen = <ProgressPanel progress={progress} onExit={() => setView('home')} />;
  } else if (view === 'calibrate') {
    screen = (
      <Calibration
        progress={progress}
        onDone={(p) => {
          setProgress(p);
          setView('home');
        }}
        onExit={() => setView('home')}
      />
    );
  } else if (view === 'discriminate') {
    screen = (
      <Discrimination
        progress={progress}
        range={range}
        onResult={handleResult}
        onExit={() => setView('home')}
      />
    );
  } else {
    screen = (
      <PracticeScreen
        stage={stage}
        progress={progress}
        range={range}
        onResult={handleResult}
        onExit={() => setView('home')}
      />
    );
  }

  return (
    <>
      <SoundBar />
      {screen}
    </>
  );
}
