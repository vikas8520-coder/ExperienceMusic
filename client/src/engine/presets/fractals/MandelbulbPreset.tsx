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

uniform float u_aoStrength;
uniform float u_shadowStrength;
uniform float u_sssStrength;
uniform float u_sssRadius;
uniform float u_roughness;
uniform float u_specIntensity;
uniform float u_envReflect;
uniform float u_bounceStrength;

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
uniform float u_exposure;

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

float orbitW;
float orbitX;
float orbitY;

float mandelbulbDE(vec3 p, float power, int iterations) {
  vec3 z = p;
  float dr = 1.0;
  float r = 0.0;
  orbitW = 1e10;
  orbitX = 1e10;
  orbitY = 1e10;

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

    orbitX = min(orbitX, abs(z.x));
    orbitY = min(orbitY, abs(z.y));
    orbitW = min(orbitW, dot(z, z));
  }
  r = max(r, 1e-6);
  return 0.5 * log(r) * r / max(dr, 1e-6);
}

float map(vec3 p) {
  p = (p - u_offset) * u_scale;

  float t = u_time * u_rotateSpeed;
  float deform = u_deformAmount + u_midMorph * u_audioGain * 0.2;
  p = rotY(t * 0.08 + deform * sin(u_time * 0.4) * 0.2) * p;
  p = rotX(t * 0.05 + deform * cos(u_time * 0.3) * 0.15) * p;

  float pw = u_power
    + u_beatPulse * u_audioGain * 0.3
    + u_bassImpact * u_audioGain * 0.1
    + 0.1 * sin(u_time * 0.5);

  float breathe = 1.0 + u_bassImpact * u_audioGain * 0.025 * sin(u_time * 1.5);
  p *= breathe;

  float warp = u_trebleShimmer * u_audioGain * 0.005;
  p.x += warp * sin(p.y * 4.0 + u_time * 0.9);
  p.y += warp * cos(p.z * 4.0 + u_time * 0.7);

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
  for (int i = 1; i <= 5; i++) {
    float h = eps * 1.8 * float(i);
    float d = map(p + n * h);
    occ += (h - d) * scale;
    scale *= 0.6;
  }
  return clamp(1.0 - u_aoStrength * occ * 1.5, 0.0, 1.0);
}

float softShadow(vec3 ro, vec3 rd, float mint, float maxt) {
  float res = 1.0;
  float t = mint;
  float ph = 1e10;
  for (int i = 0; i < 16; i++) {
    float d = map(ro + rd * t);
    float y = d * d / (2.0 * ph);
    float h = sqrt(max(0.0, d * d - y * y));
    res = min(res, 10.0 * h / max(0.001, t - y));
    ph = d;
    t += clamp(d, 0.015, 0.2);
    if (res < 0.002 || t > maxt) break;
  }
  return clamp(res, 0.0, 1.0);
}

float subsurfaceScatter(vec3 p, vec3 lightDir, vec3 n, float eps) {
  float scatter = 0.0;
  float weight = 1.0;
  vec3 sampleDir = normalize(lightDir + n * 0.3);
  for (int i = 1; i <= 5; i++) {
    float h = u_sssRadius * eps * float(i) * 2.5;
    float d = map(p + sampleDir * h);
    scatter += weight * max(0.0, h - d);
    weight *= 0.45;
  }
  float backScatter = clamp(dot(-lightDir, n) * 0.5 + 0.5, 0.0, 1.0);
  return scatter * (1.0 + backScatter * 0.5);
}

float ggxDistribution(float ndotH, float rough) {
  float a2 = rough * rough;
  a2 *= a2;
  float d = ndotH * ndotH * (a2 - 1.0) + 1.0;
  return a2 / (PI * d * d);
}

float geometrySmith(float ndotV, float ndotL, float rough) {
  float k = (rough + 1.0);
  k = k * k * 0.125;
  float gv = ndotV / (ndotV * (1.0 - k) + k);
  float gl = ndotL / (ndotL * (1.0 - k) + k);
  return gv * gl;
}

vec3 fresnelSchlick(float cosTheta, vec3 f0) {
  float t = 1.0 - cosTheta;
  float t2 = t * t;
  return f0 + (1.0 - f0) * (t2 * t2 * t);
}

vec3 envSample(vec3 rd) {
  float y = rd.y * 0.5 + 0.5;
  vec3 sky = mix(vec3(0.01, 0.012, 0.02), vec3(0.04, 0.05, 0.08), y);
  sky += vec3(0.02, 0.025, 0.04) * pow(max(0.0, rd.y), 0.5);
  return sky;
}

