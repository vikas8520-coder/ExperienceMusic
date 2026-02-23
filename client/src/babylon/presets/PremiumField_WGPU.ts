import * as BABYLON from "@babylonjs/core";
import type { BabylonPresetRuntime } from "../types";

// Babylon WGSL implementation of the Premium Field shader.
// This file is intentionally additive and does not affect the active Three.js renderer path.
export function createPremiumField(scene: unknown): BabylonPresetRuntime {
  const sphere = BABYLON.MeshBuilder.CreateSphere(
    "premiumSphere",
    { diameter: 2, segments: 64 },
    scene,
  );

  const shader = new BABYLON.ShaderMaterial(
    "premiumShader",
    scene,
    {
      vertexSource: `
struct Uniforms {
  uTime: f32,
  uBass: f32,
  uMid: f32,
  uHigh: f32,
  uRms: f32,
  uMorph: f32,
  uBeatPulse: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
};

struct VertexOutput {
  @builtin(position) Position: vec4<f32>,
  @location(0) worldPos: vec3<f32>,
  @location(1) normalW: vec3<f32>,
  @location(2) vUv: vec2<f32>,
  @location(3) fieldMask: f32,
};

@vertex
fn main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  var p = input.position;
  let breathe = 1.0 + sin(uniforms.uTime * 1.3) * 0.015 * (0.3 + uniforms.uRms);
  p *= breathe;

  // Note: this minimal scaffold writes clip-space position directly.
  // When integrating into your Babylon scene stack, replace this with full matrix transforms.
  let world = vec4<f32>(p, 1.0);

  output.Position = world;
  output.worldPos = p;
  output.normalW = normalize(input.normal);
  output.vUv = input.uv;
  output.fieldMask = 1.0;

  return output;
}
`,
      fragmentSource: `
struct Uniforms {
  uTime: f32,
  uBass: f32,
  uMid: f32,
  uHigh: f32,
  uRms: f32,
  uMorph: f32,
  uBeatPulse: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct FragmentInput {
  @location(0) worldPos: vec3<f32>,
  @location(1) normalW: vec3<f32>,
  @location(2) vUv: vec2<f32>,
  @location(3) fieldMask: f32,
};

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
  let V = normalize(-input.worldPos);
  let fres = pow(1.0 - max(dot(normalize(input.normalW), V), 0.0), 2.3);

  let polar = atan2(input.worldPos.z, input.worldPos.x);
  let lineA = sin(polar * 16.0 + uniforms.uTime * (1.0 + uniforms.uMid * 1.8));
  let lineB = sin(input.vUv.y * 140.0 - uniforms.uTime * (1.4 + uniforms.uHigh * 2.0));
  let lines = smoothstep(0.68, 1.0, abs(lineA * 0.55 + lineB * 0.45));

  let deep = vec3<f32>(0.03, 0.12, 0.20);
  let cyan = vec3<f32>(0.10, 0.75, 0.95);
  let warm = vec3<f32>(0.85, 0.70, 0.35);

  let base = mix(deep, cyan, 0.35 + 0.65 * uniforms.uRms);
  let field = mix(base, warm, clamp(uniforms.uBass * 0.7 + uniforms.uBeatPulse * 0.5, 0.0, 1.0));

  var color = field;
  color += lines * (0.22 + uniforms.uHigh * 0.5) * vec3<f32>(0.75, 0.95, 1.0);
  color += fres * (0.35 + uniforms.uMid * 0.4) * vec3<f32>(0.4, 0.8, 1.0);

  let alpha = 0.78 + 0.18 * fres + 0.08 * lines;
  return vec4<f32>(color, alpha * input.fieldMask);
}
`,
      shaderLanguage: (BABYLON as any).ShaderLanguage?.WGSL,
    },
    {
      attributes: ["position", "normal", "uv"],
      uniforms: ["uTime", "uBass", "uMid", "uHigh", "uRms", "uMorph", "uBeatPulse"],
    },
  );

  sphere.material = shader;

  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

  return {
    update(audio, _dt, blend) {
      const intensity = clamp01(blend?.intensity ?? 1);
      const morph = clamp01(blend?.morph ?? 0);
      shader.setFloat("uTime", performance.now() * 0.001);
      shader.setFloat("uBass", clamp01((audio.bass ?? 0) * intensity));
      shader.setFloat("uMid", clamp01((audio.mid ?? 0) * intensity));
      shader.setFloat("uHigh", clamp01((audio.high ?? 0) * intensity));
      shader.setFloat("uRms", clamp01((audio.energy ?? 0) * intensity));
      shader.setFloat("uMorph", morph);
      shader.setFloat("uBeatPulse", clamp01(audio.kick ?? 0));
    },
    dispose() {
      sphere.dispose();
      shader.dispose();
    },
  };
}
