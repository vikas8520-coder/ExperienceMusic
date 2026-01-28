import * as THREE from "three";
import { useMemo, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";

export type PsyPresetName = "blueTunnel" | "bwVortex" | "rainbowSpiral" | "redMandala";

type Props = {
  preset: PsyPresetName;
  bass: number;
  mid: number;
  high: number;
  intensity?: number;
  speed?: number;
  opacity?: number;
  blending?: THREE.Blending;
};

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const frag = /* glsl */ `
precision highp float;

varying vec2 vUv;
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uIntensity;
uniform float uSpeed;
uniform float uOpacity;
uniform int uPreset;

#define PI 3.14159265359
#define TAU 6.28318530718

float sat(float x) { return clamp(x, 0.0, 1.0); }

vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(TAU * (c * t + d));
}

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
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

float fbm(vec2 p) {
  float val = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    val += amp * noise(p);
    p *= 2.0;
    amp *= 0.5;
  }
  return val;
}

vec2 rotate(vec2 p, float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c) * p;
}

float softStripes(float x, float freq, float soft) {
  float s = sin(x * freq);
  return smoothstep(-soft, soft, s) * 0.5 + 0.5;
}

float glow(float d, float intensity, float radius) {
  return intensity / (1.0 + pow(d / radius, 2.0));
}

vec3 premiumGlow(vec3 col, float amount) {
  return col + col * col * amount;
}

float vignette(float r, float inner, float outer) {
  return 1.0 - smoothstep(inner, outer, r);
}

void main() {
  vec2 uv = vUv;
  vec2 p = uv * 2.0 - 1.0;

  float intensity = uIntensity;
  float spd = uSpeed;
  
  float bass = sat(uBass) * intensity;
  float mid = sat(uMid) * intensity;
  float high = sat(uHigh) * intensity;
  float energy = (bass + mid + high) / 3.0;

  float t = uTime * spd;

  float r = length(p);
  float a = atan(p.y, p.x);

  float spin = t * (0.25 + mid * 0.8);
  float breathe = 1.0 + sin(t * 0.5) * 0.05 + bass * 0.15;
  
  float vig = vignette(r, 0.3, 1.5);
  float softVig = vignette(r, 0.0, 1.2);

  vec3 col = vec3(0.0);
  float alpha = 0.0;

  // PRESET 0: Blue Tunnel - Premium crystalline tunnel
  if (uPreset == 0) {
    vec2 q = p * breathe;
    q = rotate(q, spin * 0.4);
    float rr = length(q) + 0.001;
    float aa = atan(q.y, q.x);

    float logSpiral = aa + (2.5 + bass * 2.0) * log(rr) + t * (0.6 + bass * 1.2);
    
    float layers = 0.0;
    for (float i = 0.0; i < 3.0; i++) {
      float offset = i * 0.3;
      float freq = 8.0 + i * 4.0 + bass * 15.0;
      float stripe = softStripes(logSpiral + offset, freq, 0.3 - bass * 0.15);
      float depth = 1.0 - i * 0.25;
      layers += stripe * depth * (0.4 + high * 0.3);
    }
    
    float tunnel = sin((1.0 / (rr + 0.15)) * (3.0 + bass * 2.0) - t * (0.8 + mid));
    tunnel = smoothstep(-0.3, 0.8, tunnel);
    
    float mask = layers * tunnel;
    
    float shimmer = fbm(q * 8.0 + t * 0.3) * 0.15 * high;
    
    vec3 deepBlue = vec3(0.05, 0.15, 0.35);
    vec3 cyan = vec3(0.1, 0.6, 0.8);
    vec3 teal = vec3(0.0, 0.9, 0.7);
    vec3 white = vec3(0.95, 0.98, 1.0);
    
    float colorT = t * 0.04 + logSpiral * 0.08 + high * 0.15;
    col = mix(deepBlue, cyan, sat(sin(colorT * TAU) * 0.5 + 0.5));
    col = mix(col, teal, sat(sin(colorT * TAU + 2.0) * 0.5 + 0.5) * 0.6);
    col = mix(col, white, mask * 0.3 + shimmer);
    
    col = premiumGlow(col, 0.8 + bass * 0.5);
    col *= softVig;
    col *= 0.7 + high * 0.8;
    
    alpha = sat(mask * 0.8 + layers * 0.2) * uOpacity * vig;
  }

  // PRESET 1: BW Vortex - Premium hypnotic monochrome
  else if (uPreset == 1) {
    vec2 q = p * breathe;
    float rr = length(q);
    float aa = atan(q.y, q.x) + spin * (0.6 + mid * 0.6);

    float warp = fbm(q * 3.0 + t * 0.2) * 0.3 * intensity;
    rr += warp;
    
    float k1 = 12.0 + bass * 20.0;
    float k2 = 8.0 + high * 15.0;
    
    float f1 = sin(aa * k1 + (1.0 / (rr + 0.1)) * 5.0 - t * (1.2 + bass * 1.5));
    float f2 = sin(rr * k2 - t * (0.8 + mid));
    float f3 = sin((aa + rr * 3.0) * 6.0 - t * 0.5);
    
    float moire = f1 * 0.5 + f2 * 0.3 + f3 * 0.2;
    
    float bw = smoothstep(-0.3, 0.3, moire);
    bw = pow(bw, 0.8);
    
    float edgeGlow = glow(abs(moire), 0.15 + high * 0.1, 0.1);
    
    col = vec3(bw);
    col += vec3(edgeGlow) * (0.5 + bass * 0.5);
    
    float subtleColor = sin(t * 0.1 + rr * 2.0) * 0.03;
    col.b += subtleColor * high;
    col.r -= subtleColor * 0.5 * high;
    
    col = premiumGlow(col, 0.3);
    col *= softVig;
    
    alpha = (0.5 + bass * 0.3 + bw * 0.2) * uOpacity * vig;
  }

  // PRESET 2: Rainbow Spiral - Premium prismatic flow
  else if (uPreset == 2) {
    vec2 q = p * breathe;
    q = rotate(q, spin * 0.5);
    float rr = length(q);
    float aa = atan(q.y, q.x);

    float flow = fbm(vec2(aa * 2.0, rr * 3.0 - t * 0.5)) * 0.2;
    
    float spiral = aa + (3.0 + bass * 2.5) * log(rr + 0.01) + t * (0.7 + mid);
    spiral += flow * intensity;
    
    float layers = 0.0;
    for (float i = 0.0; i < 4.0; i++) {
      float phase = i * PI * 0.5;
      float freq = 10.0 + i * 3.0 + bass * 12.0;
      float stripe = softStripes(spiral + phase, freq, 0.25);
      layers += stripe * (1.0 - i * 0.2) * 0.3;
    }
    
    float pulse = sin((1.0 / (rr + 0.12)) * 4.0 - t * (1.5 + bass * 1.5));
    pulse = smoothstep(0.0, 0.9, pulse);
    
    float mask = layers * pulse;
    
    vec3 A = vec3(0.5, 0.5, 0.5);
    vec3 B = vec3(0.6, 0.6, 0.6);
    vec3 C = vec3(1.0, 1.0, 1.0);
    vec3 D = vec3(0.0, 0.33, 0.67);
    
    float hueShift = t * 0.06 + spiral * 0.12 + high * 0.2;
    col = palette(hueShift, A, B, C, D);
    
    vec3 highlight = vec3(1.0, 0.95, 0.9);
    col = mix(col, highlight, mask * 0.4);
    
    float sparkle = pow(hash21(q * 50.0 + t), 20.0) * high * 0.5;
    col += sparkle;
    
    col = premiumGlow(col, 0.6 + bass * 0.4);
    col *= 0.8 + high * 0.6;
    col *= softVig;
    
    alpha = sat(mask * 0.7 + layers * 0.3) * uOpacity * vig;
  }

  // PRESET 3: Red Mandala - Premium sacred geometry
  else {
    vec2 q = p * breathe;
    float rr = length(q);
    float aa = atan(q.y, q.x) + spin * (0.5 + mid * 0.8);

    float petalCount = 8.0 + floor(high * 8.0);
    float sector = TAU / petalCount;
    
    float sa = mod(aa, sector);
    sa = abs(sa - sector * 0.5);
    
    float innerRing = smoothstep(0.1, 0.15, rr) * smoothstep(0.4, 0.35, rr);
    float outerRing = smoothstep(0.35, 0.4, rr) * smoothstep(0.8, 0.7, rr);
    float rings = innerRing + outerRing * 0.7;
    
    float petals = sin(sa * petalCount * 2.0 + t * (0.5 + mid * 0.8));
    petals = petals * 0.5 + 0.5;
    petals = pow(petals, 1.5);
    
    float radialPulse = sin((1.0 / (rr + 0.1)) * 6.0 - t * (1.2 + bass * 1.5));
    radialPulse = smoothstep(0.0, 0.85, radialPulse);
    
    float fractalDetail = 0.0;
    for (float i = 1.0; i <= 3.0; i++) {
      float scale = pow(2.0, i);
      float subAngle = mod(aa * scale, sector * scale);
      subAngle = abs(subAngle - sector * scale * 0.5);
      fractalDetail += sin(subAngle * petalCount * scale + t * 0.3 * i) * (0.5 / i);
    }
    fractalDetail = sat(fractalDetail * 0.5 + 0.5);
    
    float mask = petals * radialPulse + rings * 0.5 + fractalDetail * 0.3 * high;
    
    vec3 deepRed = vec3(0.4, 0.02, 0.08);
    vec3 crimson = vec3(0.8, 0.1, 0.15);
    vec3 magenta = vec3(0.7, 0.15, 0.5);
    vec3 gold = vec3(1.0, 0.85, 0.4);
    vec3 white = vec3(1.0, 0.95, 0.92);
    
    float colorT = t * 0.05 + rr * 0.4 + high * 0.15;
    col = mix(deepRed, crimson, sat(petals));
    col = mix(col, magenta, sat(sin(aa * 3.0 + t) * 0.5 + 0.5) * 0.4);
    col = mix(col, gold, rings * 0.6 + fractalDetail * 0.3);
    col = mix(col, white, mask * 0.25);
    
    float centerGlow = glow(rr, 0.3 + bass * 0.2, 0.15);
    col += vec3(1.0, 0.6, 0.4) * centerGlow * 0.4;
    
    col = premiumGlow(col, 0.7 + bass * 0.5);
    col *= 0.75 + high * 0.7;
    col *= softVig;
    
    alpha = sat(mask * 0.6 + radialPulse * 0.2 + rings * 0.2) * uOpacity * vig;
  }

  float grain = (hash21(uv * 500.0 + t) - 0.5) * 0.02;
  col += grain;

  gl_FragColor = vec4(col, alpha);
}
`;

function presetToIndex(p: PsyPresetName): number {
  switch (p) {
    case "blueTunnel": return 0;
    case "bwVortex": return 1;
    case "rainbowSpiral": return 2;
    case "redMandala": return 3;
    default: return 0;
  }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function PsyPresetLayer({
  preset,
  bass,
  mid,
  high,
  intensity = 1.0,
  speed = 1.0,
  opacity = 0.9,
  blending = THREE.AdditiveBlending,
}: Props) {
  const geometryRef = useRef<THREE.PlaneGeometry | null>(null);
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending,
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uIntensity: { value: intensity },
        uSpeed: { value: speed },
        uOpacity: { value: opacity },
        uPreset: { value: presetToIndex(preset) },
      },
      vertexShader: vert,
      fragmentShader: frag,
    });
  }, [blending, opacity, preset, intensity, speed]);

  useEffect(() => {
    return () => {
      material.dispose();
      if (geometryRef.current) {
        geometryRef.current.dispose();
      }
    };
  }, [material]);

  useFrame((_, dt) => {
    material.uniforms.uTime.value += dt;
    material.uniforms.uBass.value = clamp01(bass);
    material.uniforms.uMid.value = clamp01(mid);
    material.uniforms.uHigh.value = clamp01(high);
    material.uniforms.uIntensity.value = Math.max(0.1, intensity);
    material.uniforms.uSpeed.value = Math.max(0.1, speed);
    material.uniforms.uOpacity.value = clamp01(opacity);
    material.uniforms.uPreset.value = presetToIndex(preset);
  });

  return (
    <mesh frustumCulled={false} renderOrder={10}>
      <planeGeometry ref={geometryRef} args={[2, 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
