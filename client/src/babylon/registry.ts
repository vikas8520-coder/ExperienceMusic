import type { BabylonPresetDefinition } from "./types";

// Babylon presets intentionally disabled in main UI.
// Keep this registry empty until new Babylon presets are rebuilt from scratch.
export const BABYLON_PRESETS: Record<string, BabylonPresetDefinition> = {};

export function hasBabylonPreset(presetName: string): boolean {
  return Object.prototype.hasOwnProperty.call(BABYLON_PRESETS, presetName);
}
