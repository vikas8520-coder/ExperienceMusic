import { EffectComposer, Bloom, ChromaticAberration, Noise, Vignette } from "@react-three/postprocessing";
import { BlendFunction, KernelSize } from "postprocessing";
import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Kaleidoscope } from "./KaleidoscopeEffect";
import { Afterimage } from "./AfterimageEffect";

type Props = {
  sub?: number;      // 20-60Hz: slow heavy motion, global pulse
  bass: number;      // 60-250Hz: bloom, breathing, zoom
  mid: number;       // 250-2kHz: rotation, shape, density
  high: number;      // 2k-10kHz: sparkles, glitch, aberration
  kick?: number;     // Beat detection: sudden impacts
  enabled?: boolean;
  afterimageOn?: boolean;
  bloomOn?: boolean;
  chromaOn?: boolean;
  noiseOn?: boolean;
  vignetteOn?: boolean;
  kaleidoOn?: boolean;
  intensity?: number;      // Controls preset movement/vibration only
  glowIntensity?: number;  // Controls bloom/glow brightness separately
  motion?: number;
  trails?: number;
  vignetteStrength?: number;
  kaleidoStrength?: number;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function Effects({
  sub = 0,
  bass,
  mid,
  high,
  kick = 0,
  enabled = true,
  afterimageOn = false,
  bloomOn = true,
  chromaOn = true,
  noiseOn = true,
  vignetteOn = true,
  kaleidoOn = false,
  intensity = 1.0,
  glowIntensity = 1.0,
  motion = 1.0,
  trails = 0.75,
  vignetteStrength = 0.35,
  kaleidoStrength = 0.6,
}: Props) {
  const kaleidoRef = useRef<any>(null);
  const afterimageRef = useRef<any>(null);
  const angleRef = useRef(0);
  const smoothSubRef = useRef(0);
  const smoothBassRef = useRef(0);
  const smoothMidRef = useRef(0);
  const smoothHighRef = useRef(0);
  const smoothKickRef = useRef(0);
  
  const rawSub = clamp01(sub);
  const b = clamp01(bass);
  const m = clamp01(mid);
  const h = clamp01(high);
  const k = clamp01(kick);

  useFrame((_, delta) => {
    const smoothFactor = 1 - Math.exp(-8 * delta);
    const slowSmooth = 1 - Math.exp(-3 * delta);  // Slower for sub
    const fastSmooth = 1 - Math.exp(-15 * delta); // Faster for kick
    
    smoothSubRef.current = lerp(smoothSubRef.current, rawSub, slowSmooth);
    smoothBassRef.current = lerp(smoothBassRef.current, b, smoothFactor);
    smoothMidRef.current = lerp(smoothMidRef.current, m, smoothFactor);
    smoothHighRef.current = lerp(smoothHighRef.current, h, smoothFactor);
    smoothKickRef.current = lerp(smoothKickRef.current, k, fastSmooth);
    
    if (kaleidoOn && kaleidoRef.current) {
      angleRef.current += (0.2 + smoothMidRef.current * 0.8 + smoothHighRef.current * 0.5) * motion * delta;
      kaleidoRef.current.angle = angleRef.current;
      kaleidoRef.current.sides = kaleidoSides;
      kaleidoRef.current.intensity = kaleidoIntensity;
    }
  });

  const ssub = smoothSubRef.current || rawSub;
  const sb = smoothBassRef.current || b;
  const sm = smoothMidRef.current || m;
  const sh = smoothHighRef.current || h;
  const sk = smoothKickRef.current || k;

  // Bloom: Driven by sub + bass for heavy, breathing glow
  // Sub provides the slow "body" feel, bass provides the punch
  // Uses separate glowIntensity so intensity only affects preset movement
  const bloomIntensity = (0.3 + ssub * 0.8 + sb * 1.8 + sk * 0.6) * glowIntensity;
  const bloomLuminanceThreshold = 0.2 + (1 - sh) * 0.25;
  
  // Chromatic aberration: Driven by highs for sparkle/glitch effect
  // Kick adds extra punch on beats
  const chromaOffset = useMemo(() => {
    const amt = (0.001 + h * 0.012 + kick * 0.005) * intensity;
    return new THREE.Vector2(amt, -amt * 0.85);
  }, [h, kick, intensity]);

  // Noise: Driven by highs for texture, sub for subtle body
  const noiseAmount = 0.02 + sh * 0.06 + ssub * 0.02;

  // Vignette: Pulses with sub for "breathing" effect
  const vignetteAmount = clamp01(vignetteStrength + ssub * 0.15 + sb * 0.1);

  // Kaleidoscope: Mids control rotation, energy controls sides
  const kaleidoSides = 6 + Math.floor((sm + sh) * 6);
  const kaleidoIntensity = clamp01(kaleidoStrength * (0.4 + sb * 0.3 + sh * 0.3));

  // Afterimage/Trails: Decay controlled by trails prop and energy
  // Higher energy = slightly faster decay to keep responsiveness
  const afterimageDecay = clamp01(trails * (0.98 - sb * 0.08 - sh * 0.04));
  const afterimageBlend = clamp01(trails * 0.85);

  if (!enabled) return null;

  return (
    <EffectComposer multisampling={4}>
      <Afterimage
        ref={afterimageRef}
        enabled={afterimageOn}
        decay={afterimageDecay}
        blend={afterimageBlend}
      />
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
        opacity={noiseOn ? noiseAmount : 0} 
        blendFunction={BlendFunction.SOFT_LIGHT}
      />
      <Vignette
        eskil={false}
        offset={0.25}
        darkness={vignetteOn ? vignetteAmount : 0}
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
