import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef, useMemo, useEffect } from "react";
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
uniform float u_rotation;
uniform int   u_iterations;
uniform float u_power;

uniform float u_audioGain;
uniform float u_bassImpact;
uniform float u_midMorph;
uniform float u_trebleShimmer;
uniform float u_beatPunch;

uniform float u_juliaMorph;
uniform vec2  u_juliaC;
uniform float u_glowIntensity;
uniform float u_orbitTrap;
uniform float u_interiorStyle;
uniform float u_colorSpeed;
uniform float u_edgeDetail;
uniform float u_aaLevel;
uniform float u_saturation;
uniform float u_warpAmount;

uniform vec3 u_paletteA;
uniform vec3 u_paletteB;
uniform vec3 u_paletteC;
uniform vec3 u_paletteD;
uniform float u_colorCycle;

#define PI  3.14159265359
#define TAU 6.28318530718

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

vec3 iqPalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(TAU * (c * t + d));
}

float trapCircle(vec2 z, float r) {
  return abs(length(z) - r);
}
float trapCross(vec2 z) {
  return min(abs(z.x), abs(z.y));
}
float trapLine(vec2 z, float angle) {
  vec2 d = vec2(cos(angle), sin(angle));
  return abs(dot(z, vec2(-d.y, d.x)));
}

struct FractalResult {
  float smoothIter;
  float minTrapDist;
  float finalMag;
  vec2  lastZ;
  bool  escaped;
  float orbitSum;
  float stripAngle;
  float distEst;
};

FractalResult computeFractal(vec2 z0, vec2 c, float power, int maxIter, float time, float warp, float trapMix) {
  FractalResult res;
  res.smoothIter = 0.0;
  res.minTrapDist = 1e10;
  res.finalMag = 0.0;
  res.lastZ = vec2(0.0);
  res.escaped = false;
  res.orbitSum = 0.0;
  res.stripAngle = 0.0;
  res.distEst = 0.0;

  vec2 z = z0;
  float dz = 1.0;

  float warpT = warp * 0.12;
  vec2 warpOff = warpT * vec2(sin(time * 0.37), cos(time * 0.53));

  bool doTraps = trapMix > 0.01;

  for (int i = 0; i < 512; i++) {
    if (i >= maxIter) break;

    float r2 = dot(z, z);

    if (r2 > 256.0) {
      res.escaped = true;
      float r = sqrt(r2);
      res.smoothIter = float(i) - log2(log2(r2)) + 4.0;
      res.stripAngle = atan(z.y, z.x);
      res.distEst = 0.5 * log(r2) * r / dz;
      break;
    }

    float r = sqrt(r2);
    dz = 2.0 * r * dz + 1.0;

    float x2 = z.x * z.x;
    float y2 = z.y * z.y;
    float xy = z.x * z.y;

    vec2 zNew;
    if (power < 2.1) {
      zNew = vec2(x2 - y2, 2.0 * xy);
    } else if (power < 3.1) {
      zNew = vec2(z.x * x2 - 3.0 * z.x * y2, 3.0 * x2 * z.y - z.y * y2);
    } else {
      float theta = atan(z.y, z.x);
      float rn = pow(r, power);
      float an = power * theta;
      zNew = vec2(rn * cos(an), rn * sin(an));
    }

    z = zNew + c + warpOff * sin(float(i) * 0.1);

    if (doTraps) {
      float trap1 = trapCircle(z, 0.5 + 0.3 * sin(time * 0.2));
      float trap2 = trapCross(z);
      float trap3 = trapLine(z, time * 0.15);
      float trapDist = min(trap1, min(trap2 * 1.5, trap3 * 2.0));
      res.minTrapDist = min(res.minTrapDist, trapDist);
    }

    res.orbitSum += exp(-r2 * 0.5);
    res.lastZ = z;
    res.finalMag = r;
    res.smoothIter = float(i);
  }

  if (!res.escaped) {
    res.smoothIter = float(maxIter);
  }

  return res;
}

