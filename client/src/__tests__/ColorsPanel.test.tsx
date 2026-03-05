import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorsPanel } from "@/components/settings/ColorsPanel";

function makeColorSettings(overrides: Record<string, any> = {}) {
  return {
    mode: "gradient" as const,
    primaryColor: "#a855f7",
    secondaryColor: "#06b6d4",
    tertiaryColor: "#f43f5e",
    moodPreset: "cosmic" as const,
    customColors: [],
    spectrumSpeed: 1,
    spectrumOffset: 0,
    aiColors: [],
    ...overrides,
  };
}

describe("ColorsPanel", () => {
  const palette = ["#ff0000", "#00ff00", "#0000ff", "#ff00ff", "#00ffff", "#ffff00", "#ffffff", "#000000"];

  // ─── Core Rendering ─────────────────────────────────────────────────

  describe("Core Rendering", () => {
    it("renders panel-colors container", () => {
      render(
        <ColorsPanel
          colorSettings={makeColorSettings()}
          setColorSettings={vi.fn()}
          colorPalette={palette}
        />
      );
      expect(screen.getByTestId("panel-colors")).toBeTruthy();
    });
  });

  // ─── Color Mode Permutations ────────────────────────────────────────

  describe("Color mode permutations", () => {
    const modes = ["single", "gradient", "triadic", "mood", "spectrum"] as const;

    modes.forEach((mode) => {
      it(`renders with mode=${mode}`, () => {
        render(
          <ColorsPanel
            colorSettings={makeColorSettings({ mode })}
            setColorSettings={vi.fn()}
            colorPalette={palette}
          />
        );
        expect(screen.getByTestId("panel-colors")).toBeTruthy();
      });
    });

    // Mode button testids
    modes.forEach((mode) => {
      it(`renders mode button for ${mode}`, () => {
        render(
          <ColorsPanel
            colorSettings={makeColorSettings()}
            setColorSettings={vi.fn()}
            colorPalette={palette}
          />
        );
        expect(screen.getByTestId(`button-color-mode-${mode}`)).toBeTruthy();
      });
    });
  });

  // ─── Mode-specific Conditional Rendering ────────────────────────────

  describe("Mode-specific conditional rendering", () => {
    it("shows primary color input for single mode", () => {
      render(
        <ColorsPanel
          colorSettings={makeColorSettings({ mode: "single" })}
          setColorSettings={vi.fn()}
          colorPalette={palette}
        />
      );
      expect(screen.getByTestId("input-color-primary")).toBeTruthy();
    });

    it("shows primary + secondary for gradient mode", () => {
      render(
        <ColorsPanel
          colorSettings={makeColorSettings({ mode: "gradient" })}
          setColorSettings={vi.fn()}
          colorPalette={palette}
        />
      );
      expect(screen.getByTestId("input-color-primary")).toBeTruthy();
      expect(screen.getByTestId("input-color-secondary")).toBeTruthy();
    });

    it("shows primary + secondary + tertiary for triadic mode", () => {
      render(
        <ColorsPanel
          colorSettings={makeColorSettings({ mode: "triadic" })}
          setColorSettings={vi.fn()}
          colorPalette={palette}
        />
      );
      expect(screen.getByTestId("input-color-primary")).toBeTruthy();
      expect(screen.getByTestId("input-color-secondary")).toBeTruthy();
      expect(screen.getByTestId("input-color-tertiary")).toBeTruthy();
    });

    it("shows spectrum speed slider for spectrum mode", () => {
      render(
        <ColorsPanel
          colorSettings={makeColorSettings({ mode: "spectrum" })}
          setColorSettings={vi.fn()}
          colorPalette={palette}
        />
      );
      expect(screen.getByTestId("slider-spectrum-speed")).toBeTruthy();
    });
  });

  // ─── Mood Presets (when mode=mood) ──────────────────────────────────

  describe("Mood preset buttons (mode=mood)", () => {
    const moods = ["energetic", "calm", "dark", "ethereal", "fire", "ice", "forest", "cosmic"];

    moods.forEach((mood) => {
      it(`renders mood button for ${mood}`, () => {
        render(
          <ColorsPanel
            colorSettings={makeColorSettings({ mode: "mood" })}
            setColorSettings={vi.fn()}
            colorPalette={palette}
          />
        );
        expect(screen.getByTestId(`button-mood-${mood}`)).toBeTruthy();
      });
    });
  });

  // ─── Mode Switch Callbacks ──────────────────────────────────────────

  describe("Mode switch callbacks", () => {
    const modes = ["single", "gradient", "triadic", "mood", "spectrum"] as const;

    modes.forEach((mode) => {
      it(`clicking mode ${mode} calls setColorSettings`, () => {
        const setColorSettings = vi.fn();
        render(
          <ColorsPanel
            colorSettings={makeColorSettings({ mode: "single" })}
            setColorSettings={setColorSettings}
            colorPalette={palette}
          />
        );
        fireEvent.click(screen.getByTestId(`button-color-mode-${mode}`));
        expect(setColorSettings).toHaveBeenCalled();
      });
    });
  });

  // ─── Palette Rendering ──────────────────────────────────────────────

  describe("Palette rendering", () => {
    it("renders with empty palette", () => {
      render(
        <ColorsPanel
          colorSettings={makeColorSettings()}
          setColorSettings={vi.fn()}
          colorPalette={[]}
        />
      );
      expect(screen.getByTestId("panel-colors")).toBeTruthy();
    });

    it("renders with full palette", () => {
      render(
        <ColorsPanel
          colorSettings={makeColorSettings()}
          setColorSettings={vi.fn()}
          colorPalette={palette}
        />
      );
      expect(screen.getByTestId("panel-colors")).toBeTruthy();
    });
  });
});
