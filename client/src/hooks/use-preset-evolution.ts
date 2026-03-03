import { useMemo, useRef } from "react";
import { createEvolutionState, evolveParams } from "@/engine/evolution/evolutionEngine";
import type { AudioFrame, EvolutionPreset, Section, VisualParams } from "@/engine/evolution/types";

export function usePresetEvolution(args: {
  enabled: boolean;
  evolutionPreset: EvolutionPreset | null | undefined;
  sections: Section[] | null | undefined;
  tSec: number;
  audio: AudioFrame;
  bpm?: number;
}): VisualParams | null {
  const stateRef = useRef(createEvolutionState());

  return useMemo(() => {
    if (!args.enabled) return null;
    if (!args.evolutionPreset?.enabled) return null;

    return evolveParams(
      args.evolutionPreset,
      args.sections ?? [],
      args.tSec,
      args.audio,
      stateRef.current,
      { bpm: args.bpm },
    );
  }, [
    args.enabled,
    args.evolutionPreset,
    args.sections,
    args.tSec,
    args.audio.rms,
    args.audio.low,
    args.audio.mid,
    args.audio.high,
    args.audio.onset,
    args.audio.beatPhase,
    args.bpm,
  ]);
}
