import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

type UsePresetTransitionArgs<TPreset extends string> = {
  currentPreset: TPreset;
  nextPreset: TPreset;
  transitionDuration?: number;
  intensityFrom?: number;
  intensityTo?: number;
  morphFrom?: number;
  morphTo?: number;
};

type UsePresetTransitionResult<TPreset extends string> = {
  activeA: TPreset;
  activeB: TPreset;
  isTransitioning: boolean;
  mix: number;
  intensity: number;
  morph: number;
  stableTexture: THREE.Texture | null;
  registerValidTexture: (tex: THREE.Texture | null | undefined) => void;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smoothstep01 = (t: number) => t * t * (3 - 2 * t);

export function usePresetTransition<TPreset extends string>({
  currentPreset,
  nextPreset,
  transitionDuration = 0.3,
  intensityFrom = 0.85,
  intensityTo = 1.0,
  morphFrom = 0.0,
  morphTo = 1.0,
}: UsePresetTransitionArgs<TPreset>): UsePresetTransitionResult<TPreset> {
  const [activeA, setActiveA] = useState<TPreset>(currentPreset);
  const [activeB, setActiveB] = useState<TPreset>(nextPreset);
  const [mix, setMix] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const rafRef = useRef<number | null>(null);
  const lastTextureRef = useRef<THREE.Texture | null>(null);

  const registerValidTexture = (tex: THREE.Texture | null | undefined) => {
    if (tex && tex.image) lastTextureRef.current = tex;
  };

  useEffect(() => {
    if (currentPreset === nextPreset) return;

    setActiveA(currentPreset);
    setActiveB(nextPreset);
    setIsTransitioning(true);
    setMix(0);

    const start = performance.now();
    const durationMs = Math.max(0.001, transitionDuration) * 1000;

    const tick = (now: number) => {
      const raw = clamp01((now - start) / durationMs);
      setMix(smoothstep01(raw));

      if (raw < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setIsTransitioning(false);
        setActiveA(nextPreset);
        setMix(1);
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [currentPreset, nextPreset, transitionDuration]);

  const intensity = useMemo(
    () => THREE.MathUtils.lerp(intensityFrom, intensityTo, mix),
    [intensityFrom, intensityTo, mix]
  );

  const morph = useMemo(
    () => THREE.MathUtils.lerp(morphFrom, morphTo, mix),
    [morphFrom, morphTo, mix]
  );

  return {
    activeA,
    activeB,
    isTransitioning,
    mix,
    intensity,
    morph,
    stableTexture: lastTextureRef.current,
    registerValidTexture,
  };
}
