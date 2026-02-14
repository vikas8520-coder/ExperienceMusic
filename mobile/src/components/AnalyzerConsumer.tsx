import React, { useEffect } from "react";
import { startAnalysis, stopAnalysis, onBandsUpdate } from "@/audio-analyzer";

// Example usage for the native audio analyzer bridge.
export function AnalyzerConsumer() {
  useEffect(() => {
    let unsub = () => {};
    (async () => {
      try {
        await startAnalysis({ fftSize: 1024, smoothing: 0.8 });
        unsub = onBandsUpdate((u) => {
          // use u.bass/u.mid/u.high/u.rmsEnergy/u.beatDetected
          // e.g. push into store or local state
          void u;
        });
      } catch (e) {
        // Edge case: no playback / native unavailable / session failure
        console.warn("Audio analysis failed to start", e);
      }
    })();

    return () => {
      unsub();
      stopAnalysis().catch(() => {});
    };
  }, []);

  return null;
}
