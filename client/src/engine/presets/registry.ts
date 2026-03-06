import { MandelbrotPreset } from "./fractals/MandelbrotPreset";
import { JuliaOrbitTrapPreset } from "./fractals/JuliaOrbitTrapPreset";
import { BurningShipPreset, MultibrotPreset, PhoenixPreset, NewtonPreset } from "./fractals/EscapeFamilyPresets";
import { LivingTunnelPreset } from "./fractals/LivingTunnelPreset";
import { GrayScottPreset, CurlFlowPreset } from "./fractals/SimulationFieldPresets";
import { PsyTemplePreset } from "./fractals/PsyTemplePreset";
import type { FractalPreset } from "./types";

export const fractalPresets: Record<string, FractalPreset> = {
  "Mandelbrot Explorer": MandelbrotPreset,
  "Julia Orbit Trap": JuliaOrbitTrapPreset,
  "Burning Ship": BurningShipPreset,
  "Multibrot": MultibrotPreset,
  "Phoenix": PhoenixPreset,
  "Newton": NewtonPreset,
  "Living Tunnel": LivingTunnelPreset,
  "Gray Scott": GrayScottPreset,
  "Curl Flow": CurlFlowPreset,
  "Psy Temple": PsyTemplePreset,
};

export function isFractalPreset(presetName: string): boolean {
  return presetName in fractalPresets;
}

export function getFractalPreset(presetName: string): FractalPreset | undefined {
  return fractalPresets[presetName];
}

export function registerFractalPreset(name: string, preset: FractalPreset): void {
  fractalPresets[name] = preset;
}

export function unregisterFractalPreset(name: string): boolean {
  if (name in fractalPresets) {
    delete fractalPresets[name];
    return true;
  }
  return false;
}
