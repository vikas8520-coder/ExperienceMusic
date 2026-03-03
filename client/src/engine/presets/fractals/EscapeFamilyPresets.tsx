import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { FractalPreset, PresetContext, UniformSpec, UniformValues } from "../types";

const vert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const frag = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform vec2  u_resolution;
uniform float u_time;

uniform int   u_variant; // 0 Burning Ship, 1 Multibrot, 2 Phoenix, 3 Newton
uniform vec2  u_center;
uniform float u_zoom;
uniform float u_zoomExp;
uniform bool  u_infiniteZoom;
uniform float u_rotation;
uniform int   u_iterations;
uniform float u_aaLevel;
uniform float u_opacity;

uniform float u_audioBass;
uniform float u_audioMid;
uniform float u_audioHigh;
uniform float u_audioBeat;

uniform float u_power;
uniform float u_powerMorph;
uniform float u_bailout;
uniform float u_flame;
uniform float u_edgeShimmer;
uniform float u_memory;
uniform float u_memoryBurst;
uniform float u_damping;
uniform vec2  u_phoenixC;
uniform int   u_polyChoice;
uniform float u_boundaryGlow;

uniform vec3  u_paletteA;
uniform vec3  u_paletteB;
uniform vec3  u_paletteC;
uniform vec3  u_paletteD;
uniform float u_colorCycle;
uniform float u_colorSpeed;
uniform float u_saturation;
uniform float u_exposure;
uniform float u_gamma;
uniform float u_dither;
uniform float u_paletteRepeat;

#define PI  3.14159265359
#define TAU 6.28318530718

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 iqPalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(TAU * (c * t + d));
}

