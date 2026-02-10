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
uniform float u_sssStrength;
uniform float u_iridescence;

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

vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

vec4 orbitTrap;

float mandelbulbDE(vec3 p, float power, int iterations) {
  vec3 z = p;
  float dr = 1.0;
  float r = 0.0;
  orbitTrap = vec4(1e10);

  for (int i = 0; i < 96; i++) {
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

    orbitTrap.x = min(orbitTrap.x, abs(z.x));
    orbitTrap.y = min(orbitTrap.y, abs(z.y));
    orbitTrap.z = min(orbitTrap.z, abs(z.z));
    orbitTrap.w = min(orbitTrap.w, dot(z, z));
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

  float pw = u_power
    + u_beatPulse * u_audioGain * 0.4
    + u_bassImpact * u_audioGain * 0.15
    + 0.15 * sin(u_time * 0.6);

  float breathe = 1.0 + u_bassImpact * u_audioGain * 0.04 * sin(u_time * 2.0);
  p *= breathe;

  float warp = u_trebleShimmer * u_audioGain * 0.008;
  p.x += warp * sin(p.y * 5.0 + u_time * 1.2);
  p.y += warp * cos(p.z * 5.0 + u_time * 0.9);

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
  float occ = 0.0;
  float scale = 1.0;
  for (int i = 1; i <= 4; i++) {
    float h = eps * 2.0 * float(i);
    float d = map(p + n * h);
    occ += (h - d) * scale;
    scale *= 0.65;
  }
  return clamp(1.0 - u_aoStrength * occ, 0.0, 1.0);
}

float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
  float res = 1.0;
  float t = mint;
  float ph = 1e10;
  for (int i = 0; i < 12; i++) {
    float d = map(ro + rd * t);
    float y = d * d / (2.0 * ph);
    float h = sqrt(max(0.0, d * d - y * y));
    res = min(res, k * h / max(0.001, t - y));
    ph = d;
    t += clamp(d, 0.02, 0.25);
    if (res < 0.005 || t > maxt) break;
  }
  return clamp(res, 0.0, 1.0);
}

float subsurfaceScatter(vec3 p, vec3 lightDir, float eps) {
  float scatter = 0.0;
  float weight = 1.0;
  for (int i = 1; i <= 3; i++) {
    float h = eps * float(i) * 3.0;
    float d = map(p + lightDir * h);
    scatter += weight * max(0.0, h - d);
    weight *= 0.5;
  }
  return scatter;
}

