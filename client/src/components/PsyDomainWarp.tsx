import * as THREE from "three";
import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { PALETTE_GLSL, psyPalettes, paletteToGLSLUniforms, type PsyPalette } from "@/lib/psyPalettes";

type AudioData = {
  bass: number; mid: number; high: number;
  kick: number; sub: number; energy: number;
};

export type DomainWarpParams = {
  symmetry: number;      // 1-24 fold symmetry
  warpStrength: number;  // 0-10
  warpLayers: number;    // 1-3 recursion depth
  noiseScale: number;    // 0.5-8.0
  noiseOctaves: number;  // 1-8
  zoom: number;          // 0.1-10
  rotation: number;      // 0-360
  speed: number;         // 0-2
  seed: number;          // 0-99999
  palette: PsyPalette;
};

export const defaultDomainWarpParams: DomainWarpParams = {
  symmetry: 6,
  warpStrength: 4.0,
  warpLayers: 2,
  noiseScale: 3.0,
  noiseOctaves: 5,
  zoom: 1.0,
  rotation: 0,
  speed: 1.0,
  seed: 42,
  palette: psyPalettes[0],
};

type Props = {
  getAudioData?: () => AudioData;
  settings?: any;
  params?: DomainWarpParams;
  static?: boolean; // true = wallpaper mode (no animation)
};

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  ${PALETTE_GLSL}

  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uKick;
  uniform float uSub;
  uniform float uEnergy;
  uniform float uSymmetry;
  uniform float uWarpStrength;
  uniform float uWarpLayers;
  uniform float uNoiseScale;
  uniform float uNoiseOctaves;
  uniform float uZoom;
  uniform float uRotation;
  uniform float uSeed;

  varying vec2 vUv;

  // --- Noise functions ---
  float hash(vec2 p) {
    return fract(sin(dot(p + uSeed * 0.01, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1,0)), f.x),
      mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    int oct = int(uNoiseOctaves);
    for (int i = 0; i < 8; i++) {
      if (i >= oct) break;
      v += a * noise(p);
      p = p * 2.1 + vec2(1.7, 3.2);
      a *= 0.5;
    }
    return v;
  }

  // --- Polar symmetry (mandala folding) ---
  vec2 polarFold(vec2 uv, float segments) {
    if (segments < 1.5) return uv; // no folding
    vec2 centered = uv - 0.5;
    float r = length(centered);
    float a = atan(centered.y, centered.x);
    float segAngle = 6.28318 / segments;
    a = mod(a, segAngle);
    a = min(a, segAngle - a); // mirror fold
    return vec2(cos(a), sin(a)) * r + 0.5;
  }

  // --- Domain warping: the key technique ---
  // fbm(p + fbm(p + fbm(p))) — each layer feeds into the next
  vec3 domainWarp(vec2 p, float t) {
    float ws = uWarpStrength;

    // Layer 1
    vec2 q = vec2(
      fbm(p + vec2(0.0, 0.0) + t * 0.1),
      fbm(p + vec2(5.2, 1.3) + t * 0.12)
    );

    // Layer 2
    vec2 r = vec2(0.0);
    if (uWarpLayers > 1.5) {
      r = vec2(
        fbm(p + ws * q + vec2(1.7, 9.2) + t * 0.08),
        fbm(p + ws * q + vec2(8.3, 2.8) + t * 0.09)
      );
    }

    // Layer 3
    vec2 s = r;
    if (uWarpLayers > 2.5) {
      s = vec2(
        fbm(p + ws * r + vec2(3.1, 7.4) + t * 0.06),
        fbm(p + ws * r + vec2(6.7, 4.1) + t * 0.07)
      );
    }

    // Final fbm with full warp chain
    vec2 finalWarp = (uWarpLayers > 2.5) ? s : (uWarpLayers > 1.5) ? r : q;
    float f = fbm(p + ws * finalWarp);

    // Color from palette — use different warping stages for multi-channel color
    float c1 = f;
    float c2 = length(q);
    float c3 = (uWarpLayers > 1.5) ? length(r) : c2;

    // Map through IQ palette
    vec3 color = iqPalette(c1);

    // Mix with secondary palette samples for depth
    color = mix(color, iqPalette(c2 + 0.3), 0.3);
    color = mix(color, iqPalette(c3 + 0.6), 0.15);

    // Boost contrast
    color = pow(color, vec3(0.85));
    color = (color - 0.35) * 1.6 + 0.35;
    color = clamp(color, 0.0, 1.0);

    return color;
  }

  void main() {
    float t = uTime;

    // Apply rotation
    vec2 uv = vUv - 0.5;
    float rot = uRotation * 0.01745; // deg to rad
    float cr = cos(rot), sr = sin(rot);
    uv = mat2(cr, -sr, sr, cr) * uv;
    uv = uv / uZoom + 0.5;

    // Apply symmetry folding
    uv = polarFold(uv, uSymmetry);

    // Scale for noise
    vec2 p = (uv - 0.5) * uNoiseScale;

    // Audio modulation
    float audioWarp = uBass * 0.5 + uKick * 1.0;
    float audioSpeed = 1.0 + uMid * 0.5;
    float audioTime = t * audioSpeed;

    // Domain warp with audio-modulated time
    vec3 color = domainWarp(p + vec2(audioWarp * 0.1), audioTime);

    // Audio-reactive glow
    float glow = uEnergy * 0.2 + uKick * 0.3;
    color += color * glow;

    // High frequency shimmer
    float shimmer = uHigh * 0.15 * sin(t * 10.0 + vUv.y * 30.0);
    color += shimmer;

    // Vignette
    float vig = 1.0 - length((vUv - 0.5) * 1.6);
    color *= smoothstep(0.0, 0.5, vig);

    color = clamp(color, 0.0, 1.0);
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function PsyDomainWarp({ getAudioData, settings, params, static: isStatic }: Props) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const p = params || defaultDomainWarpParams;

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uKick: { value: 0 },
        uSub: { value: 0 },
        uEnergy: { value: 0 },
        uSymmetry: { value: p.symmetry },
        uWarpStrength: { value: p.warpStrength },
        uWarpLayers: { value: p.warpLayers },
        uNoiseScale: { value: p.noiseScale },
        uNoiseOctaves: { value: p.noiseOctaves },
        uZoom: { value: p.zoom },
        uRotation: { value: p.rotation },
        uSeed: { value: p.seed },
        ...paletteToGLSLUniforms(p.palette),
      },
      vertexShader,
      fragmentShader,
    });
  }, []);

  useEffect(() => {
    matRef.current = material;
  }, [material]);

  // Update params reactively
  useEffect(() => {
    if (!matRef.current) return;
    const u = matRef.current.uniforms;
    u.uSymmetry.value = p.symmetry;
    u.uWarpStrength.value = p.warpStrength;
    u.uWarpLayers.value = p.warpLayers;
    u.uNoiseScale.value = p.noiseScale;
    u.uNoiseOctaves.value = p.noiseOctaves;
    u.uZoom.value = p.zoom;
    u.uRotation.value = p.rotation;
    u.uSeed.value = p.seed;
    u.uPalA.value = p.palette.a;
    u.uPalB.value = p.palette.b;
    u.uPalC.value = p.palette.c;
    u.uPalD.value = p.palette.d;
  }, [p]);

  useFrame((_, delta) => {
    if (!matRef.current) return;
    const u = matRef.current.uniforms;

    if (!isStatic) {
      u.uTime.value += delta * p.speed;
    }

    if (getAudioData) {
      const audio = getAudioData();
      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
      u.uBass.value = lerp(u.uBass.value, audio.bass || 0, 0.3);
      u.uMid.value = lerp(u.uMid.value, audio.mid || 0, 0.4);
      u.uHigh.value = lerp(u.uHigh.value, audio.high || 0, 0.5);
      u.uKick.value = lerp(u.uKick.value, audio.kick || 0, 0.6);
      u.uSub.value = lerp(u.uSub.value, audio.sub || 0, 0.2);
      u.uEnergy.value = lerp(u.uEnergy.value, audio.energy || 0, 0.3);
    }
  });

  return (
    <mesh material={material} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
