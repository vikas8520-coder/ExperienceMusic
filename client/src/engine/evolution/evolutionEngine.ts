import type {
  AIMood,
  AudioFrame,
  Ease,
  EvolutionSignals,
  EvolutionPreset,
  EvolutionState,
  Section,
  SectionType,
  VisualParams,
} from "./types";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const smoothstep = (t: number) => t * t * (3 - 2 * t);
const expIn = (t: number) => t * t;
const expOut = (t: number) => 1 - (1 - t) * (1 - t);

const AI_MOOD_TARGETS: Record<AIMood, Partial<VisualParams>> = {
  calm: {
    complexity: 0.22,
    warp: 0.14,
    symmetry: 0.42,
    glow: 0.14,
    particles: 0.08,
    saturation: 0.26,
    speed: 0.24,
    zoomPulse: 0.08,
    palette: 0.26,
  },
  groove: {
    complexity: 0.42,
    warp: 0.36,
    symmetry: 0.46,
    glow: 0.3,
    particles: 0.24,
    saturation: 0.44,
    speed: 0.44,
    zoomPulse: 0.34,
    palette: 0.44,
  },
  lift: {
    complexity: 0.58,
    warp: 0.5,
    symmetry: 0.52,
    glow: 0.46,
    particles: 0.36,
    saturation: 0.58,
    speed: 0.58,
    zoomPulse: 0.46,
    palette: 0.62,
  },
  hype: {
    complexity: 0.82,
    warp: 0.78,
    symmetry: 0.64,
    glow: 0.78,
    particles: 0.62,
    saturation: 0.78,
    speed: 0.74,
    zoomPulse: 0.86,
    palette: 0.72,
  },
  spark: {
    complexity: 0.66,
    warp: 0.6,
    symmetry: 0.4,
    glow: 0.84,
    particles: 0.48,
    saturation: 0.74,
    speed: 0.66,
    zoomPulse: 0.52,
    palette: 0.9,
  },
};

function applyEase(t: number, mode: Ease | undefined): number {
  const x = clamp01(t);
  if (mode === "linear") return x;
  if (mode === "expIn") return expIn(x);
  if (mode === "expOut") return expOut(x);
  return smoothstep(x);
}

function getActiveSection(sections: Section[], tSec: number): Section {
  if (!sections.length) {
    return {
      type: "intro",
      startSec: 0,
      endSec: Math.max(1, tSec + 1),
    };
  }
  return sections.find((s) => tSec >= s.startSec && tSec < s.endSec) ?? sections[sections.length - 1];
}

function mergeParams(base: VisualParams, patch?: Partial<VisualParams>): VisualParams {
  if (!patch) return base;
  return {
    complexity: patch.complexity ?? base.complexity,
    warp: patch.warp ?? base.warp,
    symmetry: patch.symmetry ?? base.symmetry,
    glow: patch.glow ?? base.glow,
    particles: patch.particles ?? base.particles,
    saturation: patch.saturation ?? base.saturation,
    speed: patch.speed ?? base.speed,
    zoomPulse: patch.zoomPulse ?? base.zoomPulse,
    palette: patch.palette ?? base.palette,
  };
}

function blendParams(a: VisualParams, b: VisualParams, t: number): VisualParams {
  return {
    complexity: lerp(a.complexity, b.complexity, t),
    warp: lerp(a.warp, b.warp, t),
    symmetry: lerp(a.symmetry, b.symmetry, t),
    glow: lerp(a.glow, b.glow, t),
    particles: lerp(a.particles, b.particles, t),
    saturation: lerp(a.saturation, b.saturation, t),
    speed: lerp(a.speed, b.speed, t),
    zoomPulse: lerp(a.zoomPulse, b.zoomPulse, t),
    palette: lerp(a.palette, b.palette, t),
  };
}

function blendTowards(out: VisualParams, target: Partial<VisualParams>, mix: number): VisualParams {
  if (mix <= 0) return out;
  return {
    complexity: target.complexity == null ? out.complexity : lerp(out.complexity, target.complexity, mix),
    warp: target.warp == null ? out.warp : lerp(out.warp, target.warp, mix),
    symmetry: target.symmetry == null ? out.symmetry : lerp(out.symmetry, target.symmetry, mix),
    glow: target.glow == null ? out.glow : lerp(out.glow, target.glow, mix),
    particles: target.particles == null ? out.particles : lerp(out.particles, target.particles, mix),
    saturation: target.saturation == null ? out.saturation : lerp(out.saturation, target.saturation, mix),
    speed: target.speed == null ? out.speed : lerp(out.speed, target.speed, mix),
    zoomPulse: target.zoomPulse == null ? out.zoomPulse : lerp(out.zoomPulse, target.zoomPulse, mix),
    palette: target.palette == null ? out.palette : lerp(out.palette, target.palette, mix),
  };
}

