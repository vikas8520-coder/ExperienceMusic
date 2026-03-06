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
precision highp float;

varying vec2 vUv;

uniform vec2  u_resolution;
uniform float u_time;

uniform float u_zoom;
uniform float u_rotation;
uniform float u_symmetryFolds;
uniform float u_mandalaScale;
uniform float u_tendrilSpeed;
uniform float u_tendrilDensity;
uniform float u_crystalSize;
uniform float u_figureIntensity;
uniform float u_cosmicGlow;
uniform float u_uvIntensity;

uniform float u_glowIntensity;
uniform float u_saturation;
uniform float u_contrast;
uniform float u_opacity;

uniform vec3  u_paletteA;
uniform vec3  u_paletteB;
uniform vec3  u_paletteC;
uniform vec3  u_paletteD;
uniform float u_colorCycle;
uniform float u_colorSpeed;

uniform float u_bass;
uniform float u_mid;
uniform float u_high;
uniform float u_energy;
uniform float u_kick;

uniform int   u_qualityMode;

#define TAU 6.28318530718
#define PI  3.14159265359

float sat(float x) { return clamp(x, 0.0, 1.0); }
bool Q_MED()  { return u_qualityMode >= 1; }
bool Q_HIGH() { return u_qualityMode >= 2; }

mat2 rot(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

// --- Noise functions ---

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p, int octaves) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    v += a * noise(p);
    p = r * p * 2.0 + vec2(0.13, 0.17);
    a *= 0.5;
  }
  return v;
}

// --- IQ palette ---

vec3 iqPalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(TAU * (c * t + d));
}

// --- Sacred geometry: mandala star ---

float mandala(vec2 p, float folds, float scale, float time) {
  float r = length(p);
  float a = atan(p.y, p.x);

  // Fold into symmetric sectors
  float sector = TAU / folds;
  a = mod(a + sector * 0.5, sector) - sector * 0.5;
  a = abs(a);

  vec2 q = vec2(cos(a), sin(a)) * r;
  q *= scale;

  // Concentric rings
  float rings = sin(r * 18.0 - time * 0.8) * 0.5 + 0.5;
  rings *= smoothstep(0.0, 0.15, r);

  // Petal shapes
  float petals = smoothstep(0.02, 0.0, abs(q.y) - 0.03 * (1.0 - r * 1.8));
  petals *= smoothstep(0.6, 0.0, r);

  // Star arms
  float arms = smoothstep(0.015, 0.0, abs(q.y - q.x * 0.3) - 0.008);
  arms *= smoothstep(0.7, 0.1, r);

  // Inner geometry: flower of life circles
  float flower = 0.0;
  float flowerR = 0.12;
  for (int i = 0; i < 6; i++) {
    float fa = float(i) * TAU / 6.0 + time * 0.15;
    vec2 fc = vec2(cos(fa), sin(fa)) * flowerR;
    float d = abs(length(p - fc) - flowerR);
    flower += smoothstep(0.008, 0.0, d) * 0.4;
  }
  // Center circle
  flower += smoothstep(0.006, 0.0, abs(r - flowerR)) * 0.5;

  return rings * 0.3 + petals * 0.5 + arms * 0.4 + flower * 0.6;
}

// --- Organic tendrils via warped FBM ---

float tendrils(vec2 p, float time, float density) {
  int oct = Q_HIGH() ? 6 : (Q_MED() ? 4 : 3);

  // Mirror X for bilateral symmetry
  p.x = abs(p.x);

  vec2 q = p * density;
  q += vec2(
    fbm(q * 0.8 + vec2(time * 0.12, -time * 0.09), oct),
    fbm(q * 0.8 + vec2(-time * 0.11, time * 0.14), oct)
  ) * 1.2;

  float n = fbm(q, oct);

  // Create vine-like structure by thresholding
  float vines = smoothstep(0.42, 0.58, n);
  float detail = smoothstep(0.35, 0.65, fbm(q * 2.0 + time * 0.06, oct));

  return vines * 0.7 + detail * 0.3;
}

// --- Crystal shards via angular voronoi ---

