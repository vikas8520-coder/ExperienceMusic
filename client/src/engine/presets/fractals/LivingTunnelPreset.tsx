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

uniform vec2  u_center;
uniform float u_zoom;
uniform float u_zoomExp;
uniform bool  u_infiniteZoom;
uniform float u_rotation;
uniform float u_zoomPulse;

uniform float u_tunnelRadius;
uniform float u_segmentPeriod;
uniform float u_flowWarp;
uniform float u_detailScale;
uniform float u_crystalBoost;

uniform float u_glowIntensity;
uniform float u_fogDensity;
uniform float u_rimStrength;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_opacity;

uniform float u_colorCycle;
uniform float u_colorSpeed;
uniform vec3  u_paletteA;
uniform vec3  u_paletteB;
uniform vec3  u_paletteC;
uniform vec3  u_paletteD;

uniform float u_bass;
uniform float u_mid;
uniform float u_high;
uniform float u_energy;
uniform float u_kick;

uniform int   u_qualityMode;
uniform int   u_debugMode;

#define TAU 6.28318530718

float sat(float x) { return clamp(x, 0.0, 1.0); }
bool Q_MED()  { return u_qualityMode >= 1; }
bool Q_HIGH() { return u_qualityMode >= 2; }

mat2 rot(float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, -s, s, c);
}

vec3 palette4(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  t = fract(t);
  if (t < 0.3333) return mix(a, b, t / 0.3333);
  if (t < 0.6666) return mix(b, c, (t - 0.3333) / 0.3333);
  return mix(c, d, (t - 0.6666) / 0.3334);
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float n000 = hash21(i.xy + vec2(0.0, 0.0) + i.z);
  float n100 = hash21(i.xy + vec2(1.0, 0.0) + i.z);
  float n010 = hash21(i.xy + vec2(0.0, 1.0) + i.z);
  float n110 = hash21(i.xy + vec2(1.0, 1.0) + i.z);

  float n001 = hash21(i.xy + vec2(0.0, 0.0) + (i.z + 1.0));
  float n101 = hash21(i.xy + vec2(1.0, 0.0) + (i.z + 1.0));
  float n011 = hash21(i.xy + vec2(0.0, 1.0) + (i.z + 1.0));
  float n111 = hash21(i.xy + vec2(1.0, 1.0) + (i.z + 1.0));

  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);

  float nxy0 = mix(nx00, nx10, f.y);
  float nxy1 = mix(nx01, nx11, f.y);
  return mix(nxy0, nxy1, f.z);
}

float fbmN(vec3 p) {
  float v = 0.0;
  float a = 0.55;
  for (int i = 0; i < 5; i++) {
    if (!Q_HIGH() && i >= 4) break;
    if (!Q_MED() && i >= 2) break;
    v += a * noise(p);
    p = p * 1.35 + vec3(0.11, 0.07, 0.13);
    a *= 0.5;
  }
  return v;
}

float tunnelMap(
  vec3 p,
  float t,
  float baseRadius,
  float segmentNorm,
  float flowNorm,
  float detailNorm,
  float crystal
) {
  float period = max(0.25, u_segmentPeriod);
  vec3 q = p;
  q.z = mod(q.z + 0.5 * period, period) - 0.5 * period;

  if (Q_MED()) {
    float flowT = u_time * (0.35 + 0.55 * sat(u_energy));
    float amt = 0.18 * sat(u_flowWarp) * (0.5 + 0.5 * sat(u_detailScale));
    float n1 = fbmN(q * 0.8 + vec3(0.0, 0.0, flowT));
    float n2 = fbmN(q * 0.8 + vec3(17.3, 11.1, flowT * 0.9));
    float n3 = fbmN(q * 0.8 + vec3(-9.2, 7.7, flowT * 1.1));
    vec3 v = vec3(n1, n2, n3) - 0.5;
    float a2 = (n1 - 0.5) * 1.8;
    q.xy = rot(a2) * q.xy;
    q += v * amt;
    q = clamp(q, vec3(-8.0), vec3(8.0));
  }

  float swirl = q.z * (0.9 + detailNorm * 0.8) + t * (0.7 + flowNorm * 0.9);
  q.xy = rot(swirl * 0.35) * q.xy;

  float flowAmp = 0.05 + flowNorm * 0.24;
  q.xy += vec2(
    sin(q.z * 2.1 + t * 1.1 + q.y * (2.1 + detailNorm * 1.9)),
    cos(q.z * 1.8 - t * 1.0 + q.x * (2.0 + detailNorm * 2.0))
  ) * flowAmp;

  // Crystal fold is applied after flow warp so drops feel faceted but keep tunnel motion.
  if (crystal > 0.001) {
    vec3 folded = sign(q) * pow(max(abs(q), vec3(1e-4)), vec3(0.85));
    q = mix(q, folded, crystal);
    q.xy *= 1.0 + crystal * 0.35;
  }

  float n = fbmN(
    vec3(
      q.xy * (2.0 + detailNorm * 2.5) +
      vec2(p.z * 0.35 - t * 0.18, p.z * 0.27 + t * 0.22),
      p.z * 0.55 + t * 0.16
    )
  );

  float breath = 0.10 * sin(u_time * 1.1 + p.z * 0.7);
  float r = baseRadius + breath;
  if (Q_HIGH()) {
    float ribN = fbmN(q * 2.0 + vec3(0.0, 0.0, u_time * 0.6));
    r += (ribN - 0.5) * (0.16 * sat(u_detailScale));
  }

  float radius = r
    + (n - 0.5) * (0.08 + detailNorm * 0.14)
    + 0.05 * sin(p.z * 1.4 - t * 1.6);

  float d = abs(length(q.xy) - radius) - mix(0.14, 0.055, detailNorm);
  if (Q_HIGH()) {
    float veins = fbmN(q * 3.2 + vec3(2.0, -1.0, u_time * 0.9));
    d += (veins - 0.5) * (0.08 * sat(u_detailScale));
  }

  float ribWave = abs(
    sin(
      q.z * (8.0 + detailNorm * 18.0) +
      atan(q.y, q.x) * (3.0 + detailNorm * 4.0) -
      t * 1.8
    )
  );
  d -= ribWave * (0.02 + 0.03 * crystal);

  vec3 qc = abs(q);
  float facet = max(qc.x * 0.86 + qc.y * 0.68, qc.z * 0.58) - (radius * (0.9 + 0.16 * crystal));
  return mix(d, min(d, facet), crystal * 0.45);
}

