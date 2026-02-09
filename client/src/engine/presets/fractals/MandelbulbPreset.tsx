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

uniform vec3  u_camPos;
uniform mat3  u_camRot;

uniform float u_resScale;
uniform int   u_maxSteps;
uniform int   u_fractalIter;
uniform float u_maxDist;
uniform float u_epsilonBase;

uniform float u_power;
uniform float u_scale;
uniform vec3  u_offset;

uniform float u_glowIntensity;
uniform float u_fogDensity;
uniform float u_aoStrength;
uniform float u_shadowSoft;

uniform float u_beatPulse;
uniform float u_bassImpact;
uniform float u_midMorph;
uniform float u_trebleShimmer;
uniform float u_audioGain;

uniform float u_colorSpeed;
uniform float u_saturation;
uniform vec3  u_baseColor;
uniform vec3  u_hotColor;
uniform vec3  u_glowColor;
uniform float u_colorCycle;

uniform float u_deformAmount;
uniform float u_rotateSpeed;
uniform float u_fov;

#define PI  3.14159265359
#define TAU 6.28318530718

mat3 rotY(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
}
mat3 rotX(float a) {
  float c = cos(a), s = sin(a);
  return mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c);
}

vec3 iqPalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(TAU * (c * t + d));
}

float mandelbulbDE(vec3 p, float power, int iterations) {
  vec3 z = p;
  float dr = 1.0;
  float r = 0.0;

  for (int i = 0; i < 256; i++) {
    if (i >= iterations) break;
    r = length(z);
    if (r > 2.0) break;
    if (r < 1e-6) { r = 1e-6; break; }

    float theta = acos(clamp(z.z / r, -1.0, 1.0));
    float phi = atan(z.y, z.x);
    dr = pow(r, power - 1.0) * power * dr + 1.0;

    float zr = pow(r, power);
    theta *= power;
    phi *= power;

    z = zr * vec3(
      sin(theta) * cos(phi),
      sin(phi) * sin(theta),
      cos(theta)
    );
    z += p;
  }
  r = max(r, 1e-6);
  return 0.5 * log(r) * r / max(dr, 1e-6);
}

float map(vec3 p) {
  p = (p - u_offset) * u_scale;

  float t = u_time * u_rotateSpeed;
  float deform = u_deformAmount + u_midMorph * u_audioGain * 0.3;
  p = rotY(t * 0.1 + deform * sin(u_time * 0.5) * 0.3) * p;
  p = rotX(t * 0.07 + deform * cos(u_time * 0.37) * 0.2) * p;

  float pw = u_power + u_beatPulse * u_audioGain * 0.8 + u_bassImpact * u_audioGain * 0.15;

  float breathe = 1.0 + u_bassImpact * u_audioGain * 0.04 * sin(u_time * 2.0);
  p *= breathe;

  return mandelbulbDE(p, pw, u_fractalIter) / (u_scale * breathe);
}

vec3 getNormal(vec3 p, float eps) {
  vec2 e = vec2(eps, 0.0);
  return normalize(vec3(
    map(p + e.xyy) - map(p - e.xyy),
    map(p + e.yxy) - map(p - e.yxy),
    map(p + e.yyx) - map(p - e.yyx)
  ));
}

float calcAO(vec3 p, vec3 n, float eps) {
  float ao = 0.0;
  float weight = 1.0;
  for (int i = 1; i <= 5; i++) {
    float dist = eps * 2.0 * float(i);
    float d = map(p + n * dist);
    ao += weight * (dist - d);
    weight *= 0.5;
  }
  return 1.0 - clamp(ao * u_aoStrength, 0.0, 1.0);
}

float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
  float res = 1.0;
  float t = mint;
  for (int i = 0; i < 32; i++) {
    float h = map(ro + rd * t);
    if (h < 0.001) return 0.0;
    res = min(res, k * h / t);
    t += clamp(h, 0.02, 0.2);
    if (t > maxt) break;
  }
  return clamp(res, 0.0, 1.0);
}

