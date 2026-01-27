import * as THREE from "three";
import { useMemo, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";

export type PsyPresetName = "blueTunnel" | "bwVortex" | "rainbowSpiral" | "redMandala";

type Props = {
  preset: PsyPresetName;
  bass: number;
  mid: number;
  high: number;
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
uniform float uOpacity;
uniform int uPreset;

float sat(float x) { return clamp(x, 0.0, 1.0); }

vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  return a + b * cos(6.28318530718 * (c * t + d));
}

float hash21(vec2 p){
  p = fract(p*vec2(123.34, 456.21));
  p += dot(p, p+45.32);
  return fract(p.x*p.y);
}

float stripes(float x, float freq, float sharp){
  float s = sin(x * freq);
  float a = abs(s);
  return smoothstep(sharp, 1.0, a);
}

vec2 rotate(vec2 p, float a){
  float c = cos(a), s = sin(a);
  return mat2(c,-s,s,c) * p;
}

void main() {
  vec2 uv = vUv;
  vec2 p = uv * 2.0 - 1.0;

  float bass = sat(uBass);
  float mid  = sat(uMid);
  float high = sat(uHigh);

  float t = uTime;

  p.x *= 1.0;

  float r = length(p);
  float a = atan(p.y, p.x);

  float spin = t * (0.35 + mid * 1.2);
  float zoom = 1.0 + bass * 1.2;

  float vig = smoothstep(1.4, 0.1, r);

  vec3 col = vec3(0.0);
  float alpha = 0.0;

  // PRESET 0: blueTunnel (blue/green striped tunnel)
  if (uPreset == 0) {
    vec2 q = p;
    q = rotate(q, spin * 0.35);
    float rr = length(q) + 1e-4;
    float aa = atan(q.y, q.x);

    float spiral = aa + (2.1 + bass * 2.6) * log(rr) + t * (0.8 + bass * 1.6);

    float band = stripes(spiral, 12.0 + bass * 18.0, 0.15);
    float wave = sin((1.0/(rr + 0.12)) * (2.2 + bass * 2.0) - t * (1.2 + mid));
    wave = smoothstep(-0.15, 0.95, wave);

    float m = band * wave;

    vec3 A = vec3(0.15, 0.35, 0.45);
    vec3 B = vec3(0.45, 0.55, 0.50);
    vec3 C = vec3(1.00, 1.00, 1.00);
    vec3 D = vec3(0.00, 0.18, 0.28);
    col = palette(t*0.06 + spiral*0.12 + high*0.12, A, B, C, D);

    col *= (0.55 + high * 1.1);
    col *= vig;
    alpha = m * uOpacity;
  }

  // PRESET 1: bwVortex (high-contrast black/white vortex)
  else if (uPreset == 1) {
    float rr = r * zoom;
    float aa = a + spin * (0.9 + mid*0.8);

    float k1 = 18.0 + bass * 25.0;
    float k2 = 11.0 + high * 22.0;

    float f1 = sin(aa * k1 + (1.0/(rr+0.08))*6.0 - t*(1.8 + bass*1.2));
    float f2 = sin(rr * k2 - t*(1.2 + mid));
    float moire = f1 * 0.65 + f2 * 0.45;

    float bw = step(0.0, moire);
    bw = mix(bw, sat(moire*0.75+0.5), 0.25 + high*0.35);

    col = vec3(bw);
    col *= vig;

    alpha = (0.55 + bass*0.35) * uOpacity * vig;
  }

  // PRESET 2: rainbowSpiral (multi-color spiral strips)
  else if (uPreset == 2) {
    float rr = r * (0.85 + bass*0.9);
    float aa = a + spin;

    float spiral = aa + (2.8 + bass*2.2) * log(rr + 1e-3) + t*(0.9 + mid*0.8);
    float band = stripes(spiral, 16.0 + bass*20.0, 0.12);

    float pulse = sin((1.0/(rr+0.10))*5.0 - t*(2.0 + bass*1.5));
    pulse = smoothstep(0.2, 1.0, pulse);

    float m = band * pulse;

    vec3 A = vec3(0.50, 0.50, 0.50);
    vec3 B = vec3(0.50, 0.50, 0.50);
    vec3 C = vec3(1.00, 1.00, 1.00);
    vec3 D = vec3(0.00, 0.10, 0.20);
    col = palette(t*0.10 + spiral*0.18 + high*0.25, A, B, C, D);

    col *= (0.65 + high*1.25);
    col *= vig;

    alpha = m * uOpacity;
  }

  // PRESET 3: redMandala (red/purple mandala wheel)
  else {
    float rr = r * (0.9 + bass*0.8);
    float aa = a + spin*(0.8 + mid);

    float petals = 10.0 + floor(high*10.0);
    float sector = 6.28318530718 / petals;
    float sa = mod(aa, sector);
    sa = abs(sa - sector*0.5);

    float flower = sin(sa * petals * 2.0 + t*(0.8 + mid*0.9)) * 0.5 + 0.5;
    float spokes = sin((1.0/(rr+0.12))*7.0 - t*(1.8 + bass*1.2));
    spokes = smoothstep(0.1, 1.0, spokes);

    float m = flower * spokes;

    vec3 A = vec3(0.35, 0.10, 0.25);
    vec3 B = vec3(0.65, 0.25, 0.55);
    vec3 C = vec3(1.00, 1.00, 1.00);
    vec3 D = vec3(0.15, 0.05, 0.25);
    col = palette(t*0.07 + rr*0.6 + high*0.18, A, B, C, D);

    col *= (0.55 + high*1.15);
    col *= vig;

    alpha = m * uOpacity;
  }

  gl_FragColor = vec4(col, alpha);
}
`;

function presetToIndex(p: PsyPresetName): number {
  switch (p) {
    case "blueTunnel": return 0;
    case "bwVortex": return 1;
    case "rainbowSpiral": return 2;
    case "redMandala": return 3;
  }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function PsyPresetLayer({
  preset,
  bass,
  mid,
  high,
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
        uOpacity: { value: opacity },
        uPreset: { value: presetToIndex(preset) },
      },
      vertexShader: vert,
      fragmentShader: frag,
    });
  }, [blending, opacity, preset]);

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