vec3 calcNormal(
  vec3 p,
  float t,
  float baseRadius,
  float segmentNorm,
  float flowNorm,
  float detailNorm,
  float crystal
) {
  float e = mix(0.0025, 0.0009, sat(float(u_qualityMode) / 2.0));
  vec2 h = vec2(e, 0.0);
  float dx = tunnelMap(p + vec3(h.x, h.y, h.y), t, baseRadius, segmentNorm, flowNorm, detailNorm, crystal)
           - tunnelMap(p - vec3(h.x, h.y, h.y), t, baseRadius, segmentNorm, flowNorm, detailNorm, crystal);
  float dy = tunnelMap(p + vec3(h.y, h.x, h.y), t, baseRadius, segmentNorm, flowNorm, detailNorm, crystal)
           - tunnelMap(p - vec3(h.y, h.x, h.y), t, baseRadius, segmentNorm, flowNorm, detailNorm, crystal);
  float dz = tunnelMap(p + vec3(h.y, h.y, h.x), t, baseRadius, segmentNorm, flowNorm, detailNorm, crystal)
           - tunnelMap(p - vec3(h.y, h.y, h.x), t, baseRadius, segmentNorm, flowNorm, detailNorm, crystal);
  return normalize(vec3(dx, dy, dz));
}

float softShadow(
  vec3 ro,
  vec3 rd,
  float t,
  float baseRadius,
  float segmentNorm,
  float flowNorm,
  float detailNorm,
  float crystal
) {
  float res = 1.0;
  float travel = 0.03;
  int maxShadowSteps = Q_HIGH() ? 24 : 14;
  for (int i = 0; i < 24; i++) {
    if (i >= maxShadowSteps) break;
    float h = tunnelMap(ro + rd * travel, t, baseRadius, segmentNorm, flowNorm, detailNorm, crystal);
    res = min(res, 10.0 * h / max(travel, 0.001));
    travel += clamp(h, 0.02, 0.20);
    if (res < 0.05 || travel > 6.0) break;
  }
  return clamp(res, 0.0, 1.0);
}

float calcAO(
  vec3 p,
  vec3 n,
  float t,
  float baseRadius,
  float segmentNorm,
  float flowNorm,
  float detailNorm,
  float crystal
) {
  float ao = 1.0;
  float sca = 1.0;
  int samples = Q_HIGH() ? 5 : 3;
  for (int j = 1; j <= 5; j++) {
    if (j > samples) break;
    float h = 0.02 * float(j);
    float d = tunnelMap(p + n * h, t, baseRadius, segmentNorm, flowNorm, detailNorm, crystal);
    ao -= (h - d) * sca;
    sca *= 0.7;
  }
  return clamp(ao, 0.0, 1.0);
}

float fresnelSchlick(float ndv, float f0) {
  float x = clamp(1.0 - ndv, 0.0, 1.0);
  float x2 = x * x;
  float x5 = x2 * x2 * x;
  return f0 + (1.0 - f0) * x5;
}