function decayPulse(value: number, dt: number, perSecond: number): number {
  if (dt <= 0 || value <= 0) return value;
  return Math.max(0, value * Math.exp(-perSecond * dt));
}

function runAIAssist(
  out: VisualParams,
  preset: EvolutionPreset,
  audio: AudioFrame,
  state: EvolutionState,
  tSec: number,
  dt: number,
): VisualParams {
  if (!preset.ai?.enabled) return out;

  const aiStrength = clamp01(preset.ai.strength ?? 0.62);
  const responsiveness = clamp01(preset.ai.responsiveness ?? 0.58);
  const creativity = clamp01(preset.ai.creativity ?? 0.5);

  const ai = state.ai;
  const onset = clamp01(audio.onset ?? 0);

  // Online feature tracking (EMA). This is the lightweight "AI" memory.
  const tau = lerp(0.65, 0.18, responsiveness);
  const alpha = clamp01(dt <= 0 ? 0.06 : dt / (tau + dt));

  ai.emaRms = lerp(ai.emaRms, audio.rms, alpha);
  ai.emaLow = lerp(ai.emaLow, audio.low, alpha);
  ai.emaMid = lerp(ai.emaMid, audio.mid, alpha);
  ai.emaHigh = lerp(ai.emaHigh, audio.high, alpha);
  ai.emaOnset = lerp(ai.emaOnset, onset, alpha);

  const noveltyRaw = clamp01(
    (Math.abs(audio.low - ai.emaLow) +
      Math.abs(audio.mid - ai.emaMid) +
      Math.abs(audio.high - ai.emaHigh) +
      Math.abs(audio.rms - ai.emaRms)) *
      1.18,
  );
  ai.novelty = lerp(ai.novelty, noveltyRaw, alpha * 1.35);

  const momentumRaw = clamp01(
    Math.max(0, audio.rms - ai.emaRms) * 2.1 +
      Math.max(0, audio.low - ai.emaLow) * 1.3 +
      onset * 0.45,
  );
  ai.momentum = lerp(ai.momentum, momentumRaw, alpha * 1.15);

  const tensionRaw = clamp01(audio.high * 0.52 + onset * 0.38 + ai.novelty * 0.36);
  ai.tension = lerp(ai.tension, tensionRaw, alpha * 1.2);

  const scores: Record<AIMood, number> = {
    calm: clamp01((1 - audio.rms) * 0.45 + (1 - ai.novelty) * 0.35 + (1 - onset) * 0.2),
    groove: clamp01(audio.low * 0.42 + audio.mid * 0.22 + audio.rms * 0.2 + (1 - audio.high) * 0.16),
    lift: clamp01(audio.mid * 0.36 + audio.high * 0.26 + ai.novelty * 0.24 + ai.momentum * 0.14),
    hype: clamp01(audio.low * 0.3 + onset * 0.34 + audio.rms * 0.2 + ai.tension * 0.16),
    spark: clamp01(audio.high * 0.44 + ai.novelty * 0.32 + onset * 0.24),
  };

  const ranked = (Object.keys(scores) as AIMood[]).sort((a, b) => scores[b] - scores[a]);
  const bestMood = ranked[0];
  const currentMood = ai.mood;
  const bestScore = scores[bestMood];
  const currentScore = scores[currentMood];

  const minHold = lerp(2.4, 0.8, responsiveness * 0.68 + creativity * 0.32);
  const switchThreshold = lerp(0.11, 0.03, creativity);
  if (
    bestMood !== currentMood &&
    bestScore > currentScore + switchThreshold &&
    tSec - ai.lastMoodSwitchSec > minHold
  ) {
    ai.mood = bestMood;
    ai.lastMoodSwitchSec = tSec;

    if (bestMood === "hype") {
      state.pulse.warpBurst = Math.max(state.pulse.warpBurst, 0.74);
    } else if (bestMood === "spark") {
      state.pulse.paletteFlip = Math.max(state.pulse.paletteFlip, 0.6);
    } else if (bestMood === "groove") {
      state.pulse.symmetryShift = Math.max(state.pulse.symmetryShift, 0.48);
    }
  }

  ai.moodConfidence = lerp(ai.moodConfidence, scores[ai.mood], clamp01(dt * 2.4 + 0.06));

  // Detect energetic bursts and generate micro-events without explicit beat grid.
  const burstCooldown = lerp(0.8, 0.28, responsiveness);
  const burstThreshold = clamp01(0.72 - creativity * 0.22 - responsiveness * 0.1);
  if (onset > burstThreshold && tSec - ai.lastBurstSec > burstCooldown) {
    ai.lastBurstSec = tSec;
    state.pulse.warpBurst = Math.max(state.pulse.warpBurst, 0.52 + onset * 0.44);

    if (audio.high > audio.low * 0.95 && ai.novelty > 0.2) {
      state.pulse.paletteFlip = Math.max(state.pulse.paletteFlip, 0.4 + ai.novelty * 0.4);
    }
    if (audio.low > audio.mid && audio.low > audio.high) {
      state.pulse.symmetryShift = Math.max(state.pulse.symmetryShift, 0.36 + audio.low * 0.38);
    }
  }

  const dynamicMix =
    aiStrength * clamp01(0.24 + audio.rms * 0.28 + ai.novelty * 0.28 + ai.tension * 0.2) *
    (0.72 + ai.moodConfidence * 0.28);
  const responseBoost = 0.45 + responsiveness * 0.55;
  const moodMix = clamp01(dynamicMix * responseBoost);

  let aiOut = blendTowards(out, AI_MOOD_TARGETS[ai.mood], moodMix);

  aiOut.zoomPulse = clamp01(aiOut.zoomPulse + ai.momentum * aiStrength * 0.14);
  aiOut.glow = clamp01(aiOut.glow + ai.tension * aiStrength * 0.1);

  if (typeof audio.modeIndex === "number") {
    const modeNorm = clamp01((audio.modeIndex - 1) / 7);
    aiOut.symmetry = clamp01(lerp(aiOut.symmetry, modeNorm, moodMix * (0.08 + creativity * 0.08)));
  }

  if (typeof audio.dominantFreq === "number") {
    const freqNorm = clamp01((audio.dominantFreq - 60) / 420);
    aiOut.palette = clamp01(lerp(aiOut.palette, freqNorm, moodMix * 0.12));
  }

  return aiOut;
}

