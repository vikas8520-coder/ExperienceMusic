import type { TensionPhase, TensionSignals, TensionState } from "./types";
import type { AudioData } from "@/hooks/use-audio-analyzer";

const BUFFER_SIZE = 480; // 8s @ 60fps
const ONSET_WINDOW = 2; // seconds
const MAX_ONSET_DENSITY = 10;
const DROP_HOLD_MS = 500;
const CENTROID_THRESHOLD = 0.05;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function createTensionState(): TensionState {
  return {
    centroidBuffer: new Float32Array(BUFFER_SIZE),
    energyBuffer: new Float32Array(BUFFER_SIZE),
    bufferIndex: 0,
    bufferFilled: 0,
    onsetTimestamps: [],
    phase: "calm",
    phaseStartTime: 0,
    lastDropTime: -1,
    lastUpdateTime: 0,
  };
}

function rollingMean(
  buffer: Float32Array,
  index: number,
  filled: number,
  windowFrames: number,
): number {
  if (filled === 0) return 0;
  const count = Math.min(windowFrames, filled);
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const idx = (index - 1 - i + BUFFER_SIZE) % BUFFER_SIZE;
    sum += buffer[idx];
  }
  return sum / count;
}

export function updateTension(
  state: TensionState,
  audio: AudioData,
  micRms: number,
  tSec: number,
): TensionSignals {
  // Write to circular buffers
  const centroidNorm = clamp01(audio.high * 0.6 + audio.mid * 0.4);
  state.centroidBuffer[state.bufferIndex] = centroidNorm;
  state.energyBuffer[state.bufferIndex] = audio.energy;
  state.bufferIndex = (state.bufferIndex + 1) % BUFFER_SIZE;
  state.bufferFilled = Math.min(state.bufferFilled + 1, BUFFER_SIZE);

  // Track onsets
  if (audio.kick > 0.3) {
    state.onsetTimestamps.push(tSec);
  }
  // Prune old onset timestamps
  const onsetCutoff = tSec - ONSET_WINDOW;
  while (state.onsetTimestamps.length > 0 && state.onsetTimestamps[0] < onsetCutoff) {
    state.onsetTimestamps.shift();
  }

  // Onset density: hits in last 2s, divided by 2, cap at MAX_ONSET_DENSITY
  const onsetDensity = Math.min(state.onsetTimestamps.length / ONSET_WINDOW, MAX_ONSET_DENSITY);
  const onsetDensityNorm = onsetDensity / MAX_ONSET_DENSITY;

  // Centroid direction: compare rolling mean of last 1s vs last 4s
  const recent = rollingMean(state.centroidBuffer, state.bufferIndex, state.bufferFilled, 60); // ~1s
  const longTerm = rollingMean(state.centroidBuffer, state.bufferIndex, state.bufferFilled, 240); // ~4s
  const centroidDiff = recent - longTerm;
  const centroidDirection: TensionSignals["centroidDirection"] =
    centroidDiff > CENTROID_THRESHOLD ? "rising" : centroidDiff < -CENTROID_THRESHOLD ? "falling" : "stable";

  // Drop detection: sharp centroid drop in one frame + bass spike
  const prevIdx = (state.bufferIndex - 2 + BUFFER_SIZE) % BUFFER_SIZE;
  const centroidDelta = state.bufferFilled >= 2 ? state.centroidBuffer[prevIdx] - centroidNorm : 0;
  const isDropFrame = centroidDelta > 0.25 && audio.bass > 0.6;
  if (isDropFrame) {
    state.lastDropTime = tSec;
  }
  const dropDetected = state.lastDropTime >= 0 && (tSec - state.lastDropTime) < DROP_HOLD_MS / 1000;

  // Tension level composite
  const tensionLevel = clamp01(
    audio.energy * 0.3 +
      onsetDensityNorm * 0.25 +
      centroidNorm * 0.2 +
      audio.high * 0.15 +
      clamp01(micRms) * 0.1,
  );

  // Phase state machine
  const phaseAge = tSec - state.phaseStartTime;
  let nextPhase: TensionPhase = state.phase;

  switch (state.phase) {
    case "calm":
      if (tensionLevel >= 0.25 && phaseAge > 2) {
        nextPhase = "building";
      }
      break;
    case "building":
      if (tensionLevel > 0.7) {
        nextPhase = "peak";
      } else if (tensionLevel < 0.2 && phaseAge > 2) {
        nextPhase = "calm";
      }
      break;
    case "peak":
      if (centroidDirection === "falling" || tensionLevel < 0.5) {
        nextPhase = "releasing";
      }
      break;
    case "releasing":
      if (tensionLevel < 0.25 && phaseAge > 2) {
        nextPhase = "calm";
      } else if (tensionLevel > 0.6 && centroidDirection === "rising") {
        nextPhase = "building";
      }
      break;
  }

  if (nextPhase !== state.phase) {
    state.phase = nextPhase;
    state.phaseStartTime = tSec;
  }

  state.lastUpdateTime = tSec;

  return {
    tensionLevel,
    phase: state.phase,
    buildDuration: state.phase === "building" ? tSec - state.phaseStartTime : 0,
    dropDetected,
    onsetDensity,
    centroidDirection,
  };
}
