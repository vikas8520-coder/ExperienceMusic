import type { AIMood } from "@/engine/evolution/types";
import type { TensionSignals } from "@/engine/tension/types";
import type { AutoEvolveDecision, ChaosLevel, MoodPresetMap } from "./moodPresetMap";

export type BrainState = {
  recentPresets: string[];
  lastSwitchTime: number;
  phraseIndex: number;
  chaosSeed: number;
  lastTensionPhase: string;
  lastPaletteShiftTime: number;
};

export function createBrainState(): BrainState {
  return {
    recentPresets: [],
    lastSwitchTime: -999,
    phraseIndex: 0,
    chaosSeed: Math.random() * 2147483647,
    lastTensionPhase: "calm",
    lastPaletteShiftTime: 0,
  };
}

// Simple LCG PRNG for deterministic-ish randomness seeded by chaos
function lcgNext(seed: number): number {
  const next = (seed * 1664525 + 1013904223) & 0x7fffffff;
  return next;
}

function lcgFloat(seed: number): [number, number] {
  const next = lcgNext(seed);
  return [next / 0x7fffffff, next];
}

// --- Chaos-level configuration ---

type ChaosConfig = {
  cooldownSec: number;
  crossMoodChance: number;
  wildCardChance: number;
  repeatAvoid: number;
  transitionMin: number;
  transitionMax: number;
  perturbation: number;
  triggerOnPhaseChange: boolean;
  triggerOnDrop: boolean;
};

const CHAOS_CONFIGS: Record<ChaosLevel, ChaosConfig> = {
  subtle: {
    cooldownSec: 30,
    crossMoodChance: 0.05,
    wildCardChance: 0,
    repeatAvoid: 2,
    transitionMin: 1.5,
    transitionMax: 2.5,
    perturbation: 0.03,
    triggerOnPhaseChange: false,
    triggerOnDrop: false,
  },
  medium: {
    cooldownSec: 15,
    crossMoodChance: 0.15,
    wildCardChance: 0,
    repeatAvoid: 1,
    transitionMin: 0.8,
    transitionMax: 2.0,
    perturbation: 0.08,
    triggerOnPhaseChange: true,
    triggerOnDrop: true,
  },
  aggressive: {
    cooldownSec: 8,
    crossMoodChance: 0.3,
    wildCardChance: 0.1,
    repeatAvoid: 0,
    transitionMin: 0.3,
    transitionMax: 1.5,
    perturbation: 0.2,
    triggerOnPhaseChange: true,
    triggerOnDrop: true,
  },
};

function isPhraseBarBoundary(
  beatPhase: number,
  bpm: number,
  tSec: number,
  state: BrainState,
): boolean {
  if (!bpm || bpm <= 0) return false;
  const beatsPerSec = bpm / 60;
  const barsElapsed = (tSec * beatsPerSec) / 4;
  const phraseIndex = Math.floor(barsElapsed / 16);
  if (phraseIndex !== state.phraseIndex) {
    state.phraseIndex = phraseIndex;
    return true;
  }
  return false;
}

function pickPresetFromPool(
  pool: string[],
  recentPresets: string[],
  repeatAvoid: number,
  seed: number,
): [string | null, number] {
  if (pool.length === 0) return [null, seed];

  // Filter out recent presets
  let candidates = pool;
  if (repeatAvoid > 0) {
    const recentSet = new Set(recentPresets.slice(-repeatAvoid));
    const filtered = pool.filter((p) => !recentSet.has(p));
    if (filtered.length > 0) candidates = filtered;
  }

  // Weighted random pick using LCG
  const [rand, nextSeed] = lcgFloat(seed);
  const idx = Math.floor(rand * candidates.length) % candidates.length;
  return [candidates[idx], nextSeed];
}

function getAllPresets(moodMap: MoodPresetMap): string[] {
  const all = new Set<string>();
  for (const presets of Object.values(moodMap)) {
    for (const p of presets) all.add(p);
  }
  return Array.from(all);
}

