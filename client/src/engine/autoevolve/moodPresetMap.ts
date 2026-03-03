import type { AIMood } from "@/engine/evolution/types";
import type { TensionPhase } from "@/engine/tension/types";

export type MoodPresetMap = Record<AIMood, string[]>;

export type ChaosLevel = "subtle" | "medium" | "aggressive";

export type AutoEvolveConfig = {
  enabled: boolean;
  chaos: ChaosLevel;
  moodMap: MoodPresetMap;
};

export type AutoEvolveDecision = {
  shouldSwitch: boolean;
  targetPreset?: string;
  reason?: string;
  transitionDuration?: number;
};

export type AutoEvolveOutput = {
  tensionLevel: number;
  tensionPhase: TensionPhase;
  currentMood?: AIMood;
  lastSwitchReason?: string;
  enabled: boolean;
};

const STORAGE_KEY = "auralvis-autoevolve-mood-map";

export const DEFAULT_MOOD_PRESET_MAP: MoodPresetMap = {
  calm: ["Cosmic Web", "Water Membrane Orb", "Gray Scott", "MilkDrop: Cosmic Dust"],
  groove: ["Energy Rings", "Audio Bars", "Cymatic Sand Plate", "Chladni Geometry"],
  lift: ["Psy Tunnel", "Particle Field", "Resonant Field Lines", "Julia Orbit Trap"],
  hype: ["Psy Extra", "Geometric Kaleidoscope", "Burning Ship", "MilkDrop: Bass Kicks", "MilkDrop: Fractopia"],
  spark: ["Waveform Sphere", "Mandelbrot Explorer", "MilkDrop: Drain to Heaven"],
};

export function loadMoodPresetMap(): MoodPresetMap {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate structure: must have all 5 moods with string arrays
      const moods: AIMood[] = ["calm", "groove", "lift", "hype", "spark"];
      const valid = moods.every(
        (m) => Array.isArray(parsed[m]) && parsed[m].every((p: unknown) => typeof p === "string"),
      );
      if (valid) return parsed;
    }
  } catch {
    // Fall through to default
  }
  return { ...DEFAULT_MOOD_PRESET_MAP };
}

export function saveMoodPresetMap(map: MoodPresetMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

export function createDefaultAutoEvolveConfig(): AutoEvolveConfig {
  return {
    enabled: false,
    chaos: "medium",
    moodMap: loadMoodPresetMap(),
  };
}
