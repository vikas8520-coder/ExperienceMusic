import * as THREE from "three";
import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { PALETTE_GLSL, psyPalettes, paletteToGLSLUniforms, type PsyPalette } from "@/lib/psyPalettes";

type AudioData = {
  bass: number; mid: number; high: number;
  kick: number; sub: number; energy: number;
};

export type FractalFlameParams = {
  variation: number;      // 0-7: sinusoidal, spherical, swirl, horseshoe, polar, handkerchief, heart, julia
  symmetry: number;       // 1-12
  zoom: number;           // 0.1-10
  rotation: number;       // 0-360
  speed: number;          // 0-2
  seed: number;           // 0-99999
  iterations: number;     // 5-20 (visual density)
  spread: number;         // 0.5-5 (how far transforms spread)
  palette: PsyPalette;
};

export const defaultFractalFlameParams: FractalFlameParams = {
  variation: 2, // swirl
  symmetry: 3,
  zoom: 1.0,
  rotation: 0,
  speed: 1.0,
  seed: 314,
  iterations: 12,
  spread: 2.0,
  palette: psyPalettes[5], // Acid Neon
};

export const FLAME_VARIATION_NAMES = [
  "Sinusoidal", "Spherical", "Swirl", "Horseshoe",
  "Polar", "Handkerchief", "Heart", "Julia"
];

