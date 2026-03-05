import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PresetsPanel } from "@/components/settings/PresetsPanel";

function makeSettings(overrides: Record<string, any> = {}) {
  return {
    presetName: "Energy Rings" as const,
    presetEnabled: true,
    ...overrides,
  };
}

describe("PresetsPanel", () => {
  // ─── Core Rendering ─────────────────────────────────────────────────

  describe("Core Rendering", () => {
    it("renders panel-presets container", () => {
      render(
        <PresetsPanel
          settings={makeSettings()}
          setSettings={vi.fn()}
          onSavePreset={vi.fn()}
        />
      );
      expect(screen.getByTestId("panel-presets")).toBeTruthy();
    });

    it("renders preset enabled toggle", () => {
      render(
        <PresetsPanel
          settings={makeSettings()}
          setSettings={vi.fn()}
          onSavePreset={vi.fn()}
        />
      );
      expect(screen.getByTestId("toggle-preset-enabled")).toBeTruthy();
    });

    it("renders save preset button", () => {
      render(
        <PresetsPanel
          settings={makeSettings()}
          setSettings={vi.fn()}
          onSavePreset={vi.fn()}
        />
      );
      expect(screen.getByTestId("button-save-preset")).toBeTruthy();
    });
  });

  // ─── Preset Enabled Permutations ────────────────────────────────────

  describe("Preset enabled permutations", () => {
    [true, false].forEach((enabled) => {
      it(`renders with presetEnabled=${enabled}`, () => {
        render(
          <PresetsPanel
            settings={makeSettings({ presetEnabled: enabled })}
            setSettings={vi.fn()}
            onSavePreset={vi.fn()}
          />
        );
        expect(screen.getByTestId("panel-presets")).toBeTruthy();
      });
    });
  });

  // ─── Preset Name Permutations ───────────────────────────────────────

  describe("Preset name permutations (sample)", () => {
    const presetNames = [
      "Energy Rings",
      "Neon Tunnel",
      "Particle Storm",
      "Cosmic Web",
      "Waveform",
      "DNA Helix",
    ] as const;

    presetNames.forEach((name) => {
      it(`renders with presetName="${name}"`, () => {
        render(
          <PresetsPanel
            settings={makeSettings({ presetName: name })}
            setSettings={vi.fn()}
            onSavePreset={vi.fn()}
          />
        );
        expect(screen.getByTestId("panel-presets")).toBeTruthy();
      });
    });
  });

  // ─── Callbacks ──────────────────────────────────────────────────────

  describe("Callbacks fire correctly", () => {
    it("calls onSavePreset when save button clicked", () => {
      const onSavePreset = vi.fn();
      render(
        <PresetsPanel
          settings={makeSettings()}
          setSettings={vi.fn()}
          onSavePreset={onSavePreset}
        />
      );
      fireEvent.click(screen.getByTestId("button-save-preset"));
      expect(onSavePreset).toHaveBeenCalledTimes(1);
    });

    it("calls setSettings when preset enabled toggled", () => {
      const setSettings = vi.fn();
      render(
        <PresetsPanel
          settings={makeSettings()}
          setSettings={setSettings}
          onSavePreset={vi.fn()}
        />
      );
      fireEvent.click(screen.getByTestId("toggle-preset-enabled"));
      expect(setSettings).toHaveBeenCalled();
    });
  });
});
