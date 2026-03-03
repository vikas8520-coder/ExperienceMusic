import { describe, it, expect } from "vitest";
import {
  convertAudioForButterchurn,
  MILKDROP_PRESET_NAMES,
  MILKDROP_PRESET_MAP,
  isMilkdropPreset,
  resolveButterchurnPresetKey,
} from "@/engine/milkdrop/MilkdropBridge";
import type { AudioData } from "@/hooks/use-audio-analyzer";

function createMockAudioData(overrides: Partial<AudioData> = {}): AudioData {
  return {
    sub: 0.5,
    bass: 0.6,
    mid: 0.4,
    high: 0.3,
    energy: 0.5,
    kick: 0.2,
    dominantFreq: 200,
    modeIndex: 4,
    frequencyData: new Uint8Array(1024).fill(128),
    bpm: 120,
    beatPhase: 0.5,
    bpmSin1: 0,
    bpmSin2: 0,
    bpmSin4: 0,
    bpmCos1: -1,
    bassHits: 2,
    bassPresence: 0.5,
    ...overrides,
  };
}

describe("MilkdropBridge — Audio Conversion", () => {
  it("produces 512-bin frequency data", () => {
    const audioData = createMockAudioData();
    const { frequencyData } = convertAudioForButterchurn(audioData);

    expect(frequencyData).toBeInstanceOf(Uint8Array);
    expect(frequencyData.length).toBe(512);
  });

  it("produces 512-sample waveform data", () => {
    const audioData = createMockAudioData();
    const { waveformData } = convertAudioForButterchurn(audioData);

    expect(waveformData).toBeInstanceOf(Uint8Array);
    expect(waveformData.length).toBe(1024);
  });

  it("handles empty frequency data gracefully", () => {
    const audioData = createMockAudioData({
      frequencyData: new Uint8Array(0),
    });

    const { frequencyData, waveformData } = convertAudioForButterchurn(audioData);
    expect(frequencyData.length).toBe(512);
    expect(waveformData.length).toBe(1024);
    // With no frequency data, all bins should be 0
    expect(frequencyData.every((v) => v === 0)).toBe(true);
  });

  it("resamples 1024 bins to 512 correctly", () => {
    const inputData = new Uint8Array(1024);
    inputData[0] = 255;
    inputData[1] = 200;

    const audioData = createMockAudioData({ frequencyData: inputData });
    const { frequencyData } = convertAudioForButterchurn(audioData);

    // First bin should be from index 0 of source (ratio = 2)
    expect(frequencyData[0]).toBe(255);
  });

  it("waveform values stay within 0-255 range", () => {
    const audioData = createMockAudioData({
      bass: 1.0,
      mid: 1.0,
      high: 1.0,
    });

    const { waveformData } = convertAudioForButterchurn(audioData);
    for (const val of waveformData) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(255);
    }
  });
});

describe("MilkDrop Preset Names", () => {
  it("has at least 20 curated presets", () => {
    expect(MILKDROP_PRESET_NAMES.length).toBe(20);
  });

  it("all entries are non-empty strings", () => {
    for (const name of MILKDROP_PRESET_NAMES) {
      expect(typeof name).toBe("string");
      expect(name.length).toBeGreaterThan(0);
    }
  });
});

describe("MILKDROP_PRESET_MAP", () => {
  it("maps 5 UI preset names to butterchurn keys", () => {
    expect(Object.keys(MILKDROP_PRESET_MAP).length).toBe(5);
  });

  it("all keys start with 'MilkDrop:'", () => {
    for (const key of Object.keys(MILKDROP_PRESET_MAP)) {
      expect(key.startsWith("MilkDrop:")).toBe(true);
    }
  });

  it("all values are present in MILKDROP_PRESET_NAMES", () => {
    for (const value of Object.values(MILKDROP_PRESET_MAP)) {
      expect(MILKDROP_PRESET_NAMES).toContain(value);
    }
  });
});

describe("isMilkdropPreset", () => {
  it("returns true for MilkDrop: prefixed names", () => {
    expect(isMilkdropPreset("MilkDrop: Bass Kicks")).toBe(true);
    expect(isMilkdropPreset("MilkDrop: Cosmic Dust")).toBe(true);
    expect(isMilkdropPreset("MilkDrop: Unknown")).toBe(true);
  });

  it("returns false for non-MilkDrop names", () => {
    expect(isMilkdropPreset("Energy Rings")).toBe(false);
    expect(isMilkdropPreset("Psy Tunnel")).toBe(false);
    expect(isMilkdropPreset("")).toBe(false);
  });
});

describe("resolveButterchurnPresetKey", () => {
  it("resolves known UI names to butterchurn keys", () => {
    expect(resolveButterchurnPresetKey("MilkDrop: Bass Kicks")).toBe(
      "Flexi - smashing fractals [acid etching mix]",
    );
    expect(resolveButterchurnPresetKey("MilkDrop: Fractopia")).toBe(
      "flexi - patternton, district of media, capitol of the united abstractions of fractopia",
    );
  });

  it("returns undefined for unknown names", () => {
    expect(resolveButterchurnPresetKey("MilkDrop: Unknown")).toBeUndefined();
    expect(resolveButterchurnPresetKey("Energy Rings")).toBeUndefined();
  });
});