vec3 colorExterior(FractalResult fr, float time, float shimmer, float cycle,
                   vec3 palA, vec3 palB, vec3 palC, vec3 palD,
                   float sat, float edgeDetail, float orbitTrap, float glowIntensity,
                   int maxIter) {
  float t = fr.smoothIter / float(maxIter);

  float logT = log(1.0 + fr.smoothIter) / log(1.0 + float(maxIter));
  t = mix(t, logT, 0.6);

  t = pow(t, 0.7 + edgeDetail * 0.5);

  float stripeMod = 0.5 + 0.5 * sin(fr.stripAngle * 6.0 + time * 2.0);
  t += shimmer * stripeMod * 0.08;

  vec3 col = iqPalette(t + cycle, palA, palB, palC, palD);

  float trapColor = 1.0 - smoothstep(0.0, 0.5, fr.minTrapDist);
  trapColor = pow(trapColor, 2.0);
  vec3 trapCol = iqPalette(trapColor * 2.0 + cycle + 0.3, palA, palB, palC, palD);
  col = mix(col, trapCol, orbitTrap * trapColor * 0.7);

  float orbitGlow = fr.orbitSum / float(maxIter);
  orbitGlow = clamp(orbitGlow * 3.0, 0.0, 1.0);
  col += glowIntensity * orbitGlow * vec3(0.15, 0.1, 0.25);

  float deGlow = 0.0;
  if (fr.distEst > 0.0) {
    deGlow = clamp(1.0 - log(fr.distEst * 800.0 + 1.0) * 0.4, 0.0, 1.0);
    deGlow = pow(deGlow, 2.5);
  }
  float edgeGlow = max(1.0 - smoothstep(0.0, 0.15, t), deGlow);
  col += glowIntensity * edgeGlow * vec3(0.2, 0.15, 0.35) * 1.5;

  float gray = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(gray), col, sat);

  return col;
}

vec3 colorInterior(FractalResult fr, float time, float style, float cycle,
                   vec3 palA, vec3 palB, vec3 palC, vec3 palD, float orbitTrap) {
  if (style < 0.25) {
    return vec3(0.0);
  }

  float orbitVal = fr.orbitSum * 0.15;
  float t = fract(orbitVal + cycle);

  if (style < 0.5) {
    vec3 col = iqPalette(t, palA * 0.3, palB * 0.2, palC, palD);
    float trapFade = 1.0 - smoothstep(0.0, 1.0, fr.minTrapDist);
    col *= 0.15 + 0.25 * trapFade;
    return col;
  }

  if (style < 0.75) {
    float angle = atan(fr.lastZ.y, fr.lastZ.x) / TAU + 0.5;
    float mag = length(fr.lastZ);
    float pattern = sin(angle * 12.0 + time) * cos(mag * 4.0 - time * 0.5);
    vec3 col = iqPalette(pattern * 0.5 + 0.5 + cycle, palA * 0.4, palB * 0.3, palC, palD);
    return col * 0.2;
  }

  float nebula = fr.orbitSum * 0.1;
  nebula = pow(nebula, 1.5);
  vec3 nebulaCol = iqPalette(nebula + cycle, palA, palB * 0.5, palC, palD);
  float trapGlow = 1.0 - smoothstep(0.0, 0.8, fr.minTrapDist);
  nebulaCol += trapGlow * orbitTrap * vec3(0.15, 0.05, 0.2);
  return nebulaCol * 0.25;
}

