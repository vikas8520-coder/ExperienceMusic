import { EffectComposer, Bloom, ChromaticAberration, Noise, Vignette } from "@react-three/postprocessing";
import { BlendFunction, KernelSize } from "postprocessing";
import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Kaleidoscope } from "./KaleidoscopeEffect";

type Props = {
  bass: number;
  mid: number;
  high: number;
  enabled?: boolean;
  afterimageOn?: boolean;
  bloomOn?: boolean;
  chromaOn?: boolean;
  noiseOn?: boolean;
  vignetteOn?: boolean;
  kaleidoOn?: boolean;
  intensity?: number;
  motion?: number;
  trails?: number;
  vignetteStrength?: number;
  kaleidoStrength?: number;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function Effects({
  bass,
  mid,
  high,
  enabled = true,
  afterimageOn = false,
  bloomOn = true,
  chromaOn = true,
  noiseOn = true,
  vignetteOn = true,
  kaleidoOn = false,
  intensity = 1.0,
  motion = 1.0,
  trails = 0.75,
  vignetteStrength = 0.35,
  kaleidoStrength = 0.6,
}: Props) {
  const kaleidoRef = useRef<any>(null);
  const angleRef = useRef(0);
  const smoothBassRef = useRef(0);
  const smoothMidRef = useRef(0);
  const smoothHighRef = useRef(0);
  
  const b = clamp01(bass);
  const m = clamp01(mid);
  const h = clamp01(high);

  useFrame((_, delta) => {
    const smoothFactor = 1 - Math.exp(-8 * delta);
    smoothBassRef.current = lerp(smoothBassRef.current, b, smoothFactor);
    smoothMidRef.current = lerp(smoothMidRef.current, m, smoothFactor);
    smoothHighRef.current = lerp(smoothHighRef.current, h, smoothFactor);
    
    if (kaleidoOn && kaleidoRef.current) {
      angleRef.current += (0.2 + smoothMidRef.current * 0.8 + smoothHighRef.current * 0.5) * motion * delta;
      kaleidoRef.current.angle = angleRef.current;
      kaleidoRef.current.sides = kaleidoSides;
      kaleidoRef.current.intensity = kaleidoIntensity;
    }
  });

  const sb = smoothBassRef.current || b;
  const sm = smoothMidRef.current || m;
  const sh = smoothHighRef.current || h;

  const bloomIntensity = (0.4 + sb * 2.0) * intensity;
  const bloomLuminanceThreshold = 0.25 + (1 - sh) * 0.25;
  
  const chromaOffset = useMemo(() => {
    const amt = (0.0015 + h * 0.01) * intensity;
    return new THREE.Vector2(amt, -amt * 0.85);
  }, [h, intensity]);

  const kaleidoSides = 6 + Math.floor(sh * 12);
  const kaleidoIntensity = clamp01(kaleidoStrength * (0.4 + sb * 0.3 + sh * 0.3));

  if (!enabled) return null;

  return (
    <EffectComposer multisampling={4}>
      <Bloom
        intensity={bloomOn ? bloomIntensity : 0}
        luminanceThreshold={bloomLuminanceThreshold}
        luminanceSmoothing={0.9}
        mipmapBlur
        kernelSize={KernelSize.LARGE}
        blendFunction={BlendFunction.ADD}
      />
      <ChromaticAberration
        offset={chromaOn ? chromaOffset : new THREE.Vector2(0, 0)}
        radialModulation
        modulationOffset={0.4}
      />
      <Noise 
        opacity={noiseOn ? 0.03 + sh * 0.06 : 0} 
        blendFunction={BlendFunction.SOFT_LIGHT}
      />
      <Vignette
        eskil={false}
        offset={0.25}
        darkness={vignetteOn ? clamp01(vignetteStrength + sb * 0.2) : 0}
        blendFunction={BlendFunction.NORMAL}
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
