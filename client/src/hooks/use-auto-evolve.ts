import { useRef, useEffect, useState, useCallback } from "react";
import type { AudioData } from "@/hooks/use-audio-analyzer";
import type { EvolutionSignals } from "@/engine/evolution/types";
import { createTensionState, updateTension } from "@/engine/tension/tensionDetector";
import type { TensionState } from "@/engine/tension/types";
import { createBrainState, evaluateSwitch } from "@/engine/autoevolve/presetQueueBrain";
import type { BrainState } from "@/engine/autoevolve/presetQueueBrain";
import type { AutoEvolveConfig, AutoEvolveOutput } from "@/engine/autoevolve/moodPresetMap";

export function useAutoEvolve(args: {
  config: AutoEvolveConfig;
  currentPreset: string;
  getAudioData: () => AudioData;
  evolutionSignalsRef: React.RefObject<EvolutionSignals | null>;
  onSwitchPreset: (presetName: string) => void;
}): AutoEvolveOutput {
  const { config, currentPreset, getAudioData, evolutionSignalsRef, onSwitchPreset } = args;

  const tensionRef = useRef<TensionState | null>(null);
  const brainRef = useRef<BrainState | null>(null);
  const rafRef = useRef<number>(0);
  const lastUIUpdate = useRef(0);

  const [output, setOutput] = useState<AutoEvolveOutput>({
    tensionLevel: 0,
    tensionPhase: "calm",
    currentMood: undefined,
    lastSwitchReason: undefined,
    enabled: false,
  });

  // Stable ref for the switch callback to avoid re-triggering the rAF loop
  const onSwitchRef = useRef(onSwitchPreset);
  onSwitchRef.current = onSwitchPreset;

  const configRef = useRef(config);
  configRef.current = config;

  const presetRef = useRef(currentPreset);
  presetRef.current = currentPreset;

  const getAudioRef = useRef(getAudioData);
  getAudioRef.current = getAudioData;

  // Reset state when toggled on/off
  useEffect(() => {
    if (config.enabled) {
      tensionRef.current = createTensionState();
      brainRef.current = createBrainState();
    } else {
      tensionRef.current = null;
      brainRef.current = null;
    }
  }, [config.enabled]);

  // Main rAF loop
  useEffect(() => {
    if (!config.enabled) {
      setOutput((prev) => (prev.enabled ? { ...prev, enabled: false } : prev));
      return;
    }

    const startTime = performance.now() / 1000;

    const tick = () => {
      const tension = tensionRef.current;
      const brain = brainRef.current;
      if (!tension || !brain) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const cfg = configRef.current;
      const audio = getAudioRef.current();
      const tSec = performance.now() / 1000 - startTime;

      // Update tension detector
      const signals = updateTension(tension, audio, 0, tSec);

      // Read evolution signals for mood
      const evoSignals = evolutionSignalsRef.current;
      const mood = evoSignals?.mood;

      // Evaluate whether to switch preset
      const decision = evaluateSwitch(
        brain,
        presetRef.current,
        mood,
        signals,
        cfg.moodMap,
        cfg.chaos,
        audio.beatPhase,
        audio.bpm,
        tSec,
      );

      if (decision.shouldSwitch && decision.targetPreset) {
        onSwitchRef.current(decision.targetPreset);
      }

      // Throttled UI update every 200ms
      const now = performance.now();
      if (now - lastUIUpdate.current > 200) {
        lastUIUpdate.current = now;
        setOutput({
          tensionLevel: signals.tensionLevel,
          tensionPhase: signals.phase,
          currentMood: mood,
          lastSwitchReason: decision.shouldSwitch ? decision.reason : undefined,
          enabled: true,
        });
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [config.enabled, evolutionSignalsRef]);

  return output;
}
