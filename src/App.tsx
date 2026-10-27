import { useMemo, useState } from 'react';
import StageMap from './components/StageMap';
import PracticeScreen from './components/PracticeScreen';
import Calibration from './components/Calibration';
import Discrimination from './components/Discrimination';
import ProgressPanel from './components/ProgressPanel';
import { applyResult, loadProgress, rangeOrDefault, saveProgress, track } from './lib/storage';
import type { Progress, RoundResult, StageId } from './types';

type View = 'home' | 'practice' | 'progress' | 'calibrate' | 'discriminate';

export default function App() {
  const [progress, setProgress] = useState<Progress>(() => loadProgress());
  const [view, setView] = useState<View>('home');
  const [stage, setStage] = useState<StageId>(progress.stage || 'longtone');

  const range = useMemo(() => rangeOrDefault(progress), [progress.range]);

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

  if (view === 'home') {
    return (
      <StageMap
        progress={progress}
        onPick={pick}
        onProgress={() => setView('progress')}
        onCalibrate={() => setView('calibrate')}
      />
    );
  }

  if (view === 'progress') {
    return <ProgressPanel progress={progress} onExit={() => setView('home')} />;
  }

  if (view === 'calibrate') {
    return (
      <Calibration
        progress={progress}
        onDone={(p) => {
          setProgress(p);
          setView('home');
        }}
        onExit={() => setView('home')}
      />
    );
  }

  if (view === 'discriminate') {
    return (
      <Discrimination
        progress={progress}
        range={range}
        onResult={handleResult}
        onExit={() => setView('home')}
      />
    );
  }

  return (
    <PracticeScreen
      stage={stage}
      progress={progress}
      range={range}
      onResult={handleResult}
      onExit={() => setView('home')}
    />
  );
}