vec3 acesToneMap(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

float triplanarLayer(vec3 p, vec3 n, float scale, float seed) {
  vec3 an = max(abs(n), vec3(1e-3));
  an /= (an.x + an.y + an.z);
  float nx = fbmN(vec3(p.y * scale + seed, p.z * scale - seed, p.x * 0.35 + seed));
  float ny = fbmN(vec3(p.x * scale - seed, p.z * scale + seed, p.y * 0.37 - seed));
  float nz = fbmN(vec3(p.x * scale + seed, p.y * scale - seed, p.z * 0.39 + seed));
  return nx * an.x + ny * an.y + nz * an.z;
}

vec3 fallbackColor(vec2 p, float t, float pulse, float crystal, float high, float energy) {
  float r = length(p) + 1e-4;
  float a = atan(p.y, p.x);
  float core = 1.0 / (r + 0.22 + (1.0 - sat(u_tunnelRadius)) * 0.24);
  float wave = sin(core * (5.0 + sat(u_detailScale) * 11.0) - t * 1.8 + a * 2.3);
  float rings = 0.5 + 0.5 * wave;
  float phase = fract(
    u_colorCycle +
    t * (0.06 + sat(u_colorSpeed) * 0.08) +
    a / TAU +
    r * 0.46 +
    wave * 0.08
  );
  vec3 o = palette4(phase, u_paletteA, u_paletteB, u_paletteC, u_paletteD);
  vec3 c = palette4(phase + 0.2, u_paletteD, u_paletteC, u_paletteB, u_paletteA);
  vec3 base = mix(o, c, crystal * 0.78);
  vec3 col = base * (0.34 + rings * 1.1);
  col += rings * (0.08 + 0.16 * pulse + 0.1 * high) * mix(vec3(0.25, 0.55, 1.0), vec3(1.0, 0.5, 1.0), crystal);
  col += vec3(0.04, 0.03, 0.06) * (0.7 + energy * 0.45);
  return col;
}

void main() {
  if (u_debugMode == 1) {
    gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);
    return;
  }
  if (u_debugMode == 2) {
    gl_FragColor = vec4(sat(u_bass), sat(u_mid), sat(u_high), 1.0);
    return;
  }
  if (u_debugMode == 3) {
    gl_FragColor = vec4(vUv, 0.0, 1.0);
    return;
  }

  vec2 uv = vUv * 2.0 - 1.0;
  uv.x *= u_resolution.x / max(u_resolution.y, 1.0);

  float zoom = u_infiniteZoom ? exp2(clamp(u_zoomExp, -20.0, 20.0)) : max(0.2, u_zoom);
  vec2 p = rot(u_rotation) * (uv / zoom + u_center * 0.18);

  float bass = sat(u_bass);
  float mid = sat(u_mid);
  float high = sat(u_high);
  float energy = sat(u_energy);
  float kick = sat(u_kick);

  float pulse = max(kick, smoothstep(0.55, 1.0, bass) * energy);
  float crystal = clamp((sat(u_crystalBoost) * (0.55 * energy + 0.85 * pulse)) * (0.6 + 0.6 * bass), 0.0, 1.0);
  float organic = 1.0 - 0.7 * crystal;
  float t = u_time * (0.22 + 0.94 * energy + 0.2 * mid + 0.12 * organic);

  float baseRadius = mix(0.24, 0.9, sat(u_tunnelRadius)) * (0.9 + 0.1 * organic);
  float segmentNorm = sat(u_segmentPeriod);
  float flowNorm = sat(u_flowWarp);
  float detailNorm = sat(u_detailScale);

  vec3 ro = vec3(0.0, 0.0, -3.0);
  vec3 rd = normalize(vec3(p, 1.7));
  ro.z += t * (1.2 + 2.4 * energy);
  ro.xy += vec2(sin(t * 0.17), cos(t * 0.13)) * 0.12 * (0.35 + 0.65 * flowNorm);
  rd.xy = rot((0.25 + 0.35 * mid) * (0.3 + 0.2 * sin(t * 0.4))) * rd.xy;
  rd.xy = rot(0.12 * sin(t * 0.37) + 0.24 * mid) * rd.xy;
  rd.xy *= 1.0 + 0.08 * pulse;

  int maxSteps = Q_HIGH() ? 92 : (Q_MED() ? 64 : 48);

  float maxDist = 22.0;
  float dist = 0.0;
  float glowAcc = 0.0;
  vec3 layerGlow = vec3(0.0);
  bool hit = false;
  float hitField = 1.0;
  vec3 hitPos = vec3(0.0);
  vec3 col = fallbackColor(p, t, pulse, crystal, high, energy);

  for (int i = 0; i < 96; i++) {
    if (i >= maxSteps) break;
    vec3 pos = ro + rd * dist;
    float d = tunnelMap(pos, t, baseRadius, segmentNorm, flowNorm, detailNorm, crystal);
    if (Q_MED()) {
      bool sampleFog = Q_HIGH() || ((i % 2) == 0);
      if (sampleFog) {
        float fog = exp(-dist * (0.12 + 0.30 * sat(u_fogDensity)));
        fog = clamp(fog, 0.0, 1.0);
        float life = fbmN(pos * 0.35 + vec3(0.0, 0.0, u_time * 0.4));
        glowAcc += fog * (0.01 + 0.03 * high) * (0.35 + 0.65 * life) * sat(u_glowIntensity);
        float filament = smoothstep(0.7, 0.96, fbmN(pos * (1.6 + detailNorm * 2.6) + vec3(0.0, 0.0, t * 0.22)));
        vec3 filamentTint = mix(
          u_paletteC * 0.9 + vec3(0.02, 0.05, 0.09),
          u_paletteD * 0.85 + vec3(0.06, 0.02, 0.08),
          0.5 + 0.5 * sin(pos.z * 0.8 + t * 0.35)
        );
        layerGlow += filamentTint * filament * fog * (0.003 + 0.012 * sat(u_glowIntensity));
      }
    } else {
      float fog = exp(-dist * (0.14 + 0.26 * sat(u_fogDensity)));
      float shimmer = 0.5 + 0.5 * sin(pos.z * 5.5 + t * 0.45 + length(pos.xy) * 2.2);
      vec3 lowTint = mix(u_paletteC, u_paletteD, shimmer);
      layerGlow += lowTint * fog * (0.0015 + 0.006 * sat(u_glowIntensity));
    }

    if (d < 0.0018) {
      hit = true;
      hitField = d;
      hitPos = pos;
      break;
    }

    dist += clamp(d * 0.82, 0.002, 0.45);
    if (dist > maxDist) break;
  }

  if (hit) {
    vec3 n = calcNormal(hitPos, t, baseRadius, segmentNorm, flowNorm, detailNorm, crystal);
    vec3 viewDir = normalize(-rd);
    vec3 lightDir = normalize(vec3(-0.45, 0.62, -0.52));
    vec3 fillDir = normalize(vec3(0.55, -0.35, -0.60));
    float diffKey = max(0.0, dot(n, lightDir));
    float sh = Q_MED() ? softShadow(hitPos + n * 0.02, lightDir, t, baseRadius, segmentNorm, flowNorm, detailNorm, crystal) : 1.0;
    diffKey *= sh;
    float rimPow = mix(3.0, 1.1, sat(u_rimStrength));
    float ndv = max(0.0, dot(n, viewDir));
    float rim = pow(1.0 - ndv, rimPow);
    float ao = Q_MED() ? calcAO(hitPos, n, t, baseRadius, segmentNorm, flowNorm, detailNorm, crystal) : 1.0;
    float diffFill = max(0.0, dot(n, fillDir)) * (0.22 + 0.28 * ao);
    float backScatter = pow(max(0.0, dot(-n, lightDir)), 1.6) * (0.06 + 0.22 * organic);

    float phase = fract(
      u_colorCycle +
      t * (0.06 + sat(u_colorSpeed) * 0.08) +
      hitPos.z * 0.09 +
      atan(hitPos.y, hitPos.x) / TAU
    );
    vec3 palOrganic = palette4(phase, u_paletteA, u_paletteB, u_paletteC, u_paletteD);
    vec3 palCrystal = palette4(phase + 0.2, u_paletteD, u_paletteC, u_paletteB, u_paletteA);
    vec3 baseCol = mix(palOrganic, palCrystal, crystal * 0.85);

    float texMacro = 0.5 + 0.5 * noise(hitPos * 1.2 + vec3(0.0, 0.0, t * 0.12));
    float texFine = 0.5 + 0.5 * sin(hitPos.z * (9.0 + detailNorm * 8.0) + atan(hitPos.y, hitPos.x) * 4.0 - t * 0.4);
    float striation = 0.5 + 0.5 * sin(hitPos.z * (12.0 + detailNorm * 18.0) + texMacro * TAU + t * 0.26);
    if (Q_MED()) {
      texMacro = triplanarLayer(hitPos * (0.75 + detailNorm * 1.8), n, 1.4 + detailNorm * 2.0, t * 0.07);
      texFine = triplanarLayer(hitPos * (2.0 + detailNorm * 3.2) + n * 0.35, n, 3.5 + detailNorm * 5.0, 7.3 - t * 0.05);
      float striWave = sin(hitPos.z * (11.0 + detailNorm * 28.0) + texMacro * 6.283 + t * 0.3);
      striation = 0.5 + 0.5 * striWave;
      baseCol *= mix(0.84, 1.2, texMacro);
      baseCol *= mix(0.82, 1.08, texFine);
      baseCol *= mix(0.9, 1.14, striation);
    }

    float roughnessBase = clamp(mix(0.72, 0.28, crystal) * mix(1.0, 0.86, detailNorm), 0.12, 0.92);
    float roughness = roughnessBase;
    if (Q_MED()) {
      roughness = clamp(roughnessBase * mix(1.18, 0.74, texFine) * mix(1.08, 0.86, striation), 0.08, 0.95);
    }
    float gloss = 1.0 - roughness;
    float specPowKey = mix(10.0, 120.0, gloss);
    float specPowFill = mix(6.0, 48.0, gloss);
    vec3 hKey = normalize(lightDir + viewDir);
    vec3 hFill = normalize(fillDir + viewDir);
    float specKey = pow(max(0.0, dot(n, hKey)), specPowKey) * sh;
    float specFill = pow(max(0.0, dot(n, hFill)), specPowFill) * 0.35;
    float fresnel = fresnelSchlick(ndv, mix(0.03, 0.08, crystal));
    float clearcoat = Q_MED() ? (0.05 + 0.18 * (1.0 - roughness) * (0.6 + 0.4 * texFine)) : 0.0;
    float specCoat = pow(max(0.0, dot(n, normalize(lightDir + viewDir))), mix(44.0, 160.0, gloss)) * sh * clearcoat;

    vec3 ambient = mix(vec3(0.018, 0.024, 0.036), vec3(0.05, 0.07, 0.11), ao) * (0.8 + 0.2 * energy);
    vec3 lit = baseCol * (ambient + 0.98 * diffKey + 0.42 * diffFill);
    lit *= mix(0.56, 1.0, ao);
    lit += baseCol * backScatter * mix(vec3(0.85, 0.55, 0.45), vec3(0.65, 0.45, 0.85), crystal) * 0.18;
    lit += rim * mix(vec3(0.2, 0.52, 1.0), vec3(1.0, 0.55, 1.0), crystal) * (0.24 + 0.88 * sat(u_glowIntensity));
    vec3 specTint = mix(vec3(0.78, 0.9, 1.0), vec3(1.0, 0.78, 0.94), crystal);
    lit += (specKey + specFill) * specTint * (0.18 + 0.9 * high) * (0.7 + 0.6 * fresnel);
    lit += specCoat * vec3(1.0, 0.98, 0.95) * (0.18 + 0.35 * fresnel);
    lit += pulse * (0.05 + 0.08 * sat(u_glowIntensity)) * baseCol;

    // Layered emissive materials: glowing filaments + iridescent coat.
    if (Q_MED()) {
      float veinMask = smoothstep(0.63, 0.97, texFine * 0.65 + striation * 0.35);
      vec3 veinTint = mix(
        u_paletteC * 1.05 + vec3(0.04, 0.11, 0.18),
        u_paletteD * 1.0 + vec3(0.14, 0.03, 0.16),
        0.5 + 0.5 * sin(phase * TAU + t * 0.42)
      );
      lit += veinTint * veinMask * (0.04 + 0.18 * sat(u_glowIntensity)) * (0.75 + 0.25 * ao);

      float pearl = Q_HIGH() ? smoothstep(0.82, 0.98, triplanarLayer(hitPos * (3.5 + detailNorm * 6.0), n, 6.4, 4.7 + t * 0.03)) : 0.0;
      vec3 pearlTint = mix(vec3(0.7, 0.9, 1.0), vec3(1.0, 0.75, 0.92), crystal);
      lit += pearlTint * pearl * (0.05 + 0.16 * clearcoat) * (0.35 + 0.65 * fresnel);
    }

    float iridescence = 0.5 + 0.5 * sin(phase * TAU * 2.0 + ndv * 8.0 + t * 0.7);
    vec3 iriTint = mix(vec3(0.3, 0.72, 1.0), vec3(1.0, 0.46, 0.88), iridescence);
    lit += iriTint * fresnel * (0.02 + 0.12 * sat(u_glowIntensity)) * (0.35 + 0.65 * specCoat);

    float shell = exp(-abs(hitField) * 320.0);
    lit += mix(u_paletteC, u_paletteD, 0.55) * shell * (0.015 + 0.08 * sat(u_glowIntensity));

    float depthFog = exp(-dist * (0.06 + sat(u_fogDensity) * 0.2));
    col = mix(fallbackColor(p, t, pulse, crystal, high, energy), lit, depthFog);
  }

  glowAcc = clamp(glowAcc, 0.0, 2.0);
  layerGlow = clamp(layerGlow, vec3(0.0), vec3(1.4));
  col += glowAcc * mix(vec3(0.24, 0.56, 1.0), vec3(1.0, 0.58, 1.0), crystal);
  col += layerGlow * (0.9 + 0.5 * crystal);
  col += vec3(0.04, 0.03, 0.06);

  float fogAmt = 1.0 - exp(-dist * (0.08 + 0.42 * sat(u_fogDensity)));
  vec3 fogCol = mix(
    u_paletteA * 0.38 + u_paletteC * 0.62,
    u_paletteD * 0.82 + u_paletteB * 0.18,
    0.35 * crystal
  );
  col = mix(col, fogCol, clamp(fogAmt * 0.65, 0.0, 0.85));

  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(luma), col, mix(0.75, 1.75, sat(u_saturation)));
  col = (col - 0.5) * mix(0.85, 1.3, sat(u_contrast)) + 0.5;
  col = max(col, vec3(0.08, 0.06, 0.11));

  if (!hit || dot(col, col) < 0.002) {
    vec3 safeCol = fallbackColor(p, t, pulse, crystal, high, energy) + vec3(0.06, 0.045, 0.08);
    col = max(col, safeCol);
  }

  col = max(col, vec3(0.0));
  col = acesToneMap(col);
  col = pow(col, vec3(1.0 / 2.2));
  float vignette = smoothstep(1.28, 0.24, length(p));
  col *= mix(0.72, 1.0, vignette);
  float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  col += dither * (0.9 / 255.0);
  col = clamp(col, 0.0, 1.0);
  gl_FragColor = vec4(col, max(0.4, sat(u_opacity)));
}
`;

function vec3FromHex(hex: string) {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
}

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

const LivingTunnelRender: React.FC<{ uniforms: UniformValues; state: any }> = ({ uniforms, state }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null!);
  const { size, viewport, gl } = useThree();
  const fpsEmaRef = useRef(60);
  const lowFpsTimerRef = useRef(0);
  const highFpsTimerRef = useRef(0);
  const governorQualityRef = useRef<number | null>(null);
  const manualQualityRef = useRef(-1);

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

    const dpr = gl.getPixelRatio();
    m.uniforms.u_resolution.value.set(size.width * dpr, size.height * dpr);
    m.uniforms.u_time.value = clock.getElapsedTime();

    const infiniteZoom = !!uniforms.u_infiniteZoom;
    const baseZoom = infiniteZoom
      ? Math.pow(2, numOr(uniforms.u_zoomExp, 0))
      : numOr(uniforms.u_zoom, 1.4);

    const zoomPulseEnabled = uniforms.u_zoomPulseEnabled !== false;
    const zoomPulseStrength = numOr(uniforms.u_zoomPulseStrength, 0.14);
    const pulseEnv = numOr(state.zoomPulseEnv, 0);
    const zoomPulse = zoomPulseEnabled ? (1 - Math.exp(-zoomPulseStrength * pulseEnv)) : 0;

    const centerX = Array.isArray(uniforms.u_center) ? numOr(uniforms.u_center[0], 0) : 0;
    const centerY = Array.isArray(uniforms.u_center) ? numOr(uniforms.u_center[1], 0) : 0;
    m.uniforms.u_center.value.set(
      centerX,
      centerY,
    );
    const safeZoom = Math.max(1e-6, numOr(baseZoom, 1.4));
    m.uniforms.u_zoom.value = safeZoom;
    m.uniforms.u_zoomExp.value = Math.log2(safeZoom);
    m.uniforms.u_infiniteZoom.value = infiniteZoom;
    m.uniforms.u_rotation.value = numOr(uniforms.u_rotation, 0);
    m.uniforms.u_zoomPulse.value = zoomPulse;

    m.uniforms.u_tunnelRadius.value = numOr(uniforms.u_tunnelRadius, 0.62);
    m.uniforms.u_segmentPeriod.value = numOr(uniforms.u_segmentPeriod, 1.35);
    m.uniforms.u_flowWarp.value = numOr(uniforms.u_flowWarp, 0.85);
    m.uniforms.u_detailScale.value = numOr(uniforms.u_detailScale, 0.75);
    m.uniforms.u_crystalBoost.value = numOr(uniforms.u_crystalBoost, 0.55);

    m.uniforms.u_glowIntensity.value = numOr(uniforms.u_glowIntensity, 1.35);
    m.uniforms.u_fogDensity.value = numOr(uniforms.u_fogDensity, 0.62);
    m.uniforms.u_rimStrength.value = numOr(uniforms.u_rimStrength, 0.75);
    m.uniforms.u_contrast.value = numOr(uniforms.u_contrast, 0.62);
    m.uniforms.u_saturation.value = numOr(uniforms.u_saturation, 0.95);
    m.uniforms.u_opacity.value = numOr(uniforms.u_opacity, 1);

    m.uniforms.u_colorCycle.value = numOr(uniforms.u_colorCycle, 0);
    m.uniforms.u_colorSpeed.value = numOr(uniforms.u_colorSpeed, 0.55);
    m.uniforms.u_paletteA.value.copy(vec3FromHex(typeof uniforms.u_paletteA === "string" ? uniforms.u_paletteA : "#0a1222"));
    m.uniforms.u_paletteB.value.copy(vec3FromHex(typeof uniforms.u_paletteB === "string" ? uniforms.u_paletteB : "#4a3d9e"));
    m.uniforms.u_paletteC.value.copy(vec3FromHex(typeof uniforms.u_paletteC === "string" ? uniforms.u_paletteC : "#10b0d6"));
    m.uniforms.u_paletteD.value.copy(vec3FromHex(typeof uniforms.u_paletteD === "string" ? uniforms.u_paletteD : "#f16ad8"));

    const reactive = state.reactive ?? {};
    const bass = clamp(typeof reactive.bass === "number" ? reactive.bass : 0, 0, 1);
    const mid = clamp(typeof reactive.mid === "number" ? reactive.mid : 0, 0, 1);
    const high = clamp(typeof reactive.high === "number" ? reactive.high : 0, 0, 1);
    const energy = clamp(typeof reactive.energy === "number" ? reactive.energy : 0, 0, 1);
    const kick = clamp(typeof reactive.kick === "number" ? reactive.kick : 0, 0, 1);

    m.uniforms.u_bass.value = smoothAR(m.uniforms.u_bass.value, bass, delta, 20, 8);
    m.uniforms.u_mid.value = smoothAR(m.uniforms.u_mid.value, mid, delta, 16, 8);
    m.uniforms.u_high.value = smoothAR(m.uniforms.u_high.value, high, delta, 18, 9);
    m.uniforms.u_energy.value = smoothAR(m.uniforms.u_energy.value, energy, delta, 16, 8);
    m.uniforms.u_kick.value = smoothAR(m.uniforms.u_kick.value, kick, delta, 28, 10);

    const dtSafe = clamp(delta, 1 / 240, 0.25);
    const fpsNow = 1 / dtSafe;
    fpsEmaRef.current = fpsEmaRef.current * 0.9 + fpsNow * 0.1;

    const manualQuality = Math.round(clamp(numOr(uniforms.u_qualityMode, 1), 0, 2));
    const governorEnabled = uniforms.u_qualityGovernor !== false;

    if (!governorEnabled) {
      governorQualityRef.current = manualQuality;
      lowFpsTimerRef.current = 0;
      highFpsTimerRef.current = 0;
      manualQualityRef.current = manualQuality;
    } else {
      if (manualQuality !== manualQualityRef.current || governorQualityRef.current === null) {
        governorQualityRef.current = manualQuality;
        manualQualityRef.current = manualQuality;
        lowFpsTimerRef.current = 0;
        highFpsTimerRef.current = 0;
      }

      const fpsEma = fpsEmaRef.current;
      if (fpsEma < 45) {
        lowFpsTimerRef.current += dtSafe;
        highFpsTimerRef.current = 0;
        if (lowFpsTimerRef.current >= 1.5 && (governorQualityRef.current ?? 0) > 0) {
          governorQualityRef.current = Math.max(0, (governorQualityRef.current ?? 0) - 1);
          lowFpsTimerRef.current = 0;
          highFpsTimerRef.current = 0;
        }
      } else if (fpsEma > 58) {
        highFpsTimerRef.current += dtSafe;
        lowFpsTimerRef.current = 0;
        const maxUpgrade = manualQuality;
        if (highFpsTimerRef.current >= 2.0 && (governorQualityRef.current ?? 0) < maxUpgrade) {
          governorQualityRef.current = Math.min(maxUpgrade, (governorQualityRef.current ?? 0) + 1);
          highFpsTimerRef.current = 0;
          lowFpsTimerRef.current = 0;
        }
      } else {
        lowFpsTimerRef.current = Math.max(0, lowFpsTimerRef.current - dtSafe * 0.5);
        highFpsTimerRef.current = Math.max(0, highFpsTimerRef.current - dtSafe * 0.5);
      }
    }

    const effectiveQuality = governorEnabled
      ? clamp(governorQualityRef.current ?? manualQuality, 0, 2)
      : manualQuality;
    state.qualityGovernor = {
      fps: fpsEmaRef.current,
      quality: effectiveQuality,
      lowTimer: lowFpsTimerRef.current,
      highTimer: highFpsTimerRef.current,
    };
    m.uniforms.u_qualityMode.value = Math.round(effectiveQuality);
    m.uniforms.u_debugMode.value = Math.round(numOr(uniforms.u_debugMode, 0));
  });

  const initialUniforms = useMemo(
    () => ({
      u_resolution: { value: new THREE.Vector2(1, 1) },
      u_time: { value: 0 },
      u_center: { value: new THREE.Vector2(0, 0) },
      u_zoom: { value: 1.4 },
      u_zoomExp: { value: Math.log2(1.4) },
      u_infiniteZoom: { value: false },
      u_rotation: { value: 0 },
      u_zoomPulse: { value: 0 },
      u_tunnelRadius: { value: 0.62 },
      u_segmentPeriod: { value: 1.35 },
      u_flowWarp: { value: 0.85 },
      u_detailScale: { value: 0.75 },
      u_crystalBoost: { value: 0.55 },
      u_glowIntensity: { value: 1.35 },
      u_fogDensity: { value: 0.62 },
      u_rimStrength: { value: 0.75 },
      u_contrast: { value: 0.62 },
      u_saturation: { value: 0.95 },
      u_opacity: { value: 1 },
      u_colorCycle: { value: 0 },
      u_colorSpeed: { value: 0.55 },
      u_paletteA: { value: new THREE.Vector3(0.04, 0.07, 0.13) },
      u_paletteB: { value: new THREE.Vector3(0.24, 0.18, 0.49) },
      u_paletteC: { value: new THREE.Vector3(0.06, 0.69, 0.84) },
      u_paletteD: { value: new THREE.Vector3(0.95, 0.4, 0.85) },
      u_bass: { value: 0 },
      u_mid: { value: 0 },
      u_high: { value: 0 },
      u_energy: { value: 0 },
      u_kick: { value: 0 },
      u_qualityMode: { value: 0 },
      u_debugMode: { value: 0 },
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

export const LivingTunnelPreset: FractalPreset = {
  id: "living-tunnel",
  name: "Living Tunnel",
  category: "Fractals/3D",
  kind: "shader2d",

  uniformSpecs: [
    { key: "u_center", label: "Center", type: "vec2", group: "Fractal", default: [0, 0] },
    { key: "u_zoom", label: "Fractal zoom", type: "float", group: "Fractal", min: 0.35, max: 3.2, step: 0.001, default: 1.4, macro: true },
    { key: "u_opacity", label: "Opacity", type: "float", group: "Fractal", min: 0, max: 1, step: 0.01, default: 1 },
    { key: "u_infiniteZoom", label: "Infinite Zoom", type: "bool", group: "Fractal Zoom", default: false },
    {
      key: "u_zoomExp",
      label: "Zoom Depth",
      type: "float",
      group: "Fractal Zoom",
      min: -20,
      max: 8,
      step: 0.01,
      default: 0,
      visibleIf: (u: UniformValues) => !!u.u_infiniteZoom,
    },
    { key: "u_zoomPulseEnabled", label: "Zoom Pulse", type: "bool", group: "Fractal", default: true },
    {
      key: "u_zoomPulseStrength",
      label: "Pulse Amount",
      type: "float",
      group: "Fractal",
      min: 0,
      max: 1.2,
      step: 0.01,
      default: 0.35,
      visibleIf: (u: UniformValues) => !!u.u_zoomPulseEnabled,
    },
    { key: "u_rotation", label: "Rotation", type: "float", group: "Fractal", min: -3.14, max: 3.14, step: 0.001, default: 0 },
    { key: "u_tunnelRadius", label: "Tunnel Radius", type: "float", group: "Fractal", min: 0, max: 1, step: 0.001, default: 0.62, macro: true },
    { key: "u_segmentPeriod", label: "Segment Length", type: "float", group: "Fractal", min: 0.25, max: 2, step: 0.001, default: 1.35, macro: true },
    { key: "u_flowWarp", label: "Flow Warp", type: "float", group: "Fractal", min: 0, max: 1, step: 0.001, default: 0.85, macro: true },
    { key: "u_detailScale", label: "Detail", type: "float", group: "Fractal", min: 0, max: 1, step: 0.001, default: 0.75, macro: true },
    { key: "u_crystalBoost", label: "Crystal Boost", type: "float", group: "Fractal", min: 0, max: 1.5, step: 0.01, default: 0.55, macro: true },

    { key: "u_paletteA", label: "Base Tone", type: "color", group: "Color", default: "#0a1222" },
    { key: "u_paletteB", label: "Amplitude", type: "color", group: "Color", default: "#4a3d9e" },
    { key: "u_paletteC", label: "Frequency", type: "color", group: "Color", default: "#10b0d6" },
    { key: "u_paletteD", label: "Phase", type: "color", group: "Color", default: "#f16ad8" },
    { key: "u_colorCycle", label: "Color Cycle", type: "float", group: "Color", min: 0, max: 1, step: 0.001, default: 0.12, macro: true },
    { key: "u_colorSpeed", label: "Auto Cycle Speed", type: "float", group: "Color", min: 0, max: 2, step: 0.01, default: 0.55 },
    { key: "u_saturation", label: "Saturation", type: "float", group: "Color", min: 0, max: 1.5, step: 0.01, default: 0.95 },

    { key: "u_glowIntensity", label: "Glow", type: "float", group: "Effects", min: 0, max: 2, step: 0.01, default: 1.35, macro: true },
    { key: "u_fogDensity", label: "Fog Density", type: "float", group: "Effects", min: 0, max: 1, step: 0.01, default: 0.62, macro: true },
    { key: "u_rimStrength", label: "Rim Light", type: "float", group: "Effects", min: 0, max: 1, step: 0.01, default: 0.75 },
    { key: "u_contrast", label: "Contrast", type: "float", group: "Effects", min: 0, max: 1.2, step: 0.01, default: 0.62 },

    { key: "u_audioGain", label: "Audio Gain", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 1.0, macro: true },
    { key: "u_bassImpact", label: "Bass Impact", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.95, macro: true },
    { key: "u_midMorph", label: "Mid Morph", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.8, macro: true },
    { key: "u_trebleShimmer", label: "Treble Shimmer", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.9, macro: true },
    { key: "u_beatPunch", label: "Beat Punch", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 1.1 },

    { key: "u_qualityGovernor", label: "Quality Governor", type: "bool", group: "Quality", default: true },
    { key: "u_qualityMode", label: "Render Profile", type: "int", group: "Quality", min: 0, max: 2, step: 1, default: 1 },
    { key: "u_debugMode", label: "Debug View", type: "int", group: "Quality", min: 0, max: 3, step: 1, default: 0 },
  ],

  init(_ctx: PresetContext) {},
  update({ ctx, audio, uniforms, state }) {
    const gain = clamp(typeof uniforms.u_audioGain === "number" ? uniforms.u_audioGain : 1, 0, 2);
    const bassImpact = clamp(typeof uniforms.u_bassImpact === "number" ? uniforms.u_bassImpact : 1, 0, 2);
    const midMorph = clamp(typeof uniforms.u_midMorph === "number" ? uniforms.u_midMorph : 1, 0, 2);
    const trebleShimmer = clamp(typeof uniforms.u_trebleShimmer === "number" ? uniforms.u_trebleShimmer : 1, 0, 2);
    const beatPunch = clamp(typeof uniforms.u_beatPunch === "number" ? uniforms.u_beatPunch : 1, 0, 2);
    const reactivityScale = 0.08;

    const dt = Math.max(ctx.dt, 1 / 240);
    const reactive = state.reactive ?? { bass: 0, mid: 0, high: 0, energy: 0, kick: 0 };

    const bassIn = Number.isFinite(audio.bass) ? audio.bass : 0;
    const midIn = Number.isFinite(audio.mid) ? audio.mid : 0;
    const trebleIn = Number.isFinite(audio.treble) ? audio.treble : 0;
    const rmsIn = Number.isFinite(audio.rms) ? audio.rms : 0;
    const beatIn = Number.isFinite(audio.beat) ? audio.beat : 0;

    const targetBass = clamp(bassIn * gain * (0.45 + bassImpact * 0.55) * reactivityScale, 0, 1);
    const targetMid = clamp(midIn * gain * (0.4 + midMorph * 0.5) * reactivityScale, 0, 1);
    const targetHigh = clamp(trebleIn * gain * (0.35 + trebleShimmer * 0.65) * reactivityScale, 0, 1);
    const targetEnergy = clamp(rmsIn * gain * reactivityScale, 0, 1);
    const targetKick = clamp(beatIn * gain * (0.35 + beatPunch * 0.7) * reactivityScale, 0, 1);

    reactive.bass = smoothAR(reactive.bass, targetBass, dt, 24, 8);
    reactive.mid = smoothAR(reactive.mid, targetMid, dt, 18, 8);
    reactive.high = smoothAR(reactive.high, targetHigh, dt, 20, 9);
    reactive.energy = smoothAR(reactive.energy, targetEnergy, dt, 18, 8);
    reactive.kick = smoothAR(reactive.kick, targetKick, dt, 30, 11);
    state.reactive = reactive;

    const pulseRaw = clamp(Math.max(reactive.kick, reactive.bass * 0.55 + reactive.energy * 0.45), 0, 1);
    const prevPulse = typeof state.zoomPulseEnv === "number" ? state.zoomPulseEnv : 0;
    const pulseRate = pulseRaw > prevPulse ? 8 : 4;
    const pulseAlpha = 1 - Math.exp(-pulseRate * dt);
    state.zoomPulseEnv = prevPulse + (pulseRaw - prevPulse) * pulseAlpha;
  },
  dispose() {},

  Render: LivingTunnelRender,
};
