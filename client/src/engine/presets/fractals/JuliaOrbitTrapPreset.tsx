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
uniform float u_zoomExp;
uniform bool  u_infiniteZoom;
uniform float u_rotation;
uniform int   u_iterations;

uniform vec2  u_juliaC;
uniform float u_juliaMorph;

uniform float u_trapRadius;
uniform float u_trapLineAngle;
uniform float u_trapMix;
uniform float u_trapColorShift;
uniform float u_spiralDensity;

uniform float u_colorSpeed;
uniform float u_colorCycle;
uniform float u_saturation;
uniform float u_brightness;
uniform float u_warmth;
uniform float u_contrast;

uniform float u_audioGain;
uniform float u_bassImpact;
uniform float u_midMorph;
uniform float u_trebleShimmer;
uniform float u_beatPunch;

uniform float u_aaLevel;

#define PI  3.14159265359
#define TAU 6.28318530718

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(TAU * (c * t + d));
}

float trapPoint(vec2 z, vec2 center) {
  return length(z - center);
}

float trapCircle(vec2 z, float r) {
  return abs(length(z) - r);
}

float trapLine(vec2 z, float angle) {
  vec2 d = vec2(cos(angle), sin(angle));
  return abs(dot(z, vec2(-d.y, d.x)));
}

float trapSpiral(vec2 z, float density, float time) {
  float r = length(z);
  float a = atan(z.y, z.x);
  float spiral = abs(fract((a / TAU + log(r + 0.001) * density + time * 0.02) * 3.0) - 0.5) * 2.0;
  return spiral * r;
}

struct FResult {
  float smoothIter;
  float trapDist1;
  float trapDist2;
  float trapDist3;
  float trapDist4;
  float orbitSum;
  vec2  lastZ;
  bool  escaped;
  float angle;
  float avgR;
};

FResult iterate(vec2 z0, vec2 c, int maxIter, float time,
                float trapR, float trapAngle, float spiralD) {
  FResult res;
  res.smoothIter = 0.0;
  res.trapDist1 = 1e10;
  res.trapDist2 = 1e10;
  res.trapDist3 = 1e10;
  res.trapDist4 = 1e10;
  res.orbitSum = 0.0;
  res.lastZ = vec2(0.0);
  res.escaped = false;
  res.angle = 0.0;
  res.avgR = 0.0;

  vec2 z = z0;

  vec2 trapCenter1 = vec2(cos(time * 0.13) * 0.3, sin(time * 0.17) * 0.3);
  vec2 trapCenter2 = vec2(sin(time * 0.11 + 1.5) * 0.5, cos(time * 0.09 + 2.0) * 0.5);

  float dynAngle = trapAngle + time * 0.05;
  float dynRadius = trapR + 0.1 * sin(time * 0.12);

  for (int i = 0; i < 512; i++) {
    if (i >= maxIter) break;

    float r2 = dot(z, z);

    if (r2 > 256.0) {
      res.escaped = true;
      res.smoothIter = float(i) - log2(log2(r2)) + 4.0;
      res.angle = atan(z.y, z.x);
      break;
    }

    float x2 = z.x * z.x;
    float y2 = z.y * z.y;
    z = vec2(x2 - y2, 2.0 * z.x * z.y) + c;

    float t1 = trapPoint(z, trapCenter1);
    float t2 = trapCircle(z, dynRadius);
    float t3 = trapLine(z, dynAngle);
    float t4 = trapSpiral(z, spiralD, time);

    res.trapDist1 = min(res.trapDist1, t1);
    res.trapDist2 = min(res.trapDist2, t2);
    res.trapDist3 = min(res.trapDist3, t3);
    res.trapDist4 = min(res.trapDist4, t4);

    float r = sqrt(r2);
    res.orbitSum += exp(-r * 1.5);
    res.avgR += r;
    res.lastZ = z;
    res.smoothIter = float(i);
  }

  res.avgR /= max(1.0, res.smoothIter);

  if (!res.escaped) {
    res.smoothIter = float(maxIter);
  }

  return res;
}

