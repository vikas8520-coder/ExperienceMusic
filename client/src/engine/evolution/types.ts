export type SectionType = "intro" | "build" | "drop" | "breakdown" | "outro";

export type Section = {
  type: SectionType;
  startSec: number;
  endSec: number;
  confidence?: number;
};

export type AudioFrame = {
  rms: number;
  low: number;
  mid: number;
  high: number;
  onset?: number;
  beatPhase?: number;
  dominantFreq?: number;
  modeIndex?: number;
};

export type Ease = "linear" | "smoothstep" | "expIn" | "expOut";

export type VisualParams = {
  complexity: number;
  warp: number;
  symmetry: number;
  glow: number;
  particles: number;
  saturation: number;
  speed: number;
  zoomPulse: number;
  palette: number;
};

export type PhraseEvents = {
  everyBars: 8 | 16;
  actions: Array<"symmetryShift" | "paletteFlip" | "warpBurst">;
};

export type AIMood = "calm" | "groove" | "lift" | "hype" | "spark";

export type AIEvolutionConfig = {
  enabled: boolean;
  strength?: number; // 0..1
  responsiveness?: number; // 0..1
  creativity?: number; // 0..1
};

export type EvolutionSignals = {
  isDrop: boolean;
  dropIntensity: number; // 0..1
  dropAge: number; // seconds
  mood?: AIMood;
  moodConfidence?: number;
};

export type EvolutionPreset = {
  enabled: boolean;
  base: VisualParams;
  phaseTargets: Partial<Record<SectionType, Partial<VisualParams>>>;
  curves?: {
    defaultEase?: Ease;
    dropPunch?: number;
    settleMs?: number;
  };
  phraseEvents?: PhraseEvents;
  ai?: AIEvolutionConfig;
};

export type AIRuntimeState = {
  emaRms: number;
  emaLow: number;
  emaMid: number;
  emaHigh: number;
  emaOnset: number;
  novelty: number;
  tension: number;
  momentum: number;
  mood: AIMood;
  moodConfidence: number;
  lastMoodSwitchSec: number;
  lastBurstSec: number;
};

export type EvolutionState = {
  lastSectionType?: SectionType;
  lastBeatPhase?: number;
  lastPhraseIndex?: number;
  dropPunchUntil?: number;
  dropStartSec?: number;
  dropIntensity?: number;
  lastEvalTimeSec?: number;
  pulse: {
    warpBurst: number;
    paletteFlip: number;
    symmetryShift: number;
  };
  ai: AIRuntimeState;
};