vec3 shade(vec3 p, vec3 rd, float hitDist, float eps) {
  vec3 n = getNormal(p, eps * 2.0);
  vec3 v = -rd;

  vec3 keyDir  = normalize(vec3(0.5, 0.9, 0.35));
  vec3 fillDir = normalize(vec3(-0.6, 0.25, -0.55));
  vec3 backDir = normalize(vec3(-0.1, 0.4, 0.9));

  vec3 keyCol  = vec3(1.0, 0.97, 0.92) * 2.2;
  vec3 fillCol = vec3(0.45, 0.55, 0.75) * 0.6;
  vec3 backCol = vec3(0.6, 0.65, 0.8) * 0.4;

  float ndotK = clamp(dot(n, keyDir), 0.0, 1.0);
  float ndotF = clamp(dot(n, fillDir), 0.0, 1.0);
  float ndotB = clamp(dot(n, backDir), 0.0, 1.0);
  float ndotV = clamp(dot(n, v), 0.001, 1.0);

  float keyShadow = softShadow(p + n * eps * 3.0, keyDir, 0.01, 6.0);
  keyShadow = mix(1.0, keyShadow, u_shadowStrength);

  float ao = calcAO(p, n, eps);

  float cycle = u_colorCycle + u_time * u_colorSpeed * 0.015;
  float trebleAccent = u_trebleShimmer * u_audioGain * 0.15;

  float ot = sqrt(orbitW) * 0.5;
  float ox = clamp(orbitX * 1.8, 0.0, 1.0);
  float oy = clamp(orbitY * 1.8, 0.0, 1.0);

  vec3 palA = iqPalette(
    ot * 0.4 + ox * 0.15 + cycle + trebleAccent * sin(u_time * 1.8 + p.x * 3.0),
    vec3(0.55, 0.5, 0.45),
    vec3(0.4, 0.35, 0.3),
    vec3(1.0, 0.8, 0.65),
    vec3(0.0 + cycle, 0.12 + cycle * 0.4, 0.28 + cycle * 0.25)
  );

  vec3 palB = iqPalette(
    oy * 0.5 + ot * 0.3 + cycle * 1.2,
    vec3(0.5, 0.48, 0.45),
    vec3(0.35, 0.3, 0.28),
    vec3(0.9, 0.7, 0.5),
    vec3(0.2 + cycle, 0.4, 0.55)
  );

  float height = dot(n, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5;
  vec3 surfColor = mix(palA, palB, height * 0.4 + ox * 0.3 + 0.15);

  vec3 baseCol = mix(u_baseColor, u_hotColor, u_beatPulse * u_audioGain * 0.5);
  vec3 albedo = mix(baseCol, surfColor, 0.7 + ox * 0.15);
  albedo = clamp(albedo, 0.0, 1.0);

  vec3 f0 = vec3(0.04);
  float metalness = clamp(0.02 + ox * 0.03, 0.0, 0.1);
  f0 = mix(f0, albedo, metalness);

  float rough = u_roughness;

  vec3 hK = normalize(keyDir + v);
  float ndotHK = clamp(dot(n, hK), 0.0, 1.0);
  float D_key = ggxDistribution(ndotHK, rough);
  float G_key = geometrySmith(ndotV, ndotK, rough);
  vec3 F_key = fresnelSchlick(clamp(dot(hK, v), 0.0, 1.0), f0);
  vec3 specKey = D_key * G_key * F_key / max(4.0 * ndotV * ndotK, 0.001);

  vec3 kd = (1.0 - F_key) * (1.0 - metalness);

  vec3 keyDiffuse = kd * albedo / PI * ndotK * keyCol * keyShadow;
  vec3 keySpec = specKey * ndotK * keyCol * keyShadow * u_specIntensity;

  vec3 fillDiffuse = (1.0 - metalness) * albedo / PI * ndotF * fillCol;
  vec3 backDiffuse = (1.0 - metalness) * albedo / PI * ndotB * backCol;

  float sss = subsurfaceScatter(p, keyDir, n, eps);
  float sssFill = subsurfaceScatter(p, fillDir, n, eps);
  vec3 sssColor = albedo * 1.2 + u_glowColor * 0.15;
  vec3 sssLit = sssColor * (sss * 0.5 + sssFill * 0.2) * u_sssStrength;
  sssLit *= mix(keyCol * 0.4, fillCol * 0.3, 0.5);

  vec3 reflDir = reflect(-v, n);
  vec3 envCol = envSample(reflDir);
  vec3 envFresnel = fresnelSchlick(ndotV, f0);
  vec3 envLit = envCol * envFresnel * u_envReflect;

  vec3 bounceDir = normalize(vec3(0.0, -1.0, 0.0));
  float bounceDot = clamp(dot(n, -bounceDir), 0.0, 1.0);
  vec3 bounceCol = albedo * vec3(0.3, 0.25, 0.2);
  vec3 bounceLit = bounceCol * bounceDot * u_bounceStrength * 0.3;

  vec3 ambient = albedo * vec3(0.06, 0.065, 0.08) * ao;

  vec3 result = ambient + keyDiffuse + keySpec + fillDiffuse + backDiffuse + sssLit + envLit + bounceLit;
  result *= ao;

  float glowAmount = u_beatPulse * u_audioGain * 0.08;
  result += u_glowColor * glowAmount * ao * pow(1.0 - ndotV, 2.0) * 0.3;

  float gray = dot(result, vec3(0.2126, 0.7152, 0.0722));
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
  vec3 col = vec3(0.0);
  float prevD = 1e10;

  for (int i = 0; i < 160; i++) {
    if (i >= u_maxSteps) break;

    vec3 p = ro + rd * totalDist;
    d = map(p);

    float eps = max(5e-5, u_epsilonBase * (0.12 + 0.05 * totalDist));

    if (d < eps) {
      hit = true;
      col = shade(p, rd, totalDist, eps);
      break;
    }

    float step = d * 1.0;
    if (d < prevD * 0.5) step = d * 0.8;
    prevD = d;

    totalDist += step;
    if (totalDist > u_maxDist) break;
  }

  float bgY = uv.y * 0.5 + 0.5;
  vec3 bg = mix(
    vec3(0.008, 0.005, 0.018),
    vec3(0.025, 0.028, 0.05),
    bgY
  );

  float beatBg = u_beatPulse * u_audioGain * 0.03;
  bg += u_glowColor * beatBg * bgY * 0.5;

  if (!hit) {
    col = bg;
  } else {
    vec3 fogCol = bg * 1.2;
    float fogAmt = 1.0 - exp(-0.02 * totalDist * totalDist);
    col = mix(col, fogCol, fogAmt);
  }

  col *= u_exposure;

  vec3 x = col * 0.6;
  vec3 a = x * (x + 0.0245786) - 0.000090537;
  vec3 b = x * (0.983729 * x + 0.4329510) + 0.238081;
  col = clamp(a / b, 0.0, 1.0);

  col = pow(col, vec3(1.0 / 2.2));

  float vig = 1.0 - dot(uv * 0.3, uv * 0.3);
  vig = clamp(pow(vig, 0.5), 0.0, 1.0);
  col *= 0.6 + 0.4 * vig;

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

    m.uniforms.u_aoStrength.value = uniforms.u_aoStrength;
    m.uniforms.u_shadowStrength.value = uniforms.u_shadowStrength;
    m.uniforms.u_sssStrength.value = uniforms.u_sssStrength;
    m.uniforms.u_sssRadius.value = uniforms.u_sssRadius;
    m.uniforms.u_roughness.value = uniforms.u_roughness;
    m.uniforms.u_specIntensity.value = uniforms.u_specIntensity;
    m.uniforms.u_envReflect.value = uniforms.u_envReflect;
    m.uniforms.u_bounceStrength.value = uniforms.u_bounceStrength;

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
    m.uniforms.u_exposure.value = uniforms.u_exposure;
  });

  const initialUniforms = useMemo(() => ({
    u_resolution: { value: new THREE.Vector2(1, 1) },
    u_time: { value: 0 },
    u_camPos: { value: new THREE.Vector3(0, 0, 3.5) },
    u_camRot: { value: new THREE.Matrix3() },

    u_resScale: { value: 0.75 },
    u_maxSteps: { value: 90 },
    u_fractalIter: { value: 12 },
    u_maxDist: { value: 10.0 },
    u_epsilonBase: { value: 0.0015 },

    u_power: { value: 8.0 },
    u_scale: { value: 1.0 },
    u_offset: { value: new THREE.Vector3(0, 0, 0) },

    u_aoStrength: { value: 0.7 },
    u_shadowStrength: { value: 0.6 },
    u_sssStrength: { value: 0.5 },
    u_sssRadius: { value: 1.0 },
    u_roughness: { value: 0.4 },
    u_specIntensity: { value: 0.8 },
    u_envReflect: { value: 0.15 },
    u_bounceStrength: { value: 0.4 },

    u_beatPulse: { value: 0 },
    u_bassImpact: { value: 0 },
    u_midMorph: { value: 0 },
    u_trebleShimmer: { value: 0 },
    u_audioGain: { value: 1.0 },

    u_colorSpeed: { value: 0.2 },
    u_saturation: { value: 1.15 },
    u_baseColor: { value: new THREE.Vector3(0.15, 0.12, 0.1) },
    u_hotColor: { value: new THREE.Vector3(0.9, 0.35, 0.12) },
    u_glowColor: { value: new THREE.Vector3(0.3, 0.45, 0.7) },
    u_colorCycle: { value: 0 },

    u_deformAmount: { value: 0.0 },
    u_rotateSpeed: { value: 0.2 },
    u_fov: { value: 55.0 },
    u_exposure: { value: 1.3 },
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
    { key: "u_fractalIter", label: "Iterations", type: "int", group: "Fractal", min: 4, max: 20, step: 1, default: 12 },
    { key: "u_deformAmount", label: "Deform", type: "float", group: "Fractal", min: 0, max: 1, step: 0.01, default: 0.0, macro: true },
    { key: "u_offset", label: "Offset", type: "vec3", group: "Fractal", default: [0, 0, 0] },

    { key: "u_rotateSpeed", label: "Rotate Speed", type: "float", group: "Camera", min: 0, max: 1, step: 0.01, default: 0.2, macro: true },
    { key: "u_fov", label: "FOV", type: "float", group: "Camera", min: 30, max: 90, step: 1, default: 55 },
    { key: "u_exposure", label: "Exposure", type: "float", group: "Camera", min: 0.5, max: 3.0, step: 0.05, default: 1.3, macro: true },

    { key: "u_baseColor", label: "Base Color", type: "color", group: "Color", default: "#261e1a" },
    { key: "u_hotColor", label: "Beat Color", type: "color", group: "Color", default: "#e6591f" },
    { key: "u_glowColor", label: "Accent Color", type: "color", group: "Color", default: "#4d73b3" },
    { key: "u_colorCycle", label: "Color Cycle", type: "float", group: "Color", min: 0, max: 1, step: 0.001, default: 0, macro: true },
    { key: "u_colorSpeed", label: "Auto Cycle", type: "float", group: "Color", min: 0, max: 1, step: 0.01, default: 0.2 },
    { key: "u_saturation", label: "Saturation", type: "float", group: "Color", min: 0, max: 2, step: 0.01, default: 1.15 },

    { key: "u_roughness", label: "Roughness", type: "float", group: "Material", min: 0.1, max: 1.0, step: 0.01, default: 0.4, macro: true },
    { key: "u_specIntensity", label: "Specular", type: "float", group: "Material", min: 0, max: 2, step: 0.01, default: 0.8, macro: true },
    { key: "u_envReflect", label: "Environment", type: "float", group: "Material", min: 0, max: 1, step: 0.01, default: 0.15 },
    { key: "u_sssStrength", label: "Subsurface", type: "float", group: "Material", min: 0, max: 2, step: 0.01, default: 0.5, macro: true },
    { key: "u_sssRadius", label: "SSS Radius", type: "float", group: "Material", min: 0.2, max: 3.0, step: 0.1, default: 1.0 },

    { key: "u_aoStrength", label: "AO Strength", type: "float", group: "Lighting", min: 0, max: 2, step: 0.05, default: 0.7 },
    { key: "u_shadowStrength", label: "Shadows", type: "float", group: "Lighting", min: 0, max: 1, step: 0.01, default: 0.6, macro: true },
    { key: "u_bounceStrength", label: "Bounce Light", type: "float", group: "Lighting", min: 0, max: 2, step: 0.05, default: 0.4 },

    { key: "u_audioGain", label: "Audio Gain", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 1.0, macro: true },
    { key: "u_bassImpact", label: "Bass Impact", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.6, macro: true },
    { key: "u_midMorph", label: "Mid Morph", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.4, macro: true },
    { key: "u_trebleShimmer", label: "Treble Accent", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.3, macro: true },
    { key: "u_beatPulse", label: "Beat Punch", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.6 },

    { key: "u_resScale", label: "Resolution", type: "float", group: "Quality", min: 0.25, max: 1.0, step: 0.05, default: 0.75 },
    { key: "u_maxSteps", label: "Ray Steps", type: "int", group: "Quality", min: 40, max: 160, step: 5, default: 90 },
    { key: "u_maxDist", label: "Max Distance", type: "float", group: "Quality", min: 4, max: 20, step: 1, default: 10 },
    { key: "u_epsilonBase", label: "Detail", type: "float", group: "Quality", min: 0.0005, max: 0.005, step: 0.0005, default: 0.0015 },
  ],

  init(_ctx: PresetContext) {},
  update() {},
  dispose() {},

  Render: MandelbulbRender,
};