export function evolveParams(
  preset: EvolutionPreset,
  sections: Section[],
  tSec: number,
  audio: AudioFrame,
  state: EvolutionState,
  opts?: { bpm?: number },
): VisualParams {
  if (!preset.enabled) return preset.base;

  const active = getActiveSection(sections, tSec);
  const secDur = Math.max(0.001, active.endSec - active.startSec);
  const sectionProgress = (tSec - active.startSec) / secDur;
  const eased = applyEase(sectionProgress, preset.curves?.defaultEase ?? "smoothstep");

  const currentTarget = mergeParams(preset.base, preset.phaseTargets[active.type]);
  const prevType: SectionType =
    state.lastSectionType && state.lastSectionType !== active.type ? state.lastSectionType : active.type;
  const prevTarget = mergeParams(preset.base, preset.phaseTargets[prevType]);

  let out = blendParams(prevTarget, currentTarget, eased);

  const enteringNewSection = state.lastSectionType !== active.type;
  if (enteringNewSection) {
    if (active.type === "drop") {
      const punch = clamp01(preset.curves?.dropPunch ?? 0.35);
      const settleMs = preset.curves?.settleMs ?? 250;
      state.dropPunchUntil = tSec + settleMs / 1000;
      out.warp = clamp01(out.warp * (1 + punch));
      out.glow = clamp01(out.glow * (1 + punch * 0.7));
      out.complexity = clamp01(out.complexity * (1 + punch * 0.35));
      out.zoomPulse = clamp01(Math.max(out.zoomPulse, 0.9));
    }
    state.lastSectionType = active.type;
  }

  if (state.dropPunchUntil && tSec < state.dropPunchUntil) {
    const settleSec = Math.max(0.001, (preset.curves?.settleMs ?? 250) / 1000);
    const remain = (state.dropPunchUntil - tSec) / settleSec;
    const k = clamp01(remain);
    out.zoomPulse = clamp01(out.zoomPulse + 0.25 * k);
  }

  if (preset.phraseEvents && opts?.bpm && audio.beatPhase != null) {
    const beatsPerSec = opts.bpm / 60;
    const beatsElapsed = tSec * beatsPerSec;
    const barsElapsed = beatsElapsed / 4;
    const phraseLen = preset.phraseEvents.everyBars;
    const phraseIndex = Math.floor(barsElapsed / phraseLen);

    if (state.lastPhraseIndex == null) {
      state.lastPhraseIndex = phraseIndex;
    }

    if (phraseIndex !== state.lastPhraseIndex) {
      for (const action of preset.phraseEvents.actions) {
        if (action === "warpBurst") state.pulse.warpBurst = 1;
        if (action === "paletteFlip") state.pulse.paletteFlip = 1;
        if (action === "symmetryShift") state.pulse.symmetryShift = 1;
      }
      state.lastPhraseIndex = phraseIndex;
    }
  }

  const dt = Math.max(0, tSec - (state.lastEvalTimeSec ?? tSec));
  state.lastEvalTimeSec = tSec;

  state.pulse.warpBurst = decayPulse(state.pulse.warpBurst, dt, 3.6);
  state.pulse.paletteFlip = decayPulse(state.pulse.paletteFlip, dt, 1.8);
  state.pulse.symmetryShift = decayPulse(state.pulse.symmetryShift, dt, 1.8);

  if (state.pulse.warpBurst > 0) {
    out.warp = clamp01(out.warp + 0.35 * state.pulse.warpBurst);
  }
  if (state.pulse.paletteFlip > 0) {
    out.palette = clamp01(1 - out.palette * (1 - 0.7 * state.pulse.paletteFlip));
  }
  if (state.pulse.symmetryShift > 0) {
    out.symmetry = clamp01(out.symmetry + 0.2 * state.pulse.symmetryShift);
  }

  const onset = clamp01(audio.onset ?? 0);
  out.warp = clamp01(out.warp + audio.low * 0.22 + audio.mid * 0.1);
  out.glow = clamp01(out.glow + audio.high * 0.16 + onset * 0.35);
  out.particles = clamp01(out.particles + audio.mid * 0.14);
  out.speed = clamp01(out.speed * (1 + audio.rms * 0.18));
  out.zoomPulse = clamp01(Math.max(out.zoomPulse, audio.low * 0.55));

  out = runAIAssist(out, preset, audio, state, tSec, dt);

  const dropMood = state.ai.mood === "hype" || state.ai.mood === "spark";
  const dropDrive = clamp01(
    audio.rms * 0.55 +
      audio.low * 0.25 +
      clamp01(audio.onset ?? 0) * 0.2,
  );
  const visualDrive = clamp01(out.warp * 0.38 + out.glow * 0.34 + out.zoomPulse * 0.28);
  const targetDropIntensity = clamp01(dropDrive * 0.7 + visualDrive * 0.3);
  state.dropIntensity = lerp(
    state.dropIntensity ?? 0,
    targetDropIntensity,
    clamp01(dt * 3.6 + 0.06),
  );
  const isDrop = dropMood && (state.dropIntensity ?? 0) > 0.28;
  if (isDrop) {
    if (state.dropStartSec == null) state.dropStartSec = tSec;
  } else {
    state.dropStartSec = undefined;
  }

  (Object.keys(out) as Array<keyof VisualParams>).forEach((key) => {
    out[key] = clamp01(out[key]);
  });

  return out;
}