vec3 shade(vec3 p, vec3 rd, float hitDist, float eps) {
  vec3 n = getNormal(p, eps * 2.0);

  vec3 keyDir   = normalize(vec3(0.6, 0.8, 0.4));
  vec3 fillDir  = normalize(vec3(-0.5, 0.3, -0.6));
  vec3 rimDir   = normalize(vec3(0.0, -0.2, 1.0));

  vec3 keyColor  = vec3(1.0, 0.95, 0.85) * 1.2;
  vec3 fillColor = vec3(0.4, 0.55, 0.8) * 0.5;
  vec3 rimColor  = u_glowColor * 1.5;

  float diff1 = clamp(dot(n, keyDir), 0.0, 1.0);
  float diff2 = clamp(dot(n, fillDir), 0.0, 1.0);
  float rimDot = clamp(dot(n, rimDir), 0.0, 1.0);

  float shadow1 = softShadow(p + n * eps * 3.0, keyDir, 0.01, 8.0, 12.0 + u_shadowSoft * 20.0);
  shadow1 = mix(1.0, shadow1, u_shadowSoft);

  float ao = calcAO(p, n, eps);

  float fresnel = pow(clamp(1.0 - dot(n, -rd), 0.0, 1.0), 3.0);

  vec3 halfVec = normalize(keyDir - rd);
  float ndotH = clamp(dot(n, halfVec), 0.0, 1.0);
  float roughness = 0.35;
  float a2 = roughness * roughness;
  float denom = ndotH * ndotH * (a2 - 1.0) + 1.0;
  float ggx = a2 / (PI * denom * denom);
  float spec = ggx * clamp(dot(n, keyDir), 0.0, 1.0);

  float cycle = u_colorCycle + u_time * u_colorSpeed * 0.02;
  float trebleFlicker = u_trebleShimmer * u_audioGain * 0.3;

  float ot = sqrt(orbitTrap.w) * 0.5;
  float otX = clamp(orbitTrap.x * 2.0, 0.0, 1.0);
  float otY = clamp(orbitTrap.y * 2.0, 0.0, 1.0);
  float otZ = clamp(orbitTrap.z * 2.0, 0.0, 1.0);

  vec3 palCol = iqPalette(
    ot * 0.5 + otX * 0.2 + cycle + trebleFlicker * sin(u_time * 2.5 + p.x * 4.0),
    vec3(0.5, 0.5, 0.5),
    vec3(0.5, 0.5, 0.5),
    vec3(1.0, 0.9, 0.7),
    vec3(0.0 + cycle, 0.15 + cycle * 0.5, 0.35 + cycle * 0.3)
  );

  vec3 palCol2 = iqPalette(
    otY * 0.6 + otZ * 0.4 + cycle * 1.3,
    vec3(0.5, 0.5, 0.5),
    vec3(0.5, 0.5, 0.4),
    vec3(1.0, 0.7, 0.4),
    vec3(0.3 + cycle, 0.5, 0.7)
  );

  float height = dot(n, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5;
  vec3 orbColor = mix(palCol, palCol2, height * 0.5 + 0.25);

  vec3 col = mix(u_baseColor, u_hotColor, u_beatPulse * u_audioGain * 0.6);
  col = mix(col, orbColor, 0.65 + otX * 0.2);

  vec3 iridescent = hsv2rgb(vec3(fresnel * 0.6 + ot * 0.3 + cycle, 0.7, 1.0));
  col = mix(col, iridescent, u_iridescence * fresnel * 0.5);

  vec3 ambient = col * vec3(0.12, 0.13, 0.18) * ao;

  vec3 keyLit = col * keyColor * diff1 * shadow1;

  vec3 fillLit = col * fillColor * diff2;

  vec3 rimLit = rimColor * pow(fresnel, 2.5) * 0.5;
  rimLit += rimColor * rimDot * 0.15;

  vec3 specCol = mix(vec3(0.9, 0.92, 1.0), u_glowColor, fresnel * 0.3);
  vec3 specLit = specCol * spec * 0.5 * shadow1;

  float sss = subsurfaceScatter(p, keyDir, eps);
  vec3 sssCol = u_glowColor * 0.6 + col * 0.4;
  vec3 sssLit = sssCol * sss * u_sssStrength * diff1 * 0.4;

  vec3 result = ambient + keyLit + fillLit + rimLit + specLit + sssLit;
  result *= ao;

  float glowMod = u_glowIntensity + u_beatPulse * u_audioGain * 0.5;
  result += glowMod * u_glowColor * (fresnel * 0.25 + otX * 0.1) * ao;

  float bioGlow = pow(1.0 - ot, 3.0) * 0.15;
  bioGlow += u_bassImpact * u_audioGain * pow(1.0 - otX, 2.0) * 0.1;
  result += u_glowColor * bioGlow * u_glowIntensity;

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
  float prevD = 1e10;
  float minDist = 1e10;

  for (int i = 0; i < 160; i++) {
    if (i >= u_maxSteps) break;

    vec3 p = ro + rd * totalDist;
    d = map(p);

    float eps = max(5e-5, u_epsilonBase * (0.15 + 0.06 * totalDist));

    minDist = min(minDist, d);

    if ((i & 3) == 0) {
      glow += 0.08 / (0.008 + d * d * 8.0);
    }

    if (d < eps) {
      hit = true;
      col = shade(p, rd, totalDist, eps);
      break;
    }

    float step = d * 1.2;
    if (d > prevD) step = d;
    prevD = d;

    totalDist += step;
    if (totalDist > u_maxDist) break;
  }

  vec3 bgTop = vec3(0.04, 0.03, 0.08);
  vec3 bgMid = vec3(0.02, 0.015, 0.05);
  vec3 bgBot = vec3(0.005, 0.003, 0.015);
  float bgGrad = smoothstep(-1.0, 1.0, uv.y);
  vec3 bg = mix(bgBot, bgMid, smoothstep(0.0, 0.5, bgGrad));
  bg = mix(bg, bgTop, smoothstep(0.5, 1.0, bgGrad));

  float beatBg = u_beatPulse * u_audioGain * 0.06;
  bg += u_glowColor * beatBg * (0.3 + 0.7 * bgGrad);

  float starField = 0.0;
  vec2 starUV = uv * 15.0;
  vec2 starId = floor(starUV);
  vec2 starF = fract(starUV) - 0.5;
  float starHash = fract(sin(dot(starId, vec2(127.1, 311.7))) * 43758.5453);
  if (starHash > 0.97) {
    float starBright = (starHash - 0.97) * 33.0;
    float starDist = length(starF);
    starField = starBright * exp(-starDist * starDist * 40.0);
    starField *= 0.5 + 0.5 * sin(u_time * 2.0 + starHash * 100.0);
  }
  bg += vec3(starField * 0.3);

  if (!hit) {
    col = bg;
    float nearGlow = exp(-minDist * 4.0) * 0.15;
    col += u_glowColor * nearGlow * u_glowIntensity;
  } else {
    vec3 fogCol = mix(bg, u_glowColor * 0.08, 0.3);
    float fogAmt = 1.0 - exp(-u_fogDensity * totalDist * totalDist);
    col = mix(col, fogCol, fogAmt);

    float depthShift = clamp(totalDist / u_maxDist, 0.0, 1.0);
    col = mix(col, col * vec3(0.85, 0.9, 1.1), depthShift * 0.3);
  }

  float glowFade = clamp(glow * 0.03, 0.0, 1.0);
  col += u_glowColor * glowFade * (u_glowIntensity * 0.4 + u_beatPulse * u_audioGain * 0.25);

  vec3 acesInput = col * 0.6;
  vec3 a = acesInput * (acesInput + 0.0245786) - 0.000090537;
  vec3 b = acesInput * (0.983729 * acesInput + 0.4329510) + 0.238081;
  col = clamp(a / b, 0.0, 1.0);

  col = pow(col, vec3(0.91));

  float vig = 1.0 - dot(uv * 0.35, uv * 0.35);
  vig = clamp(vig, 0.0, 1.0);
  vig = pow(vig, 0.6);
  col *= 0.5 + 0.5 * vig;

  vec2 grainUV = vUv * u_resolution;
  float grain = fract(sin(dot(grainUV + u_time * 0.1, vec2(12.9898, 78.233))) * 43758.5453);
  grain = (grain - 0.5) * 0.02;
  col += grain;

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

  const FIXED_POS = useMemo(() => new THREE.Vector3(0, 0, 3.5), []);
  const FIXED_ROT = useMemo(() => {
    const fwd = new THREE.Vector3(0, 0, -1);
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3(1, 0, 0);
    const m = new THREE.Matrix3();
    m.set(right.x, up.x, -fwd.x, right.y, up.y, -fwd.y, right.z, up.z, -fwd.z);
    return m;
  }, []);

  const smoothed = useRef({
    bass: 0, mid: 0, treble: 0, beat: 0,
  });

  useFrame(({ clock, camera }) => {
    const m = matRef.current;
    if (!m) return;

    camera.position.copy(FIXED_POS);
    camera.quaternion.set(0, 0, 0, 1);
    camera.updateMatrixWorld();

    const s = smoothed.current;
    const lr = 0.08;
    const decay = 0.92;

    s.bass = Math.max(s.bass * decay, s.bass + (uniforms.u_bassImpact - s.bass) * lr);
    s.mid = Math.max(s.mid * decay, s.mid + (uniforms.u_midMorph - s.mid) * lr);
    s.treble = Math.max(s.treble * decay, s.treble + (uniforms.u_trebleShimmer - s.treble) * lr);
    s.beat = s.beat * 0.88 + uniforms.u_beatPulse * 0.12;

    const t = clock.getElapsedTime();
    const dpr = gl.getPixelRatio();

    m.uniforms.u_time.value = t;
    m.uniforms.u_resolution.value.set(size.width * dpr, size.height * dpr);
    m.uniforms.u_camPos.value.copy(FIXED_POS);
    m.uniforms.u_camRot.value.copy(FIXED_ROT);

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
    m.uniforms.u_sssStrength.value = uniforms.u_sssStrength;
    m.uniforms.u_iridescence.value = uniforms.u_iridescence;

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

    u_resScale: { value: 0.75 },
    u_maxSteps: { value: 80 },
    u_fractalIter: { value: 10 },
    u_maxDist: { value: 10.0 },
    u_epsilonBase: { value: 0.002 },

    u_power: { value: 8.0 },
    u_scale: { value: 1.0 },
    u_offset: { value: new THREE.Vector3(0, 0, 0) },

    u_glowIntensity: { value: 0.7 },
    u_fogDensity: { value: 0.03 },
    u_aoStrength: { value: 0.5 },
    u_shadowSoft: { value: 0.3 },
    u_sssStrength: { value: 0.6 },
    u_iridescence: { value: 0.4 },

    u_beatPulse: { value: 0 },
    u_bassImpact: { value: 0 },
    u_midMorph: { value: 0 },
    u_trebleShimmer: { value: 0 },
    u_audioGain: { value: 1.0 },

    u_colorSpeed: { value: 0.3 },
    u_saturation: { value: 1.3 },
    u_baseColor: { value: new THREE.Vector3(0.08, 0.12, 0.35) },
    u_hotColor: { value: new THREE.Vector3(1.0, 0.35, 0.08) },
    u_glowColor: { value: new THREE.Vector3(0.3, 0.5, 1.0) },
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
    { key: "u_scale", label: "Zoom", type: "float", group: "Fractal", min: 0.5, max: 3.0, step: 0.01, default: 1.0, macro: true },
    { key: "u_fractalIter", label: "Iterations", type: "int", group: "Fractal", min: 3, max: 16, step: 1, default: 10 },
    { key: "u_deformAmount", label: "Deform", type: "float", group: "Fractal", min: 0, max: 1, step: 0.01, default: 0.0, macro: true },
    { key: "u_offset", label: "Offset", type: "vec3", group: "Fractal", default: [0, 0, 0] },

    { key: "u_rotateSpeed", label: "Rotate Speed", type: "float", group: "Motion", min: 0, max: 2, step: 0.01, default: 0.3, macro: true },
    { key: "u_fov", label: "FOV", type: "float", group: "Motion", min: 30, max: 120, step: 1, default: 60 },

    { key: "u_baseColor", label: "Base Color", type: "color", group: "Color", default: "#142259" },
    { key: "u_hotColor", label: "Beat Color", type: "color", group: "Color", default: "#ff5914" },
    { key: "u_glowColor", label: "Glow Color", type: "color", group: "Color", default: "#4d80ff" },
    { key: "u_colorCycle", label: "Color Cycle", type: "float", group: "Color", min: 0, max: 1, step: 0.001, default: 0, macro: true },
    { key: "u_colorSpeed", label: "Auto Cycle", type: "float", group: "Color", min: 0, max: 2, step: 0.01, default: 0.3 },
    { key: "u_saturation", label: "Saturation", type: "float", group: "Color", min: 0, max: 2, step: 0.01, default: 1.3 },
    { key: "u_iridescence", label: "Iridescence", type: "float", group: "Color", min: 0, max: 1, step: 0.01, default: 0.4, macro: true },

    { key: "u_glowIntensity", label: "Glow", type: "float", group: "Effects", min: 0, max: 2, step: 0.01, default: 0.7, macro: true },
    { key: "u_fogDensity", label: "Fog", type: "float", group: "Effects", min: 0, max: 0.15, step: 0.001, default: 0.03 },
    { key: "u_aoStrength", label: "AO Strength", type: "float", group: "Effects", min: 0, max: 3, step: 0.1, default: 0.5 },
    { key: "u_shadowSoft", label: "Shadows", type: "float", group: "Effects", min: 0, max: 1, step: 0.01, default: 0.3, macro: true },
    { key: "u_sssStrength", label: "Subsurface", type: "float", group: "Effects", min: 0, max: 2, step: 0.01, default: 0.6, macro: true },

    { key: "u_audioGain", label: "Audio Gain", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 1.0, macro: true },
    { key: "u_bassImpact", label: "Bass Impact", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.8, macro: true },
    { key: "u_midMorph", label: "Mid Morph", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.6, macro: true },
    { key: "u_trebleShimmer", label: "Treble Shimmer", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.5, macro: true },
    { key: "u_beatPulse", label: "Beat Punch", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.8 },

    { key: "u_resScale", label: "Resolution", type: "float", group: "Quality", min: 0.25, max: 1.0, step: 0.05, default: 0.75 },
    { key: "u_maxSteps", label: "Ray Steps", type: "int", group: "Quality", min: 30, max: 160, step: 5, default: 80 },
    { key: "u_maxDist", label: "Max Distance", type: "float", group: "Quality", min: 4, max: 20, step: 1, default: 10 },
    { key: "u_epsilonBase", label: "Detail", type: "float", group: "Quality", min: 0.0005, max: 0.005, step: 0.0005, default: 0.002 },
  ],

  init(_ctx: PresetContext) {},
  update() {},
  dispose() {},

  Render: MandelbulbRender,
};
