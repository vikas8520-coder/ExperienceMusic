// audio-analyzer/index.ts
// JS bridge interface for React Native (Expo prebuild / bare)
// iOS module name: AudioAnalyzerIOS
// Android module name: AudioAnalyzerAndroid

import { NativeEventEmitter, NativeModules, Platform } from "react-native";

export type BandsUpdate = {
  bass: number; // 0..1 (20-250 Hz)
  mid: number; // 0..1 (250-2000 Hz)
  high: number; // 0..1 (2000-10000 Hz)
  rmsEnergy: number; // 0..1
  beatDetected: boolean;
  timestampMs: number;
};

export type StartAnalysisOptions = {
  fftSize?: number; // default 1024
  sampleRate?: number; // native decides if omitted
  smoothing?: number; // 0..1
};

type NativeAnalyzerModule = {
  startAnalysis(options?: StartAnalysisOptions): Promise<void>;
  stopAnalysis(): Promise<void>;
  isAnalyzing?: () => Promise<boolean>;
};

const moduleName =
  Platform.OS === "ios" ? "AudioAnalyzerIOS" : "AudioAnalyzerAndroid";

const NativeAnalyzer = NativeModules[moduleName] as NativeAnalyzerModule | undefined;

if (!NativeAnalyzer) {
  // Fail fast with clear setup error
  console.warn(
    `[AudioAnalyzer] Native module "${moduleName}" not found. ` +
      `Did you run prebuild / pod install / gradle sync?`
  );
}

const emitter = NativeAnalyzer ? new NativeEventEmitter(NativeAnalyzer as any) : null;
const EVENT_NAME = "AudioBandsUpdate";

/**
 * Starts native audio analysis on current playback stream.
 * Rejects when:
 * - no native module
 * - audio session/player not active
 * - permission/session setup fails
 */
export async function startAnalysis(options?: StartAnalysisOptions): Promise<void> {
  if (!NativeAnalyzer) throw new Error("Audio analyzer native module not available");
  await NativeAnalyzer.startAnalysis(options ?? {});
}

/**
 * Stops native analysis and releases taps/listeners.
 */
export async function stopAnalysis(): Promise<void> {
  if (!NativeAnalyzer) return;
  await NativeAnalyzer.stopAnalysis();
}

/**
 * Subscribes to real-time band updates from native.
 * Returns unsubscribe function.
 */
export function onBandsUpdate(cb: (update: BandsUpdate) => void): () => void {
  if (!emitter) {
    return () => {};
  }
  const sub = emitter.addListener(EVENT_NAME, cb);
  return () => sub.remove();
}