vec3 renderPixel(vec2 fragCoord, vec2 res, float time,
                 vec2 center, float zoom, float rotation, int maxIter, float power,
                 float audioGain, float bassImpact, float midMorph, float trebleShimmer,
                 float beatPunch, float juliaMorph, vec2 juliaC,
                 float glowIntensity, float orbitTrap, float interiorStyle,
                 float colorSpeed, float edgeDetail, float saturation, float warpAmount,
                 vec3 palA, vec3 palB, vec3 palC, vec3 palD, float colorCycle) {

  vec2 uv = fragCoord / res * 2.0 - 1.0;
  uv.x *= res.x / res.y;

  float bassPulse = bassImpact * audioGain;
  float midDrift = midMorph * audioGain;
  float trebleSpark = trebleShimmer * audioGain;
  float kick = beatPunch * audioGain;

  float zoomPunch = 1.0 + bassPulse * 0.15 * (0.5 + 0.5 * sin(time * 1.5));
  float rotOff = midDrift * 0.08 * sin(time * 0.7);

  uv = rot(rotation + rotOff) * uv;
  vec2 c = center + uv / (zoom * zoomPunch);

  float jm = clamp(juliaMorph + midDrift * 0.15, 0.0, 1.0);
  vec2 jc = juliaC + vec2(
    sin(time * 0.23 + midDrift * 2.0) * 0.02 * midDrift,
    cos(time * 0.31 + bassPulse) * 0.02 * midDrift
  );

  vec2 iterC;
  vec2 startZ;
  if (jm > 0.01) {
    startZ = c;
    iterC = mix(c, jc, jm);
  } else {
    startZ = vec2(0.0);
    iterC = c;
  }

  float warp = warpAmount + kick * 0.5;

  FractalResult fr = computeFractal(startZ, iterC, power, maxIter, time + kick * 0.5, warp, orbitTrap);

  float cycle = colorCycle + time * colorSpeed * 0.03 + kick * 0.08;

  vec3 col;
  if (fr.escaped) {
    col = colorExterior(fr, time, trebleSpark, cycle,
                        palA, palB, palC, palD,
                        saturation, edgeDetail, orbitTrap, glowIntensity, maxIter);

    float beatFlash = kick * 0.3;
    col += beatFlash * smoothstep(0.8, 0.0, fr.smoothIter / float(maxIter)) * vec3(0.3, 0.2, 0.4);
  } else {
    col = colorInterior(fr, time, interiorStyle, cycle,
                        palA, palB, palC, palD, orbitTrap);

    col += kick * 0.06 * vec3(0.2, 0.1, 0.3);
  }

  col += trebleSpark * 0.04 * vec3(
    sin(time * 3.7 + c.x * 10.0) * 0.5 + 0.5,
    sin(time * 4.3 + c.y * 10.0) * 0.5 + 0.5,
    sin(time * 5.1 + (c.x + c.y) * 7.0) * 0.5 + 0.5
  );

  return col;
}