float crystals(vec2 p, float size, float time) {
  p.x = abs(p.x); // symmetry

  vec2 gp = p / size;
  vec2 ip = floor(gp);
  vec2 fp = fract(gp);

  float minDist = 1.0;
  float secondDist = 1.0;

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 point = vec2(
        hash21(ip + neighbor),
        hash21(ip + neighbor + 99.0)
      );
      point = 0.5 + 0.35 * sin(time * 0.3 + TAU * point);
      float d = length(fp - neighbor - point);
      if (d < minDist) {
        secondDist = minDist;
        minDist = d;
      } else if (d < secondDist) {
        secondDist = d;
      }
    }
  }

  // Edge detection for faceted look
  float edge = secondDist - minDist;
  float facet = smoothstep(0.0, 0.05, edge);
  float glow = exp(-edge * 12.0);

  return glow * 0.6 + (1.0 - facet) * 0.4;
}

// --- Meditating figure SDF silhouette ---

float figureSDF(vec2 p) {
  p.x = abs(p.x); // symmetric

  // Head (circle)
  float head = length(p - vec2(0.0, 0.28)) - 0.055;

  // Body (ellipse - torso)
  vec2 bp = p - vec2(0.0, 0.16);
  float body = length(bp / vec2(0.09, 0.12)) - 1.0;
  body *= 0.09;

  // Crossed legs (wide ellipse at bottom)
  vec2 lp = p - vec2(0.0, 0.04);
  float legs = length(lp / vec2(0.16, 0.045)) - 1.0;
  legs *= 0.045;

  // Arms reaching to knees
  vec2 ap = p - vec2(0.07, 0.12);
  ap = rot(-0.6) * ap;
  float arm = length(ap / vec2(0.008, 0.09)) - 1.0;
  arm *= 0.008;

  float d = min(head, min(body, min(legs, arm)));
  return d;
}

float figure(vec2 p, float intensity) {
  if (intensity < 0.01) return 0.0;

  // Position figure at bottom center
  vec2 fp = p - vec2(0.0, -0.28);
  fp *= 3.2;

  float d = figureSDF(fp);
  float silhouette = smoothstep(0.01, -0.01, d);
  float aura = exp(-max(d, 0.0) * 18.0) * 0.7;
  float innerGlow = exp(-max(d, 0.0) * 40.0) * 0.4;

  return (silhouette * 0.3 + aura + innerGlow) * intensity;
}

// --- Cosmic elements: twin moons ---

float cosmicMoons(vec2 p, float time) {
  float moons = 0.0;

  // Left moon
  vec2 lm = p - vec2(-0.45, 0.38);
  float ld = length(lm);
  moons += exp(-ld * ld * 60.0) * 0.8;
  moons += smoothstep(0.06, 0.0, abs(ld - 0.05)) * 0.4;
  // Halo ring
  moons += smoothstep(0.008, 0.0, abs(ld - 0.09)) * 0.3 * (0.7 + 0.3 * sin(time * 1.2));

  // Right moon (mirrored)
  vec2 rm = p - vec2(0.45, 0.38);
  float rd = length(rm);
  moons += exp(-rd * rd * 60.0) * 0.8;
  moons += smoothstep(0.06, 0.0, abs(rd - 0.05)) * 0.4;
  moons += smoothstep(0.008, 0.0, abs(rd - 0.09)) * 0.3 * (0.7 + 0.3 * sin(time * 1.2 + 1.0));

  return moons;
}

// --- Mountain/temple silhouette ---

float mountain(vec2 p, float time) {
  // Position at top center
  vec2 mp = p - vec2(0.0, 0.22);
  mp.x = abs(mp.x); // symmetric

  // Mountain shape
  float slope = mp.y - (0.18 - mp.x * 0.65 - mp.x * mp.x * 0.8);
  float mtn = smoothstep(0.02, -0.02, slope);

  // Temple steps
  float steps = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float sy = 0.12 - fi * 0.025;
    float sx = 0.06 + fi * 0.02;
    vec2 sp = mp - vec2(0.0, sy);
    float step = smoothstep(0.005, 0.0, abs(sp.y)) * smoothstep(sx, sx - 0.01, abs(sp.x));
    steps += step * 0.2;
  }

  return mtn * 0.2 + steps;
}

// --- Star field background ---

