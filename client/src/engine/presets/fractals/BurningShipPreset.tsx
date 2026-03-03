import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { FractalPreset, PresetContext, UniformValues } from "../types";

const vert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const frag = /* glsl */ `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 vUv;

uniform vec2  u_resolution;
uniform float u_time;

uniform vec2  u_center;
uniform float u_zoom;
uniform float u_zoomExp;
uniform bool  u_infiniteZoom;
uniform float u_rotation;
uniform float u_iterations;
uniform float u_power;
uniform float u_juliaMorph;
uniform vec2  u_juliaC;
uniform int   u_aaLevel;
uniform float u_opacity;

uniform float u_bass;
uniform float u_mid;
uniform float u_high;
uniform float u_energy;

uniform float u_paletteRepeat;
uniform float u_exposure;
uniform float u_gamma;
uniform float u_edgeGlow;
uniform float u_aoStrength;
uniform float u_rimStrength;
uniform float u_height;
uniform float u_warp;

float sat01(float x) {
  return clamp(x, 0.0, 1.0);
}

mat2 rot(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(6.28318 * (c * t + d));
}

// Returns: x=mu (0..~1), y=escaped (0/1), z=trap, w=orbit density
vec4 burnShipInfo(vec2 c, int maxIter) {
  vec2 z = vec2(0.0);
  float m2 = 0.0;
  float trap = 1e6;
  float orbit = 0.0;
  float iter = float(maxIter);
  bool escaped = false;
  float juliaMix = clamp(u_juliaMorph, 0.0, 1.0);
  vec2 cEff = mix(c, u_juliaC, juliaMix);
  float p = max(1.0, u_power);

  for (int i = 0; i < 512; i++) {
    if (i >= maxIter) break;

    z = abs(z);
    float r = max(length(z), 1e-9);
    float a = atan(z.y, z.x);
    float rp = pow(r, p);
    float ap = a * p;
    z = rp * vec2(cos(ap), sin(ap)) + cEff;

    m2 = dot(z, z);
    trap = min(trap, abs(length(z) - 1.12));
    orbit += exp(-m2 * 0.18);

    if (m2 > 64.0) {
      iter = float(i);
      escaped = true;
      break;
    }
  }

  float mu = 0.0;
  if (escaped) {
    m2 = max(m2, 1e-12);

    float log_zn = 0.5 * log(m2);
    log_zn = max(log_zn, 1e-12);

    float inner = max(log_zn / log(2.0), 1e-12);
    float nu = log(inner) / log(2.0);

    float smoothIter = iter + 1.0 - nu;
    smoothIter = clamp(smoothIter, 0.0, float(maxIter));
    mu = smoothIter / float(maxIter);
  }

  return vec4(mu, escaped ? 1.0 : 0.0, trap, orbit / float(maxIter));
}

vec3 renderPixel(vec2 fragCoord) {
  vec2 p = fragCoord / u_resolution * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;

  vec2 uv = rot(u_rotation) * p;
  uv = uv / max(1e-6, u_zoom) + u_center;

  float warp = u_warp * (0.35 + 0.65 * u_mid) * (0.6 + 0.4 * sin(u_time * 0.6));
  uv += warp * vec2(
    sin(uv.y * 3.0 + u_time * 0.7),
    cos(uv.x * 3.2 - u_time * 0.6)
  );

  int maxIter = int(clamp(u_iterations * (0.90 + 0.20 * u_energy), 24.0, 512.0));
  vec4 info = burnShipInfo(uv, maxIter);

  float mu = sat01(info.x);
  float escaped = info.y;
  float trap = info.z;
  float orbit = info.w;

  float h = pow(mu, 0.68) * u_height;
  float ang = atan(uv.y, uv.x) + orbit * 6.0 + u_time * 0.1;
  vec3 n = normalize(vec3(cos(ang) * (0.35 + 0.65 * h), sin(ang) * (0.35 + 0.65 * h), 1.15));

  vec3 l1 = normalize(vec3(0.32, 0.58, 0.75));
  vec3 l2 = normalize(vec3(-0.22, 0.28, 0.56));

  float diff = max(0.0, dot(n, l1));
  float diff2 = max(0.0, dot(n, l2)) * 0.35;
  float rim = pow(1.0 - n.z, 2.1) * u_rimStrength;

  vec3 vdir = vec3(0.0, 0.0, 1.0);
  vec3 hdir = normalize(l1 + vdir);
  float spec = pow(max(0.0, dot(n, hdir)), 22.0 + 26.0 * u_high) * (0.08 + 0.24 * u_high);

  float edge = pow(1.0 - smoothstep(0.02, 0.22, trap), 1.2);
  float glow = edge * (0.22 + 0.86 * u_edgeGlow) * (0.55 + 0.45 * u_energy);

  float t = fract(mu * max(0.1, u_paletteRepeat) + edge * 0.14 + 0.025 * u_time * (0.4 + 0.6 * u_energy));
  vec3 base = pal(
    t,
    vec3(0.08, 0.09, 0.14),
    vec3(0.42, 0.34, 0.54),
    vec3(1.0, 1.0, 1.0),
    vec3(0.00, 0.13, 0.23)
  );

  vec3 warm = vec3(1.0, 0.56, 0.16);
  base = mix(base, warm, 0.24 * smoothstep(0.40, 1.0, u_bass) * (0.3 + 0.7 * edge));

  vec3 insideCol = vec3(0.10, 0.07, 0.13) + 0.08 * vec3(0.14, 0.11, 0.23) * (0.5 + 0.5 * sin(u_time * 0.28));
  vec3 col = mix(insideCol, base, escaped);

  float ao = 1.0 - u_aoStrength * (0.45 * h + 0.35 * (1.0 - edge));
  ao = clamp(ao, 0.35, 1.0);

  float lightMix = max(0.62, 0.45 + 0.8 * diff + diff2);
  col *= lightMix;
  col *= max(0.62, ao);

  col += rim * vec3(0.30, 0.46, 0.82);
  col += spec * vec3(1.0, 0.86, 1.08);
  col += glow * vec3(0.34, 0.62, 1.18);

  // Prevent dead-black interiors.
  col += (1.0 - escaped) * (0.05 + 0.08 * orbit) * vec3(0.42, 0.28, 0.66);

  float d = (hash21(gl_FragCoord.xy + u_time) - 0.5) * (1.0 / 255.0) * (0.75 + 0.45 * u_high);
  col += d;

  col *= max(0.01, u_exposure) * 1.15;
  col = col / (col + vec3(1.0));
  col = pow(max(col, 0.0), vec3(1.0 / max(0.3, u_gamma)));
  col += vec3(0.02, 0.015, 0.025);

  if (!(col.r >= 0.0) || !(col.g >= 0.0) || !(col.b >= 0.0)) {
    col = vec3(0.35, 0.06, 0.45);
  }

  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  vec3 fallback = vec3(0.16, 0.05, 0.24);
  fallback += 0.2 * vec3(
    0.5 + 0.5 * sin(u_time * 0.8 + uv.x * 5.0),
    0.5 + 0.5 * sin(u_time * 1.1 + uv.y * 4.0),
    0.5 + 0.5 * sin(u_time * 0.6 + uv.x * 2.0 + uv.y * 2.0)
  );
  float useFallback = 1.0 - smoothstep(0.03, 0.15, lum);
  col = mix(col, fallback, useFallback * 0.9);

  col = max(col, vec3(0.05, 0.04, 0.06));
  return clamp(col, 0.0, 1.0);
}

void main() {
  vec2 fragCoord = vUv * u_resolution;
  int aa = int(clamp(float(u_aaLevel), 1.0, 2.0));

  vec3 col;
  if (aa <= 1) {
    col = renderPixel(fragCoord);
  } else {
    col = vec3(0.0);
    float faa = float(aa);
    for (int j = 0; j < 2; j++) {
      for (int i = 0; i < 2; i++) {
        vec2 off = (vec2(float(i), float(j)) + 0.5) / faa - 0.5;
        col += renderPixel(fragCoord + off);
      }
    }
    col *= 0.25;
  }

  gl_FragColor = vec4(col, max(0.35, u_opacity));
}
`;

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function vec2Or(value: unknown, fallbackX: number, fallbackY: number): [number, number] {
  if (Array.isArray(value) && value.length >= 2) {
    return [num(value[0], fallbackX), num(value[1], fallbackY)];
  }
  return [fallbackX, fallbackY];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothAR(prev: number, next: number, dt: number, attack = 18, release = 6): number {
  const speed = next > prev ? attack : release;
  const alpha = 1 - Math.exp(-speed * dt);
  return prev + (next - prev) * alpha;
}

const BurningShipRender: React.FC<{ uniforms: UniformValues; state: any }> = ({ uniforms, state }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null!);
  const { size, viewport, gl } = useThree();

  useEffect(() => {
    const prev = gl.getPixelRatio();
    gl.setPixelRatio(Math.min(1, prev));
    return () => {
      gl.setPixelRatio(prev);
    };
  }, [gl]);

  useFrame(({ clock }) => {
    const m = matRef.current;
    if (!m) return;

    const dpr = gl.getPixelRatio();
    m.uniforms.u_resolution.value.set(size.width * dpr, size.height * dpr);
    m.uniforms.u_time.value = clock.getElapsedTime();

    const [centerX, centerY] = vec2Or(uniforms.u_center, -0.45, -0.5);
    m.uniforms.u_center.value.set(centerX, centerY);

    const zoomValue = num(uniforms.u_zoom, 1.8);
    const zoomExpValue = num(uniforms.u_zoomExp, Math.log2(Math.max(1e-12, zoomValue)));
    const infiniteZoom = !!uniforms.u_infiniteZoom;
    const baseZoom = infiniteZoom ? Math.pow(2, zoomExpValue) : zoomValue;
    const audioReactive = uniforms.u_audioReactive === true;

    const zoomPulseEnabled = audioReactive && uniforms.u_zoomPulseEnabled !== false;
    const zoomPulseStrength = num(uniforms.u_zoomPulseStrength, 0.12);
    const zoomPulseEnv = num(state.zoomPulseEnv, 0);
    const zoomPulse = zoomPulseEnabled ? Math.exp(zoomPulseStrength * zoomPulseEnv) : 1;
    const effectiveZoom = Math.max(1e-12, baseZoom * zoomPulse);

    m.uniforms.u_zoom.value = Math.max(1e-6, effectiveZoom);
    m.uniforms.u_zoomExp.value = Math.log2(effectiveZoom);
    m.uniforms.u_infiniteZoom.value = infiniteZoom;

    const baseRotation = num(uniforms.u_rotation, 0);
    const basePower = num(uniforms.u_power, 2.0);
    const juliaMorph = clamp01(num(uniforms.u_juliaMorph, 0.0));
    const [juliaCX, juliaCY] = vec2Or(uniforms.u_juliaC, -0.4, 0.6);
    const baseIterations = Math.max(24, Math.min(512, num(uniforms.u_iterations, 220)));
    const basePaletteRepeat = num(uniforms.u_paletteRepeat, 2.6);
    const baseExposure = num(uniforms.u_exposure, 1.7);
    const baseEdgeGlow = num(uniforms.u_edgeGlow, 1.25);
    const baseWarp = num(uniforms.u_warp, 0.08);

    m.uniforms.u_gamma.value = num(uniforms.u_gamma, 2.1);
    m.uniforms.u_aoStrength.value = num(uniforms.u_aoStrength, 0.55);
    m.uniforms.u_rimStrength.value = num(uniforms.u_rimStrength, 0.45);
    m.uniforms.u_height.value = num(uniforms.u_height, 1.0);
    m.uniforms.u_aaLevel.value = Math.round(num(uniforms.u_aaLevel, 1));
    m.uniforms.u_opacity.value = num(uniforms.u_opacity, 1);

    const audioGain = num(uniforms.u_audioGain, 1.0);
    const bassImpact = num(uniforms.u_bassImpact, 0.8);
    const midMorph = num(uniforms.u_midMorph, 0.6);
    const trebleShimmer = num(uniforms.u_trebleShimmer, 0.6);
    const beatPunch = num(uniforms.u_beatPunch, 0.8);

    const bass = audioReactive ? clamp01(num(state.audioBass, 0) * audioGain * bassImpact) : 0;
    const mid = audioReactive ? clamp01(num(state.audioMid, 0) * audioGain * midMorph) : 0;
    const high = audioReactive ? clamp01(num(state.audioHigh, 0) * audioGain * trebleShimmer) : 0;
    const energyBase = audioReactive ? clamp01(num(state.audioEnergy, 0) * audioGain) : 0;
    const beat = audioReactive ? clamp01(num(state.audioBeat, 0) * audioGain * beatPunch) : 0;
    const energy = audioReactive ? clamp01(energyBase * 0.8 + beat * 0.2) : 0;

    const reactIterations = num(uniforms.u_reactIterations, 0.45);
    const reactWarp = num(uniforms.u_reactWarp, 0.45);
    const reactGlow = num(uniforms.u_reactGlow, 0.65);
    const reactExposure = num(uniforms.u_reactExposure, 0.38);
    const reactRotation = num(uniforms.u_reactRotation, 0.15);
    const reactPaletteShift = num(uniforms.u_reactPaletteShift, 0.3);

    const iterationsBoost = 1 + reactIterations * (energy * 0.65 + bass * 0.35);
    const effectiveIterations = Math.max(24, Math.min(512, baseIterations * iterationsBoost));

    const effectiveWarp = Math.max(0, Math.min(0.4, baseWarp + reactWarp * (mid * 0.12 + energy * 0.10)));
    const effectiveGlow = Math.max(0, Math.min(2, baseEdgeGlow + reactGlow * (energy * 0.85 + high * 0.35)));
    const effectiveExposure = Math.max(0.4, Math.min(2.5, baseExposure + reactExposure * (energy * 0.5 + bass * 0.2)));
    const effectiveRotation = baseRotation + reactRotation * (beat * 0.14 + mid * 0.06 + high * 0.03);
    const effectivePaletteRepeat = Math.max(
      0.5,
      Math.min(8, basePaletteRepeat + reactPaletteShift * (high * 0.8 + energy * 0.4)),
    );

    m.uniforms.u_rotation.value = effectiveRotation;
    m.uniforms.u_iterations.value = effectiveIterations;
    m.uniforms.u_power.value = Math.max(1.0, Math.min(6.0, basePower));
    m.uniforms.u_juliaMorph.value = juliaMorph;
    m.uniforms.u_juliaC.value.set(juliaCX, juliaCY);
    m.uniforms.u_paletteRepeat.value = effectivePaletteRepeat;
    m.uniforms.u_exposure.value = effectiveExposure;
    m.uniforms.u_edgeGlow.value = effectiveGlow;
    m.uniforms.u_warp.value = effectiveWarp;

    m.uniforms.u_bass.value = bass;
    m.uniforms.u_mid.value = mid;
    m.uniforms.u_high.value = high;
    m.uniforms.u_energy.value = energy;

    // Ensure transition blending cannot leave this material permanently transparent.
    m.transparent = true;
    m.opacity = 1.0;
  });

  const initialUniforms = useMemo(
    () => ({
      u_resolution: { value: new THREE.Vector2(1, 1) },
      u_time: { value: 0 },

      u_center: { value: new THREE.Vector2(-0.45, -0.5) },
      u_zoom: { value: 1.8 },
      u_zoomExp: { value: Math.log2(1.8) },
      u_infiniteZoom: { value: false },
      u_rotation: { value: 0 },
      u_iterations: { value: 220.0 },
      u_power: { value: 2.0 },
      u_juliaMorph: { value: 0.0 },
      u_juliaC: { value: new THREE.Vector2(-0.4, 0.6) },
      u_aaLevel: { value: 1 },
      u_opacity: { value: 1.0 },

      u_bass: { value: 0.0 },
      u_mid: { value: 0.0 },
      u_high: { value: 0.0 },
      u_energy: { value: 0.0 },

      u_paletteRepeat: { value: 2.6 },
      u_exposure: { value: 1.7 },
      u_gamma: { value: 2.1 },
      u_edgeGlow: { value: 1.25 },
      u_aoStrength: { value: 0.55 },
      u_rimStrength: { value: 0.45 },
      u_height: { value: 1.0 },
      u_warp: { value: 0.08 },
    }),
    [],
  );

  return (
    <mesh position={[0, 0, 0]}>
      <planeGeometry args={[viewport.width, viewport.height]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={initialUniforms}
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </mesh>
  );
};

export const BurningShipPreset: FractalPreset = {
  id: "burning-ship",
  name: "Burning Ship",
  category: "Fractals/Complex",
  kind: "shader2d",

  uniformSpecs: [
    { key: "u_center", label: "Center", type: "vec2", group: "Fractal", default: [-0.45, -0.5] },
    { key: "u_zoom", label: "Fractal zoom", type: "float", group: "Fractal", min: 0.35, max: 120, step: 0.01, default: 1.8, macro: true },
    { key: "u_opacity", label: "Opacity", type: "float", group: "Fractal", min: 0, max: 1, step: 0.01, default: 1 },
    { key: "u_infiniteZoom", label: "Infinite Zoom", type: "bool", group: "Fractal Zoom", default: false },
    {
      key: "u_zoomExp",
      label: "Zoom Depth",
      type: "float",
      group: "Fractal Zoom",
      min: -80,
      max: 12,
      step: 0.01,
      default: 0,
      visibleIf: (u: UniformValues) => !!u.u_infiniteZoom,
    },
    { key: "u_zoomPulseEnabled", label: "Zoom Pulse", type: "bool", group: "Fractal", default: false },
    {
      key: "u_zoomPulseStrength",
      label: "Pulse Amount",
      type: "float",
      group: "Fractal",
      min: 0,
      max: 0.35,
      step: 0.005,
      default: 0.12,
      visibleIf: (u: UniformValues) => !!u.u_zoomPulseEnabled,
    },
    { key: "u_rotation", label: "Rotation", type: "float", group: "Fractal", min: -3.14, max: 3.14, step: 0.001, default: 0 },
    { key: "u_iterations", label: "Iterations", type: "int", group: "Fractal", min: 24, max: 512, step: 1, default: 220 },
    { key: "u_power", label: "Power", type: "float", group: "Fractal", min: 1.0, max: 6.0, step: 0.01, default: 2.0 },
    { key: "u_juliaMorph", label: "Julia Morph", type: "float", group: "Julia", min: 0, max: 1, step: 0.001, default: 0.0, macro: true },
    {
      key: "u_juliaC",
      label: "Julia Seed",
      type: "vec2",
      group: "Julia",
      default: [-0.4, 0.6],
      visibleIf: (u: UniformValues) => (u.u_juliaMorph as number) > 0.01,
    },

    { key: "u_paletteRepeat", label: "Palette Repeat", type: "float", group: "Color", min: 0.5, max: 8.0, step: 0.01, default: 2.6 },
    { key: "u_exposure", label: "Exposure", type: "float", group: "Color", min: 0.4, max: 2.5, step: 0.01, default: 1.7 },
    { key: "u_gamma", label: "Gamma", type: "float", group: "Color", min: 0.6, max: 3.0, step: 0.01, default: 2.1 },

    { key: "u_edgeGlow", label: "Edge Glow", type: "float", group: "Effects", min: 0.0, max: 2.0, step: 0.01, default: 1.25, macro: true },
    { key: "u_aoStrength", label: "AO Strength", type: "float", group: "Lighting", min: 0.0, max: 1.0, step: 0.01, default: 0.55 },
    { key: "u_rimStrength", label: "Rim Strength", type: "float", group: "Lighting", min: 0.0, max: 1.0, step: 0.01, default: 0.45 },
    { key: "u_height", label: "Height", type: "float", group: "Lighting", min: 0.2, max: 2.0, step: 0.01, default: 1.0 },
    { key: "u_warp", label: "Domain Warp", type: "float", group: "Motion", min: 0.0, max: 0.4, step: 0.001, default: 0.08 },
    { key: "u_aaLevel", label: "Anti-Alias", type: "int", group: "Quality", min: 1, max: 2, step: 1, default: 1 },

    { key: "u_audioReactive", label: "Audio Reactive", type: "bool", group: "Audio", default: true, macro: true },
    { key: "u_audioGain", label: "Audio Gain", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 1.0, macro: true },
    { key: "u_bassImpact", label: "Bass Impact", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.8, macro: true },
    { key: "u_midMorph", label: "Mid Morph", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.6, macro: true },
    { key: "u_trebleShimmer", label: "Treble Shimmer", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.6, macro: true },
    { key: "u_beatPunch", label: "Beat Punch", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.8 },
    {
      key: "u_reactIterations",
      label: "React Iterations",
      type: "float",
      group: "Audio",
      min: 0,
      max: 1.5,
      step: 0.01,
      default: 0.45,
      visibleIf: (u: UniformValues) => u.u_audioReactive === true,
    },
    {
      key: "u_reactWarp",
      label: "React Warp",
      type: "float",
      group: "Audio",
      min: 0,
      max: 1.5,
      step: 0.01,
      default: 0.45,
      visibleIf: (u: UniformValues) => u.u_audioReactive === true,
    },
    {
      key: "u_reactGlow",
      label: "React Glow",
      type: "float",
      group: "Audio",
      min: 0,
      max: 2,
      step: 0.01,
      default: 0.65,
      visibleIf: (u: UniformValues) => u.u_audioReactive === true,
    },
    {
      key: "u_reactExposure",
      label: "React Exposure",
      type: "float",
      group: "Audio",
      min: 0,
      max: 1.2,
      step: 0.01,
      default: 0.38,
      visibleIf: (u: UniformValues) => u.u_audioReactive === true,
    },
    {
      key: "u_reactRotation",
      label: "React Rotation",
      type: "float",
      group: "Audio",
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.15,
      visibleIf: (u: UniformValues) => u.u_audioReactive === true,
    },
    {
      key: "u_reactPaletteShift",
      label: "React Palette",
      type: "float",
      group: "Audio",
      min: 0,
      max: 1.5,
      step: 0.01,
      default: 0.3,
      visibleIf: (u: UniformValues) => u.u_audioReactive === true,
    },
  ],

  init(_ctx: PresetContext) {},
  update({ ctx, audio, uniforms, state }) {
    if (uniforms.u_audioReactive !== true) {
      state.audioBass = 0;
      state.audioMid = 0;
      state.audioHigh = 0;
      state.audioBeat = 0;
      state.audioEnergy = 0;
      state.zoomPulseEnv = 0;
      return;
    }

    const dt = Math.max(ctx.dt, 1 / 120);

    const bassTarget = clamp01(audio.bass);
    const midTarget = clamp01(audio.mid);
    const highTarget = clamp01(audio.treble);
    const beatTarget = clamp01(audio.beat);
    const energyTarget = clamp01(audio.rms * 0.6 + audio.bass * 0.25 + audio.beat * 0.15);

    state.audioBass = smoothAR(num(state.audioBass, 0), bassTarget, dt, 14, 5);
    state.audioMid = smoothAR(num(state.audioMid, 0), midTarget, dt, 16, 6);
    state.audioHigh = smoothAR(num(state.audioHigh, 0), highTarget, dt, 20, 8);
    state.audioBeat = smoothAR(num(state.audioBeat, 0), beatTarget, dt, 24, 8);
    state.audioEnergy = smoothAR(num(state.audioEnergy, 0), energyTarget, dt, 12, 5);

    const prevZoomPulse = num(state.zoomPulseEnv, 0);
    const rate = energyTarget > prevZoomPulse ? 12 : 5;
    const alpha = 1 - Math.exp(-rate * dt);
    state.zoomPulseEnv = prevZoomPulse + (energyTarget - prevZoomPulse) * alpha;
  },
  dispose() {},

  Render: BurningShipRender,
};
