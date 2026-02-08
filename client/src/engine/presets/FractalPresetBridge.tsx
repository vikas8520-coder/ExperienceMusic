import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { AudioData } from "@/hooks/use-audio-analyzer";
import type { AudioFeatures, FractalPreset, PresetContext, UniformValues } from "./types";

function audioDataToFeatures(ad: AudioData): AudioFeatures {
  return {
    rms: ad.energy,
    bass: ad.bass,
    mid: ad.mid,
    treble: ad.high,
    beat: ad.kick,
  };
}

interface FractalPresetBridgeProps {
  preset: FractalPreset;
  getAudioData: () => AudioData;
  uniforms: UniformValues;
}

export function FractalPresetBridge({ preset, getAudioData, uniforms }: FractalPresetBridgeProps) {
  const Render = preset.Render;
  const stateRef = useRef<any>({});
  const presetIdRef = useRef<string>("");
  const { size } = useThree();

  const ctx = useMemo<PresetContext>(() => ({
    now: 0,
    dt: 0,
    width: size.width,
    height: size.height,
    dpr: window.devicePixelRatio || 1,
    quality: "high" as const,
    isMobile: /Mobi|Android/i.test(navigator.userAgent),
  }), [size.width, size.height]);

  useEffect(() => {
    if (presetIdRef.current && presetIdRef.current !== preset.id) {
      try { preset.dispose(ctx); } catch {}
    }
    presetIdRef.current = preset.id;
    stateRef.current = {};

    const initResult = preset.init(ctx);
    if (initResult && typeof (initResult as any).catch === "function") {
      (initResult as Promise<void>).catch((e) => console.error("preset.init failed", e));
    }

    return () => {
      try { preset.dispose(ctx); } catch {}
    };
  }, [preset.id, ctx]);

  useFrame((state, delta) => {
    const audio = audioDataToFeatures(getAudioData());
    ctx.now = state.clock.getElapsedTime();
    ctx.dt = Math.min(delta, 0.1);
    ctx.width = size.width;
    ctx.height = size.height;
    preset.update({ ctx, audio, uniforms, state: stateRef.current });
  });

  if (!Render) return null;
  return <Render uniforms={uniforms} state={stateRef.current} />;
}
