import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PerformPanel } from "@/components/settings/PerformPanel";

function makeSettings(overrides: Record<string, any> = {}) {
  return {
    intensity: 1,
    speed: 0.5,
    glowIntensity: 1.0,
    ...overrides,
  };
}

function makeProps(overrides: Record<string, any> = {}) {
  return {
    settings: makeSettings(overrides.settings || {}),
    setSettings: vi.fn(),
    zoom: 1,
    onZoomChange: vi.fn(),
    ...overrides,
  };
}

describe("PerformPanel", () => {
  // ─── Core Rendering ─────────────────────────────────────────────────

  describe("Core Rendering", () => {
    it("renders panel-perform container", () => {
      render(<PerformPanel {...makeProps()} />);
      expect(screen.getByTestId("panel-perform")).toBeTruthy();
    });

    it("renders all 4 parameter cards", () => {
      render(<PerformPanel {...makeProps()} />);
      expect(screen.getByTestId("card-perform-intensity")).toBeTruthy();
      expect(screen.getByTestId("card-perform-speed")).toBeTruthy();
      expect(screen.getByTestId("card-perform-glow")).toBeTruthy();
      expect(screen.getByTestId("card-perform-zoom")).toBeTruthy();
    });

    it("renders all 4 sliders", () => {
      render(<PerformPanel {...makeProps()} />);
      expect(screen.getByTestId("slider-perform-intensity")).toBeTruthy();
      expect(screen.getByTestId("slider-perform-speed")).toBeTruthy();
      expect(screen.getByTestId("slider-perform-glow")).toBeTruthy();
      expect(screen.getByTestId("slider-perform-zoom")).toBeTruthy();
    });
  });

  // ─── Intensity Permutations ─────────────────────────────────────────

  describe("Intensity permutations", () => {
    [0, 0.5, 1, 1.5, 2, 3].forEach((intensity) => {
      it(`renders with intensity=${intensity}`, () => {
        render(<PerformPanel {...makeProps({ settings: { intensity } })} />);
        expect(screen.getByTestId("card-perform-intensity")).toBeTruthy();
      });
    });
  });

  // ─── Speed Permutations ─────────────────────────────────────────────

  describe("Speed permutations", () => {
    [0, 0.25, 0.5, 1, 1.5, 2].forEach((speed) => {
      it(`renders with speed=${speed}`, () => {
        render(<PerformPanel {...makeProps({ settings: { speed } })} />);
        expect(screen.getByTestId("card-perform-speed")).toBeTruthy();
      });
    });
  });

  // ─── Glow Permutations ──────────────────────────────────────────────

  describe("Glow permutations", () => {
    [0, 0.5, 1, 1.5, 2].forEach((glowIntensity) => {
      it(`renders with glowIntensity=${glowIntensity}`, () => {
        render(<PerformPanel {...makeProps({ settings: { glowIntensity } })} />);
        expect(screen.getByTestId("card-perform-glow")).toBeTruthy();
      });
    });
  });

  // ─── Zoom Permutations ──────────────────────────────────────────────

  describe("Zoom permutations", () => {
    [0.5, 0.75, 1, 1.25, 1.5, 2].forEach((zoom) => {
      it(`renders with zoom=${zoom}`, () => {
        render(<PerformPanel {...makeProps({ zoom })} />);
        expect(screen.getByTestId("card-perform-zoom")).toBeTruthy();
      });
    });
  });

  // ─── Cross-Product: Intensity × Speed ───────────────────────────────

  describe("Cross-product: Intensity × Speed", () => {
    const intensities = [0, 1.5, 3];
    const speeds = [0, 1, 2];

    intensities.forEach((intensity) => {
      speeds.forEach((speed) => {
        it(`intensity=${intensity}, speed=${speed}`, () => {
          render(
            <PerformPanel
              {...makeProps({ settings: { intensity, speed } })}
            />
          );
          expect(screen.getByTestId("panel-perform")).toBeTruthy();
        });
      });
    });
  });

  // ─── Optional Props ─────────────────────────────────────────────────

  describe("Optional props: renders without fractal data", () => {
    it("renders without fractalMacros", () => {
      render(<PerformPanel {...makeProps()} />);
      expect(screen.getByTestId("panel-perform")).toBeTruthy();
    });
  });
});
