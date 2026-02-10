import { MandelbrotPreset } from "./fractals/MandelbrotPreset";
import { JuliaOrbitTrapPreset } from "./fractals/JuliaOrbitTrapPreset";
import type { FractalPreset } from "./types";

export const fractalPresets: Record<string, FractalPreset> = {
  "Mandelbrot Explorer": MandelbrotPreset,
  "Julia Orbit Trap": JuliaOrbitTrapPreset,
};

export function isFractalPreset(presetName: string): boolean {
  return presetName in fractalPresets;
}

export function getFractalPreset(presetName: string): FractalPreset | undefined {
  return fractalPresets[presetName];
}