void main() {
  vec2 fragCoord = vUv * u_resolution;

  int aa = int(u_aaLevel);

  vec3 col;
  if (aa <= 1) {
    col = renderPixel(fragCoord, u_resolution, u_time,
                      u_center, u_zoom, u_rotation, u_iterations, u_power,
                      u_audioGain, u_bassImpact, u_midMorph, u_trebleShimmer,
                      u_beatPunch, u_juliaMorph, u_juliaC,
                      u_glowIntensity, u_orbitTrap, u_interiorStyle,
                      u_colorSpeed, u_edgeDetail, u_saturation, u_warpAmount,
                      u_paletteA, u_paletteB, u_paletteC, u_paletteD, u_colorCycle);
  } else {
    col = vec3(0.0);
    float faa = float(aa);
    for (int j = 0; j < 4; j++) {
      if (j >= aa) break;
      for (int i = 0; i < 4; i++) {
        if (i >= aa) break;
        vec2 off = (vec2(float(i), float(j)) + 0.5) / faa - 0.5;
        col += renderPixel(fragCoord + off, u_resolution, u_time,
                           u_center, u_zoom, u_rotation, u_iterations, u_power,
                           u_audioGain, u_bassImpact, u_midMorph, u_trebleShimmer,
                           u_beatPunch, u_juliaMorph, u_juliaC,
                           u_glowIntensity, u_orbitTrap, u_interiorStyle,
                           u_colorSpeed, u_edgeDetail, u_saturation, u_warpAmount,
                           u_paletteA, u_paletteB, u_paletteC, u_paletteD, u_colorCycle);
      }
    }
    col /= faa * faa;
  }

  col = clamp(col, 0.0, 1.0);

  col = pow(col, vec3(0.92));

  col = mix(col, col * col * (3.0 - 2.0 * col), 0.15);

  gl_FragColor = vec4(col, 1.0);
}
`;

function vec3FromHex(hex: string) {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
}

const MandelbrotRender: React.FC<{ uniforms: UniformValues; state: any }> = ({ uniforms, state }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null!);
  const { size, viewport, gl } = useThree();

  useEffect(() => {
    const prev = gl.getPixelRatio();
    gl.setPixelRatio(Math.min(1, prev));
    return () => { gl.setPixelRatio(prev); };
  }, [gl]);

  const smoothedAudio = useRef({
    bass: 0, mid: 0, treble: 0, beat: 0,
  });

  useFrame(({ clock }) => {
    const m = matRef.current;
    if (!m) return;

    const sa = smoothedAudio.current;
    const lerpRate = 0.08;
    const decayRate = 0.93;
    sa.bass = Math.max(sa.bass * decayRate, sa.bass + (uniforms.u_bassImpact - sa.bass) * lerpRate);
    sa.mid = Math.max(sa.mid * decayRate, sa.mid + (uniforms.u_midMorph - sa.mid) * lerpRate);
    sa.treble = Math.max(sa.treble * decayRate, sa.treble + (uniforms.u_trebleShimmer - sa.treble) * lerpRate);
    sa.beat = sa.beat * 0.88 + uniforms.u_beatPunch * 0.12;

    const dpr = gl.getPixelRatio();
    m.uniforms.u_time.value = clock.getElapsedTime();
    m.uniforms.u_resolution.value.set(size.width * dpr, size.height * dpr);

    m.uniforms.u_center.value.set(uniforms.u_center[0], uniforms.u_center[1]);
    const zoomPulseEnabled = uniforms.u_zoomPulseEnabled !== false;
    const zoomPulseStrength = typeof uniforms.u_zoomPulseStrength === "number" ? uniforms.u_zoomPulseStrength : 0.12;
    const zoomPulseEnv = typeof state.zoomPulseEnv === "number" ? state.zoomPulseEnv : 0;
    const zoomPulse = zoomPulseEnabled ? Math.exp(zoomPulseStrength * zoomPulseEnv) : 1;
    m.uniforms.u_zoom.value = Math.max(1e-6, uniforms.u_zoom * zoomPulse);
    m.uniforms.u_rotation.value = uniforms.u_rotation;
    m.uniforms.u_iterations.value = uniforms.u_iterations;
    m.uniforms.u_power.value = uniforms.u_power;

    m.uniforms.u_audioGain.value = uniforms.u_audioGain;
    m.uniforms.u_bassImpact.value = sa.bass;
    m.uniforms.u_midMorph.value = sa.mid;
    m.uniforms.u_trebleShimmer.value = sa.treble;
    m.uniforms.u_beatPunch.value = sa.beat;

    m.uniforms.u_juliaMorph.value = uniforms.u_juliaMorph;
    m.uniforms.u_juliaC.value.set(uniforms.u_juliaC[0], uniforms.u_juliaC[1]);
    m.uniforms.u_glowIntensity.value = uniforms.u_glowIntensity;
    m.uniforms.u_orbitTrap.value = uniforms.u_orbitTrap;
    m.uniforms.u_interiorStyle.value = uniforms.u_interiorStyle;
    m.uniforms.u_colorSpeed.value = uniforms.u_colorSpeed;
    m.uniforms.u_edgeDetail.value = uniforms.u_edgeDetail;
    m.uniforms.u_aaLevel.value = uniforms.u_aaLevel;
    m.uniforms.u_saturation.value = uniforms.u_saturation;
    m.uniforms.u_warpAmount.value = uniforms.u_warpAmount;

    m.uniforms.u_paletteA.value.copy(vec3FromHex(uniforms.u_paletteA));
    m.uniforms.u_paletteB.value.copy(vec3FromHex(uniforms.u_paletteB));
    m.uniforms.u_paletteC.value.copy(vec3FromHex(uniforms.u_paletteC));
    m.uniforms.u_paletteD.value.copy(vec3FromHex(uniforms.u_paletteD));
    m.uniforms.u_colorCycle.value = uniforms.u_colorCycle;
  });

  const initialUniforms = useMemo(() => ({
    u_resolution: { value: new THREE.Vector2(1, 1) },
    u_time: { value: 0 },
    u_center: { value: new THREE.Vector2(-0.5, 0) },
    u_zoom: { value: 1.8 },
    u_rotation: { value: 0 },
    u_iterations: { value: 128 },
    u_power: { value: 2 },
    u_audioGain: { value: 1 },
    u_bassImpact: { value: 0 },
    u_midMorph: { value: 0 },
    u_trebleShimmer: { value: 0 },
    u_beatPunch: { value: 0 },
    u_juliaMorph: { value: 0 },
    u_juliaC: { value: new THREE.Vector2(-0.4, 0.6) },
    u_glowIntensity: { value: 0.8 },
    u_orbitTrap: { value: 0.5 },
    u_interiorStyle: { value: 0.5 },
    u_colorSpeed: { value: 0.4 },
    u_edgeDetail: { value: 0.5 },
    u_aaLevel: { value: 1 },
    u_saturation: { value: 1.15 },
    u_warpAmount: { value: 0 },
    u_paletteA: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
    u_paletteB: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
    u_paletteC: { value: new THREE.Vector3(1, 1, 1) },
    u_paletteD: { value: new THREE.Vector3(0.0, 0.33, 0.67) },
    u_colorCycle: { value: 0.0 },
  }), []);

  return (
    <mesh position={[0, 0, 0]}>
      <planeGeometry args={[viewport.width, viewport.height]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={initialUniforms}
      />
    </mesh>
  );
};

export const MandelbrotPreset: FractalPreset = {
  id: "mandelbrot",
  name: "Mandelbrot Explorer",
  category: "Fractals/Complex",
  kind: "shader2d",

  uniformSpecs: [
    { key: "u_center", label: "Center", type: "vec2", group: "Fractal", default: [-0.5, 0] },
    { key: "u_zoom", label: "Fractal zoom", type: "float", group: "Fractal", min: 0.5, max: 50, step: 0.01, default: 1.8, macro: true },
    { key: "u_zoomPulseEnabled", label: "Zoom Pulse", type: "bool", group: "Fractal", default: false },
    { key: "u_zoomPulseStrength", label: "Pulse Amount", type: "float", group: "Fractal", min: 0, max: 0.35, step: 0.005, default: 0.12,
      visibleIf: (u: UniformValues) => !!u.u_zoomPulseEnabled },
    { key: "u_rotation", label: "Rotation", type: "float", group: "Fractal", min: -3.14, max: 3.14, step: 0.001, default: 0 },
    { key: "u_iterations", label: "Iterations", type: "int", group: "Fractal", min: 50, max: 512, step: 1, default: 128 },
    { key: "u_power", label: "Power", type: "float", group: "Fractal", min: 2, max: 6, step: 0.01, default: 2.0 },
    { key: "u_edgeDetail", label: "Edge Detail", type: "float", group: "Fractal", min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: "u_warpAmount", label: "Warp", type: "float", group: "Fractal", min: 0, max: 1, step: 0.01, default: 0.0 },

    { key: "u_juliaMorph", label: "Julia Morph", type: "float", group: "Julia", min: 0, max: 1, step: 0.001, default: 0.0, macro: true },
    { key: "u_juliaC", label: "Julia Seed", type: "vec2", group: "Julia", default: [-0.4, 0.6],
      visibleIf: (u: UniformValues) => (u.u_juliaMorph as number) > 0.01 },

    { key: "u_paletteA", label: "Base Tone", type: "color", group: "Color", default: "#808080" },
    { key: "u_paletteB", label: "Amplitude", type: "color", group: "Color", default: "#808080" },
    { key: "u_paletteC", label: "Frequency", type: "color", group: "Color", default: "#ffffff" },
    { key: "u_paletteD", label: "Phase", type: "color", group: "Color", default: "#0055aa" },
    { key: "u_colorCycle", label: "Color Cycle", type: "float", group: "Color", min: 0, max: 1, step: 0.001, default: 0.0, macro: true },
    { key: "u_colorSpeed", label: "Auto Cycle Speed", type: "float", group: "Color", min: 0, max: 2, step: 0.01, default: 0.4 },
    { key: "u_saturation", label: "Saturation", type: "float", group: "Color", min: 0, max: 2, step: 0.01, default: 1.15 },

    { key: "u_glowIntensity", label: "Edge Glow", type: "float", group: "Effects", min: 0, max: 2, step: 0.01, default: 0.8, macro: true },
    { key: "u_orbitTrap", label: "Orbit Trap", type: "float", group: "Effects", min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: "u_interiorStyle", label: "Interior Style", type: "float", group: "Effects", min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: "u_aaLevel", label: "Anti-Alias", type: "int", group: "Effects", min: 1, max: 3, step: 1, default: 1 },

    { key: "u_audioGain", label: "Audio Gain", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 1.0, macro: true },
    { key: "u_bassImpact", label: "Bass Impact", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.8, macro: true },
    { key: "u_midMorph", label: "Mid Morph", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.6, macro: true },
    { key: "u_trebleShimmer", label: "Treble Shimmer", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.6, macro: true },
    { key: "u_beatPunch", label: "Beat Punch", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.8 },
  ],

  init(_ctx: PresetContext) {},
  update({ ctx, audio, state }) {
    const raw = Math.max(0, Math.min(1, audio.rms * 0.6 + audio.bass * 0.25 + audio.beat * 0.15));
    const prev = typeof state.zoomPulseEnv === "number" ? state.zoomPulseEnv : 0;
    const rate = raw > prev ? 12 : 5;
    const alpha = 1 - Math.exp(-rate * Math.max(ctx.dt, 1 / 120));
    state.zoomPulseEnv = prev + (raw - prev) * alpha;
  },
  dispose() {},

  Render: MandelbrotRender,
};
