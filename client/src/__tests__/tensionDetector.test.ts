import { describe, it, expect } from "vitest";
import { createTensionState, updateTension } from "@/engine/tension/tensionDetector";
import type { AudioData } from "@/hooks/use-audio-analyzer";

function makeAudio(overrides: Partial<AudioData> = {}): AudioData {
  return {
    sub: 0,
    bass: 0,
    mid: 0,
    high: 0,
    energy: 0,
    kick: 0,
    dominantFreq: 220,
    modeIndex: 1,
    frequencyData: new Uint8Array(128),
    bpm: 120,
    beatPhase: 0,
    bpmSin1: 0,
    bpmSin2: 0,
    bpmSin4: 0,
    bpmCos1: 1,
    bassHits: 0,
    bassPresence: 0,
    ...overrides,
  };
}

describe("Tension Detector", () => {
  describe("createTensionState", () => {
    it("creates initial state with zero-filled buffers", () => {
      const state = createTensionState();
      expect(state.centroidBuffer).toBeInstanceOf(Float32Array);
      expect(state.centroidBuffer.length).toBe(480);
      expect(state.energyBuffer.length).toBe(480);
      expect(state.bufferIndex).toBe(0);
      expect(state.bufferFilled).toBe(0);
      expect(state.phase).toBe("calm");
      expect(state.onsetTimestamps).toEqual([]);
    });
  });

  describe("phase transitions", () => {
    it("transitions from calm to building when tension rises above 0.25", () => {
      const state = createTensionState();
      // Feed several frames of high energy to build up tension
      for (let t = 0; t < 200; t++) {
        const signals = updateTension(state, makeAudio({ energy: 0.7, high: 0.6, mid: 0.5, kick: 0.5 }), 0, t * 0.016 + 3);
        if (signals.phase === "building") {
          expect(signals.tensionLevel).toBeGreaterThanOrEqual(0.2);
          return;
        }
      }
      // Should have transitioned at some point
      expect(state.phase).toBe("building");
    });

    it("transitions from building to peak when tension exceeds 0.7", () => {
      const state = createTensionState();
      state.phase = "building";
      state.phaseStartTime = 0;
      // Feed very high energy frames
      let reachedPeak = false;
      for (let t = 0; t < 300; t++) {
        const signals = updateTension(
          state,
          makeAudio({ energy: 0.95, high: 0.9, mid: 0.8, bass: 0.9, kick: 0.8 }),
          0.5,
          t * 0.016,
        );
        if (signals.phase === "peak") {
          reachedPeak = true;
          break;
        }
      }
      expect(reachedPeak).toBe(true);
    });

    it("transitions from peak to releasing when tension drops", () => {
      const state = createTensionState();
      state.phase = "peak";
      state.phaseStartTime = 0;
      // Fill buffer with high values first
      for (let i = 0; i < 240; i++) {
        updateTension(state, makeAudio({ energy: 0.9, high: 0.8, mid: 0.7 }), 0, i * 0.016);
      }
      // Then drop to low values
      let released = false;
      for (let t = 240; t < 400; t++) {
        const signals = updateTension(state, makeAudio({ energy: 0.1, high: 0.05, mid: 0.1 }), 0, t * 0.016);
        if (signals.phase === "releasing") {
          released = true;
          break;
        }
      }
      expect(released).toBe(true);
    });

    it("transitions from releasing to calm after hold period", () => {
      const state = createTensionState();
      state.phase = "releasing";
      state.phaseStartTime = 0;
      // Keep low energy for > 2 seconds
      let calmed = false;
      for (let t = 0; t < 200; t++) {
        const signals = updateTension(state, makeAudio({ energy: 0.05, high: 0.02, mid: 0.03 }), 0, t * 0.016 + 3);
        if (signals.phase === "calm") {
          calmed = true;
          break;
        }
      }
      expect(calmed).toBe(true);
    });

    it("rebounds from releasing to building on energy surge", () => {
      const state = createTensionState();
      state.phase = "releasing";
      state.phaseStartTime = 0;
      // Fill buffers with moderate, then rising audio
      for (let i = 0; i < 240; i++) {
        updateTension(state, makeAudio({ energy: 0.3, high: 0.2, mid: 0.2 }), 0, i * 0.016);
      }
      let rebounded = false;
      for (let t = 240; t < 500; t++) {
        const signals = updateTension(
          state,
          makeAudio({ energy: 0.85, high: 0.8, mid: 0.7, kick: 0.7 }),
          0.3,
          t * 0.016,
        );
        if (signals.phase === "building") {
          rebounded = true;
          break;
        }
      }
      expect(rebounded).toBe(true);
    });
  });

  describe("drop detection", () => {
    it("detects a drop when centroid drops sharply and bass spikes", () => {
      const state = createTensionState();
      // Fill buffer with high centroid values
      for (let i = 0; i < 60; i++) {
        updateTension(state, makeAudio({ high: 0.9, mid: 0.8, bass: 0.2 }), 0, i * 0.016);
      }
      // Sharp drop: centroid goes very low, bass spikes
      const signals = updateTension(
        state,
        makeAudio({ high: 0.1, mid: 0.1, bass: 0.8 }),
        0,
        61 * 0.016,
      );
      expect(signals.dropDetected).toBe(true);
    });

    it("clears drop detection after 500ms", () => {
      const state = createTensionState();
      // Create a drop
      for (let i = 0; i < 10; i++) {
        updateTension(state, makeAudio({ high: 0.9, mid: 0.8 }), 0, i * 0.016);
      }
      updateTension(state, makeAudio({ high: 0.1, mid: 0.1, bass: 0.8 }), 0, 1.0);

      // At 1.3s (300ms later) — still detected
      const before = updateTension(state, makeAudio({ high: 0.4, mid: 0.3 }), 0, 1.3);
      expect(before.dropDetected).toBe(true);

      // At 1.6s (600ms later) — should be cleared
      const after = updateTension(state, makeAudio({ high: 0.4, mid: 0.3 }), 0, 1.6);
      expect(after.dropDetected).toBe(false);
    });

    it("does not false-positive on gradual centroid changes", () => {
      const state = createTensionState();
      // Gradual descent — no sharp drop
      for (let i = 0; i < 120; i++) {
        const highVal = 0.8 - (i / 120) * 0.6;
        const signals = updateTension(
          state,
          makeAudio({ high: highVal, mid: highVal * 0.9, bass: 0.3 }),
          0,
          i * 0.016,
        );
        expect(signals.dropDetected).toBe(false);
      }
    });
  });

  describe("circular buffers", () => {
    it("wraps around after BUFFER_SIZE writes", () => {
      const state = createTensionState();
      // Write 500 frames (more than buffer size of 480)
      for (let i = 0; i < 500; i++) {
        updateTension(state, makeAudio({ energy: i % 2 === 0 ? 0.8 : 0.2 }), 0, i * 0.016);
      }
      expect(state.bufferFilled).toBe(480);
      expect(state.bufferIndex).toBe(500 % 480);
    });
  });

  describe("centroid direction", () => {
    it("reports rising when recent centroid exceeds long-term average", () => {
      const state = createTensionState();
      // Fill with low values
      for (let i = 0; i < 240; i++) {
        updateTension(state, makeAudio({ high: 0.1, mid: 0.1 }), 0, i * 0.016);
      }
      // Then ramp up
      let sawRising = false;
      for (let i = 240; i < 360; i++) {
        const signals = updateTension(state, makeAudio({ high: 0.8, mid: 0.7 }), 0, i * 0.016);
        if (signals.centroidDirection === "rising") {
          sawRising = true;
          break;
        }
      }
      expect(sawRising).toBe(true);
    });

    it("reports falling when recent centroid is below long-term average", () => {
      const state = createTensionState();
      // Fill with high values
      for (let i = 0; i < 240; i++) {
        updateTension(state, makeAudio({ high: 0.8, mid: 0.7 }), 0, i * 0.016);
      }
      // Then drop
      let sawFalling = false;
      for (let i = 240; i < 360; i++) {
        const signals = updateTension(state, makeAudio({ high: 0.1, mid: 0.1 }), 0, i * 0.016);
        if (signals.centroidDirection === "falling") {
          sawFalling = true;
          break;
        }
      }
      expect(sawFalling).toBe(true);
    });

    it("reports stable when centroid is consistent", () => {
      const state = createTensionState();
      for (let i = 0; i < 300; i++) {
        updateTension(state, makeAudio({ high: 0.5, mid: 0.5 }), 0, i * 0.016);
      }
      const signals = updateTension(state, makeAudio({ high: 0.5, mid: 0.5 }), 0, 300 * 0.016);
      expect(signals.centroidDirection).toBe("stable");
    });
  });

  describe("onset density", () => {
    it("counts kick onsets within the 2-second window", () => {
      const state = createTensionState();
      // 8 kicks in 2 seconds = density of 4
      for (let i = 0; i < 8; i++) {
        updateTension(state, makeAudio({ kick: 0.5 }), 0, i * 0.25);
      }
      const signals = updateTension(state, makeAudio({ kick: 0 }), 0, 1.5);
      expect(signals.onsetDensity).toBeGreaterThan(0);
    });

    it("prunes old timestamps beyond 2-second window", () => {
      const state = createTensionState();
      // Add kicks at t=0..1
      for (let i = 0; i < 5; i++) {
        updateTension(state, makeAudio({ kick: 0.5 }), 0, i * 0.2);
      }
      // Jump to t=5 (all old kicks should be pruned)
      const signals = updateTension(state, makeAudio({ kick: 0 }), 0, 5);
      expect(signals.onsetDensity).toBe(0);
    });

    it("returns zero when no onsets detected", () => {
      const state = createTensionState();
      const signals = updateTension(state, makeAudio(), 0, 1.0);
      expect(signals.onsetDensity).toBe(0);
    });
  });

  describe("tension level", () => {
    it("is clamped between 0 and 1", () => {
      const state = createTensionState();
      // Very high energy
      const high = updateTension(
        state,
        makeAudio({ energy: 1, high: 1, mid: 1, kick: 1 }),
        1,
        1.0,
      );
      expect(high.tensionLevel).toBeLessThanOrEqual(1);
      expect(high.tensionLevel).toBeGreaterThanOrEqual(0);

      // Very low energy
      const low = updateTension(state, makeAudio(), 0, 2.0);
      expect(low.tensionLevel).toBeGreaterThanOrEqual(0);
      expect(low.tensionLevel).toBeLessThanOrEqual(1);
    });
  });
});