vec2 cmul(vec2 a, vec2 b) {
  return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

vec2 cdiv(vec2 a, vec2 b) {
  float den = max(dot(b, b), 1e-8);
  return vec2(a.x * b.x + a.y * b.y, a.y * b.x - a.x * b.y) / den;
}

vec2 cpow(vec2 z, float p) {
  float r = length(z);
  if (r < 1e-8) return vec2(0.0);
  float a = atan(z.y, z.x);
  float rp = pow(r, p);
  float ap = a * p;
  return vec2(cos(ap), sin(ap)) * rp;
}

struct FResult {
  float smoothIter;
  bool escaped;
  float trap;
  float angle;
  float mag;
  float rootIndex;
  float boundary;
};

float closestRootIndex(vec2 z, int polyChoice) {
  if (polyChoice == 0) {
    vec2 r0 = vec2(1.0, 0.0);
    vec2 r1 = vec2(-0.5, 0.8660254);
    vec2 r2 = vec2(-0.5, -0.8660254);
    float d0 = length(z - r0);
    float d1 = length(z - r1);
    float d2 = length(z - r2);
    if (d0 <= d1 && d0 <= d2) return 0.0;
    if (d1 <= d0 && d1 <= d2) return 1.0;
    return 2.0;
  }
  vec2 r0 = vec2(1.0, 0.0);
  vec2 r1 = vec2(-1.0, 0.0);
  vec2 r2 = vec2(0.0, 1.0);
  vec2 r3 = vec2(0.0, -1.0);
  float d0 = length(z - r0);
  float d1 = length(z - r1);
  float d2 = length(z - r2);
  float d3 = length(z - r3);
  float idx = 0.0;
  float best = d0;
  if (d1 < best) { best = d1; idx = 1.0; }
  if (d2 < best) { best = d2; idx = 2.0; }
  if (d3 < best) { idx = 3.0; }
  return idx;
}

FResult iterateFractal(vec2 c, int maxIter) {
  FResult fr;
  fr.smoothIter = 0.0;
  fr.escaped = false;
  fr.trap = 1e6;
  fr.angle = 0.0;
  fr.mag = 0.0;
  fr.rootIndex = 0.0;
  fr.boundary = 0.0;

  float bailout = max(2.0, u_bailout);
  float bailout2 = bailout * bailout;

  if (u_variant == 3) {
    vec2 z = c;
    float minStep = 1e6;
    float conv = 0.0;
    for (int i = 0; i < 512; i++) {
      if (i >= maxIter) break;
      vec2 f;
      vec2 fp;
      if (u_polyChoice == 0) {
        vec2 z2 = cmul(z, z);
        vec2 z3 = cmul(z2, z);
        f = z3 - vec2(1.0, 0.0);
        fp = 3.0 * z2;
      } else {
        vec2 z2 = cmul(z, z);
        vec2 z4 = cmul(z2, z2);
        f = z4 - vec2(1.0, 0.0);
        fp = 4.0 * cmul(z2, z);
      }

      vec2 delta = cdiv(f, fp + vec2(1e-6, 0.0));
      z -= delta * clamp(u_damping, 0.1, 1.5);

      float stepLen = length(delta);
      minStep = min(minStep, stepLen);
      conv = max(conv, 1.0 - smoothstep(0.0, 0.02, stepLen));
      fr.smoothIter = float(i);

      if (stepLen < 0.0008) {
        fr.escaped = true;
        break;
      }
    }
    fr.rootIndex = closestRootIndex(z, u_polyChoice);
    fr.boundary = clamp(exp(-minStep * (42.0 + u_boundaryGlow * 36.0)) + conv * 0.15, 0.0, 1.0);
    fr.mag = length(z);
    fr.angle = atan(z.y, z.x);
    return fr;
  }

  vec2 z = vec2(0.0);
  vec2 zPrev = vec2(0.0);
  float power = max(2.0, u_power + u_audioMid * u_powerMorph);
  float dynMemory = clamp(u_memory + u_audioMid * 0.24 + u_audioBeat * 0.2 * u_memoryBurst, -1.0, 1.0);

  for (int i = 0; i < 512; i++) {
    if (i >= maxIter) break;

    float r2 = dot(z, z);
    if (r2 > bailout2) {
      fr.escaped = true;
      fr.smoothIter = float(i) - log2(log2(max(r2, 1.0001))) + 4.0;
      fr.angle = atan(z.y, z.x);
      fr.mag = sqrt(r2);
      break;
    }

    if (u_variant == 0) {
      vec2 w = abs(z);
      z = cpow(w, max(2.0, u_power)) + c;
      fr.trap = min(fr.trap, length(w));
    } else if (u_variant == 1) {
      z = cpow(z, power) + c;
      fr.trap = min(fr.trap, abs(length(z) - 1.0));
    } else {
      vec2 z2 = cmul(z, z);
      vec2 zNew = z2 + c + dynMemory * zPrev + u_phoenixC * (1.0 - clamp(u_damping, 0.0, 1.0));
      zPrev = z;
      z = mix(zNew, z, clamp(1.0 - u_damping, 0.0, 0.8));
      fr.trap = min(fr.trap, length(z - zPrev) + abs(length(z) - 0.75) * 0.45);
    }

    fr.smoothIter = float(i);
    fr.angle = atan(z.y, z.x);
    fr.mag = sqrt(dot(z, z));
  }

  if (!fr.escaped) {
    fr.smoothIter = float(maxIter);
  }

  fr.trap = min(fr.trap, 5.0);
  return fr;
}

vec3 rootColor(float index, int polyChoice) {
  if (polyChoice == 0) {
    if (index < 0.5) return vec3(1.0, 0.45, 0.35);
    if (index < 1.5) return vec3(0.25, 0.9, 0.55);
    return vec3(0.35, 0.55, 1.0);
  }
  if (index < 0.5) return vec3(1.0, 0.72, 0.26);
  if (index < 1.5) return vec3(0.35, 0.85, 1.0);
  if (index < 2.5) return vec3(0.95, 0.35, 0.9);
  return vec3(0.58, 0.98, 0.42);
}

vec3 colorFractal(FResult fr, vec2 fragCoord, int maxIter) {
  float cycle = u_colorCycle + u_time * u_colorSpeed * 0.05 + u_audioBeat * 0.05;
  float rep = max(0.2, u_paletteRepeat);

  if (u_variant == 3) {
    float iterT = clamp(fr.smoothIter / float(maxIter), 0.0, 1.0);
    vec3 base = rootColor(fr.rootIndex, u_polyChoice);
    vec3 rootRamp = iqPalette(fract(fr.rootIndex * 0.21 + cycle), u_paletteA, u_paletteB, u_paletteC, u_paletteD);
    vec3 col = mix(rootRamp, base, 0.65);
    float boundary = clamp(fr.boundary, 0.0, 1.0);
    col += boundary * (0.2 + 0.55 * u_boundaryGlow + 0.45 * u_audioHigh) * vec3(0.85, 0.9, 1.0);
    col *= 0.55 + 0.45 * (1.0 - iterT);
    float pulse = 1.0 + u_audioBeat * 0.12;
    col *= pulse;
    return col;
  }

  float t = clamp(fr.smoothIter / float(maxIter), 0.0, 1.0);
  float logT = log(1.0 + fr.smoothIter) / log(1.0 + float(maxIter));
  t = mix(t, logT, 0.6);

  float stripes = 0.5 + 0.5 * sin(fr.angle * 8.0 + u_time * (0.8 + u_audioHigh * 1.6));
  float trap = exp(-fr.trap * 3.6);
  float idx = fract((1.0 - t) * rep + cycle + stripes * 0.08);
  vec3 col = iqPalette(idx, u_paletteA, u_paletteB, u_paletteC, u_paletteD);

  if (u_variant == 0) {
    float flame = clamp(u_flame, 0.0, 1.0);
    col += trap * flame * (0.25 + 0.75 * u_audioBass) * vec3(1.0, 0.42, 0.14);
    col += u_edgeShimmer * u_audioHigh * stripes * 0.18 * vec3(0.7, 0.75, 1.0);
  } else if (u_variant == 1) {
    float powerT = clamp((u_power - 2.0) / 10.0, 0.0, 1.0);
    col = mix(col, col.gbr, powerT * 0.2);
    col += trap * 0.08 * vec3(0.2, 0.45, 0.95);
  } else {
    col += trap * (0.16 + 0.32 * u_audioBeat) * vec3(0.7, 0.42, 1.0);
    col = mix(col, col.brg, clamp(u_memory, 0.0, 1.0) * 0.14);
  }

  if (!fr.escaped) {
    col *= 0.12 + trap * 0.4;
  }

  col *= 1.0 + u_audioBeat * 0.08;

  if (u_dither > 0.0) {
    float grain = hash12(fragCoord + vec2(u_time * 13.7, u_time * 7.9)) - 0.5;
    col += grain * 0.02 * clamp(u_dither, 0.0, 1.0);
  }

  return col;
}

vec3 renderPixel(vec2 fragCoord) {
  vec2 uv = fragCoord / u_resolution * 2.0 - 1.0;
  uv.x *= u_resolution.x / u_resolution.y;

  float zoomPulse = 1.0 + u_audioBass * 0.12 * (0.4 + 0.6 * sin(u_time * 1.4));
  float rotOff = u_audioMid * 0.08 * sin(u_time * 0.7);
  uv = rot(u_rotation + rotOff) * uv;
  vec2 c = u_center + uv / max(1e-6, u_zoom * zoomPulse);

  FResult fr = iterateFractal(c, max(8, u_iterations));
  vec3 col = colorFractal(fr, fragCoord, max(8, u_iterations));

  float gray = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(gray), col, u_saturation);

  return col;
}