export function getEvolutionSignals(state: EvolutionState, tSec: number): EvolutionSignals {
  const dropIntensity = clamp01(state.dropIntensity ?? 0);
  const isDrop = state.dropStartSec != null && dropIntensity > 0.05;
  const dropAge = state.dropStartSec != null ? Math.max(0, tSec - state.dropStartSec) : 0;
  return {
    isDrop,
    dropIntensity,
    dropAge,
    mood: state.ai.mood,
    moodConfidence: state.ai.moodConfidence,
  };
}

export function createEvolutionState(): EvolutionState {
  return {
    lastSectionType: undefined,
    lastBeatPhase: undefined,
    lastPhraseIndex: undefined,
    dropPunchUntil: undefined,
    dropStartSec: undefined,
    dropIntensity: 0,
    lastEvalTimeSec: undefined,
    pulse: {
      warpBurst: 0,
      paletteFlip: 0,
      symmetryShift: 0,
    },
    ai: {
      emaRms: 0,
      emaLow: 0,
      emaMid: 0,
      emaHigh: 0,
      emaOnset: 0,
      novelty: 0,
      tension: 0,
      momentum: 0,
      mood: "groove",
      moodConfidence: 0.5,
      lastMoodSwitchSec: 0,
      lastBurstSec: 0,
    },
  };
}
