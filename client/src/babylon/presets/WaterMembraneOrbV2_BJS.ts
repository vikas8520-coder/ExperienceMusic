import * as BABYLON from "@babylonjs/core";
import type { BabylonPresetRuntime } from "../types";

type AudioLike = {
  rms?: number;
  bass?: number;
  mid?: number;
  high?: number;
  beat?: number;
};

type Blend = { intensity: number; morph: number };

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function isWebGPU(scene: any) {
  const engine = scene?.getEngine?.();
  const className = typeof engine?.getClassName === "function" ? engine.getClassName() : "";
  return className === "WebGPUEngine" || !!engine?.isWebGPU;
}

export function createWaterMembraneOrbV2Preset(
  scene: unknown,
  opts?: { enableGlow?: boolean; heavyEdges?: boolean },
): BabylonPresetRuntime {
  const bjsScene = scene as any;
  const enableGlow = opts?.enableGlow ?? true;
  const heavyEdges = opts?.heavyEdges ?? true;

  const root = new BABYLON.TransformNode("waterV2Root", bjsScene);

  const prevFogMode = bjsScene.fogMode;
  const prevFogDensity = bjsScene.fogDensity;
  const prevFogColor = bjsScene.fogColor ? bjsScene.fogColor.clone() : null;

  bjsScene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  bjsScene.fogColor = new BABYLON.Color3(0.01, 0.02, 0.04);
  bjsScene.fogDensity = heavyEdges ? 0.018 : 0.012;

  const hemi = new BABYLON.HemisphericLight("waterV2Hemi", new BABYLON.Vector3(0.2, 1, 0.1), bjsScene);
  hemi.intensity = 0.55;

  const key = new BABYLON.PointLight("waterV2Key", new BABYLON.Vector3(0, 3.0, -3.2), bjsScene);
  key.intensity = 30;
  key.radius = 22;

  const rim = new BABYLON.PointLight("waterV2Rim", new BABYLON.Vector3(0, 2.0, 3.2), bjsScene);
  rim.intensity = 18;
  rim.radius = 18;
  rim.diffuse = new BABYLON.Color3(0.25, 0.75, 1.0);

  let glow: any = null;
  if (enableGlow) {
    glow = new BABYLON.GlowLayer("waterV2Glow", bjsScene, { blurKernelSize: 64 });
    glow.intensity = 0.75;
  }

  const orb = BABYLON.MeshBuilder.CreateSphere(
    "waterV2Orb",
    { diameter: 2.7, segments: 128 },
    bjsScene,
  );
  orb.parent = root;
  orb.isPickable = false;

  const core = BABYLON.MeshBuilder.CreateSphere(
    "waterV2Core",
    { diameter: 1.25, segments: 48 },
    bjsScene,
  );
  core.parent = root;
  core.isPickable = false;

  const shell = BABYLON.MeshBuilder.CreateSphere(
    "waterV2Shell",
    { diameter: 2.98, segments: 72 },
    bjsScene,
  );
  shell.parent = root;
  shell.isPickable = false;

  const mistRing = BABYLON.MeshBuilder.CreateTorus(
    "waterV2Mist",
    { diameter: 3.35, thickness: 0.14, tessellation: 160 },
    bjsScene,
  );
  mistRing.parent = root;
  mistRing.isPickable = false;
  mistRing.rotation.x = Math.PI / 2;

  const floor = BABYLON.MeshBuilder.CreateGround(
    "waterV2Floor",
    { width: 9, height: 9, subdivisions: 2 },
    bjsScene,
  );
  floor.parent = root;
  floor.isPickable = false;
  floor.position.y = -2.15;

  const SACRED_RING_COUNT = 6;
  const sacredRings: BABYLON.Mesh[] = [];
  const sacredMats: BABYLON.StandardMaterial[] = [];
  for (let i = 0; i < SACRED_RING_COUNT; i++) {
    const ring = BABYLON.MeshBuilder.CreateTorus(
      `waterV2SacredRing_${i}`,
      {
        diameter: 3.25 + i * 0.46,
        thickness: 0.03 + i * 0.004,
        tessellation: 120,
      },
      bjsScene,
    );
    ring.parent = root;
    ring.isPickable = false;
    ring.rotation.x = Math.PI / 2;
    ring.rotation.z = (i % 2 === 0 ? 1 : -1) * (0.16 + i * 0.03);

    const mat = new BABYLON.StandardMaterial(`waterV2SacredRingMat_${i}`, bjsScene);
    mat.diffuseColor = BABYLON.Color3.Black();
    mat.specularColor = BABYLON.Color3.Black();
    mat.emissiveColor = new BABYLON.Color3(0.14, 0.58, 1.1);
    mat.alpha = 0.16;
    mat.backFaceCulling = false;
    ring.material = mat;

    sacredRings.push(ring);
    sacredMats.push(mat);
  }

  function makeCirclePoints(radius: number, segments: number) {
    const points: BABYLON.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      points.push(new BABYLON.Vector3(Math.cos(t) * radius, 0, Math.sin(t) * radius));
    }
    return points;
  }

  const sigilLines: BABYLON.Vector3[][] = [];
  const sigilColors: BABYLON.Color4[][] = [];

  const sigilRadii = [0.45, 0.82, 1.22, 1.62, 2.05, 2.5];
  for (const r of sigilRadii) {
    const points = makeCirclePoints(r, 96);
    sigilLines.push(points);
    sigilColors.push(points.map(() => new BABYLON.Color4(0.28, 0.82, 1.0, 0.48)));
  }

  const starPts = 10;
  const star: BABYLON.Vector3[] = [];
  for (let i = 0; i <= starPts; i++) {
    const a = (i / starPts) * Math.PI * 2;
    const rr = i % 2 === 0 ? 2.25 : 1.05;
    star.push(new BABYLON.Vector3(Math.cos(a) * rr, 0, Math.sin(a) * rr));
  }
  sigilLines.push(star);
  sigilColors.push(star.map(() => new BABYLON.Color4(0.85, 0.42, 1.0, 0.42)));

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const p0 = new BABYLON.Vector3(Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62);
    const p1 = new BABYLON.Vector3(Math.cos(a) * 2.62, 0, Math.sin(a) * 2.62);
    sigilLines.push([p0, p1]);
    sigilColors.push([
      new BABYLON.Color4(0.35, 0.9, 1.0, 0.38),
      new BABYLON.Color4(0.55, 0.35, 1.0, 0.38),
    ]);
  }

  const sigilMesh = BABYLON.MeshBuilder.CreateLineSystem(
    "waterV2SigilLines",
    { lines: sigilLines, colors: sigilColors, updatable: false },
    bjsScene,
  );
  sigilMesh.parent = root;
  sigilMesh.isPickable = false;
  sigilMesh.position.y = floor.position.y + 0.04;
  sigilMesh.alpha = 0.34;

  const spiralA = BABYLON.MeshBuilder.CreateTorusKnot(
    "waterV2SpiralA",
    {
      radius: 1.35,
      tube: 0.05,
      radialSegments: 160,
      tubularSegments: 36,
      p: 2,
      q: 3,
    },
    bjsScene,
  );
  spiralA.parent = root;
  spiralA.isPickable = false;

  const spiralMatA = new BABYLON.StandardMaterial("waterV2SpiralMatA", bjsScene);
  spiralMatA.diffuseColor = BABYLON.Color3.Black();
  spiralMatA.specularColor = BABYLON.Color3.Black();
  spiralMatA.emissiveColor = new BABYLON.Color3(0.35, 0.95, 1.65);
  spiralMatA.alpha = 0.12;
  spiralMatA.backFaceCulling = false;
  spiralA.material = spiralMatA;

  const spiralB = BABYLON.MeshBuilder.CreateTorusKnot(
    "waterV2SpiralB",
    {
      radius: 1.72,
      tube: 0.036,
      radialSegments: 132,
      tubularSegments: 32,
      p: 3,
      q: 5,
    },
    bjsScene,
  );
  spiralB.parent = root;
  spiralB.isPickable = false;
  spiralB.rotation.x = Math.PI / 2;

  const spiralMatB = new BABYLON.StandardMaterial("waterV2SpiralMatB", bjsScene);
  spiralMatB.diffuseColor = BABYLON.Color3.Black();
  spiralMatB.specularColor = BABYLON.Color3.Black();
  spiralMatB.emissiveColor = new BABYLON.Color3(0.95, 0.38, 1.35);
  spiralMatB.alpha = 0.10;
  spiralMatB.backFaceCulling = false;
  spiralB.material = spiralMatB;

  const DROPLET_COUNT = 260;
  const dropletBase = BABYLON.MeshBuilder.CreateSphere(
    "waterV2DropletBase",
    { diameter: 0.07, segments: 6 },
    bjsScene,
  );
  dropletBase.parent = root;
  dropletBase.isPickable = false;

  const dropletMatrices = new Float32Array(DROPLET_COUNT * 16);
  dropletBase.thinInstanceSetBuffer("matrix", dropletMatrices, 16, true);

  const tmpM = new BABYLON.Matrix();
  const tmpQ = BABYLON.Quaternion.Identity();

  function setInstance(i: number, x: number, y: number, z: number, s: number) {
    BABYLON.Matrix.ComposeToRef(
      new BABYLON.Vector3(s, s, s),
      tmpQ,
      new BABYLON.Vector3(x, y, z),
      tmpM,
    );
    tmpM.copyToArray(dropletMatrices, i * 16);
  }

  for (let i = 0; i < DROPLET_COUNT; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 2.25 + Math.random() * 0.75;
    const y = (Math.random() - 0.5) * 2.6;
    const s = 0.8 + Math.random() * 1.5;
    setInstance(i, Math.cos(a) * r, y, Math.sin(a) * r, s);
  }
  dropletBase.thinInstanceBufferUpdated("matrix");

  const shellMat = new BABYLON.StandardMaterial("waterV2ShellMat", bjsScene);
  shellMat.diffuseColor = BABYLON.Color3.Black();
  shellMat.specularColor = BABYLON.Color3.Black();
  shellMat.emissiveColor = new BABYLON.Color3(0.25, 0.85, 1.55);
  shellMat.alpha = 0.0;
  shellMat.backFaceCulling = false;
  shell.material = shellMat;

  const mistMat = new BABYLON.StandardMaterial("waterV2MistMat", bjsScene);
  mistMat.diffuseColor = BABYLON.Color3.Black();
  mistMat.specularColor = BABYLON.Color3.Black();
  mistMat.emissiveColor = new BABYLON.Color3(0.15, 0.55, 1.1);
  mistMat.alpha = 0.22;
  mistMat.backFaceCulling = false;
  mistRing.material = mistMat;

  const coreMat = new BABYLON.StandardMaterial("waterV2CoreMat", bjsScene);
  coreMat.diffuseColor = new BABYLON.Color3(0.02, 0.02, 0.03);
  coreMat.specularColor = new BABYLON.Color3(0.08, 0.08, 0.10);
  coreMat.emissiveColor = new BABYLON.Color3(0.10, 0.65, 1.35);
  coreMat.alpha = 0.92;
  coreMat.backFaceCulling = false;
  coreMat.emissiveFresnelParameters = new BABYLON.FresnelParameters();
  coreMat.emissiveFresnelParameters.isEnabled = true;
  coreMat.emissiveFresnelParameters.bias = 0.06;
  coreMat.emissiveFresnelParameters.power = 2.8;
  coreMat.emissiveFresnelParameters.leftColor = new BABYLON.Color3(0.02, 0.06, 0.12);
  coreMat.emissiveFresnelParameters.rightColor = new BABYLON.Color3(0.45, 1.05, 1.65);
  core.material = coreMat;

  const dropletMat = new BABYLON.StandardMaterial("waterV2DropletMat", bjsScene);
  dropletMat.diffuseColor = BABYLON.Color3.Black();
  dropletMat.specularColor = BABYLON.Color3.Black();
  dropletMat.emissiveColor = new BABYLON.Color3(0.45, 0.95, 1.75);
  dropletMat.alpha = 0.55;
  dropletMat.backFaceCulling = false;
  dropletBase.material = dropletMat;

  const useWGSL = isWebGPU(bjsScene);
  const shaderLanguage = useWGSL
    ? (BABYLON as any).ShaderLanguage.WGSL
    : (BABYLON as any).ShaderLanguage.GLSL;

  const membraneVertWGSL = `
struct Uniforms {
  worldViewProjection : mat4x4<f32>,
  world : mat4x4<f32>,
  time : f32,
  bass : f32,
  mid : f32,
  high : f32,
  rms : f32,
  beat : f32,
  intensity : f32,
};
@group(0) @binding(0) var<uniform> u : Uniforms;

struct VSIn {
  @location(0) position : vec3<f32>,
  @location(1) normal : vec3<f32>,
};
struct VSOut {
  @builtin(position) position : vec4<f32>,
  @location(0) wpos : vec3<f32>,
  @location(1) wnor : vec3<f32>,
};

fn hash(p: vec3<f32>) -> f32 {
  let h = dot(p, vec3<f32>(127.1, 311.7, 74.7));
  return fract(sin(h) * 43758.5453123);
}
fn noise(p: vec3<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u2 = f*f*(3.0 - 2.0*f);
  let a = hash(i + vec3<f32>(0.0, 0.0, 0.0));
  let b = hash(i + vec3<f32>(1.0, 0.0, 0.0));
  let c = hash(i + vec3<f32>(0.0, 1.0, 0.0));
  let d = hash(i + vec3<f32>(1.0, 1.0, 0.0));
  let e = hash(i + vec3<f32>(0.0, 0.0, 1.0));
  let f1 = hash(i + vec3<f32>(1.0, 0.0, 1.0));
  let g = hash(i + vec3<f32>(0.0, 1.0, 1.0));
  let h = hash(i + vec3<f32>(1.0, 1.0, 1.0));
  let x1 = mix(a, b, u2.x);
  let x2 = mix(c, d, u2.x);
  let y1 = mix(x1, x2, u2.y);
  let x3 = mix(e, f1, u2.x);
  let x4 = mix(g, h, u2.x);
  let y2 = mix(x3, x4, u2.y);
  return mix(y1, y2, u2.z);
}

@vertex
fn main(input: VSIn) -> VSOut {
  var out: VSOut;
  let n = normalize(input.normal);
  let p = input.position;

  let t = u.time;
  let env = u.rms * 0.65 + u.bass * 0.55 + u.beat * 0.45;
  let ripA = sin((p.x*6.0 + p.z*5.0) + t*1.6) * (0.05 + 0.10*u.bass);
  let ripB = sin((p.y*7.0 + p.x*4.0) - t*(1.25 + 0.8*u.mid)) * (0.03 + 0.08*u.mid);
  let nn = noise(p*2.2 + vec3<f32>(t*0.22, t*0.17, t*0.19));
  let skin = (nn - 0.5) * (0.08 + 0.18*env);
  let beatPush = sin(t*10.0) * 0.01 * (0.35 + 0.65*u.beat);
  let disp = (ripA + ripB + skin + beatPush) * (0.65 + 0.65*u.intensity);
  let p2 = p + n * disp;

  let w = u.world * vec4<f32>(p2, 1.0);
  out.wpos = w.xyz;
  out.wnor = normalize((u.world * vec4<f32>(n, 0.0)).xyz);
  out.position = u.worldViewProjection * vec4<f32>(p2, 1.0);
  return out;
}
`;

  const membraneFragWGSL = `
struct Uniforms {
  worldViewProjection : mat4x4<f32>,
  world : mat4x4<f32>,
  time : f32,
  bass : f32,
  mid : f32,
  high : f32,
  rms : f32,
  beat : f32,
  intensity : f32,
};
@group(0) @binding(0) var<uniform> u : Uniforms;

struct FSIn {
  @location(0) wpos : vec3<f32>,
  @location(1) wnor : vec3<f32>,
};

fn saturate(x: f32) -> f32 { return clamp(x, 0.0, 1.0); }

@fragment
fn main(input: FSIn) -> @location(0) vec4<f32> {
  let n = normalize(input.wnor);
  let V = normalize(vec3<f32>(0.0, 0.0, -6.0) - input.wpos);
  let fres = pow(1.0 - saturate(dot(n, V)), 2.6);

  let deep = vec3<f32>(0.02, 0.08, 0.14);
  let cyan = vec3<f32>(0.08, 0.78, 1.00);
  let mag = vec3<f32>(0.95, 0.25, 0.95);
  let gold = vec3<f32>(0.98, 0.82, 0.25);

  let env = saturate(u.rms*0.65 + u.bass*0.55 + u.beat*0.55);
  let shimmer = saturate(u.high*0.9 + u.mid*0.35);
  let chroma = 0.02 + 0.06 * shimmer;

  let colBase = mix(deep, cyan, 0.30 + 0.70*env);
  let ritual = mix(mag, gold, saturate(0.35 + 0.65*sin(u.time*0.6 + input.wpos.y*1.2)));
  var col = mix(colBase, ritual, 0.08 + 0.16*shimmer);
  col += fres * (0.35 + 0.55*shimmer) * vec3<f32>(0.35, 0.85, 1.2);

  let r = col.x + fres * chroma;
  let g = col.y;
  let b = col.z + fres * chroma * 0.6;
  let alpha = 0.72 + 0.18*fres + 0.08*env;
  return vec4<f32>(r, g, b, alpha);
}
`;

  const membraneVertGLSL = `
precision highp float;
uniform mat4 worldViewProjection;
uniform mat4 world;
uniform float time, bass, mid, high, rms, beat, intensity;
attribute vec3 position;
attribute vec3 normal;
varying vec3 vWPos;
varying vec3 vWNor;

float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453123); }
float noise(vec3 p){
  vec3 i = floor(p), f = fract(p);
  vec3 u = f*f*(3.0-2.0*f);
  float a = hash(i+vec3(0,0,0));
  float b = hash(i+vec3(1,0,0));
  float c = hash(i+vec3(0,1,0));
  float d = hash(i+vec3(1,1,0));
  float e = hash(i+vec3(0,0,1));
  float f1= hash(i+vec3(1,0,1));
  float g = hash(i+vec3(0,1,1));
  float h = hash(i+vec3(1,1,1));
  float x1 = mix(a,b,u.x);
  float x2 = mix(c,d,u.x);
  float y1 = mix(x1,x2,u.y);
  float x3 = mix(e,f1,u.x);
  float x4 = mix(g,h,u.x);
  float y2 = mix(x3,x4,u.y);
  return mix(y1,y2,u.z);
}

void main(){
  vec3 n = normalize(normal);
  vec3 p = position;
  float env = clamp(rms*0.65 + bass*0.55 + beat*0.45, 0.0, 1.0);
  float ripA = sin((p.x*6.0 + p.z*5.0) + time*1.6) * (0.05 + 0.10*bass);
  float ripB = sin((p.y*7.0 + p.x*4.0) - time*(1.25 + 0.8*mid)) * (0.03 + 0.08*mid);
  float nn = noise(p*2.2 + vec3(time*0.22, time*0.17, time*0.19));
  float skin = (nn - 0.5) * (0.08 + 0.18*env);
  float beatPush = sin(time*10.0) * 0.01 * (0.35 + 0.65*beat);
  float disp = (ripA + ripB + skin + beatPush) * (0.65 + 0.65*intensity);
  vec3 p2 = p + n * disp;
  vec4 w = world * vec4(p2, 1.0);
  vWPos = w.xyz;
  vWNor = normalize((world * vec4(n, 0.0)).xyz);
  gl_Position = worldViewProjection * vec4(p2, 1.0);
}
`;

  const membraneFragGLSL = `
precision highp float;
uniform float time, bass, mid, high, rms, beat, intensity;
varying vec3 vWPos;
varying vec3 vWNor;
float sat(float x){ return clamp(x, 0.0, 1.0); }

void main(){
  vec3 n = normalize(vWNor);
  vec3 V = normalize(vec3(0.0, 0.0, -6.0) - vWPos);
  float fres = pow(1.0 - sat(dot(n,V)), 2.6);
  vec3 deep = vec3(0.02, 0.08, 0.14);
  vec3 cyan = vec3(0.08, 0.78, 1.00);
  vec3 mag  = vec3(0.95, 0.25, 0.95);
  vec3 gold = vec3(0.98, 0.82, 0.25);
  float env = sat(rms*0.65 + bass*0.55 + beat*0.55);
  float shimmer = sat(high*0.9 + mid*0.35);
  float chroma = 0.02 + 0.06 * shimmer;
  vec3 colBase = mix(deep, cyan, 0.30 + 0.70*env);
  vec3 ritual = mix(mag, gold, sat(0.35 + 0.65*sin(time*0.6 + vWPos.y*1.2)));
  vec3 col = mix(colBase, ritual, 0.08 + 0.16*shimmer);
  col += fres * (0.35 + 0.55*shimmer) * vec3(0.35, 0.85, 1.2);
  float r = col.r + fres * chroma;
  float g = col.g;
  float b = col.b + fres * chroma * 0.6;
  float alpha = 0.72 + 0.18*fres + 0.08*env;
  gl_FragColor = vec4(r,g,b,alpha);
}
`;

  const membraneMat = new BABYLON.ShaderMaterial(
    "waterV2MembraneMat",
    bjsScene,
    {
      vertexSource: useWGSL ? membraneVertWGSL : membraneVertGLSL,
      fragmentSource: useWGSL ? membraneFragWGSL : membraneFragGLSL,
      shaderLanguage,
    } as any,
    {
      attributes: ["position", "normal"],
      uniforms: ["worldViewProjection", "world", "time", "bass", "mid", "high", "rms", "beat", "intensity"],
      needAlphaBlending: true,
    },
  );
  membraneMat.alphaMode = BABYLON.Constants.ALPHA_COMBINE;
  orb.material = membraneMat;

  const causticsVertWGSL = `
struct Uniforms {
  worldViewProjection : mat4x4<f32>,
  time : f32,
  bass : f32,
  mid : f32,
  high : f32,
  rms : f32,
  beat : f32,
};
@group(0) @binding(0) var<uniform> u : Uniforms;

struct VSIn {
  @location(0) position : vec3<f32>;
  @location(1) normal : vec3<f32>;
  @location(2) uv : vec2<f32>;
};
struct VSOut {
  @builtin(position) position : vec4<f32>;
  @location(0) uv : vec2<f32>;
};

@vertex
fn main(input: VSIn) -> VSOut {
  var out: VSOut;
  out.uv = input.uv;
  out.position = u.worldViewProjection * vec4<f32>(input.position, 1.0);
  return out;
}
`;

  const causticsFragWGSL = `
struct Uniforms {
  worldViewProjection : mat4x4<f32>,
  time : f32,
  bass : f32,
  mid : f32,
  high : f32,
  rms : f32,
  beat : f32,
};
@group(0) @binding(0) var<uniform> u : Uniforms;

fn sat(x: f32)->f32 { return clamp(x,0.0,1.0); }

@fragment
fn main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  let t = u.time;
  let env = sat(u.rms*0.6 + u.bass*0.55 + u.beat*0.5);
  let shimmer = sat(u.high*0.9 + u.mid*0.35);
  var p = (uv - vec2<f32>(0.5)) * (3.2 + 1.2*env);
  p += vec2<f32>(sin(t*0.12), cos(t*0.10)) * 0.35;
  let a = sin(p.x*3.1 + t*1.1) + sin(p.y*2.7 - t*1.3);
  let b = sin((p.x+p.y)*2.4 + t*0.9) + cos((p.x-p.y)*2.2 - t*1.0);
  let c = sin(a*1.2 + b*1.1);
  let k = pow(sat(c*0.5 + 0.5), 2.2);
  let base = vec3<f32>(0.02, 0.06, 0.10);
  let ca = vec3<f32>(0.12, 0.85, 1.05);
  let ritual = vec3<f32>(0.75, 0.20, 0.85);
  var col = base + ca * k * (0.35 + 0.85*env);
  col = mix(col, col + ritual * (0.18 * shimmer), 0.35*shimmer);
  let d = length(uv - vec2<f32>(0.5));
  let vign = sat(1.0 - smoothstep(0.35, 0.55, d));
  col *= (0.35 + 0.65*vign);
  return vec4<f32>(col, 0.85);
}
`;

  const causticsVertGLSL = `
precision highp float;
uniform mat4 worldViewProjection;
attribute vec3 position;
attribute vec2 uv;
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = worldViewProjection * vec4(position,1.0);
}
`;

  const causticsFragGLSL = `
precision highp float;
uniform float time, bass, mid, high, rms, beat;
varying vec2 vUv;
float sat(float x){ return clamp(x,0.0,1.0); }
void main(){
  float env = sat(rms*0.6 + bass*0.55 + beat*0.5);
  float shimmer = sat(high*0.9 + mid*0.35);
  vec2 p = (vUv - 0.5) * (3.2 + 1.2*env);
  p += vec2(sin(time*0.12), cos(time*0.10)) * 0.35;
  float a = sin(p.x*3.1 + time*1.1) + sin(p.y*2.7 - time*1.3);
  float b = sin((p.x+p.y)*2.4 + time*0.9) + cos((p.x-p.y)*2.2 - time*1.0);
  float c = sin(a*1.2 + b*1.1);
  float k = pow(sat(c*0.5 + 0.5), 2.2);
  vec3 base = vec3(0.02, 0.06, 0.10);
  vec3 ca = vec3(0.12, 0.85, 1.05);
  vec3 ritual = vec3(0.75, 0.20, 0.85);
  vec3 col = base + ca * k * (0.35 + 0.85*env);
  col = mix(col, col + ritual * (0.18*shimmer), 0.35*shimmer);
  float d = length(vUv - 0.5);
  float vign = sat(1.0 - smoothstep(0.35, 0.55, d));
  col *= (0.35 + 0.65*vign);
  gl_FragColor = vec4(col, 0.85);
}
`;

  const causticsMat = new BABYLON.ShaderMaterial(
    "waterV2CausticsMat",
    bjsScene,
    {
      vertexSource: useWGSL ? causticsVertWGSL : causticsVertGLSL,
      fragmentSource: useWGSL ? causticsFragWGSL : causticsFragGLSL,
      shaderLanguage,
    } as any,
    {
      attributes: ["position", "normal", "uv"],
      uniforms: ["worldViewProjection", "time", "bass", "mid", "high", "rms", "beat"],
      needAlphaBlending: true,
    },
  );
  causticsMat.alphaMode = BABYLON.Constants.ALPHA_COMBINE;
  floor.material = causticsMat;

  let time = 0;
  let shock = 0;
  let prevBeat = 0;

  const cam0 = bjsScene.activeCamera;
  const arc = cam0 && cam0 instanceof (BABYLON as any).ArcRotateCamera ? cam0 : null;
  const baseAlpha = arc ? arc.alpha : 0;
  const baseBeta = arc ? arc.beta : 0;
  const baseRadius = arc ? arc.radius : 0;
  const baseTarget = arc ? arc.target.clone() : new BABYLON.Vector3(0, 0, 0);

  return {
    update(audio: AudioLike, dt: number, blend: Blend) {
      const dtc = Math.max(1 / 240, Math.min(1 / 20, dt || 1 / 60));
      time += dtc;

      const intensity = clamp01(blend.intensity);
      const rms = clamp01(audio.rms ?? 0);
      const bass = clamp01(audio.bass ?? 0);
      const mid = clamp01(audio.mid ?? 0);
      const high = clamp01(audio.high ?? 0);
      const beat = clamp01(audio.beat ?? 0);
      const env = clamp01(rms * 0.55 + bass * 0.35 + beat * 0.45);

      if (beat > 0.65 && prevBeat <= 0.65) shock = 1.0;
      prevBeat = beat;
      shock *= Math.exp(-4.2 * dtc);

      shell.scaling.setAll(1 + shock * 0.85);
      shellMat.alpha = shock * (0.55 + 0.25 * high);

      mistRing.scaling.setAll(1 + 0.18 * shock + 0.08 * Math.sin(time * 0.9) * (0.35 + rms));
      mistRing.rotation.z = Math.sin(time * 0.35) * 0.12;
      mistMat.alpha = 0.16 + 0.35 * rms + 0.25 * shock;
      mistMat.emissiveColor = new BABYLON.Color3(
        0.12 + 0.22 * shock,
        0.50 + 0.55 * rms,
        1.00 + 0.75 * high,
      );

      const corePulse = 1 + 0.10 * Math.sin(time * (1.2 + 1.8 * mid)) + 0.12 * rms + 0.10 * shock;
      core.scaling.setAll(corePulse);
      coreMat.emissiveColor = new BABYLON.Color3(
        0.10 + 0.35 * bass + 0.18 * shock,
        0.55 + 0.75 * rms,
        1.05 + 0.95 * high + 0.25 * shock,
      );
      coreMat.alpha = 0.70 + 0.22 * rms;

      for (let i = 0; i < sacredRings.length; i++) {
        const t = i / Math.max(1, sacredRings.length - 1);
        const ring = sacredRings[i];
        const mat = sacredMats[i];
        const wave = Math.sin(time * (0.75 + 0.35 * t) + i * 0.8);
        const ringEnv = 0.15 + 0.85 * env;

        ring.scaling.setAll(1.0 + 0.03 * wave + 0.1 * shock * (1 - t));
        ring.rotation.y += dtc * (0.08 + 0.35 * mid + 0.28 * high) * (1 + t);
        ring.rotation.x = Math.PI / 2 + Math.sin(time * 0.2 + i) * (0.02 + 0.05 * high);

        mat.alpha = 0.10 + 0.22 * ringEnv * (1 - t * 0.35);
        mat.emissiveColor = new BABYLON.Color3(
          0.14 + 0.35 * (high + shock) * (1 - 0.22 * t),
          0.45 + 0.55 * rms,
          1.0 + 0.85 * env + 0.35 * shock,
        );
      }

      sigilMesh.rotation.y += dtc * (0.08 + 0.3 * mid);
      sigilMesh.rotation.z = Math.sin(time * 0.22) * 0.04;
      sigilMesh.alpha = 0.14 + 0.22 * env + 0.18 * high;

      spiralA.scaling.setAll(1.0 + 0.55 * shock + 0.08 * env);
      spiralA.rotation.y += dtc * (0.35 + 0.9 * mid + 0.7 * high);
      spiralA.rotation.x = Math.sin(time * 0.26) * 0.2;
      spiralMatA.alpha = 0.08 + 0.35 * shock + 0.12 * high;
      spiralMatA.emissiveColor = new BABYLON.Color3(
        0.32 + 0.58 * (shock + high),
        0.82 + 0.45 * rms,
        1.45 + 0.72 * env,
      );

      spiralB.scaling.setAll(1.0 + 0.42 * shock + 0.06 * env);
      spiralB.rotation.z += dtc * (0.25 + 0.7 * high);
      spiralB.rotation.y -= dtc * (0.3 + 0.65 * mid);
      spiralMatB.alpha = 0.06 + 0.28 * shock + 0.14 * high;
      spiralMatB.emissiveColor = new BABYLON.Color3(
        0.62 + 0.45 * high + 0.35 * shock,
        0.28 + 0.35 * env,
        1.05 + 0.65 * rms + 0.45 * shock,
      );

      membraneMat.setFloat("time", time);
      membraneMat.setFloat("bass", bass);
      membraneMat.setFloat("mid", mid);
      membraneMat.setFloat("high", high);
      membraneMat.setFloat("rms", rms);
      membraneMat.setFloat("beat", beat);
      membraneMat.setFloat("intensity", intensity);

      causticsMat.setFloat("time", time);
      causticsMat.setFloat("bass", bass);
      causticsMat.setFloat("mid", mid);
      causticsMat.setFloat("high", high);
      causticsMat.setFloat("rms", rms);
      causticsMat.setFloat("beat", beat);

      const dropletGlow = 0.55 + 0.55 * rms + 0.65 * high + 0.35 * shock;
      dropletMat.emissiveColor = new BABYLON.Color3(
        0.35 + 0.35 * shock,
        0.75 + 0.55 * rms,
        1.25 + 0.85 * high,
      );
      dropletMat.alpha = 0.40 + 0.25 * dropletGlow;

      for (let i = 0; i < DROPLET_COUNT; i++) {
        const a = time * (0.45 + 1.0 * high) + i * 0.73;
        const r = 2.3 + 0.55 * Math.sin(time * 0.8 + i) + 0.25 * shock;
        const y = Math.sin(time * 1.25 + i * 0.37) * (1.1 + 0.35 * rms);
        const s = (0.75 + 0.55 * Math.sin(i * 0.2 + time)) * (0.85 + 0.65 * shock);
        setInstance(i, Math.cos(a) * r, y, Math.sin(a) * r, s);
      }
      dropletBase.thinInstanceBufferUpdated("matrix");

      root.rotation.y += dtc * (0.18 + 0.45 * mid);
      root.rotation.x = Math.sin(time * 0.22) * 0.05;
      root.rotation.z = Math.cos(time * 0.18) * 0.04;

      if (arc) {
        const orbit = 0.05 + 0.08 * mid + 0.05 * rms;
        arc.alpha = baseAlpha + time * orbit;
        arc.beta = baseBeta + Math.sin(time * 0.28) * 0.04 + 0.02 * high;
        arc.radius = baseRadius * (0.92 + 0.08 * (1 + 0.18 * rms));
        arc.target = BABYLON.Vector3.Lerp(baseTarget, new BABYLON.Vector3(0, 0, 0), 0.2);
      }

      if (glow) glow.intensity = 0.65 + 0.65 * rms + 0.55 * high + 0.35 * shock;
      bjsScene.fogDensity = (heavyEdges ? 0.018 : 0.012) + 0.018 * (0.55 * rms + 0.65 * shock);
    },

    dispose() {
      bjsScene.fogMode = prevFogMode;
      bjsScene.fogDensity = prevFogDensity;
      if (prevFogColor) bjsScene.fogColor = prevFogColor;

      glow?.dispose();

      dropletBase.dispose(false, true);
      dropletMat.dispose(true, true);

      sacredRings.forEach((m) => m.dispose(false, true));
      sacredMats.forEach((m) => m.dispose(true, true));

      sigilMesh.dispose(false, true);

      spiralA.dispose(false, true);
      spiralMatA.dispose(true, true);
      spiralB.dispose(false, true);
      spiralMatB.dispose(true, true);

      floor.dispose(false, true);
      causticsMat.dispose(true, true);

      mistRing.dispose(false, true);
      mistMat.dispose(true, true);

      shell.dispose(false, true);
      shellMat.dispose(true, true);

      core.dispose(false, true);
      coreMat.dispose(true, true);

      orb.dispose(false, true);
      membraneMat.dispose(true, true);

      hemi.dispose();
      key.dispose();
      rim.dispose();

      root.dispose();
    },
  };
}