vec3 colorFromTraps(FResult fr, float time, float cycle, float shimmer,
                    float trapMix, float trapColorShift, float sat,
                    float bright, float warmth, float cont,
                    int maxIter) {

  float t1 = exp(-fr.trapDist1 * 3.0);
  float t2 = exp(-fr.trapDist2 * 4.0);
  float t3 = exp(-fr.trapDist3 * 5.0);
  float t4 = exp(-fr.trapDist4 * 2.5);

  float trap = t1 * 0.35 + t2 * 0.25 + t3 * 0.2 + t4 * 0.2;
  trap = pow(clamp(trap, 0.0, 1.0), 0.6);

  float iterT = fr.smoothIter / float(maxIter);
  float logT = log(1.0 + fr.smoothIter) / log(1.0 + float(maxIter));
  iterT = mix(iterT, logT, 0.5);

  vec3 warmGold = palette(
    trap * 2.0 + iterT * 0.5 + cycle + trapColorShift,
    vec3(0.55, 0.47, 0.35),
    vec3(0.45, 0.38, 0.25),
    vec3(1.0, 0.8, 0.6),
    vec3(0.0, 0.1, 0.25)
  );

  vec3 tealGreen = palette(
    trap * 1.5 + iterT * 0.8 + cycle + 0.33 + trapColorShift * 0.7,
    vec3(0.45, 0.55, 0.42),
    vec3(0.3, 0.42, 0.35),
    vec3(0.8, 1.0, 0.7),
    vec3(0.15, 0.3, 0.45)
  );

  vec3 copperBrown = palette(
    trap * 1.8 + iterT * 0.3 + cycle + 0.67,
    vec3(0.5, 0.38, 0.28),
    vec3(0.4, 0.3, 0.2),
    vec3(0.9, 0.7, 0.5),
    vec3(0.05, 0.15, 0.3)
  );

  vec3 amberHighlight = palette(
    t2 * 3.0 + shimmer * 0.2 + cycle,
    vec3(0.6, 0.5, 0.3),
    vec3(0.5, 0.4, 0.2),
    vec3(1.0, 0.9, 0.7),
    vec3(0.0, 0.05, 0.15)
  );

  float blend1 = smoothstep(0.1, 0.8, t1);
  float blend2 = smoothstep(0.15, 0.7, t2);
  float blend3 = smoothstep(0.1, 0.6, t3);

  vec3 col = warmGold;
  col = mix(col, tealGreen, blend2 * 0.7 * trapMix);
  col = mix(col, copperBrown, blend1 * 0.5 * trapMix);
  col = mix(col, amberHighlight, blend3 * 0.4 * trapMix);

  float spiralColor = t4 * trapMix;
  vec3 spiralTint = palette(
    spiralColor * 2.0 + cycle + 0.5,
    vec3(0.4, 0.5, 0.38),
    vec3(0.35, 0.4, 0.3),
    vec3(0.9, 1.0, 0.8),
    vec3(0.1, 0.2, 0.35)
  );
  col = mix(col, spiralTint, spiralColor * 0.3);

  float detailLayer = fr.orbitSum / float(maxIter) * 8.0;
  detailLayer = clamp(detailLayer, 0.0, 1.0);
  vec3 detailCol = palette(
    detailLayer * 3.0 + cycle * 0.5,
    vec3(0.52, 0.5, 0.4),
    vec3(0.3, 0.25, 0.2),
    vec3(1.0, 0.9, 0.7),
    vec3(0.0 + cycle * 0.3, 0.1, 0.2)
  );
  col = mix(col, detailCol, (1.0 - trap) * 0.35);

  if (!fr.escaped) {
    float interiorVal = fr.orbitSum * 0.12;
    float angle = atan(fr.lastZ.y, fr.lastZ.x) / TAU + 0.5;
    float mag = length(fr.lastZ);
    float pattern = sin(angle * 8.0 + time * 0.5) * cos(mag * 3.0 - time * 0.3);

    vec3 interiorCol = palette(
      interiorVal + pattern * 0.3 + cycle,
      vec3(0.3, 0.25, 0.18),
      vec3(0.25, 0.2, 0.15),
      vec3(0.8, 0.6, 0.4),
      vec3(0.0, 0.1, 0.2)
    );

    float interiorTrap = exp(-fr.trapDist1 * 2.0) + exp(-fr.trapDist2 * 3.0);
    interiorTrap = clamp(interiorTrap * 0.5, 0.0, 1.0);
    interiorCol *= 0.15 + interiorTrap * 0.25 * trapMix;

    col = interiorCol;
  }

  float stripeMod = 0.5 + 0.5 * sin(fr.angle * 8.0 + time * 1.5);
  col += shimmer * stripeMod * 0.04 * vec3(0.3, 0.4, 0.2);

  col = mix(col, col * vec3(1.08, 1.02, 0.92), warmth);

  col = mix(vec3(0.5), col, 1.0 + (cont - 0.5) * 0.6);

  col *= bright;

  float gray = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(gray), col, sat);

  return col;
}

