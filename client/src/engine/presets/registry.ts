import { MandelbrotPreset } from "./fractals/MandelbrotPreset";
import type { FractalPreset } from "./types";

export const fractalPresets: Record<string, FractalPreset> = {
  "Mandelbrot Explorer": MandelbrotPreset,
};

export function isFractalPreset(presetName: string): boolean {
  return presetName in fractalPresets;
}

export function getFractalPreset(presetName: string): FractalPreset | undefined {
  return fractalPresets[presetName];
}