type Props = {
  getAudioData?: () => AudioData;
  settings?: any;
  params?: FractalFlameParams;
  static?: boolean;
};

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Fractal flame variations implemented in GLSL
// Based on Scott Draves' original flame algorithm
const fragmentShader = /* glsl */ `
  ${PALETTE_GLSL}

  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uKick;
  uniform float uSub;
  uniform float uEnergy;
  uniform float uVariation;
  uniform float uSymmetry;
  uniform float uZoom;
  uniform float uRotation;
  uniform float uSeed;
  uniform float uIterations;
  uniform float uSpread;

  varying vec2 vUv;

  #define PI 3.14159265
  #define TAU 6.28318530

  float hash(vec2 p) {
    return fract(sin(dot(p + uSeed * 0.01, vec2(127.1, 311.7))) * 43758.5453);
  }

  // --- Flame variation functions ---
  // V0: Sinusoidal
  vec2 vSinusoidal(vec2 p) {
    return vec2(sin(p.x), sin(p.y));
  }

  // V1: Spherical (1/r^2)
  vec2 vSpherical(vec2 p) {
    float r2 = dot(p, p) + 0.0001;
    return p / r2;
  }

  // V2: Swirl
  vec2 vSwirl(vec2 p) {
    float r2 = dot(p, p);
    float s = sin(r2), c = cos(r2);
    return vec2(p.x * s - p.y * c, p.x * c + p.y * s);
  }

  // V3: Horseshoe
  vec2 vHorseshoe(vec2 p) {
    float r = length(p) + 0.0001;
    return vec2((p.x - p.y) * (p.x + p.y), 2.0 * p.x * p.y) / r;
  }

  // V4: Polar
  vec2 vPolar(vec2 p) {
    float r = length(p);
    float theta = atan(p.y, p.x);
    return vec2(theta / PI, r - 1.0);
  }

  // V5: Handkerchief
  vec2 vHandkerchief(vec2 p) {
    float r = length(p);
    float theta = atan(p.y, p.x);
    return r * vec2(sin(theta + r), cos(theta - r));
  }

  // V6: Heart
  vec2 vHeart(vec2 p) {
    float r = length(p);
    float theta = atan(p.y, p.x);
    return r * vec2(sin(theta * r), -cos(theta * r));
  }

  // V7: Julia (random half-plane)
  vec2 vJulia(vec2 p, float seed) {
    float r = sqrt(length(p));
    float theta = 0.5 * atan(p.y, p.x);
    float omega = step(0.5, fract(seed * 43758.5453)) * PI;
    return r * vec2(cos(theta + omega), sin(theta + omega));
  }

  // Apply selected variation
  vec2 applyVariation(vec2 p, float v, float seed) {
    if (v < 0.5) return vSinusoidal(p);
    if (v < 1.5) return vSpherical(p);
    if (v < 2.5) return vSwirl(p);
    if (v < 3.5) return vHorseshoe(p);
    if (v < 4.5) return vPolar(p);
    if (v < 5.5) return vHandkerchief(p);
    if (v < 6.5) return vHeart(p);
    return vJulia(p, seed);
  }

  // Affine transform with seed-based coefficients
  vec2 affineTransform(vec2 p, float index, float t) {
    float s = uSeed + index * 100.0;
    float a = sin(s * 1.23 + t * 0.1) * uSpread;
    float b = cos(s * 2.34 + t * 0.08) * uSpread * 0.7;
    float c = sin(s * 3.45 + t * 0.12) * uSpread * 0.7;
    float d = cos(s * 4.56 + t * 0.09) * uSpread;
    float e = sin(s * 5.67) * 0.5;
    float f = cos(s * 6.78) * 0.5;
    return vec2(a * p.x + b * p.y + e, c * p.x + d * p.y + f);
  }

  // Polar symmetry
  vec2 polarFold(vec2 p, float segments) {
    if (segments < 1.5) return p;
    float a = atan(p.y, p.x);
    float r = length(p);
    float seg = TAU / segments;
    a = mod(a + PI, seg);
    a = min(a, seg - a);
    return vec2(cos(a), sin(a)) * r;
  }

  void main() {
    float t = uTime;

    // UV setup with rotation and zoom
    vec2 uv = (vUv - 0.5) * 2.0;
    float rot = uRotation * 0.01745 + t * 0.02;
    float cr = cos(rot), sr = sin(rot);
    uv = mat2(cr, -sr, sr, cr) * uv;
    uv /= uZoom;

    // Apply symmetry
    uv = polarFold(uv, uSymmetry);

    // --- Iterated Flame System ---
    // Accumulate color density from multiple iterations
    vec3 colorAccum = vec3(0.0);
    float densityAccum = 0.0;

    // Start point — seeded from UV
    vec2 p = uv;

    int iters = int(uIterations);
    for (int i = 0; i < 20; i++) {
      if (i >= iters) break;

      float fi = float(i);

      // Select transform (cycle through available transforms)
      float xformIndex = mod(fi, 3.0);

      // Apply affine transform
      vec2 transformed = affineTransform(p, xformIndex, t);

      // Apply nonlinear variation
      float varSeed = uSeed + fi * 17.0;
      p = applyVariation(transformed, uVariation, varSeed);

      // Audio modulation on transforms
      p += vec2(uBass * 0.05 * sin(fi), uKick * 0.1 * cos(fi));

      // Accumulate — log density mapping (key to fractal flame look)
      float colorIndex = fi / float(iters) + length(p) * 0.1;
      vec3 iterColor = iqPalette(colorIndex + t * 0.05);

      // Distance from UV for density
      float dist = length(p - uv);
      float density = exp(-dist * dist * 4.0);

      colorAccum += iterColor * density;
      densityAccum += density;
    }

    // Log density tone mapping (fractal flame signature)
    float logDensity = log(1.0 + densityAccum) / log(1.0 + float(iters));
    vec3 color = colorAccum / (densityAccum + 0.001);
    color *= logDensity;

    // Gamma / contrast
    color = pow(color, vec3(0.8));
    color = (color - 0.3) * 1.5 + 0.3;

    // Audio glow
    color += color * uEnergy * 0.2;
    color += vec3(0.2, 0.05, 0.4) * uKick * 0.3;

    // High shimmer on bright areas
    float bright = dot(color, vec3(0.299, 0.587, 0.114));
    color += color * uHigh * 0.2 * sin(t * 8.0 + vUv.y * 20.0) * bright;

    // Vignette
    float vig = 1.0 - length((vUv - 0.5) * 1.6);
    color *= smoothstep(0.0, 0.5, vig);

    color = clamp(color, 0.0, 1.0);
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function PsyFractalFlame({ getAudioData, settings, params, static: isStatic }: Props) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const p = params || defaultFractalFlameParams;

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 }, uMid: { value: 0 }, uHigh: { value: 0 },
        uKick: { value: 0 }, uSub: { value: 0 }, uEnergy: { value: 0 },
        uVariation: { value: p.variation },
        uSymmetry: { value: p.symmetry },
        uZoom: { value: p.zoom },
        uRotation: { value: p.rotation },
        uSeed: { value: p.seed },
        uIterations: { value: p.iterations },
        uSpread: { value: p.spread },
        ...paletteToGLSLUniforms(p.palette),
      },
      vertexShader,
      fragmentShader,
    });
  }, []);

  useEffect(() => { matRef.current = material; }, [material]);

  useEffect(() => {
    if (!matRef.current) return;
    const u = matRef.current.uniforms;
    u.uVariation.value = p.variation;
    u.uSymmetry.value = p.symmetry;
    u.uZoom.value = p.zoom;
    u.uRotation.value = p.rotation;
    u.uSeed.value = p.seed;
    u.uIterations.value = p.iterations;
    u.uSpread.value = p.spread;
    u.uPalA.value = p.palette.a;
    u.uPalB.value = p.palette.b;
    u.uPalC.value = p.palette.c;
    u.uPalD.value = p.palette.d;
  }, [p]);

  useFrame((_, delta) => {
    if (!matRef.current) return;
    const u = matRef.current.uniforms;
    if (!isStatic) u.uTime.value += delta * p.speed;
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
