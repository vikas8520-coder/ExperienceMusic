export type TensionPhase = "calm" | "building" | "peak" | "releasing";

export type TensionSignals = {
  tensionLevel: number; // 0-1
  phase: TensionPhase;
  buildDuration: number; // seconds
  dropDetected: boolean; // true for ~500ms after drop
  onsetDensity: number; // hits/sec
  centroidDirection: "rising" | "falling" | "stable";
};

export type TensionState = {
  centroidBuffer: Float32Array; // circular, 480 samples (8s @ 60fps)
  energyBuffer: Float32Array;
  bufferIndex: number;
  bufferFilled: number;
  onsetTimestamps: number[];
  phase: TensionPhase;
  phaseStartTime: number;
  lastDropTime: number;
  lastUpdateTime: number;
};
