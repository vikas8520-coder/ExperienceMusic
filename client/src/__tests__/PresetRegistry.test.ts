import { describe, it, expect } from "vitest";
import { fractalPresets, isFractalPreset, getFractalPreset } from "@/engine/presets/registry";

describe("Preset Registry", () => {
  it("has 9 registered fractal presets", () => {
    const names = Object.keys(fractalPresets);
    expect(names.length).toBe(9);
  });

  it("includes all expected presets", () => {
    const expected = [
      "Mandelbrot Explorer",
      "Julia Orbit Trap",
      "Burning Ship",
      "Multibrot",
      "Phoenix",
      "Newton",
      "Living Tunnel",
      "Gray Scott",
      "Curl Flow",
    ];

    for (const name of expected) {
      expect(isFractalPreset(name)).toBe(true);
    }
  });

  it("each preset has required fields", () => {
    for (const [name, preset] of Object.entries(fractalPresets)) {
      expect(preset.id).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.category).toBeTruthy();
      expect(typeof preset.init).toBe("function");
      expect(typeof preset.update).toBe("function");
      expect(typeof preset.dispose).toBe("function");
    }
  });

  it("no duplicate IDs", () => {
    const ids = Object.values(fractalPresets).map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("getFractalPreset returns undefined for unknown presets", () => {
    expect(getFractalPreset("NonExistent")).toBeUndefined();
  });

  it("isFractalPreset returns false for non-fractal presets", () => {
    expect(isFractalPreset("Energy Rings")).toBe(false);
    expect(isFractalPreset("")).toBe(false);
  });
});
