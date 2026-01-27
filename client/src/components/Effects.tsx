import { EffectComposer, Bloom, ChromaticAberration, Noise, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Kaleidoscope } from "./KaleidoscopeEffect";

type Props = {
  bass: number;
  mid: number;
  high: number;
  enabled?: boolean;
  bloomOn?: boolean;
  chromaOn?: boolean;
  noiseOn?: boolean;
  vignetteOn?: boolean;
  kaleidoOn?: boolean;
  intensity?: number;
  motion?: number;
  vignetteStrength?: number;
  kaleidoStrength?: number;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function Effects({
  bass,
  mid,
  high,
  enabled = true,
  bloomOn = true,
  chromaOn = true,
  noiseOn = true,
  vignetteOn = true,
  kaleidoOn = false,
  intensity = 1.0,
  motion = 1.0,
  vignetteStrength = 0.35,
  kaleidoStrength = 0.6,
}: Props) {
  const kaleidoRef = useRef<any>(null);
  const angleRef = useRef(0);
  
  const b = clamp01(bass);
  const m = clamp01(mid);
  const h = clamp01(high);

  const bloomIntensity = (0.3 + b * 1.5) * intensity;
  const bloomLuminanceThreshold = 0.3 + (1 - h) * 0.3;
  
  const chromaOffset = useMemo(() => {
    const amt = (0.001 + h * 0.008) * intensity;
    return new THREE.Vector2(amt, -amt * 0.85);
  }, [h, intensity]);

  const kaleidoSides = 6 + Math.floor(h * 10);
  const kaleidoIntensity = clamp01(kaleidoStrength * (0.35 + b * 0.25 + h * 0.4));

  useFrame((_, delta) => {
    if (kaleidoOn && kaleidoRef.current) {
      angleRef.current += (0.2 + m * 0.8 + h * 0.5) * motion * delta;
      kaleidoRef.current.angle = angleRef.current;
      kaleidoRef.current.sides = kaleidoSides;
      kaleidoRef.current.intensity = kaleidoIntensity;
    }
  });

  if (!enabled) return null;

  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={bloomOn ? bloomIntensity : 0}
        luminanceThreshold={bloomLuminanceThreshold}
        luminanceSmoothing={0.7}
        mipmapBlur
      />
      <ChromaticAberration
        offset={chromaOn ? chromaOffset : new THREE.Vector2(0, 0)}
        radialModulation
        modulationOffset={0.35}
      />
      <Noise opacity={noiseOn ? 0.04 + h * 0.08 : 0} />
      <Vignette
        eskil={false}
        offset={0.2}
        darkness={vignetteOn ? clamp01(vignetteStrength + b * 0.25) : 0}
      />
      <Kaleidoscope
        ref={kaleidoRef}
        enabled={kaleidoOn}
        sides={kaleidoSides}
        angle={0}
        intensity={kaleidoOn ? kaleidoIntensity : 0}
      />
    </EffectComposer>
  );
}