float stars(vec2 p, float time) {
  float s = 0.0;
  for (int i = 0; i < 3; i++) {
    vec2 q = p * (12.0 + float(i) * 8.0);
    vec2 ip = floor(q);
    vec2 fp = fract(q) - 0.5;
    float h = hash21(ip + float(i) * 100.0);
    float brightness = smoothstep(0.8, 1.0, h);
    float twinkle = 0.7 + 0.3 * sin(time * (1.0 + h * 3.0) + h * TAU);
    float d = length(fp);
    s += brightness * twinkle * exp(-d * d * 80.0);
  }
  return s;
}

// === MAIN ===

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  uv.x *= aspect;

  float zoom = max(0.3, u_zoom);
  uv = rot(u_rotation) * (uv / zoom);

  float bass = sat(u_bass);
  float mid = sat(u_mid);
  float high = sat(u_high);
  float energy = sat(u_energy);
  float kick = sat(u_kick);

  float t = u_time;
  float pulse = max(kick, smoothstep(0.5, 1.0, bass) * energy);
  float cycle = u_colorCycle + t * u_colorSpeed * 0.03;

  // Bilateral symmetry on X
  vec2 sym = vec2(abs(uv.x), uv.y);

  // === Layer 1: Star field background ===
  float starField = stars(uv, t);
  vec3 col = vec3(0.01, 0.005, 0.02); // near-black base
  col += starField * vec3(0.4, 0.5, 0.8) * 0.15;

  // === Layer 2: Cosmic nebula background ===
  int nebulaOct = Q_HIGH() ? 5 : 3;
  float nebula = fbm(uv * 1.5 + vec2(t * 0.02, -t * 0.015), nebulaOct);
  vec3 nebulaCol = iqPalette(
    nebula * 0.8 + cycle,
    vec3(0.02, 0.01, 0.05),
    vec3(0.08, 0.12, 0.18),
    vec3(1.0, 0.7, 0.5),
    vec3(0.25, 0.6, 0.75)
  );
  col += nebulaCol * 0.25 * (0.8 + 0.2 * energy);

  // === Layer 3: Mountain/temple ===
  float mtn = mountain(uv, t);
  vec3 mtnCol = iqPalette(
    mtn + cycle * 0.5,
    u_paletteA * 0.5,
    vec3(0.15, 0.1, 0.25),
    vec3(0.8, 0.6, 1.0),
    vec3(0.5, 0.3, 0.7)
  );
  col += mtn * mtnCol * u_cosmicGlow * 0.6;

  // === Layer 4: Twin cosmic moons ===
  float moons = cosmicMoons(uv, t);
  vec3 moonCol = mix(
    vec3(0.15, 0.25, 0.9),
    vec3(0.5, 0.3, 0.9),
    0.5 + 0.5 * sin(t * 0.5)
  );
  col += moons * moonCol * (0.8 + 0.4 * pulse) * u_cosmicGlow;

  // === Layer 5: Organic tendrils ===
  float tend = tendrils(uv, t * u_tendrilSpeed, u_tendrilDensity);
  float tendMask = smoothstep(0.3, 0.7, tend);
  vec3 tendrilCol = iqPalette(
    tend * 2.0 + cycle + uv.y * 0.3,
    u_paletteA,
    u_paletteB,
    u_paletteC,
    u_paletteD
  );
  // UV neon glow effect
  tendrilCol = mix(tendrilCol, tendrilCol * vec3(0.3, 1.2, 0.4), u_uvIntensity * 0.5);
  col += tendMask * tendrilCol * (0.35 + 0.25 * energy + 0.15 * bass) * u_glowIntensity;

  // === Layer 6: Sacred geometry mandala ===
  float mand = mandala(uv, u_symmetryFolds, u_mandalaScale, t);
  vec3 mandCol = iqPalette(
    mand * 1.5 + cycle * 2.0,
    vec3(0.05, 0.15, 0.02),
    vec3(0.2, 0.4, 0.1),
    vec3(0.8, 1.0, 0.6),
    vec3(0.1, 0.3, 0.5)
  );
  // Neon green/gold for sacred geometry
  mandCol *= vec3(0.6, 1.0, 0.3) + vec3(0.5, 0.3, 0.0) * mand;
  float mandPulse = 1.0 + pulse * 0.4 + mid * 0.3;
  col += mand * mandCol * 0.5 * mandPulse * u_glowIntensity;

  // === Layer 7: Crystal shards ===
  if (u_crystalSize > 0.01) {
    // Crystals appear on sides
    float crystalMask = smoothstep(0.15, 0.4, abs(uv.x)) * smoothstep(-0.3, 0.1, uv.y) * smoothstep(0.3, 0.0, uv.y);
    float cryst = crystals(uv, u_crystalSize, t);
    vec3 crystCol = iqPalette(
      cryst + cycle * 0.7,
      vec3(0.05, 0.2, 0.15),
      vec3(0.2, 0.3, 0.25),
      vec3(0.6, 0.9, 0.7),
      vec3(0.3, 0.5, 0.8)
    );
    crystCol += vec3(0.1, 0.3, 0.2) * high; // treble shimmer on crystals
    col += cryst * crystCol * crystalMask * 0.4 * u_glowIntensity;
  }

  // === Layer 8: Center meditating figure ===
  float fig = figure(uv, u_figureIntensity);
  // Golden aura for figure
  vec3 figCol = mix(
    vec3(0.8, 0.6, 0.15),  // gold
    vec3(1.0, 0.85, 0.3),  // bright gold
    fig
  );
  // Purple/blue inner aura
  vec3 figAura = vec3(0.3, 0.15, 0.7) * exp(-max(figureSDF((uv - vec2(0.0, -0.28)) * 3.2), 0.0) * 8.0) * u_figureIntensity;
  col += fig * figCol * (1.0 + pulse * 0.5);
  col += figAura * 0.5;

  // === Layer 9: Central energy orb (between figure and mountain) ===
  vec2 orbP = uv - vec2(0.0, 0.02);
  float orbDist = length(orbP);
  float orb = exp(-orbDist * orbDist * 80.0);
  float orbRings = smoothstep(0.005, 0.0, abs(orbDist - 0.06 - 0.01 * sin(t * 2.0)));
  orbRings += smoothstep(0.004, 0.0, abs(orbDist - 0.09 - 0.008 * sin(t * 1.5 + 1.0)));
  vec3 orbCol = mix(
    vec3(0.5, 0.15, 0.8),  // purple
    vec3(0.3, 0.8, 1.0),   // cyan
    0.5 + 0.5 * sin(t * 0.8)
  );
  col += (orb * 0.6 + orbRings * 0.4) * orbCol * (1.0 + bass * 0.6) * u_glowIntensity;

  // === UV blacklight effect: boost neon channels ===
  float uvBoost = u_uvIntensity;
  // Emphasize blues, greens, purples — suppress warm midtones
  vec3 uvTint = vec3(0.15, 0.6, 0.25) * uvBoost;
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  vec3 neonCol = col * (1.0 + uvTint * (1.0 - luma * 0.5));

  // Phosphorescent glow on bright areas
  float glow = smoothstep(0.15, 0.6, luma);
  neonCol += glow * vec3(0.05, 0.15, 0.08) * uvBoost;

  col = neonCol;

  // === Audio-reactive global effects ===
  // Bass: overall breathing/pulse
  col *= 1.0 + bass * 0.15;
  // Kick: flash
  col += kick * 0.06 * vec3(0.4, 0.2, 0.8);
  // High: sparkle overlay
  if (Q_MED()) {
    float sparkle = noise(uv * 40.0 + t * 3.0);
    sparkle = smoothstep(0.85, 1.0, sparkle);
    col += sparkle * high * 0.2 * vec3(0.5, 0.8, 1.0);
  }

  // === Post-processing ===
  // Saturation
  float gray = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(gray), col, mix(0.8, 1.8, sat(u_saturation)));

  // Contrast
  col = (col - 0.5) * mix(0.9, 1.4, sat(u_contrast)) + 0.5;

  // Vignette (dark edges for blacklight room feel)
  float vig = 1.0 - smoothstep(0.3, 1.1, length(uv * vec2(0.8, 0.9)));
  col *= mix(0.15, 1.0, vig);

  // Tone mapping
  col = max(col, vec3(0.0));
  col = col / (col + 0.8); // Reinhard
  col = pow(col, vec3(1.0 / 2.2)); // gamma

  // Dither
  float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  col += dither * (1.0 / 255.0);

  col = clamp(col, 0.0, 1.0);
  gl_FragColor = vec4(col, max(0.4, sat(u_opacity)));
}
`;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function numOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function smoothAR(prev: number, next: number, dt: number, attack = 18, release = 7): number {
  const safePrev = Number.isFinite(prev) ? prev : 0;
  const safeNext = Number.isFinite(next) ? next : 0;
  const speed = safeNext > safePrev ? attack : release;
  const alpha = 1 - Math.exp(-speed * Math.max(dt, 1 / 240));
  return safePrev + (safeNext - safePrev) * alpha;
}

function vec3FromHex(hex: string) {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
}

const PsyTempleRender: React.FC<{ uniforms: UniformValues; state: any }> = ({ uniforms, state }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null!);
  const { size, viewport, gl } = useThree();

  useEffect(() => {
    const prev = gl.getPixelRatio();
    gl.setPixelRatio(Math.min(1, prev));
    return () => { gl.setPixelRatio(prev); };
  }, [gl]);

  useFrame(({ clock }, delta) => {
    const m = matRef.current;
    if (!m) return;

    const dpr = gl.getPixelRatio();
    m.uniforms.u_resolution.value.set(size.width * dpr, size.height * dpr);
    m.uniforms.u_time.value = clock.getElapsedTime();

    m.uniforms.u_zoom.value = numOr(uniforms.u_zoom, 1.0);
    m.uniforms.u_rotation.value = numOr(uniforms.u_rotation, 0);
    m.uniforms.u_symmetryFolds.value = numOr(uniforms.u_symmetryFolds, 8);
    m.uniforms.u_mandalaScale.value = numOr(uniforms.u_mandalaScale, 4.0);
    m.uniforms.u_tendrilSpeed.value = numOr(uniforms.u_tendrilSpeed, 0.7);
    m.uniforms.u_tendrilDensity.value = numOr(uniforms.u_tendrilDensity, 2.5);
    m.uniforms.u_crystalSize.value = numOr(uniforms.u_crystalSize, 0.12);
    m.uniforms.u_figureIntensity.value = numOr(uniforms.u_figureIntensity, 0.85);
    m.uniforms.u_cosmicGlow.value = numOr(uniforms.u_cosmicGlow, 1.0);
    m.uniforms.u_uvIntensity.value = numOr(uniforms.u_uvIntensity, 1.2);

    m.uniforms.u_glowIntensity.value = numOr(uniforms.u_glowIntensity, 1.4);
    m.uniforms.u_saturation.value = numOr(uniforms.u_saturation, 0.85);
    m.uniforms.u_contrast.value = numOr(uniforms.u_contrast, 0.55);
    m.uniforms.u_opacity.value = numOr(uniforms.u_opacity, 1);

    m.uniforms.u_colorCycle.value = numOr(uniforms.u_colorCycle, 0);
    m.uniforms.u_colorSpeed.value = numOr(uniforms.u_colorSpeed, 0.4);
    m.uniforms.u_paletteA.value.copy(vec3FromHex(typeof uniforms.u_paletteA === "string" ? uniforms.u_paletteA : "#050a1a"));
    m.uniforms.u_paletteB.value.copy(vec3FromHex(typeof uniforms.u_paletteB === "string" ? uniforms.u_paletteB : "#1a0a4a"));
    m.uniforms.u_paletteC.value.copy(vec3FromHex(typeof uniforms.u_paletteC === "string" ? uniforms.u_paletteC : "#0aee55"));
    m.uniforms.u_paletteD.value.copy(vec3FromHex(typeof uniforms.u_paletteD === "string" ? uniforms.u_paletteD : "#6622cc"));

    const reactive = state.reactive ?? { bass: 0, mid: 0, high: 0, energy: 0, kick: 0 };
    const gain = numOr(uniforms.u_audioGain, 1);
    const reactivityScale = 0.08;

    const bassIn = numOr(state._rawBass, 0);
    const midIn = numOr(state._rawMid, 0);
    const highIn = numOr(state._rawHigh, 0);
    const energyIn = numOr(state._rawEnergy, 0);
    const kickIn = numOr(state._rawKick, 0);

    const bassImpact = numOr(uniforms.u_bassImpact, 1);
    const midMorph = numOr(uniforms.u_midMorph, 0.8);
    const trebleShimmer = numOr(uniforms.u_trebleShimmer, 0.9);
    const beatPunch = numOr(uniforms.u_beatPunch, 1.1);

    const targetBass = clamp(bassIn * gain * (0.45 + bassImpact * 0.55) * reactivityScale, 0, 1);
    const targetMid = clamp(midIn * gain * (0.4 + midMorph * 0.5) * reactivityScale, 0, 1);
    const targetHigh = clamp(highIn * gain * (0.35 + trebleShimmer * 0.65) * reactivityScale, 0, 1);
    const targetEnergy = clamp(energyIn * gain * reactivityScale, 0, 1);
    const targetKick = clamp(kickIn * gain * (0.35 + beatPunch * 0.7) * reactivityScale, 0, 1);

    reactive.bass = smoothAR(reactive.bass, targetBass, delta, 24, 8);
    reactive.mid = smoothAR(reactive.mid, targetMid, delta, 18, 8);
    reactive.high = smoothAR(reactive.high, targetHigh, delta, 20, 9);
    reactive.energy = smoothAR(reactive.energy, targetEnergy, delta, 18, 8);
    reactive.kick = smoothAR(reactive.kick, targetKick, delta, 30, 11);
    state.reactive = reactive;

    m.uniforms.u_bass.value = smoothAR(m.uniforms.u_bass.value, reactive.bass, delta, 20, 8);
    m.uniforms.u_mid.value = smoothAR(m.uniforms.u_mid.value, reactive.mid, delta, 16, 8);
    m.uniforms.u_high.value = smoothAR(m.uniforms.u_high.value, reactive.high, delta, 18, 9);
    m.uniforms.u_energy.value = smoothAR(m.uniforms.u_energy.value, reactive.energy, delta, 16, 8);
    m.uniforms.u_kick.value = smoothAR(m.uniforms.u_kick.value, reactive.kick, delta, 28, 10);

    m.uniforms.u_qualityMode.value = Math.round(numOr(uniforms.u_qualityMode, 1));
  });

  const initialUniforms = useMemo(
    () => ({
      u_resolution: { value: new THREE.Vector2(1, 1) },
      u_time: { value: 0 },
      u_zoom: { value: 1.0 },
      u_rotation: { value: 0 },
      u_symmetryFolds: { value: 8 },
      u_mandalaScale: { value: 4.0 },
      u_tendrilSpeed: { value: 0.7 },
      u_tendrilDensity: { value: 2.5 },
      u_crystalSize: { value: 0.12 },
      u_figureIntensity: { value: 0.85 },
      u_cosmicGlow: { value: 1.0 },
      u_uvIntensity: { value: 1.2 },
      u_glowIntensity: { value: 1.4 },
      u_saturation: { value: 0.85 },
      u_contrast: { value: 0.55 },
      u_opacity: { value: 1 },
      u_colorCycle: { value: 0 },
      u_colorSpeed: { value: 0.4 },
      u_paletteA: { value: new THREE.Vector3(0.02, 0.04, 0.10) },
      u_paletteB: { value: new THREE.Vector3(0.10, 0.04, 0.29) },
      u_paletteC: { value: new THREE.Vector3(0.04, 0.93, 0.33) },
      u_paletteD: { value: new THREE.Vector3(0.40, 0.13, 0.80) },
      u_bass: { value: 0 },
      u_mid: { value: 0 },
      u_high: { value: 0 },
      u_energy: { value: 0 },
      u_kick: { value: 0 },
      u_qualityMode: { value: 1 },
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

export const PsyTemplePreset: FractalPreset = {
  id: "psy-temple",
  name: "Psy Temple",
  category: "Fractals/Geometry",
  kind: "shader2d",

  uniformSpecs: [
    { key: "u_zoom", label: "Zoom", type: "float", group: "Fractal", min: 0.3, max: 3.0, step: 0.01, default: 1.0, macro: true },
    { key: "u_opacity", label: "Opacity", type: "float", group: "Fractal", min: 0, max: 1, step: 0.01, default: 1 },
    { key: "u_rotation", label: "Rotation", type: "float", group: "Fractal", min: -3.14, max: 3.14, step: 0.001, default: 0 },
    { key: "u_symmetryFolds", label: "Mandala Folds", type: "float", group: "Fractal", min: 3, max: 16, step: 1, default: 8, macro: true },
    { key: "u_mandalaScale", label: "Mandala Scale", type: "float", group: "Fractal", min: 1.0, max: 8.0, step: 0.1, default: 4.0, macro: true },
    { key: "u_tendrilSpeed", label: "Tendril Speed", type: "float", group: "Fractal", min: 0.1, max: 2.0, step: 0.01, default: 0.7, macro: true },
    { key: "u_tendrilDensity", label: "Tendril Density", type: "float", group: "Fractal", min: 1.0, max: 5.0, step: 0.1, default: 2.5, macro: true },
    { key: "u_crystalSize", label: "Crystal Size", type: "float", group: "Fractal", min: 0, max: 0.3, step: 0.005, default: 0.12, macro: true },
    { key: "u_figureIntensity", label: "Figure Intensity", type: "float", group: "Fractal", min: 0, max: 1.5, step: 0.01, default: 0.85, macro: true },
    { key: "u_cosmicGlow", label: "Cosmic Elements", type: "float", group: "Fractal", min: 0, max: 2, step: 0.01, default: 1.0, macro: true },
    { key: "u_uvIntensity", label: "UV Blacklight", type: "float", group: "Fractal", min: 0, max: 2.5, step: 0.01, default: 1.2, macro: true },

    { key: "u_paletteA", label: "Deep Black", type: "color", group: "Color", default: "#050a1a" },
    { key: "u_paletteB", label: "Deep Purple", type: "color", group: "Color", default: "#1a0a4a" },
    { key: "u_paletteC", label: "Neon Green", type: "color", group: "Color", default: "#0aee55" },
    { key: "u_paletteD", label: "UV Purple", type: "color", group: "Color", default: "#6622cc" },
    { key: "u_colorCycle", label: "Color Cycle", type: "float", group: "Color", min: 0, max: 1, step: 0.001, default: 0, macro: true },
    { key: "u_colorSpeed", label: "Auto Cycle Speed", type: "float", group: "Color", min: 0, max: 2, step: 0.01, default: 0.4 },
    { key: "u_saturation", label: "Saturation", type: "float", group: "Color", min: 0, max: 1.5, step: 0.01, default: 0.85 },

    { key: "u_glowIntensity", label: "Glow", type: "float", group: "Effects", min: 0, max: 2.5, step: 0.01, default: 1.4, macro: true },
    { key: "u_contrast", label: "Contrast", type: "float", group: "Effects", min: 0, max: 1, step: 0.01, default: 0.55 },

    { key: "u_audioGain", label: "Audio Gain", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 1.0, macro: true },
    { key: "u_bassImpact", label: "Bass Impact", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 1.0, macro: true },
    { key: "u_midMorph", label: "Mid Morph", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.8, macro: true },
    { key: "u_trebleShimmer", label: "Treble Shimmer", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.9, macro: true },
    { key: "u_beatPunch", label: "Beat Punch", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 1.1 },

    { key: "u_qualityMode", label: "Render Profile", type: "int", group: "Quality", min: 0, max: 2, step: 1, default: 1 },
  ],

  init(_ctx: PresetContext) {},
  update({ ctx, audio, uniforms, state }) {
    const gain = clamp(typeof uniforms.u_audioGain === "number" ? uniforms.u_audioGain : 1, 0, 2);
    const bassImpact = clamp(typeof uniforms.u_bassImpact === "number" ? uniforms.u_bassImpact : 1, 0, 2);
    const midMorph = clamp(typeof uniforms.u_midMorph === "number" ? uniforms.u_midMorph : 1, 0, 2);
    const trebleShimmer = clamp(typeof uniforms.u_trebleShimmer === "number" ? uniforms.u_trebleShimmer : 1, 0, 2);
    const beatPunch = clamp(typeof uniforms.u_beatPunch === "number" ? uniforms.u_beatPunch : 1, 0, 2);

    const bassIn = Number.isFinite(audio.bass) ? audio.bass : 0;
    const midIn = Number.isFinite(audio.mid) ? audio.mid : 0;
    const trebleIn = Number.isFinite(audio.treble) ? audio.treble : 0;
    const rmsIn = Number.isFinite(audio.rms) ? audio.rms : 0;
    const beatIn = Number.isFinite(audio.beat) ? audio.beat : 0;

    state._rawBass = bassIn * gain * bassImpact;
    state._rawMid = midIn * gain * midMorph;
    state._rawHigh = trebleIn * gain * trebleShimmer;
    state._rawEnergy = rmsIn * gain;
    state._rawKick = beatIn * gain * beatPunch;
  },
  dispose() {},

  Render: PsyTempleRender,
};
