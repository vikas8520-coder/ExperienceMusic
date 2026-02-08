import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
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

uniform vec3 u_paletteA;
uniform vec3 u_paletteB;
uniform vec3 u_paletteC;
uniform float u_colorCycle;

mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

vec3 palette(float t) {
  t = fract(t + u_colorCycle);
  vec3 a = mix(u_paletteA, u_paletteB, smoothstep(0.0, 0.5, t));
  vec3 b = mix(u_paletteB, u_paletteC, smoothstep(0.5, 1.0, t));
  return mix(a, b, step(0.5, t));
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  uv.x *= u_resolution.x / u_resolution.y;

  float zoomPunch = 1.0 + (u_bassImpact * u_audioGain) * 0.25;
  float morph = (u_midMorph * u_audioGain) * 0.15;
  float shimmer = (u_trebleShimmer * u_audioGain) * 0.15;

  uv = rot(u_rotation + u_time * 0.02 * morph) * uv;
  vec2 c = u_center + uv / (u_zoom * zoomPunch);

  vec2 z = vec2(0.0);
  float it = 0.0;

  for (int i = 0; i < 2000; i++) {
    if (i >= u_iterations) break;

    vec2 z2 = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y);
    z = mix(z2, z2 + 0.15*vec2(sin(u_time), cos(u_time)), clamp(u_power-2.0, 0.0, 1.0));
    z += c;

    if (dot(z,z) > 4.0) { it = float(i); break; }
    it = float(i);
  }

  float t = it / float(u_iterations);
  t = pow(t, 0.85);

  float edge = smoothstep(0.2, 1.0, t);
  float beat = u_beatPunch * 0.35;
  vec3 col = palette(t + shimmer * sin(8.0*u_time + t*12.0));
  col += beat * edge;

  col *= smoothstep(0.02, 0.25, t);

  gl_FragColor = vec4(col, 1.0);
}
`;

function vec3FromHex(hex: string) {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
}

const MandelbrotRender: React.FC<{ uniforms: UniformValues; state: any }> = ({ uniforms }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null!);
  const { size, viewport } = useThree();

  useFrame(({ clock }) => {
    const m = matRef.current;
    if (!m) return;

    m.uniforms.u_time.value = clock.getElapsedTime();
    m.uniforms.u_resolution.value.set(size.width, size.height);

    m.uniforms.u_center.value.set(uniforms.u_center[0], uniforms.u_center[1]);
    m.uniforms.u_zoom.value = uniforms.u_zoom;
    m.uniforms.u_rotation.value = uniforms.u_rotation;
    m.uniforms.u_iterations.value = uniforms.u_iterations;
    m.uniforms.u_power.value = uniforms.u_power;

    m.uniforms.u_audioGain.value = uniforms.u_audioGain;
    m.uniforms.u_bassImpact.value = uniforms.u_bassImpact;
    m.uniforms.u_midMorph.value = uniforms.u_midMorph;
    m.uniforms.u_trebleShimmer.value = uniforms.u_trebleShimmer;
    m.uniforms.u_beatPunch.value = uniforms.u_beatPunch;

    const pa = vec3FromHex(uniforms.u_paletteA);
    const pb = vec3FromHex(uniforms.u_paletteB);
    const pc = vec3FromHex(uniforms.u_paletteC);
    m.uniforms.u_paletteA.value.copy(pa);
    m.uniforms.u_paletteB.value.copy(pb);
    m.uniforms.u_paletteC.value.copy(pc);
    m.uniforms.u_colorCycle.value = uniforms.u_colorCycle;
  });

  return (
    <mesh position={[0, 0, 0]}>
      <planeGeometry args={[viewport.width, viewport.height]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={{
          u_resolution: { value: new THREE.Vector2(1, 1) },
          u_time: { value: 0 },
          u_center: { value: new THREE.Vector2(0, 0) },
          u_zoom: { value: 1 },
          u_rotation: { value: 0 },
          u_iterations: { value: 200 },
          u_power: { value: 2 },
          u_audioGain: { value: 1 },
          u_bassImpact: { value: 0.7 },
          u_midMorph: { value: 0.5 },
          u_trebleShimmer: { value: 0.5 },
          u_beatPunch: { value: 0.6 },
          u_paletteA: { value: new THREE.Vector3(0.2, 0.1, 0.5) },
          u_paletteB: { value: new THREE.Vector3(0.0, 0.8, 0.9) },
          u_paletteC: { value: new THREE.Vector3(1.0, 0.5, 0.1) },
          u_colorCycle: { value: 0.0 },
        }}
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
    { key: "u_center", label: "Center", type: "vec2", group: "Fractal", default: [0, 0] },
    { key: "u_zoom", label: "Zoom", type: "float", group: "Fractal", min: 0.5, max: 8, step: 0.01, default: 1.6, macro: true },
    { key: "u_rotation", label: "Rotation", type: "float", group: "Fractal", min: -3.14, max: 3.14, step: 0.001, default: 0 },
    { key: "u_iterations", label: "Iterations", type: "int", group: "Fractal", min: 50, max: 800, step: 1, default: 220 },
    { key: "u_power", label: "Power", type: "float", group: "Fractal", min: 2, max: 4, step: 0.01, default: 2.0 },

    { key: "u_paletteA", label: "Palette A", type: "color", group: "Color", default: "#2f1a86" },
    { key: "u_paletteB", label: "Palette B", type: "color", group: "Color", default: "#00d7ff" },
    { key: "u_paletteC", label: "Palette C", type: "color", group: "Color", default: "#ff7a18" },
    { key: "u_colorCycle", label: "Color Cycle", type: "float", group: "Color", min: 0, max: 1, step: 0.001, default: 0.0, macro: true },

    { key: "u_audioGain", label: "Audio Gain", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 1.0, macro: true },
    { key: "u_bassImpact", label: "Bass Impact", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.8, macro: true },
    { key: "u_midMorph", label: "Mid Morph", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.6, macro: true },
    { key: "u_trebleShimmer", label: "Treble Shimmer", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.6, macro: true },
    { key: "u_beatPunch", label: "Beat Punch", type: "float", group: "Audio", min: 0, max: 2, step: 0.01, default: 0.8 },
  ],

  init(_ctx: PresetContext) {},
  update() {},
  dispose() {},

  Render: MandelbrotRender,
};