vec3 renderPixel(vec2 fragCoord, vec2 res, float time,
                 vec2 center, float zoom, float rotation, int maxIter,
                 float audioGain, float bassImpact, float midMorph,
                 float trebleShimmer, float beatPunch,
                 float juliaMorph, vec2 juliaC,
                 float trapR, float trapAngle, float trapMix,
                 float trapColorShift, float spiralD,
                 float colorSpeed, float colorCycle,
                 float sat, float bright, float warmth, float cont) {

  vec2 uv = fragCoord / res * 2.0 - 1.0;
  uv.x *= res.x / res.y;

  float bassPulse = bassImpact * audioGain;
  float midDrift = midMorph * audioGain;
  float trebleSpark = trebleShimmer * audioGain;
  float kick = beatPunch * audioGain;

  float zoomPulse = 1.0 + bassPulse * 0.08 * (0.5 + 0.5 * sin(time * 1.2));
  float rotOff = midDrift * 0.04 * sin(time * 0.6);

  uv = rot(rotation + rotOff) * uv;
  vec2 c = center + uv / (zoom * zoomPulse);

  float jm = clamp(juliaMorph + midDrift * 0.08, 0.0, 1.0);
  vec2 jc = juliaC + vec2(
    sin(time * 0.19 + midDrift * 1.5) * 0.015 * midDrift,
    cos(time * 0.27 + bassPulse * 0.5) * 0.015 * midDrift
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

  float dynTrapR = trapR + kick * 0.15;
  float dynTrapAngle = trapAngle + trebleSpark * 0.3;
  float dynSpiral = spiralD + bassPulse * 0.5;

  FResult fr = iterate(startZ, iterC, maxIter, time + kick * 0.3,
                        dynTrapR, dynTrapAngle, dynSpiral);

  float cycle = colorCycle + time * colorSpeed * 0.02 + kick * 0.05;

  vec3 col = colorFromTraps(fr, time, cycle, trebleSpark,
                             trapMix, trapColorShift, sat,
                             bright, warmth, cont, maxIter);

  float beatGlow = kick * 0.15;
  if (fr.escaped) {
    float edgeness = 1.0 - smoothstep(0.0, 0.3, fr.smoothIter / float(maxIter));
    col += beatGlow * edgeness * vec3(0.25, 0.18, 0.08);
  } else {
    col += beatGlow * 0.08 * vec3(0.15, 0.12, 0.06);
  }

  return col;
}

void main() {
  vec2 fragCoord = vUv * u_resolution;
  float zoom = u_infiniteZoom ? exp2(u_zoomExp) : u_zoom;

  int aa = int(u_aaLevel);

  vec3 col;
  if (aa <= 1) {
    col = renderPixel(fragCoord, u_resolution, u_time,
                      u_center, zoom, u_rotation, u_iterations,
                      u_audioGain, u_bassImpact, u_midMorph, u_trebleShimmer,
                      u_beatPunch, u_juliaMorph, u_juliaC,
                      u_trapRadius, u_trapLineAngle, u_trapMix,
                      u_trapColorShift, u_spiralDensity,
                      u_colorSpeed, u_colorCycle,
                      u_saturation, u_brightness, u_warmth, u_contrast);
  } else {
    col = vec3(0.0);
    float faa = float(aa);
    for (int j = 0; j < 4; j++) {
      if (j >= aa) break;
      for (int i = 0; i < 4; i++) {
        if (i >= aa) break;
        vec2 off = (vec2(float(i), float(j)) + 0.5) / faa - 0.5;
        col += renderPixel(fragCoord + off, u_resolution, u_time,
                           u_center, zoom, u_rotation, u_iterations,
                           u_audioGain, u_bassImpact, u_midMorph, u_trebleShimmer,
                           u_beatPunch, u_juliaMorph, u_juliaC,
                           u_trapRadius, u_trapLineAngle, u_trapMix,
                           u_trapColorShift, u_spiralDensity,
                           u_colorSpeed, u_colorCycle,
                           u_saturation, u_brightness, u_warmth, u_contrast);
      }
    }
    col /= faa * faa;
  }

  col = clamp(col, 0.0, 1.0);

  col = pow(col, vec3(0.95));
  col = mix(col, col * col * (3.0 - 2.0 * col), 0.12);

  gl_FragColor = vec4(col, 1.0);
}
`;

function vec3FromHex(hex: string) {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
}

const JuliaOrbitTrapRender: React.FC<{ uniforms: UniformValues; state: any }> = ({ uniforms, state }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null!);
  const { size, viewport, gl } = useThree();
  const autoZoomExpRef = useRef<number | null>(null);
  const autoZoomDirRef = useRef<1 | -1>(1);
  const autoZoomMinExpRef = useRef<number | null>(null);
  const autoZoomMaxExpRef = useRef<number | null>(null);
  const centerRef = useRef(new THREE.Vector2(-0.5, 0));
  const targetCenterRef = useRef(new THREE.Vector2(-0.5, 0));
  const staticTimeRef = useRef(0);

  useEffect(() => {
    const prev = gl.getPixelRatio();
    gl.setPixelRatio(Math.min(1, prev));
    return () => { gl.setPixelRatio(prev); };
  }, [gl]);

  const smoothedAudio = useRef({
    bass: 0, mid: 0, treble: 0, beat: 0,
  });

  useFrame(({ clock }, delta) => {
    const m = matRef.current;
    if (!m) return;

    const infiniteZoom = !!uniforms.u_infiniteZoom;

    const sa = smoothedAudio.current;
    const lr = 0.08;
    const decay = 0.93;
    sa.bass = infiniteZoom
      ? sa.bass * 0.9
      : Math.max(sa.bass * decay, sa.bass + (uniforms.u_bassImpact - sa.bass) * lr);
    sa.mid = Math.max(sa.mid * decay, sa.mid + (uniforms.u_midMorph - sa.mid) * lr);
    sa.treble = Math.max(sa.treble * decay, sa.treble + (uniforms.u_trebleShimmer - sa.treble) * lr);
    sa.beat = infiniteZoom ? sa.beat * 0.88 : sa.beat * 0.88 + uniforms.u_beatPunch * 0.12;

    const dpr = gl.getPixelRatio();
    if (infiniteZoom) {
      const mm = Math.max(0, uniforms.u_midMorph ?? 0);
      const ts = Math.max(0, uniforms.u_trebleShimmer ?? 0);
      const jm = Math.max(0, uniforms.u_juliaMorph ?? 0);
      const motionDrive = Math.max(0.02, mm * 0.35 + ts * 0.35 + jm * 0.3);
      staticTimeRef.current += Math.min(delta, 0.05) * motionDrive;
      m.uniforms.u_time.value = staticTimeRef.current;
    } else {
      staticTimeRef.current = clock.getElapsedTime();
      m.uniforms.u_time.value = staticTimeRef.current;
    }
    m.uniforms.u_resolution.value.set(size.width * dpr, size.height * dpr);

    if (Array.isArray(uniforms.u_zoomTarget) && uniforms.u_zoomTarget.length === 2) {
      targetCenterRef.current.set(uniforms.u_zoomTarget[0], uniforms.u_zoomTarget[1]);
    } else {
      targetCenterRef.current.set(uniforms.u_center[0], uniforms.u_center[1]);
    }
    if (!infiniteZoom) {
      centerRef.current.set(uniforms.u_center[0], uniforms.u_center[1]);
    } else {
      const centerLerp = 1 - Math.exp(-8 * Math.min(delta, 0.05));
      centerRef.current.lerp(targetCenterRef.current, centerLerp);
    }
    m.uniforms.u_center.value.set(centerRef.current.x, centerRef.current.y);
    const zoomPulseEnabled = uniforms.u_zoomPulseEnabled !== false;
    const zoomPulseStrength = typeof uniforms.u_zoomPulseStrength === "number" ? uniforms.u_zoomPulseStrength : 0.12;
    const zoomPulseEnv = typeof state.zoomPulseEnv === "number" ? state.zoomPulseEnv : 0;
    const zoomPulse = zoomPulseEnabled ? Math.exp(zoomPulseStrength * zoomPulseEnv) : 1;
    if (!infiniteZoom) {
      autoZoomExpRef.current = null;
      autoZoomDirRef.current = 1;
      autoZoomMinExpRef.current = null;
      autoZoomMaxExpRef.current = null;
    } else {
      if (autoZoomExpRef.current === null) {
        const z = typeof uniforms.u_zoomExp === "number" ? uniforms.u_zoomExp : Math.log2(Math.max(1e-12, uniforms.u_zoom ?? 1.2));
        autoZoomExpRef.current = z;
        autoZoomMinExpRef.current = z;
        autoZoomMaxExpRef.current = Math.min(60, z + 10);
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
    const exp = infiniteZoom ? (autoZoomExpRef.current ?? (uniforms.u_zoomExp ?? 0)) : Math.log2(Math.max(1e-12, uniforms.u_zoom ?? 1.2));
    const baseZoom = Math.max(1e-12, Math.pow(2, exp));
    const effectiveZoom = Math.max(1e-12, baseZoom * zoomPulse);
    m.uniforms.u_zoom.value = Math.max(1e-6, effectiveZoom);
    m.uniforms.u_zoomExp.value = Math.log2(effectiveZoom);
    m.uniforms.u_infiniteZoom.value = infiniteZoom;
    m.uniforms.u_rotation.value = uniforms.u_rotation;
    m.uniforms.u_iterations.value = uniforms.u_iterations;

    m.uniforms.u_juliaMorph.value = uniforms.u_juliaMorph;
    m.uniforms.u_juliaC.value.set(uniforms.u_juliaC[0], uniforms.u_juliaC[1]);

    m.uniforms.u_trapRadius.value = uniforms.u_trapRadius;
    m.uniforms.u_trapLineAngle.value = uniforms.u_trapLineAngle;
    m.uniforms.u_trapMix.value = uniforms.u_trapMix;
    m.uniforms.u_trapColorShift.value = uniforms.u_trapColorShift;
    m.uniforms.u_spiralDensity.value = uniforms.u_spiralDensity;

    m.uniforms.u_colorSpeed.value = uniforms.u_colorSpeed;
    m.uniforms.u_colorCycle.value = uniforms.u_colorCycle;
    m.uniforms.u_saturation.value = uniforms.u_saturation;
    m.uniforms.u_brightness.value = uniforms.u_brightness;
    m.uniforms.u_warmth.value = uniforms.u_warmth;
    m.uniforms.u_contrast.value = uniforms.u_contrast;

    m.uniforms.u_audioGain.value = uniforms.u_audioGain;
    m.uniforms.u_bassImpact.value = sa.bass;
    m.uniforms.u_midMorph.value = sa.mid;
    m.uniforms.u_trebleShimmer.value = sa.treble;
    m.uniforms.u_beatPunch.value = sa.beat;

    m.uniforms.u_aaLevel.value = uniforms.u_aaLevel;
  });

  const initialUniforms = useMemo(() => ({
    u_resolution: { value: new THREE.Vector2(1, 1) },
    u_time: { value: 0 },
    u_center: { value: new THREE.Vector2(-0.5, 0) },
    u_zoom: { value: 1.2 },
    u_zoomExp: { value: Math.log2(1.2) },
    u_infiniteZoom: { value: false },
    u_rotation: { value: 0 },
    u_iterations: { value: 200 },
    u_juliaMorph: { value: 0.85 },
    u_juliaC: { value: new THREE.Vector2(-0.74543, 0.11301) },
    u_trapRadius: { value: 0.6 },
    u_trapLineAngle: { value: 0.78 },
    u_trapMix: { value: 0.85 },
    u_trapColorShift: { value: 0.0 },
    u_spiralDensity: { value: 2.5 },
    u_colorSpeed: { value: 0.15 },
    u_colorCycle: { value: 0.0 },
    u_saturation: { value: 1.25 },
    u_brightness: { value: 1.1 },
    u_warmth: { value: 0.65 },
    u_contrast: { value: 0.55 },
    u_audioGain: { value: 1.0 },
    u_bassImpact: { value: 0 },
    u_midMorph: { value: 0 },
    u_trebleShimmer: { value: 0 },
    u_beatPunch: { value: 0 },
    u_aaLevel: { value: 1 },
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

export const JuliaOrbitTrapPreset: FractalPreset = {
  id: "julia-orbit-trap",
  name: "Julia Orbit Trap",
  category: "Fractals/Complex",
  kind: "shader2d",

  uniformSpecs: [
    { key: "u_center", label: "Center", type: "vec2", group: "Fractal", default: [-0.5, 0] },
    { key: "u_zoom", label: "Fractal zoom", type: "float", group: "Fractal", min: 0.3, max: 80, step: 0.01, default: 1.2, macro: true },
    { key: "u_infiniteZoom", label: "Infinite Zoom", type: "bool", group: "Fractal Zoom", default: false },
    { key: "u_zoomExp", label: "Zoom Depth", type: "float", group: "Fractal Zoom", min: -80, max: 10, step: 0.01, default: 0,
      visibleIf: (u: UniformValues) => !!u.u_infiniteZoom },
    { key: "u_zoomPulseEnabled", label: "Zoom Pulse", type: "bool", group: "Fractal", default: false },
    { key: "u_zoomPulseStrength", label: "Pulse Amount", type: "float", group: "Fractal", min: 0, max: 0.35, step: 0.005, default: 0.12,
      visibleIf: (u: UniformValues) => !!u.u_zoomPulseEnabled },
    { key: "u_rotation", label: "Rotation", type: "float", group: "Fractal", min: -3.14, max: 3.14, step: 0.001, default: 0 },
    { key: "u_iterations", label: "Iterations", type: "int", group: "Fractal", min: 50, max: 400, step: 1, default: 200 },

    { key: "u_juliaMorph", label: "Julia Morph", type: "float", group: "Julia", min: 0, max: 1, step: 0.001, default: 0.85, macro: true },
    { key: "u_juliaC", label: "Julia Seed", type: "vec2", group: "Julia", default: [-0.74543, 0.11301],
      visibleIf: (u: UniformValues) => (u.u_juliaMorph as number) > 0.01 },

    { key: "u_trapRadius", label: "Trap Radius", type: "float", group: "Effects", min: 0.1, max: 2.0, step: 0.01, default: 0.6, macro: true },
    { key: "u_trapLineAngle", label: "Trap Angle", type: "float", group: "Effects", min: 0, max: 3.14, step: 0.01, default: 0.78 },
    { key: "u_trapMix", label: "Trap Intensity", type: "float", group: "Effects", min: 0, max: 1, step: 0.01, default: 0.85, macro: true },
    { key: "u_trapColorShift", label: "Trap Color Shift", type: "float", group: "Effects", min: 0, max: 1, step: 0.01, default: 0.0, macro: true },
    { key: "u_spiralDensity", label: "Spiral Density", type: "float", group: "Effects", min: 0.5, max: 6, step: 0.1, default: 2.5 },

    { key: "u_colorCycle", label: "Color Cycle", type: "float", group: "Color", min: 0, max: 1, step: 0.001, default: 0.0, macro: true },
    { key: "u_colorSpeed", label: "Auto Cycle Speed", type: "float", group: "Color", min: 0, max: 1, step: 0.01, default: 0.15 },
    { key: "u_saturation", label: "Saturation", type: "float", group: "Color", min: 0, max: 2, step: 0.01, default: 1.25 },
    { key: "u_brightness", label: "Brightness", type: "float", group: "Color", min: 0.3, max: 2.0, step: 0.01, default: 1.1 },
    { key: "u_warmth", label: "Warmth", type: "float", group: "Color", min: 0, max: 1, step: 0.01, default: 0.65 },
    { key: "u_contrast", label: "Contrast", type: "float", group: "Color", min: 0, max: 1, step: 0.01, default: 0.55 },

    { key: "u_audioGain", label: "Audio Gain", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 1.0, macro: true },
    { key: "u_bassImpact", label: "Bass Impact", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.7, macro: true },
    { key: "u_midMorph", label: "Mid Morph", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.5, macro: true },
    { key: "u_trebleShimmer", label: "Treble Shimmer", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.5, macro: true },
    { key: "u_beatPunch", label: "Beat Punch", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.7 },

    { key: "u_aaLevel", label: "Anti-Alias", type: "int", group: "Quality", min: 1, max: 3, step: 1, default: 1 },
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

  Render: JuliaOrbitTrapRender,
};
