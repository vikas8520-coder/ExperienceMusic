import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EffectsPanel } from "@/components/settings/EffectsPanel";

function makeSettings(overrides: Record<string, any> = {}) {
  return {
    imageFilters: ["none" as const],
    psyOverlays: [] as ("blueTunnel" | "bwVortex" | "rainbowSpiral" | "redMandala")[],
    trailsOn: false,
    darkOverlay: false,
    ...overrides,
  };
}

describe("EffectsPanel", () => {
  // ─── Core Rendering ─────────────────────────────────────────────────

  describe("Core Rendering", () => {
    it("renders panel-effects container", () => {
      render(<EffectsPanel settings={makeSettings()} setSettings={vi.fn()} />);
      expect(screen.getByTestId("panel-effects")).toBeTruthy();
    });

    it("renders trails toggle", () => {
      render(<EffectsPanel settings={makeSettings()} setSettings={vi.fn()} />);
      expect(screen.getByTestId("toggle-trails")).toBeTruthy();
    });

    it("renders dark overlay toggle", () => {
      render(<EffectsPanel settings={makeSettings()} setSettings={vi.fn()} />);
      expect(screen.getByTestId("toggle-dark-overlay")).toBeTruthy();
    });
  });

  // ─── Trails × DarkOverlay permutations ──────────────────────────────

  describe("Trails × DarkOverlay permutations", () => {
    const combos = [
      { trailsOn: false, darkOverlay: false },
      { trailsOn: false, darkOverlay: true },
      { trailsOn: true, darkOverlay: false },
      { trailsOn: true, darkOverlay: true },
    ];

    combos.forEach(({ trailsOn, darkOverlay }) => {
      it(`trailsOn=${trailsOn}, darkOverlay=${darkOverlay}`, () => {
        render(
          <EffectsPanel
            settings={makeSettings({ trailsOn, darkOverlay })}
            setSettings={vi.fn()}
          />
        );
        expect(screen.getByTestId("toggle-trails")).toBeTruthy();
        expect(screen.getByTestId("toggle-dark-overlay")).toBeTruthy();
      });
    });
  });

  // ─── Image Filter Permutations ──────────────────────────────────────

  describe("Image filter permutations", () => {
    const filters = ["kaleidoscope", "mirror", "colorshift", "invert", "pixelate", "rgbsplit", "wave", "zoompulse"];

    filters.forEach((filter) => {
      it(`renders with active filter: ${filter}`, () => {
        render(
          <EffectsPanel
            settings={makeSettings({ imageFilters: [filter] })}
            setSettings={vi.fn()}
          />
        );
        expect(screen.getByTestId(`filter-toggle-${filter}`)).toBeTruthy();
      });
    });

    it("renders with no filters (none)", () => {
      render(
        <EffectsPanel
          settings={makeSettings({ imageFilters: ["none"] })}
          setSettings={vi.fn()}
        />
      );
      expect(screen.getByTestId("panel-effects")).toBeTruthy();
    });

    it("renders with multiple filters", () => {
      render(
        <EffectsPanel
          settings={makeSettings({ imageFilters: ["invert", "sepia", "blur"] })}
          setSettings={vi.fn()}
        />
      );
      expect(screen.getByTestId("panel-effects")).toBeTruthy();
    });
  });

  // ─── Psy Overlay Permutations ───────────────────────────────────────

  describe("Psy overlay permutations", () => {
    const overlays = ["blueTunnel", "bwVortex", "rainbowSpiral", "redMandala"];

    overlays.forEach((overlay) => {
      it(`renders overlay toggle for ${overlay}`, () => {
        render(
          <EffectsPanel
            settings={makeSettings({ psyOverlays: [overlay] })}
            setSettings={vi.fn()}
          />
        );
        expect(screen.getByTestId(`overlay-toggle-${overlay}`)).toBeTruthy();
      });
    });

    it("renders with no overlays", () => {
      render(
        <EffectsPanel settings={makeSettings({ psyOverlays: [] })} setSettings={vi.fn()} />
      );
      expect(screen.getByTestId("panel-effects")).toBeTruthy();
    });

    it("renders with all overlays active", () => {
      render(
        <EffectsPanel
          settings={makeSettings({ psyOverlays: overlays })}
          setSettings={vi.fn()}
        />
      );
      overlays.forEach((overlay) => {
        expect(screen.getByTestId(`overlay-toggle-${overlay}`)).toBeTruthy();
      });
    });
  });

  // ─── Callbacks ──────────────────────────────────────────────────────

  describe("Toggle callbacks fire correctly", () => {
    it("calls setSettings when trails toggled", () => {
      const setSettings = vi.fn();
      render(<EffectsPanel settings={makeSettings()} setSettings={setSettings} />);
      fireEvent.click(screen.getByTestId("toggle-trails"));
      expect(setSettings).toHaveBeenCalled();
    });

    it("calls setSettings when dark overlay toggled", () => {
      const setSettings = vi.fn();
      render(<EffectsPanel settings={makeSettings()} setSettings={setSettings} />);
      fireEvent.click(screen.getByTestId("toggle-dark-overlay"));
      expect(setSettings).toHaveBeenCalled();
    });
  });
});
