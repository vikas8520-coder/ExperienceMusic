import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AudioPanel } from "@/components/settings/AudioPanel";
import type { AudioData } from "@/hooks/use-audio-analyzer";

const mockAudioData: AudioData = {
  sub: 0.3, bass: 0.5, mid: 0.4, high: 0.2, energy: 0.6, kick: 0.1,
  dominantFreq: 200, modeIndex: 1,
  frequencyData: new Uint8Array(128),
  bpm: 128, beatPhase: 0.5,
  bpmSin1: 0.7, bpmSin2: 0.3, bpmSin4: 0.1, bpmCos1: 0.9,
  bassHits: 2, bassPresence: 0.8,
};

describe("AudioPanel", () => {
  // ─── Core Rendering ─────────────────────────────────────────────────

  describe("Core Rendering", () => {
    it("renders panel-audio container", () => {
      render(
        <AudioPanel
          getAudioData={() => mockAudioData}
          micStatus="idle"
          onToggleMicReactivity={vi.fn()}
        />
      );
      expect(screen.getByTestId("panel-audio")).toBeTruthy();
    });

    it("renders mic toggle button", () => {
      render(
        <AudioPanel
          getAudioData={() => mockAudioData}
          micStatus="idle"
          onToggleMicReactivity={vi.fn()}
        />
      );
      expect(screen.getByTestId("button-mic-toggle")).toBeTruthy();
    });
  });

  // ─── Mic Status Permutations ────────────────────────────────────────

  describe("Mic status permutations", () => {
    (["idle", "starting", "running", "error"] as const).forEach((status) => {
      it(`renders with micStatus=${status}`, () => {
        render(
          <AudioPanel
            getAudioData={() => mockAudioData}
            micStatus={status}
            onToggleMicReactivity={vi.fn()}
          />
        );
        expect(screen.getByTestId("panel-audio")).toBeTruthy();
        expect(screen.getByTestId("button-mic-toggle")).toBeTruthy();
      });
    });
  });

  // ─── Audio Data Permutations ────────────────────────────────────────

  describe("Audio data permutations", () => {
    const audioVariants = [
      { desc: "silent", data: { ...mockAudioData, sub: 0, bass: 0, mid: 0, high: 0, energy: 0, bpm: 0 } },
      { desc: "low energy", data: { ...mockAudioData, energy: 0.1, bpm: 60 } },
      { desc: "medium energy", data: { ...mockAudioData, energy: 0.5, bpm: 120 } },
      { desc: "high energy", data: { ...mockAudioData, energy: 1.0, bpm: 180, bass: 1.0 } },
      { desc: "bass-heavy", data: { ...mockAudioData, sub: 1.0, bass: 1.0, mid: 0.1, high: 0.1 } },
      { desc: "treble-heavy", data: { ...mockAudioData, sub: 0.1, bass: 0.1, mid: 0.8, high: 1.0 } },
    ];

    audioVariants.forEach(({ desc, data }) => {
      it(`renders correctly with ${desc} audio data`, () => {
        render(
          <AudioPanel
            getAudioData={() => data}
            micStatus="idle"
            onToggleMicReactivity={vi.fn()}
          />
        );
        expect(screen.getByTestId("panel-audio")).toBeTruthy();
      });
    });
  });

  // ─── Mic Status × Audio Data cross-product ─────────────────────────

  describe("Mic status × Audio energy cross-product", () => {
    const statuses = ["idle", "starting", "running", "error"] as const;
    const energies = [0, 0.5, 1.0];

    statuses.forEach((status) => {
      energies.forEach((energy) => {
        it(`micStatus=${status}, energy=${energy}`, () => {
          render(
            <AudioPanel
              getAudioData={() => ({ ...mockAudioData, energy })}
              micStatus={status}
              onToggleMicReactivity={vi.fn()}
            />
          );
          expect(screen.getByTestId("panel-audio")).toBeTruthy();
        });
      });
    });
  });

  // ─── Callback ───────────────────────────────────────────────────────

  describe("Callbacks fire correctly", () => {
    it("calls onToggleMicReactivity when mic button clicked", () => {
      const onToggleMicReactivity = vi.fn();
      render(
        <AudioPanel
          getAudioData={() => mockAudioData}
          micStatus="idle"
          onToggleMicReactivity={onToggleMicReactivity}
        />
      );
      fireEvent.click(screen.getByTestId("button-mic-toggle"));
      expect(onToggleMicReactivity).toHaveBeenCalledTimes(1);
    });

    (["idle", "starting", "running", "error"] as const).forEach((status) => {
      it(`mic toggle fires in micStatus=${status}`, () => {
        const onToggle = vi.fn();
        render(
          <AudioPanel
            getAudioData={() => mockAudioData}
            micStatus={status}
            onToggleMicReactivity={onToggle}
          />
        );
        fireEvent.click(screen.getByTestId("button-mic-toggle"));
        expect(onToggle).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ─── Optional Props ─────────────────────────────────────────────────

  describe("Optional props: renders without getAudioData", () => {
    it("renders with no getAudioData prop", () => {
      render(
        <AudioPanel
          micStatus="idle"
          onToggleMicReactivity={vi.fn()}
        />
      );
      expect(screen.getByTestId("panel-audio")).toBeTruthy();
    });
  });
});