export function evaluateSwitch(
  state: BrainState,
  currentPreset: string,
  mood: AIMood | undefined,
  tension: TensionSignals,
  moodMap: MoodPresetMap,
  chaos: ChaosLevel,
  beatPhase: number,
  bpm: number,
  tSec: number,
): AutoEvolveDecision {
  const cfg = CHAOS_CONFIGS[chaos];
  const NO_SWITCH: AutoEvolveDecision = { shouldSwitch: false };

  // Cooldown check
  if (tSec - state.lastSwitchTime < cfg.cooldownSec) {
    return NO_SWITCH;
  }

  // Determine if we should trigger
  let trigger = false;
  let reason = "";

  // Phrase boundary (all chaos levels)
  if (isPhraseBarBoundary(beatPhase, bpm, tSec, state)) {
    trigger = true;
    reason = "phrase boundary (16 bars)";
  }

  // Tension phase change (medium + aggressive)
  if (cfg.triggerOnPhaseChange && tension.phase !== state.lastTensionPhase) {
    trigger = true;
    reason = `tension: ${state.lastTensionPhase} → ${tension.phase}`;
    state.lastTensionPhase = tension.phase;
  } else {
    state.lastTensionPhase = tension.phase;
  }

  // Drop detected (medium + aggressive)
  if (cfg.triggerOnDrop && tension.dropDetected) {
    trigger = true;
    reason = "drop detected";
  }

  // Aggressive: any tension shift triggers
  if (chaos === "aggressive" && tension.tensionLevel > 0.5 && !trigger) {
    // Roll dice on high tension frames
    const [rand, nextSeed] = lcgFloat(state.chaosSeed);
    state.chaosSeed = nextSeed;
    if (rand < 0.02) {
      // ~2% chance per frame at high tension
      trigger = true;
      reason = "tension spike";
    }
  }

  if (!trigger) return NO_SWITCH;

  // Determine target mood pool
  const effectiveMood = mood ?? "groove";
  let pool = moodMap[effectiveMood] ?? [];

  // Cross-mood roll
  const [crossRoll, seed1] = lcgFloat(state.chaosSeed);
  state.chaosSeed = seed1;

  if (crossRoll < cfg.crossMoodChance) {
    // Pick from a different mood
    const moods: AIMood[] = ["calm", "groove", "lift", "hype", "spark"];
    const otherMoods = moods.filter((m) => m !== effectiveMood);
    const [moodRoll, seed2] = lcgFloat(state.chaosSeed);
    state.chaosSeed = seed2;
    const altMood = otherMoods[Math.floor(moodRoll * otherMoods.length) % otherMoods.length];
    pool = moodMap[altMood] ?? pool;
    reason += " (cross-mood)";
  }

  // Wild card roll (aggressive only)
  const [wildRoll, seed3] = lcgFloat(state.chaosSeed);
  state.chaosSeed = seed3;

  if (wildRoll < cfg.wildCardChance) {
    pool = getAllPresets(moodMap);
    reason += " (wild card)";
  }

  // Pick preset
  const [target, seed4] = pickPresetFromPool(pool, state.recentPresets, cfg.repeatAvoid, state.chaosSeed);
  state.chaosSeed = seed4;

  if (!target || target === currentPreset) return NO_SWITCH;

  // Compute transition duration
  const [durRoll, seed5] = lcgFloat(state.chaosSeed);
  state.chaosSeed = seed5;
  const transitionDuration = cfg.transitionMin + durRoll * (cfg.transitionMax - cfg.transitionMin);

  // Record switch
  state.lastSwitchTime = tSec;
  state.recentPresets.push(target);
  if (state.recentPresets.length > 5) {
    state.recentPresets = state.recentPresets.slice(-5);
  }

  return {
    shouldSwitch: true,
    targetPreset: target,
    reason,
    transitionDuration,
  };
}