vec3 shade(vec3 p, vec3 rd, float t, float eps) {
  vec3 n = getNormal(p, eps * 2.0);

  vec3 lightDir1 = normalize(vec3(0.6, 0.8, 0.4));
  vec3 lightDir2 = normalize(vec3(-0.4, 0.3, -0.7));

  float diff1 = clamp(dot(n, lightDir1), 0.0, 1.0);
  float diff2 = clamp(dot(n, lightDir2), 0.0, 1.0);

  float shadow1 = 1.0;
  if (u_shadowSoft > 0.01) {
    shadow1 = softShadow(p + n * eps * 3.0, lightDir1, eps * 5.0, 2.0, 8.0 / u_shadowSoft);
  }

  float ao = calcAO(p, n, eps);

  float rim = pow(clamp(1.0 - dot(n, -rd), 0.0, 1.0), 2.5);

  float spec = pow(clamp(dot(reflect(rd, n), lightDir1), 0.0, 1.0), 32.0);

  float height = dot(n, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5;
  float curvature = clamp(length(getNormal(p + n * eps * 4.0, eps * 4.0) - n) * 5.0, 0.0, 1.0);

  float cycle = u_colorCycle + u_time * u_colorSpeed * 0.02;
  float trebleFlicker = u_trebleShimmer * u_audioGain * 0.5;

  vec3 palCol = iqPalette(
    height * 0.7 + curvature * 0.3 + cycle + trebleFlicker * sin(u_time * 3.7 + p.x * 5.0),
    vec3(0.5), vec3(0.5), vec3(1.0, 1.0, 0.8),
    vec3(0.0 + cycle, 0.33 + cycle * 0.5, 0.67 + cycle * 0.3)
  );

  vec3 col = mix(u_baseColor, u_hotColor, u_beatPulse * u_audioGain * 0.7);
  col = mix(col, palCol, 0.6 + curvature * 0.3);

  vec3 ambient = col * 0.15;
  vec3 diffuse = col * (diff1 * 0.7 * shadow1 + diff2 * 0.2);
  vec3 specular = vec3(0.8, 0.85, 1.0) * spec * 0.4 * shadow1;
  vec3 rimCol = u_glowColor * rim * 0.4;

  vec3 result = ambient + diffuse + specular + rimCol;
  result *= ao;

  float glowMod = u_glowIntensity + u_beatPulse * u_audioGain * 0.6;
  result += glowMod * u_glowColor * (rim * 0.3 + curvature * 0.15) * diff1;

  float gray = dot(result, vec3(0.299, 0.587, 0.114));
  result = mix(vec3(gray), result, u_saturation);

  return result;
}

void main() {
  vec2 res = u_resolution * u_resScale;
  vec2 uv = vUv * 2.0 - 1.0;
  uv.x *= res.x / res.y;

  float fovScale = tan(u_fov * 0.5 * PI / 180.0);
  vec3 rd = normalize(u_camRot * vec3(uv * fovScale, -1.0));
  vec3 ro = u_camPos;

  float totalDist = 0.0;
  float d = 0.0;
  bool hit = false;
  float glow = 0.0;
  vec3 col = vec3(0.0);

  for (int i = 0; i < 512; i++) {
    if (i >= u_maxSteps) break;

    vec3 p = ro + rd * totalDist;
    d = map(p);

    float eps = max(1e-5, u_epsilonBase * (0.1 + 0.05 * totalDist));

    glow += 0.015 / (0.01 + d * d * 10.0);

    if (d < eps) {
      hit = true;
      col = shade(p, rd, totalDist, eps);
      break;
    }

    totalDist += d;
    if (totalDist > u_maxDist) break;
  }

  vec3 bgTop = vec3(0.03, 0.02, 0.06);
  vec3 bgBot = vec3(0.0);
  float bgGrad = smoothstep(-1.0, 1.0, uv.y);
  vec3 bg = mix(bgBot, bgTop, bgGrad);

  float beatBg = u_beatPulse * u_audioGain * 0.08;
  bg += u_glowColor * beatBg * (0.5 + 0.5 * bgGrad);

  if (!hit) {
    col = bg;
  } else {
    float fogAmt = 1.0 - exp(-u_fogDensity * totalDist * totalDist);
    col = mix(col, bg, fogAmt);
  }

  float glowFade = clamp(glow * 0.06, 0.0, 1.0);
  col += u_glowColor * glowFade * (u_glowIntensity * 0.5 + u_beatPulse * u_audioGain * 0.3);

  float vig = 1.0 - dot(uv * 0.4, uv * 0.4);
  vig = clamp(vig, 0.0, 1.0);
  col *= 0.6 + 0.4 * vig;

  col = col / (1.0 + col);
  col = pow(col, vec3(0.92));

  gl_FragColor = vec4(col, 1.0);
}
`;

function vec3FromHex(hex: string) {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
}

const MandelbulbRender: React.FC<{ uniforms: UniformValues; state: any }> = ({ uniforms, state }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null!);
  const { size, viewport, gl } = useThree();

  useEffect(() => {
    const prev = gl.getPixelRatio();
    gl.setPixelRatio(Math.min(1, prev));
    return () => { gl.setPixelRatio(prev); };
  }, [gl]);

  const smoothed = useRef({
    bass: 0, mid: 0, treble: 0, beat: 0,
    camTheta: 0.3, camPhi: 0.8, camDist: 3.5,
  });

  useFrame(({ clock }) => {
    const m = matRef.current;
    if (!m) return;

    const s = smoothed.current;
    const lr = 0.08;
    const decay = 0.92;

    s.bass = Math.max(s.bass * decay, s.bass + (uniforms.u_bassImpact - s.bass) * lr);
    s.mid = Math.max(s.mid * decay, s.mid + (uniforms.u_midMorph - s.mid) * lr);
    s.treble = Math.max(s.treble * decay, s.treble + (uniforms.u_trebleShimmer - s.treble) * lr);
    s.beat = s.beat * 0.88 + uniforms.u_beatPulse * 0.12;

    const camDist = uniforms.u_camDist ?? 3.5;
    const camTheta = uniforms.u_camTheta ?? 0.3;
    const camPhi = uniforms.u_camPhi ?? 0.8;

    s.camDist += (camDist - s.camDist) * 0.06;
    s.camTheta += (camTheta - s.camTheta) * 0.06;
    s.camPhi += (camPhi - s.camPhi) * 0.06;

    const dist = s.camDist + s.beat * uniforms.u_audioGain * 0.15;
    const theta = s.camTheta;
    const phi = s.camPhi;

    const camPos = new THREE.Vector3(
      dist * Math.sin(phi) * Math.cos(theta),
      dist * Math.cos(phi),
      dist * Math.sin(phi) * Math.sin(theta)
    );

    const target = new THREE.Vector3(
      uniforms.u_offset?.[0] ?? 0,
      uniforms.u_offset?.[1] ?? 0,
      uniforms.u_offset?.[2] ?? 0
    );
    const forward = new THREE.Vector3().subVectors(target, camPos).normalize();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(forward, worldUp).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();

    const camRot = new THREE.Matrix3();
    camRot.set(
      right.x, up.x, -forward.x,
      right.y, up.y, -forward.y,
      right.z, up.z, -forward.z
    );

    const t = clock.getElapsedTime();
    const dpr = gl.getPixelRatio();

    m.uniforms.u_time.value = t;
    m.uniforms.u_resolution.value.set(size.width * dpr, size.height * dpr);
    m.uniforms.u_camPos.value.copy(camPos);
    m.uniforms.u_camRot.value.copy(camRot);

    m.uniforms.u_resScale.value = uniforms.u_resScale;
    m.uniforms.u_maxSteps.value = uniforms.u_maxSteps;
    m.uniforms.u_fractalIter.value = uniforms.u_fractalIter;
    m.uniforms.u_maxDist.value = uniforms.u_maxDist;
    m.uniforms.u_epsilonBase.value = uniforms.u_epsilonBase;

    m.uniforms.u_power.value = uniforms.u_power;
    m.uniforms.u_scale.value = uniforms.u_scale;
    m.uniforms.u_offset.value.set(
      uniforms.u_offset?.[0] ?? 0,
      uniforms.u_offset?.[1] ?? 0,
      uniforms.u_offset?.[2] ?? 0
    );

    m.uniforms.u_glowIntensity.value = uniforms.u_glowIntensity;
    m.uniforms.u_fogDensity.value = uniforms.u_fogDensity;
    m.uniforms.u_aoStrength.value = uniforms.u_aoStrength;
    m.uniforms.u_shadowSoft.value = uniforms.u_shadowSoft;

    m.uniforms.u_beatPulse.value = s.beat;
    m.uniforms.u_bassImpact.value = s.bass;
    m.uniforms.u_midMorph.value = s.mid;
    m.uniforms.u_trebleShimmer.value = s.treble;
    m.uniforms.u_audioGain.value = uniforms.u_audioGain;

    m.uniforms.u_colorSpeed.value = uniforms.u_colorSpeed;
    m.uniforms.u_saturation.value = uniforms.u_saturation;
    m.uniforms.u_baseColor.value.copy(vec3FromHex(uniforms.u_baseColor));
    m.uniforms.u_hotColor.value.copy(vec3FromHex(uniforms.u_hotColor));
    m.uniforms.u_glowColor.value.copy(vec3FromHex(uniforms.u_glowColor));
    m.uniforms.u_colorCycle.value = uniforms.u_colorCycle;

    m.uniforms.u_deformAmount.value = uniforms.u_deformAmount;
    m.uniforms.u_rotateSpeed.value = uniforms.u_rotateSpeed;
    m.uniforms.u_fov.value = uniforms.u_fov;
  });

  const initialUniforms = useMemo(() => ({
    u_resolution: { value: new THREE.Vector2(1, 1) },
    u_time: { value: 0 },
    u_camPos: { value: new THREE.Vector3(0, 0, 3.5) },
    u_camRot: { value: new THREE.Matrix3() },

    u_resScale: { value: 0.8 },
    u_maxSteps: { value: 100 },
    u_fractalIter: { value: 10 },
    u_maxDist: { value: 30.0 },
    u_epsilonBase: { value: 0.002 },

    u_power: { value: 8.0 },
    u_scale: { value: 1.0 },
    u_offset: { value: new THREE.Vector3(0, 0, 0) },

    u_glowIntensity: { value: 0.6 },
    u_fogDensity: { value: 0.04 },
    u_aoStrength: { value: 1.5 },
    u_shadowSoft: { value: 0.5 },

    u_beatPulse: { value: 0 },
    u_bassImpact: { value: 0 },
    u_midMorph: { value: 0 },
    u_trebleShimmer: { value: 0 },
    u_audioGain: { value: 1.0 },

    u_colorSpeed: { value: 0.3 },
    u_saturation: { value: 1.2 },
    u_baseColor: { value: new THREE.Vector3(0.05, 0.15, 0.4) },
    u_hotColor: { value: new THREE.Vector3(1.0, 0.4, 0.1) },
    u_glowColor: { value: new THREE.Vector3(0.25, 0.5, 1.0) },
    u_colorCycle: { value: 0 },

    u_deformAmount: { value: 0.0 },
    u_rotateSpeed: { value: 0.3 },
    u_fov: { value: 60.0 },
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

export const MandelbulbPreset: FractalPreset = {
  id: "mandelbulb",
  name: "Mandelbulb 3D",
  category: "Fractals/3D",
  kind: "raymarch3d",

  uniformSpecs: [
    { key: "u_power", label: "Power", type: "float", group: "Fractal", min: 2, max: 12, step: 0.1, default: 8.0, macro: true },
    { key: "u_scale", label: "Scale", type: "float", group: "Fractal", min: 0.5, max: 3.0, step: 0.01, default: 1.0 },
    { key: "u_fractalIter", label: "Iterations", type: "int", group: "Fractal", min: 4, max: 20, step: 1, default: 10 },
    { key: "u_deformAmount", label: "Deform", type: "float", group: "Fractal", min: 0, max: 1, step: 0.01, default: 0.0, macro: true },
    { key: "u_offset", label: "Offset", type: "vec3", group: "Fractal", default: [0, 0, 0] },

    { key: "u_camDist", label: "Distance", type: "float", group: "Motion", min: 1.5, max: 8.0, step: 0.05, default: 3.5, macro: true },
    { key: "u_camTheta", label: "Orbit H", type: "float", group: "Motion", min: -3.14, max: 3.14, step: 0.01, default: 0.3 },
    { key: "u_camPhi", label: "Orbit V", type: "float", group: "Motion", min: 0.1, max: 3.0, step: 0.01, default: 0.8 },
    { key: "u_rotateSpeed", label: "Rotate Speed", type: "float", group: "Motion", min: 0, max: 2, step: 0.01, default: 0.3 },
    { key: "u_fov", label: "FOV", type: "float", group: "Motion", min: 30, max: 120, step: 1, default: 60 },

    { key: "u_baseColor", label: "Base Color", type: "color", group: "Color", default: "#0d2666" },
    { key: "u_hotColor", label: "Beat Color", type: "color", group: "Color", default: "#ff6619" },
    { key: "u_glowColor", label: "Glow Color", type: "color", group: "Color", default: "#4080ff" },
    { key: "u_colorCycle", label: "Color Cycle", type: "float", group: "Color", min: 0, max: 1, step: 0.001, default: 0, macro: true },
    { key: "u_colorSpeed", label: "Auto Cycle", type: "float", group: "Color", min: 0, max: 2, step: 0.01, default: 0.3 },
    { key: "u_saturation", label: "Saturation", type: "float", group: "Color", min: 0, max: 2, step: 0.01, default: 1.2 },

    { key: "u_glowIntensity", label: "Glow", type: "float", group: "Effects", min: 0, max: 2, step: 0.01, default: 0.6, macro: true },
    { key: "u_fogDensity", label: "Fog", type: "float", group: "Effects", min: 0, max: 0.2, step: 0.001, default: 0.04 },
    { key: "u_aoStrength", label: "AO Strength", type: "float", group: "Effects", min: 0, max: 4, step: 0.1, default: 1.5 },
    { key: "u_shadowSoft", label: "Shadows", type: "float", group: "Effects", min: 0, max: 1, step: 0.01, default: 0.5 },

    { key: "u_audioGain", label: "Audio Gain", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 1.0, macro: true },
    { key: "u_bassImpact", label: "Bass Impact", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.8, macro: true },
    { key: "u_midMorph", label: "Mid Morph", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.6, macro: true },
    { key: "u_trebleShimmer", label: "Treble Shimmer", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.5, macro: true },
    { key: "u_beatPulse", label: "Beat Punch", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.8 },

    { key: "u_resScale", label: "Resolution", type: "float", group: "Quality", min: 0.3, max: 1.0, step: 0.05, default: 0.8 },
    { key: "u_maxSteps", label: "Ray Steps", type: "int", group: "Quality", min: 50, max: 300, step: 10, default: 100 },
    { key: "u_maxDist", label: "Max Distance", type: "float", group: "Quality", min: 10, max: 60, step: 1, default: 30 },
    { key: "u_epsilonBase", label: "Detail", type: "float", group: "Quality", min: 0.0005, max: 0.01, step: 0.0005, default: 0.002 },
  ],

  init(_ctx: PresetContext) {},
  update() {},
  dispose() {},

  Render: MandelbulbRender,
};
