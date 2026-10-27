export type Note = {
  midi: number;
  start: number;
  dur: number;
};

export type Phrase = {
  id: string;
  name: string;
  level: 1 | 2 | 3;
  bpm: number;
  notes: Note[];
};

export type StageId =
  | 'calibrate'
  | 'discriminate'
  | 'longtone'
  | 'interval'
  | 'phrase'
  | 'challenge';

export type Round = {
  stage: StageId;
  label: string;
  hint: string;
  notes: Note[];
  bpm: number;
  phraseName?: string;
};

export type NoteResult = {
  midi: number;
  meanCents: number;
  meanAbsCents: number;
  onsetCents: number;
  hitRate: number;
  std: number;
  frames: number;
};

export type RoundResult = {
  stage: StageId;
  score: number;
  meanAbsCents: number;
  hitRate: number;
  noteResults: NoteResult[];
  intervals: { semitones: number; direction: 1 | -1; meanCents: number }[];
  heard: boolean;
  label: string;
  passed: boolean;
};

export type SessionRecord = {
  ts: number;
  stage: StageId;
  score: number;
  meanAbsCents: number;
  hitRate: number;
  label: string;
  intervals?: { semitones: number; direction: 1 | -1; meanCents: number }[];
};

export type AnalyticsEvent = {
  ts: number;
  type: string;
  payload: Record<string, string | number | boolean>;
};

export type Progress = {
  version: number;
  stage: StageId;
  difficulty: number;
  range: { low: number; high: number } | null;
  history: SessionRecord[];
  events: AnalyticsEvent[];
  hitStreak: number;
  missStreak: number;
  lastDay: string | null;
  streak: number;
  todayCount: number;
  todayDay: string | null;
  unlocked: StageId[];
};