void main() {
  vec2 fragCoord = vUv * u_resolution;
  int aa = int(u_aaLevel);

  vec3 col;
  if (aa <= 1) {
    col = renderPixel(fragCoord);
  } else {
    col = vec3(0.0);
    float faa = float(aa);
    for (int j = 0; j < 4; j++) {
      if (j >= aa) break;
      for (int i = 0; i < 4; i++) {
        if (i >= aa) break;
        vec2 off = (vec2(float(i), float(j)) + 0.5) / faa - 0.5;
        col += renderPixel(fragCoord + off);
      }
    }
    col /= faa * faa;
  }

  col = vec3(1.0) - exp(-max(col, vec3(0.0)) * max(0.01, u_exposure));
  col = pow(max(col, vec3(0.0)), vec3(1.0 / max(0.15, u_gamma)));
  col = clamp(col, 0.0, 1.0);

  gl_FragColor = vec4(col, u_opacity);
}
`;

type EscapeVariant = 0 | 1 | 2 | 3;

type EscapePresetConfig = {
  id: string;
  name: string;
  variant: EscapeVariant;
  defaultCenter?: [number, number];
  defaultZoom?: number;
  category?: FractalPreset["category"];
  defaults?: Partial<UniformValues>;
  extraSpecs: UniformSpec[];
};

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function vec2Or(value: unknown, fallbackX: number, fallbackY: number): [number, number] {
  if (Array.isArray(value) && value.length >= 2) {
    return [num(value[0], fallbackX), num(value[1], fallbackY)];
  }
  return [fallbackX, fallbackY];
}

function vec3FromHex(hex: string) {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothAR(prev: number, next: number, dt: number, attack = 18, release = 6): number {
  const speed = next > prev ? attack : release;
  const alpha = 1 - Math.exp(-speed * dt);
  return prev + (next - prev) * alpha;
}

const BASE_SPECS: UniformSpec[] = [
  { key: "u_center", label: "Center", type: "vec2", group: "Fractal", default: [-0.5, 0] },
  { key: "u_zoom", label: "Fractal zoom", type: "float", group: "Fractal", min: 0.35, max: 120, step: 0.01, default: 1.6, macro: true },
  { key: "u_opacity", label: "Opacity", type: "float", group: "Fractal", min: 0, max: 1, step: 0.01, default: 1 },
  { key: "u_infiniteZoom", label: "Infinite Zoom", type: "bool", group: "Fractal Zoom", default: false },
  {
    key: "u_zoomExp",
    label: "Zoom Depth",
    type: "float",
    group: "Fractal Zoom",
    min: -80,
    max: 10,
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
  { key: "u_iterations", label: "Iterations", type: "int", group: "Fractal", min: 24, max: 512, step: 1, default: 160 },

  { key: "u_paletteA", label: "Base Tone", type: "color", group: "Color", default: "#120C1E" },
  { key: "u_paletteB", label: "Amplitude", type: "color", group: "Color", default: "#4A2D8F" },
  { key: "u_paletteC", label: "Frequency", type: "color", group: "Color", default: "#4FD7FF" },
  { key: "u_paletteD", label: "Phase", type: "color", group: "Color", default: "#F56BC3" },
  { key: "u_paletteRepeat", label: "Palette Repeat", type: "float", group: "Color", min: 0.5, max: 10, step: 0.01, default: 2.4 },
  { key: "u_colorCycle", label: "Color Cycle", type: "float", group: "Color", min: 0, max: 1, step: 0.001, default: 0.0, macro: true },
  { key: "u_colorSpeed", label: "Auto Cycle Speed", type: "float", group: "Color", min: 0, max: 2, step: 0.01, default: 0.42 },
  { key: "u_saturation", label: "Saturation", type: "float", group: "Color", min: 0, max: 2, step: 0.01, default: 1.1 },
  { key: "u_exposure", label: "Exposure", type: "float", group: "Color", min: 0.4, max: 2.5, step: 0.01, default: 1.0 },
  { key: "u_gamma", label: "Gamma", type: "float", group: "Color", min: 0.6, max: 2.4, step: 0.01, default: 1.0 },
  { key: "u_dither", label: "Banding Reduce", type: "float", group: "Color", min: 0, max: 1, step: 0.01, default: 0.18 },

  { key: "u_audioGain", label: "Audio Gain", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 1.0, macro: true },
  { key: "u_bassImpact", label: "Bass Impact", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.8, macro: true },
  { key: "u_midMorph", label: "Mid Morph", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.6, macro: true },
  { key: "u_trebleShimmer", label: "Treble Shimmer", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.55, macro: true },
  { key: "u_beatPunch", label: "Beat Punch", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.8 },

  { key: "u_aaLevel", label: "Anti-Alias", type: "int", group: "Quality", min: 1, max: 3, step: 1, default: 1 },
];

function createEscapePreset(config: EscapePresetConfig): FractalPreset {
  const defaultCenter = config.defaultCenter ?? [-0.5, 0];
  const defaultZoom = config.defaultZoom ?? 1.6;
  const defaults = config.defaults ?? {};
  const resolvedBaseSpecs = BASE_SPECS.map((spec) =>
    Object.prototype.hasOwnProperty.call(defaults, spec.key)
      ? { ...spec, default: defaults[spec.key] }
      : spec,
  );

  const EscapeRender: React.FC<{ uniforms: UniformValues; state: any }> = ({ uniforms, state }) => {
    const matRef = useRef<THREE.ShaderMaterial>(null!);
    const { size, viewport, gl } = useThree();
    const autoZoomExpRef = useRef<number | null>(null);
    const autoZoomDirRef = useRef<1 | -1>(1);
    const autoZoomMinExpRef = useRef<number | null>(null);
    const autoZoomMaxExpRef = useRef<number | null>(null);
    const centerRef = useRef(new THREE.Vector2(defaultCenter[0], defaultCenter[1]));
    const targetCenterRef = useRef(new THREE.Vector2(defaultCenter[0], defaultCenter[1]));
    const staticTimeRef = useRef(0);

    useEffect(() => {
      const prev = gl.getPixelRatio();
      gl.setPixelRatio(Math.min(1, prev));
      return () => {
        gl.setPixelRatio(prev);
      };
    }, [gl]);

    useFrame(({ clock }, delta) => {
      const m = matRef.current;
      if (!m) return;

      const infiniteZoom = !!uniforms.u_infiniteZoom;
      const zoomValue = num(uniforms.u_zoom, num(defaults.u_zoom, defaultZoom));
      const zoomExpValue = num(uniforms.u_zoomExp, Math.log2(Math.max(1e-12, zoomValue)));
      const [centerX, centerY] = vec2Or(uniforms.u_center, defaultCenter[0], defaultCenter[1]);
      const [targetX, targetY] = vec2Or(uniforms.u_zoomTarget, centerX, centerY);

      const dpr = gl.getPixelRatio();
      if (infiniteZoom) {
        const motionDrive = Math.max(0.02, num(state.audioMid, 0) * 0.4 + num(state.audioHigh, 0) * 0.25 + 0.2);
        staticTimeRef.current += Math.min(delta, 0.05) * motionDrive;
        m.uniforms.u_time.value = staticTimeRef.current;
      } else {
        staticTimeRef.current = clock.getElapsedTime();
        m.uniforms.u_time.value = staticTimeRef.current;
      }
      m.uniforms.u_resolution.value.set(size.width * dpr, size.height * dpr);

      targetCenterRef.current.set(targetX, targetY);
      if (!infiniteZoom) {
        centerRef.current.set(centerX, centerY);
      } else {
        const centerLerp = 1 - Math.exp(-8 * Math.min(delta, 0.05));
        centerRef.current.lerp(targetCenterRef.current, centerLerp);
      }
      m.uniforms.u_center.value.set(centerRef.current.x, centerRef.current.y);

      const zoomPulseEnabled = uniforms.u_zoomPulseEnabled !== false;
      const zoomPulseStrength = num(uniforms.u_zoomPulseStrength, 0.12);
      const zoomPulseEnv = num(state.zoomPulseEnv, 0);
      const zoomPulse = zoomPulseEnabled ? Math.exp(zoomPulseStrength * zoomPulseEnv) : 1;

      if (!infiniteZoom) {
        autoZoomExpRef.current = null;
        autoZoomDirRef.current = 1;
        autoZoomMinExpRef.current = null;
        autoZoomMaxExpRef.current = null;
      } else {
        if (autoZoomExpRef.current === null) {
          autoZoomExpRef.current = zoomExpValue;
          autoZoomMinExpRef.current = zoomExpValue;
          autoZoomMaxExpRef.current = Math.min(60, zoomExpValue + 10);
        }
        const minExp = autoZoomMinExpRef.current ?? 0;
        const maxExp = autoZoomMaxExpRef.current ?? Math.min(60, minExp + 10);
        autoZoomExpRef.current += Math.min(delta, 0.05) * 0.38 * autoZoomDirRef.current;
        if (autoZoomExpRef.current >= maxExp) {
          autoZoomExpRef.current = maxExp;
          autoZoomDirRef.current = -1;
        } else if (autoZoomExpRef.current <= minExp) {
          autoZoomExpRef.current = minExp;
          autoZoomDirRef.current = 1;
        }
      }

      const exp = infiniteZoom ? (autoZoomExpRef.current ?? zoomExpValue) : Math.log2(Math.max(1e-12, zoomValue));
      const baseZoom = Math.max(1e-12, Math.pow(2, exp));
      const effectiveZoom = Math.max(1e-12, baseZoom * zoomPulse);
      m.uniforms.u_zoom.value = Math.max(1e-6, effectiveZoom);
      m.uniforms.u_zoomExp.value = Math.log2(effectiveZoom);
      m.uniforms.u_infiniteZoom.value = infiniteZoom;

      m.uniforms.u_variant.value = config.variant;
      m.uniforms.u_rotation.value = num(uniforms.u_rotation, num(defaults.u_rotation, 0));
      m.uniforms.u_iterations.value = num(uniforms.u_iterations, num(defaults.u_iterations, 160));
      m.uniforms.u_power.value = num(uniforms.u_power, num(defaults.u_power, 2));
      m.uniforms.u_powerMorph.value = num(uniforms.u_powerMorph, num(defaults.u_powerMorph, 0.8));
      m.uniforms.u_bailout.value = num(uniforms.u_bailout, num(defaults.u_bailout, 4));
      m.uniforms.u_flame.value = num(uniforms.u_flame, num(defaults.u_flame, 0.7));
      m.uniforms.u_edgeShimmer.value = num(uniforms.u_edgeShimmer, num(defaults.u_edgeShimmer, 0.45));
      m.uniforms.u_memory.value = num(uniforms.u_memory, num(defaults.u_memory, 0.34));
      m.uniforms.u_memoryBurst.value = num(uniforms.u_memoryBurst, num(defaults.u_memoryBurst, 0.45));
      m.uniforms.u_damping.value = num(uniforms.u_damping, num(defaults.u_damping, 0.85));
      const [phoenixCX, phoenixCY] = vec2Or(uniforms.u_phoenixC, -0.5, 0.02);
      m.uniforms.u_phoenixC.value.set(phoenixCX, phoenixCY);
      m.uniforms.u_polyChoice.value = Math.round(num(uniforms.u_polyChoice, num(defaults.u_polyChoice, 0)));
      m.uniforms.u_boundaryGlow.value = num(uniforms.u_boundaryGlow, num(defaults.u_boundaryGlow, 0.9));

      m.uniforms.u_audioBass.value = num(state.audioBass, 0);
      m.uniforms.u_audioMid.value = num(state.audioMid, 0);
      m.uniforms.u_audioHigh.value = num(state.audioHigh, 0);
      m.uniforms.u_audioBeat.value = num(state.audioBeat, 0);

      m.uniforms.u_colorCycle.value = num(uniforms.u_colorCycle, num(defaults.u_colorCycle, 0));
      m.uniforms.u_colorSpeed.value = num(uniforms.u_colorSpeed, num(defaults.u_colorSpeed, 0.42));
      m.uniforms.u_saturation.value = num(uniforms.u_saturation, num(defaults.u_saturation, 1.1));
      m.uniforms.u_exposure.value = num(uniforms.u_exposure, num(defaults.u_exposure, 1.0));
      m.uniforms.u_gamma.value = num(uniforms.u_gamma, num(defaults.u_gamma, 1.0));
      m.uniforms.u_dither.value = num(uniforms.u_dither, num(defaults.u_dither, 0.18));
      m.uniforms.u_paletteRepeat.value = num(uniforms.u_paletteRepeat, num(defaults.u_paletteRepeat, 2.4));
      m.uniforms.u_aaLevel.value = num(uniforms.u_aaLevel, num(defaults.u_aaLevel, 1));
      m.uniforms.u_opacity.value = num(uniforms.u_opacity, 1);

      m.uniforms.u_paletteA.value.copy(vec3FromHex(typeof uniforms.u_paletteA === "string" ? uniforms.u_paletteA : "#120C1E"));
      m.uniforms.u_paletteB.value.copy(vec3FromHex(typeof uniforms.u_paletteB === "string" ? uniforms.u_paletteB : "#4A2D8F"));
      m.uniforms.u_paletteC.value.copy(vec3FromHex(typeof uniforms.u_paletteC === "string" ? uniforms.u_paletteC : "#4FD7FF"));
      m.uniforms.u_paletteD.value.copy(vec3FromHex(typeof uniforms.u_paletteD === "string" ? uniforms.u_paletteD : "#F56BC3"));
    });

    const initialUniforms = useMemo(
      () => ({
        u_resolution: { value: new THREE.Vector2(1, 1) },
        u_time: { value: 0 },
        u_variant: { value: config.variant },
        u_center: { value: new THREE.Vector2(defaultCenter[0], defaultCenter[1]) },
        u_zoom: { value: num(defaults.u_zoom, defaultZoom) },
        u_zoomExp: { value: Math.log2(num(defaults.u_zoom, defaultZoom)) },
        u_infiniteZoom: { value: false },
        u_rotation: { value: num(defaults.u_rotation, 0) },
        u_iterations: { value: num(defaults.u_iterations, 160) },
        u_aaLevel: { value: num(defaults.u_aaLevel, 1) },
        u_opacity: { value: 1 },

        u_audioBass: { value: 0 },
        u_audioMid: { value: 0 },
        u_audioHigh: { value: 0 },
        u_audioBeat: { value: 0 },

        u_power: { value: num(defaults.u_power, 2) },
        u_powerMorph: { value: num(defaults.u_powerMorph, 0.8) },
        u_bailout: { value: num(defaults.u_bailout, 4) },
        u_flame: { value: num(defaults.u_flame, 0.7) },
        u_edgeShimmer: { value: num(defaults.u_edgeShimmer, 0.45) },
        u_memory: { value: num(defaults.u_memory, 0.34) },
        u_memoryBurst: { value: num(defaults.u_memoryBurst, 0.45) },
        u_damping: { value: num(defaults.u_damping, 0.85) },
        u_phoenixC: { value: new THREE.Vector2(...vec2Or(defaults.u_phoenixC, -0.5, 0.02)) },
        u_polyChoice: { value: Math.round(num(defaults.u_polyChoice, 0)) },
        u_boundaryGlow: { value: num(defaults.u_boundaryGlow, 0.9) },

        u_paletteA: { value: new THREE.Vector3(0.07, 0.05, 0.12) },
        u_paletteB: { value: new THREE.Vector3(0.29, 0.18, 0.56) },
        u_paletteC: { value: new THREE.Vector3(0.31, 0.84, 1.0) },
        u_paletteD: { value: new THREE.Vector3(0.96, 0.42, 0.76) },
        u_colorCycle: { value: num(defaults.u_colorCycle, 0) },
        u_colorSpeed: { value: num(defaults.u_colorSpeed, 0.42) },
        u_saturation: { value: num(defaults.u_saturation, 1.1) },
        u_exposure: { value: num(defaults.u_exposure, 1.0) },
        u_gamma: { value: num(defaults.u_gamma, 1.0) },
        u_dither: { value: num(defaults.u_dither, 0.18) },
        u_paletteRepeat: { value: num(defaults.u_paletteRepeat, 2.4) },
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

  return {
    id: config.id,
    name: config.name,
    category: config.category ?? "Fractals/Complex",
    kind: "shader2d",
    uniformSpecs: [...resolvedBaseSpecs, ...config.extraSpecs],
    init(_ctx: PresetContext) {},
    update({ ctx, audio, uniforms, state }) {
      const dt = Math.max(ctx.dt, 1 / 120);
      const gain = num(uniforms.u_audioGain, 1.0);

      const bassTarget = clamp01(audio.bass * gain * num(uniforms.u_bassImpact, 0.8));
      const midTarget = clamp01(audio.mid * gain * num(uniforms.u_midMorph, 0.6));
      const highTarget = clamp01(audio.treble * gain * num(uniforms.u_trebleShimmer, 0.55));
      const beatTarget = clamp01(audio.beat * gain * num(uniforms.u_beatPunch, 0.8));

      state.audioBass = smoothAR(num(state.audioBass, 0), bassTarget, dt, 14, 5);
      state.audioMid = smoothAR(num(state.audioMid, 0), midTarget, dt, 16, 6);
      state.audioHigh = smoothAR(num(state.audioHigh, 0), highTarget, dt, 20, 8);
      state.audioBeat = smoothAR(num(state.audioBeat, 0), beatTarget, dt, 24, 8);

      const rawZoomPulse = clamp01(audio.rms * 0.55 + audio.bass * 0.3 + audio.beat * 0.15);
      const prevZoomPulse = num(state.zoomPulseEnv, 0);
      const rate = rawZoomPulse > prevZoomPulse ? 12 : 5;
      const alpha = 1 - Math.exp(-rate * dt);
      state.zoomPulseEnv = prevZoomPulse + (rawZoomPulse - prevZoomPulse) * alpha;
    },
    dispose() {},
    Render: EscapeRender,
  };
}

export const BurningShipPreset = createEscapePreset({
  id: "burning-ship",
  name: "Burning Ship",
  variant: 0,
  defaultCenter: [-0.45, -0.5],
  defaultZoom: 1.8,
  defaults: {
    u_iterations: 220,
    u_power: 2.0,
    u_bailout: 4.0,
    u_flame: 0.72,
    u_edgeShimmer: 0.48,
    u_colorSpeed: 0.34,
    u_paletteRepeat: 2.6,
  },
  extraSpecs: [
    { key: "u_bailout", label: "Bailout", type: "float", group: "Fractal", min: 2, max: 16, step: 0.01, default: 4 },
    { key: "u_power", label: "Fold Power", type: "float", group: "Fractal", min: 2, max: 4, step: 0.01, default: 2.0 },
    { key: "u_flame", label: "Flame", type: "float", group: "Effects", min: 0, max: 1, step: 0.01, default: 0.72, macro: true },
    { key: "u_edgeShimmer", label: "Edge Shimmer", type: "float", group: "Effects", min: 0, max: 1, step: 0.01, default: 0.48 },
  ],
});

export const MultibrotPreset = createEscapePreset({
  id: "multibrot",
  name: "Multibrot",
  variant: 1,
  defaultCenter: [-0.28, 0],
  defaultZoom: 1.45,
  defaults: {
    u_iterations: 180,
    u_power: 3.0,
    u_powerMorph: 0.9,
    u_bailout: 4.0,
    u_colorSpeed: 0.46,
    u_paletteRepeat: 3.4,
  },
  extraSpecs: [
    { key: "u_bailout", label: "Bailout", type: "float", group: "Fractal", min: 2, max: 16, step: 0.01, default: 4 },
    { key: "u_power", label: "Power", type: "float", group: "Fractal", min: 2, max: 12, step: 0.01, default: 3.0 },
    { key: "u_powerMorph", label: "Power Morph", type: "float", group: "Fractal", min: 0, max: 3, step: 0.01, default: 0.9, macro: true },
  ],
});

export const PhoenixPreset = createEscapePreset({
  id: "phoenix",
  name: "Phoenix",
  variant: 2,
  defaultCenter: [0.0, 0.0],
  defaultZoom: 1.7,
  defaults: {
    u_iterations: 220,
    u_bailout: 6.0,
    u_memory: 0.34,
    u_memoryBurst: 0.55,
    u_damping: 0.82,
    u_phoenixC: [-0.5, 0.02],
    u_colorSpeed: 0.52,
    u_paletteRepeat: 2.9,
  },
  extraSpecs: [
    { key: "u_bailout", label: "Bailout", type: "float", group: "Fractal", min: 2, max: 20, step: 0.01, default: 6 },
    { key: "u_memory", label: "Memory", type: "float", group: "Fractal", min: -1, max: 1, step: 0.001, default: 0.34, macro: true },
    { key: "u_memoryBurst", label: "Memory Burst", type: "float", group: "Effects", min: 0, max: 1, step: 0.01, default: 0.55 },
    { key: "u_damping", label: "Damping", type: "float", group: "Fractal", min: 0.1, max: 1.0, step: 0.001, default: 0.82 },
    { key: "u_phoenixC", label: "Phoenix C", type: "vec2", group: "Julia", default: [-0.5, 0.02] },
  ],
});

export const NewtonPreset = createEscapePreset({
  id: "newton",
  name: "Newton",
  variant: 3,
  defaultCenter: [0, 0],
  defaultZoom: 1.55,
  defaults: {
    u_iterations: 72,
    u_damping: 1.0,
    u_polyChoice: 0,
    u_boundaryGlow: 1.1,
    u_colorSpeed: 0.18,
    u_paletteRepeat: 1.6,
    u_saturation: 1.05,
  },
  extraSpecs: [
    { key: "u_polyChoice", label: "Polynomial (0 z^3-1, 1 z^4-1)", type: "int", group: "Fractal", min: 0, max: 1, step: 1, default: 0 },
    { key: "u_damping", label: "Damping", type: "float", group: "Fractal", min: 0.2, max: 1.2, step: 0.001, default: 1.0 },
    { key: "u_boundaryGlow", label: "Boundary Glow", type: "float", group: "Effects", min: 0, max: 2, step: 0.01, default: 1.1, macro: true },
  ],
});
