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
  const e = scene.getEngine() as any;
  const n = typeof e?.getClassName === "function" ? e.getClassName() : "";
  return n === "WebGPUEngine" || !!e?.isWebGPU;
}

export function createRitualTapestryV2Preset(
  scene: unknown,
  opts?: { enableGlow?: boolean; heavyEdges?: boolean },
): BabylonPresetRuntime {
  const bjsScene = scene as any;
  const enableGlow = opts?.enableGlow ?? true;
  const heavyEdges = opts?.heavyEdges ?? true;

  const root = new BABYLON.TransformNode("ritualV2Root", bjsScene);

  // ---- Fog (dramatic edges) ----
  const prevFogMode = bjsScene.fogMode;
  const prevFogDensity = bjsScene.fogDensity;
  const prevFogColor = bjsScene.fogColor ? bjsScene.fogColor.clone() : null;

  bjsScene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  bjsScene.fogColor = new BABYLON.Color3(0.004, 0.006, 0.016);
  bjsScene.fogDensity = heavyEdges ? 0.022 : 0.013;

  // ---- Lights ----
  const hemi = new BABYLON.HemisphericLight("ritualV2Hemi", new BABYLON.Vector3(0.2, 1, 0.1), bjsScene);
  hemi.intensity = 0.22;

  const key = new BABYLON.PointLight("ritualV2Key", new BABYLON.Vector3(0, 2.6, -3.2), bjsScene);
  key.intensity = 20;
  key.radius = 20;
  key.diffuse = new BABYLON.Color3(0.15, 0.75, 1.0);

  const rim = new BABYLON.PointLight("ritualV2Rim", new BABYLON.Vector3(0, 2.2, 3.2), bjsScene);
  rim.intensity = 16;
  rim.radius = 18;
  rim.diffuse = new BABYLON.Color3(0.85, 0.25, 1.0);

  // ---- Optional Glow ----
  let glow: any = null;
  if (enableGlow) {
    glow = new BABYLON.GlowLayer("ritualV2Glow", bjsScene, { blurKernelSize: 64 });
    glow.intensity = 1.05;
  }

  // =========================
  // Planes: center tapestry + side wall tapestries
  // =========================
  const tapestry = BABYLON.MeshBuilder.CreatePlane(
    "ritualV2Tapestry",
    { width: 6.6, height: 3.8, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
    bjsScene,
  );
  tapestry.parent = root;
  tapestry.position.y = 0.25;
  tapestry.position.z = 0.0;

  const leftWall = BABYLON.MeshBuilder.CreatePlane(
    "ritualV2LeftWall",
    { width: 5.0, height: 3.9, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
    bjsScene,
  );
  leftWall.parent = root;
  leftWall.position.set(-3.85, 0.20, 0.55);
  leftWall.rotation.y = Math.PI * 0.35;

  const rightWall = BABYLON.MeshBuilder.CreatePlane(
    "ritualV2RightWall",
    { width: 5.0, height: 3.9, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
    bjsScene,
  );
  rightWall.parent = root;
  rightWall.position.set(3.85, 0.20, 0.55);
  rightWall.rotation.y = -Math.PI * 0.35;

  // Frame + Vignette overlays
  const frame = BABYLON.MeshBuilder.CreatePlane(
    "ritualV2Frame",
    { width: 6.8, height: 4.0, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
    bjsScene,
  );
  frame.parent = root;
  frame.position.set(0, 0.25, 0.02);

  const vignette = BABYLON.MeshBuilder.CreatePlane(
    "ritualV2Vignette",
    { width: 7.2, height: 4.3, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
    bjsScene,
  );
  vignette.parent = root;
  vignette.position.set(0, 0.25, 0.06);

  const frameMat = new BABYLON.StandardMaterial("ritualV2FrameMat", bjsScene);
  frameMat.diffuseColor = BABYLON.Color3.Black();
  frameMat.specularColor = BABYLON.Color3.Black();
  frameMat.emissiveColor = new BABYLON.Color3(0.02, 0.04, 0.08);
  frameMat.alpha = 0.88;
  frame.material = frameMat;

  const vigMat = new BABYLON.StandardMaterial("ritualV2VigMat", bjsScene);
  vigMat.diffuseColor = BABYLON.Color3.Black();
  vigMat.specularColor = BABYLON.Color3.Black();
  vigMat.emissiveColor = BABYLON.Color3.Black();
  vigMat.alpha = heavyEdges ? 0.28 : 0.18;
  vignette.material = vigMat;

  // Shader language
  const useWGSL = isWebGPU(bjsScene);
  const shaderLanguage = useWGSL ? BABYLON.ShaderLanguage.WGSL : BABYLON.ShaderLanguage.GLSL;

  // =========================
  // Shared Vertex
  // =========================
  const vertWGSL = /* wgsl */ `
struct U { worldViewProjection: mat4x4<f32>, time:f32, bass:f32, mid:f32, high:f32, rms:f32, beat:f32, intensity:f32, ink:f32, shock:f32 };
@group(0) @binding(0) var<uniform> u: U;

struct In { @location(0) position: vec3<f32>, @location(1) normal: vec3<f32>, @location(2) uv: vec2<f32> };
struct Out { @builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32> };

@vertex
fn main(input: In) -> Out {
  var o: Out;
  o.uv = input.uv;
  o.pos = u.worldViewProjection * vec4<f32>(input.position, 1.0);
  return o;
}
`;

  const vertGLSL = /* glsl */ `
precision highp float;
uniform mat4 worldViewProjection;
uniform float time,bass,mid,high,rms,beat,intensity,ink,shock;
attribute vec3 position;
attribute vec2 uv;
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = worldViewProjection * vec4(position,1.0);
}
`;

  // =========================
  // Main Tapestry Fragment (V2)
  // Adds:
  // - Blacklight ink fluorescence
  // - Temple/city blocks in mountains
  // - Third eye mandala pulse on beat
  // =========================
  const fragWGSL = /* wgsl */ `
struct U { worldViewProjection: mat4x4<f32>, time:f32, bass:f32, mid:f32, high:f32, rms:f32, beat:f32, intensity:f32, ink:f32, shock:f32 };
@group(0) @binding(0) var<uniform> u: U;

fn sat(x:f32)->f32{ return clamp(x,0.0,1.0); }
fn rot(p:vec2<f32>, a:f32)->vec2<f32>{ let c=cos(a); let s=sin(a); return vec2<f32>(c*p.x-s*p.y, s*p.x+c*p.y); }
fn hash(p:vec2<f32>)->f32{ return fract(sin(dot(p, vec2<f32>(127.1,311.7))) * 43758.5453123); }
fn noise(p:vec2<f32>)->f32{
  let i=floor(p); let f=fract(p);
  let u2=f*f*(3.0-2.0*f);
  let a=hash(i+vec2<f32>(0.0,0.0));
  let b=hash(i+vec2<f32>(1.0,0.0));
  let c=hash(i+vec2<f32>(0.0,1.0));
  let d=hash(i+vec2<f32>(1.0,1.0));
  return mix(mix(a,b,u2.x), mix(c,d,u2.x), u2.y);
}
fn fbm(p:vec2<f32>)->f32{
  var v=0.0; var a=0.5; var pp=p;
  for(var i=0;i<6;i=i+1){
    v += a*noise(pp);
    pp = pp*2.0 + vec2<f32>(19.0, 37.0);
    a *= 0.5;
  }
  return v;
}
fn sdCircle(p:vec2<f32>, r:f32)->f32{ return length(p)-r; }
fn sdBox(p:vec2<f32>, b:vec2<f32>)->f32{
  let d = abs(p)-b;
  return length(max(d, vec2<f32>(0.0))) + min(max(d.x,d.y), 0.0);
}
fn deity(p:vec2<f32>)->f32{
  let head = sdCircle(p-vec2<f32>(0.0,0.36), 0.12);
  let torso= sdBox(p-vec2<f32>(0.0,0.12), vec2<f32>(0.16,0.22));
  let base = sdBox(p-vec2<f32>(0.0,-0.22), vec2<f32>(0.32,0.12));
  let k=0.10;
  let u1 = -log(exp(-k*head)+exp(-k*torso))/k;
  let u2 = -log(exp(-k*u1)+exp(-k*base))/k;
  return u2;
}
fn mandala(p:vec2<f32>, t:f32, spokeCount:f32, ringCount:f32)->f32{
  let r=length(p);
  let a=atan2(p.y,p.x);
  let spokes=abs(sin(a*spokeCount + t*0.4));
  let rings=abs(sin(r*ringCount - t*0.9));
  let glyph=smoothstep(0.86,1.0,spokes)*smoothstep(0.62,1.0,rings);
  let fil=abs(sin((p.x*6.0+p.y*5.0)+t*0.6)*cos((p.x*5.0-p.y*7.0)-t*0.55));
  glyph += 0.55*smoothstep(0.75,1.0,fil)*smoothstep(0.20,0.0,r);
  return glyph;
}

// Temple/city blocks inside mountain region (procedural rectangles)
fn templeBlocks(uv:vec2<f32>, t:f32)->f32{
  // consider only top half
  if (uv.y < 0.56) { return 0.0; }
  let y = (uv.y - 0.56) / 0.44; // 0..1
  let x = uv.x;

  // block grid
  let gx = floor(x * 22.0);
  let gy = floor(y * 12.0);
  let id = vec2<f32>(gx, gy);

  // pseudo random block height/width
  let r1 = noise(id * 0.9 + vec2<f32>(3.2, 7.1));
  let r2 = noise(id * 1.3 + vec2<f32>(9.4, 2.6));

  // silhouette mask: more blocks near center ridge
  let centerBias = 1.0 - abs(x - 0.5) * 2.0;
  centerBias = sat(centerBias);

  let block = smoothstep(0.78, 0.98, r1) * smoothstep(0.25, 1.0, centerBias);
  // add stepped “temple” feel
  block *= smoothstep(0.35, 0.05, abs(fract(y * 6.0 + r2*0.2) - 0.5));

  // tiny flicker
  block *= 0.85 + 0.15*sin(t*0.8 + r2*6.2831);
  return block;
}

@fragment
fn main(@location(0) uv0: vec2<f32>) -> @location(0) vec4<f32> {
  let t=u.time;

  let env=sat(u.rms*0.60 + u.bass*0.55 + u.beat*0.55);
  let hi=sat(u.high*0.95 + u.mid*0.35);
  let bass=sat(u.bass);
  let mid=sat(u.mid);

  // Mirror symmetry like tapestry
  var uv=uv0;
  uv.x = abs(uv.x - 0.5) + 0.5;

  // Main coord space
  var p=(uv0-vec2<f32>(0.5,0.5))*vec2<f32>(1.88,1.12);
  p=rot(p, 0.10*sin(t*0.25)*(0.35+0.65*mid));

  // Blacklight ink control: "inks fluoresce", blacks stay deep
  let ink = sat(u.ink);
  let blackCrush = 1.0 + 1.35*ink;      // deeper darks
  let fluoroBoost = 1.0 + 1.55*ink;     // brighter neon
  let glowBoost = 1.0 + 0.85*ink;

  // background dust + stars
  let dust=fbm(p*2.7 + vec2<f32>(t*0.05, -t*0.03));
  let stars=smoothstep(0.985, 1.0, noise(p*18.0 + vec2<f32>(t*0.35, 0.0)));

  // mountain glow mask
  let ridge = smoothstep(0.60, 0.95, uv0.y);
  let m = ridge * smoothstep(0.56, 0.95, uv0.y);

  // deity + mandala
  let mand = mandala(p*1.05, t*(0.95+0.6*mid), 8.0, 18.0);
  let d = deity(p*0.95 + vec2<f32>(0.0,-0.08));
  let deityFill = smoothstep(0.02,-0.02,d);
  let deityEdge = smoothstep(0.05,0.0,abs(d))*(0.55+0.45*env);

  // linework
  let linesA=abs(sin((p.x*14.0+p.y*9.0)+t*(1.1+0.9*mid)));
  let linesB=abs(sin((p.x*9.0-p.y*13.0)-t*(0.9+1.2*hi)));
  let linework=smoothstep(0.86, 1.0, max(linesA, linesB));

  // crystals
  let crystal = smoothstep(0.42,0.0, abs(p.x-0.72)+abs(p.y+0.05));
  crystal *= smoothstep(0.68,0.22, abs(p.y-0.05));

  // Temple / city blocks (top area)
  let city = templeBlocks(uv0, t);

  // Third-eye mandala (center-top) pulses on beat
  let eyeP = (uv0 - vec2<f32>(0.5, 0.62)) * vec2<f32>(1.0, 1.25);
  let eye = mandala(eyeP*1.4, t*(1.25+0.55*hi), 10.0, 22.0);
  let eyeCore = smoothstep(0.20, 0.0, length(eyeP));
  let eyePulse = (0.45 + 1.05*u.shock) * (0.35 + 0.85*hi);
  let thirdEye = (eye*0.85 + eyeCore*0.65) * eyePulse;

  // palette
  let deep=vec3<f32>(0.006, 0.012, 0.03);
  let cyan=vec3<f32>(0.05, 0.90, 1.20);
  let blue=vec3<f32>(0.12, 0.25, 1.10);
  let mag=vec3<f32>(0.98, 0.22, 0.98);
  let gold=vec3<f32>(0.98, 0.82, 0.25);
  let green=vec3<f32>(0.12, 1.10, 0.45);

  let hue=0.5+0.5*sin(t*0.25 + p.y*0.7);
  let ritual = mix(mag, gold, sat(hue));
  var ocean = mix(deep, cyan, 0.25 + 0.75*env);
  ocean = mix(ocean, blue, 0.20 + 0.35*hi);

  var col = ocean;

  // apply blacklight: darken base but boost neon additions
  col *= (0.85 / blackCrush);

  col += dust * vec3<f32>(0.02, 0.05, 0.10) * (0.7 + 0.5*hi);
  col += stars * vec3<f32>(0.10, 0.22, 0.45) * (0.7 + 0.6*hi);

  // mountains + city blocks glow
  col = mix(col, col + ritual*0.65*glowBoost, m*(0.22+0.95*hi));
  col += city * (0.45 + 0.75*hi) * mix(gold, cyan, 0.35) * (0.65 + 0.65*env) * fluoroBoost;

  // mandala + linework glow
  col += mand * (0.35 + 1.25*hi) * mix(cyan, ritual, 0.35) * fluoroBoost;
  col += linework * (0.20 + 0.95*hi) * mix(green, cyan, 0.55) * fluoroBoost;

  // deity “gold statue”
  col = mix(col, col + gold*(0.55 + 0.85*env)*fluoroBoost, deityFill*0.85);
  col += deityEdge * (0.35 + 0.75*hi) * vec3<f32>(0.55, 0.95, 1.35) * glowBoost;

  // crystals
  col += crystal * (0.25 + 0.90*hi) * mix(green, ritual, 0.45) * fluoroBoost;

  // third eye
  col += thirdEye * mix(cyan, ritual, 0.42) * (0.85 + 0.85*env) * fluoroBoost;

  // bass ink bloom from center
  let bloom = smoothstep(0.70, 0.0, length(p));
  col += bloom * bass * vec3<f32>(0.02, 0.16, 0.22) * (0.7 + 0.6*fluoroBoost);

  // vignette
  let v=length(uv0-vec2<f32>(0.5));
  let vig = smoothstep(0.80, 0.25, v);
  col *= (0.18 + 0.98*vig);

  // final blacklight “fluoro clamp”
  col = max(col, vec3<f32>(0.0));
  col = pow(col, vec3<f32>(0.92, 0.92, 0.90)); // slightly punchier

  return vec4<f32>(col, 1.0);
}
`;

  const fragGLSL = /* glsl */ `
precision highp float;
uniform float time,bass,mid,high,rms,beat,intensity,ink,shock;
varying vec2 vUv;

float sat(float x){ return clamp(x,0.0,1.0); }
vec2 rot(vec2 p,float a){ float c=cos(a), s=sin(a); return vec2(c*p.x-s*p.y, s*p.x+c*p.y); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  vec2 u=f*f*(3.0-2.0*f);
  float a=hash(i+vec2(0,0));
  float b=hash(i+vec2(1,0));
  float c=hash(i+vec2(0,1));
  float d=hash(i+vec2(1,1));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){
  float v=0.0, a=0.5;
  for(int i=0;i<6;i++){
    v += a*noise(p);
    p = p*2.0 + vec2(19.0,37.0);
    a *= 0.5;
  }
  return v;
}
float sdCircle(vec2 p,float r){ return length(p)-r; }
float sdBox(vec2 p, vec2 b){ vec2 d=abs(p)-b; return length(max(d,0.0)) + min(max(d.x,d.y),0.0); }
float deity(vec2 p){
  float head=sdCircle(p-vec2(0.0,0.36),0.12);
  float torso=sdBox(p-vec2(0.0,0.12),vec2(0.16,0.22));
  float base=sdBox(p-vec2(0.0,-0.22),vec2(0.32,0.12));
  float k=0.10;
  float u1=-log(exp(-k*head)+exp(-k*torso))/k;
  float u2=-log(exp(-k*u1)+exp(-k*base))/k;
  return u2;
}
float mandala(vec2 p,float t,float sc,float rc){
  float r=length(p);
  float a=atan(p.y,p.x);
  float spokes=abs(sin(a*sc + t*0.4));
  float rings=abs(sin(r*rc - t*0.9));
  float glyph=smoothstep(0.86,1.0,spokes)*smoothstep(0.62,1.0,rings);
  float fil=abs(sin((p.x*6.0+p.y*5.0)+t*0.6)*cos((p.x*5.0-p.y*7.0)-t*0.55));
  glyph += 0.55*smoothstep(0.75,1.0,fil)*smoothstep(0.20,0.0,r);
  return glyph;
}
float templeBlocks(vec2 uv,float t){
  if(uv.y < 0.56) return 0.0;
  float y=(uv.y-0.56)/0.44;
  float x=uv.x;
  float gx=floor(x*22.0);
  float gy=floor(y*12.0);
  vec2 id=vec2(gx,gy);
  float r1=noise(id*0.9 + vec2(3.2,7.1));
  float r2=noise(id*1.3 + vec2(9.4,2.6));
  float centerBias = 1.0 - abs(x-0.5)*2.0;
  centerBias = sat(centerBias);
  float block = smoothstep(0.78,0.98,r1) * smoothstep(0.25,1.0,centerBias);
  block *= smoothstep(0.35,0.05,abs(fract(y*6.0 + r2*0.2)-0.5));
  block *= 0.85 + 0.15*sin(t*0.8 + r2*6.2831);
  return block;
}

void main(){
  float t=time;
  float env=sat(rms*0.60 + bass*0.55 + beat*0.55);
  float hi=sat(high*0.95 + mid*0.35);

  vec2 uv0=vUv;
  vec2 uv=uv0;
  uv.x = abs(uv.x - 0.5) + 0.5;

  vec2 p=(uv0-0.5)*vec2(1.88,1.12);
  p=rot(p, 0.10*sin(t*0.25)*(0.35+0.65*mid));

  float inkv = sat(ink);
  float blackCrush = 1.0 + 1.35*inkv;
  float fluoroBoost = 1.0 + 1.55*inkv;
  float glowBoost = 1.0 + 0.85*inkv;

  float dust=fbm(p*2.7 + vec2(t*0.05, -t*0.03));
  float stars=smoothstep(0.985,1.0,noise(p*18.0 + vec2(t*0.35,0.0)));

  float mand=mandala(p*1.05, t*(0.95+0.6*mid), 8.0, 18.0);
  float d=deity(p*0.95 + vec2(0.0,-0.08));
  float deityFill=smoothstep(0.02,-0.02,d);
  float deityEdge=smoothstep(0.05,0.0,abs(d))*(0.55+0.45*env);

  float linesA=abs(sin((p.x*14.0+p.y*9.0)+t*(1.1+0.9*mid)));
  float linesB=abs(sin((p.x*9.0-p.y*13.0)-t*(0.9+1.2*hi)));
  float linework=smoothstep(0.86,1.0,max(linesA,linesB));

  float crystal=smoothstep(0.42,0.0,abs(p.x-0.72)+abs(p.y+0.05));
  crystal *= smoothstep(0.68,0.22,abs(p.y-0.05));

  float city = templeBlocks(uv0, t);

  vec2 eyeP=(uv0-vec2(0.5,0.62))*vec2(1.0,1.25);
  float eye=mandala(eyeP*1.4, t*(1.25+0.55*hi), 10.0, 22.0);
  float eyeCore=smoothstep(0.20,0.0,length(eyeP));
  float eyePulse=(0.45 + 1.05*shock) * (0.35 + 0.85*hi);
  float thirdEye=(eye*0.85 + eyeCore*0.65) * eyePulse;

  vec3 deep=vec3(0.006,0.012,0.03);
  vec3 cyan=vec3(0.05,0.90,1.20);
  vec3 blue=vec3(0.12,0.25,1.10);
  vec3 mag=vec3(0.98,0.22,0.98);
  vec3 gold=vec3(0.98,0.82,0.25);
  vec3 green=vec3(0.12,1.10,0.45);

  float hue=0.5+0.5*sin(t*0.25 + p.y*0.7);
  vec3 ritual=mix(mag,gold,sat(hue));
  vec3 ocean=mix(deep,cyan,0.25+0.75*env);
  ocean=mix(ocean,blue,0.20+0.35*hi);

  vec3 col=ocean;
  col *= (0.85 / blackCrush);

  col += dust*vec3(0.02,0.05,0.10)*(0.7+0.5*hi);
  col += stars*vec3(0.10,0.22,0.45)*(0.7+0.6*hi);

  col += city * (0.45+0.75*hi) * mix(gold, cyan, 0.35) * (0.65+0.65*env) * fluoroBoost;

  col += mand*(0.35+1.25*hi)*mix(cyan, ritual, 0.35)*fluoroBoost;
  col += linework*(0.20+0.95*hi)*mix(green, cyan, 0.55)*fluoroBoost;

  col = mix(col, col + gold*(0.55+0.85*env)*fluoroBoost, deityFill*0.85);
  col += deityEdge*(0.35+0.75*hi)*vec3(0.55,0.95,1.35)*glowBoost;

  col += crystal*(0.25+0.90*hi)*mix(green, ritual, 0.45)*fluoroBoost;
  col += thirdEye*mix(cyan, ritual, 0.42)*(0.85+0.85*env)*fluoroBoost;

  float bloom=smoothstep(0.70,0.0,length(p));
  col += bloom*sat(bass)*vec3(0.02,0.16,0.22)*(0.7+0.6*fluoroBoost);

  float v=length(uv0-0.5);
  float vig=smoothstep(0.80,0.25,v);
  col *= (0.18 + 0.98*vig);

  col = pow(max(col,0.0), vec3(0.92,0.92,0.90));
  gl_FragColor = vec4(col, 1.0);
}
`;

  const tapestryMat = new BABYLON.ShaderMaterial(
    "ritualV2TapestryMat",
    bjsScene,
    {
      vertexSource: useWGSL ? vertWGSL : vertGLSL,
      fragmentSource: useWGSL ? fragWGSL : fragGLSL,
      shaderLanguage,
    } as any,
    {
      attributes: ["position", "normal", "uv"],
      uniforms: ["worldViewProjection", "time", "bass", "mid", "high", "rms", "beat", "intensity", "ink", "shock"],
    },
  );

  tapestry.material = tapestryMat;
  leftWall.material = tapestryMat;  // same shader, different UV feels like side fabric
  rightWall.material = tapestryMat;

  // =========================
  // Ritual Dust (thin instances)
  // =========================
  const DUST_COUNT = 850;
  const dustBase = BABYLON.MeshBuilder.CreateSphere("ritualV2DustBase", { diameter: 0.024, segments: 4 }, bjsScene);
  dustBase.parent = root;
  dustBase.isPickable = false;

  const dustMat = new BABYLON.StandardMaterial("ritualV2DustMat", bjsScene);
  dustMat.diffuseColor = BABYLON.Color3.Black();
  dustMat.specularColor = BABYLON.Color3.Black();
  dustMat.emissiveColor = new BABYLON.Color3(0.15, 0.65, 1.2);
  dustMat.alpha = 0.35;
  dustMat.backFaceCulling = false;
  dustBase.material = dustMat;

  const dustMatrices = new Float32Array(DUST_COUNT * 16);
  dustBase.thinInstanceSetBuffer("matrix", dustMatrices, 16, true);
  const tmpM = new BABYLON.Matrix();
  const tmpQ = BABYLON.Quaternion.Identity();

  const dust = Array.from({ length: DUST_COUNT }, (_, i) => ({
    a: Math.random() * Math.PI * 2,
    r: 0.7 + Math.random() * 3.4,
    y: (Math.random() - 0.5) * 2.8,
    s: 0.7 + Math.random() * 2.0,
    seed: Math.random() * 10000 + i * 3.1,
  }));

  function composeTo(i: number, x: number, y: number, z: number, s: number) {
    BABYLON.Matrix.ComposeToRef(new BABYLON.Vector3(s, s, s), tmpQ, new BABYLON.Vector3(x, y, z), tmpM);
    tmpM.copyToArray(dustMatrices, i * 16);
  }

  for (let i = 0; i < DUST_COUNT; i++) {
    const d = dust[i];
    composeTo(i, Math.cos(d.a) * d.r, d.y, Math.sin(d.a) * d.r, d.s);
  }
  dustBase.thinInstanceBufferUpdated("matrix");

  // =========================
  // Camera orbit if ArcRotateCamera
  // =========================
  const cam0 = bjsScene.activeCamera;
  const arc = cam0 && cam0 instanceof BABYLON.ArcRotateCamera ? cam0 : null;
  const baseAlpha = arc ? arc.alpha : 0;
  const baseBeta = arc ? arc.beta : 0;
  const baseRadius = arc ? arc.radius : 0;
  const baseTarget = arc ? arc.target.clone() : new BABYLON.Vector3(0, 0.25, 0);

  // =========================
  // Runtime state
  // =========================
  let time = 0;
  let prevBeat = 0;
  let shock = 0;     // beat shock envelope
  let ink = 0;       // blacklight ink intensity envelope

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

      const beatEdge = beat > 0.65 && prevBeat <= 0.65;
      prevBeat = beat;
      if (beatEdge) shock = 1.0;
      shock *= Math.exp(-4.2 * dtc);

      // blacklight ink envelope: grows with highs + beat, decays gently
      const inkTarget = clamp01(0.35 * high + 0.25 * rms + 0.30 * shock);
      const rate = inkTarget > ink ? 6.5 : 2.2;
      ink = ink + (inkTarget - ink) * (1 - Math.exp(-rate * dtc));

      tapestryMat.setFloat("time", time);
      tapestryMat.setFloat("bass", bass);
      tapestryMat.setFloat("mid", mid);
      tapestryMat.setFloat("high", high);
      tapestryMat.setFloat("rms", rms);
      tapestryMat.setFloat("beat", beat);
      tapestryMat.setFloat("intensity", intensity);
      tapestryMat.setFloat("shock", shock);
      tapestryMat.setFloat("ink", ink);

      // Side walls feel like fabric panels
      leftWall.position.z = 0.55 + 0.05 * Math.sin(time * 0.35);
      rightWall.position.z = 0.55 + 0.05 * Math.cos(time * 0.33);

      // Glow + fog react
      if (glow) glow.intensity = 0.95 + 0.90 * (rms + high) + 0.45 * shock + 0.65 * ink;
      bjsScene.fogDensity = (heavyEdges ? 0.022 : 0.013) + 0.02 * (0.55 * rms + 0.75 * shock);

      // vignette heavier in low energy, opens slightly on shock
      vigMat.alpha = (heavyEdges ? 0.28 : 0.18) + 0.16 * (1.0 - high) + 0.10 * shock;

      // subtle “fabric breath”
      const breathe = 1 + 0.02 * Math.sin(time * 0.85) * (0.35 + 0.65 * rms);
      tapestry.scaling.setAll(breathe);
      frame.scaling.setAll(1 + 0.006 * Math.sin(time * 0.65));
      vignette.scaling.setAll(1 + 0.01 * Math.sin(time * 0.45));

      // dust swirl + sparkle
      dustMat.emissiveColor = new BABYLON.Color3(
        0.10 + 0.30 * bass + 0.20 * shock,
        0.55 + 0.75 * rms,
        1.05 + 0.85 * high + 0.35 * ink,
      );
      dustMat.alpha = 0.18 + 0.26 * rms + 0.18 * shock + 0.12 * ink;

      for (let i = 0; i < DUST_COUNT; i++) {
        const d = dust[i];
        const a = d.a + time * (0.09 + 0.28 * high) + Math.sin(d.seed + time) * 0.02;
        const r = d.r + 0.10 * Math.sin(time * 0.6 + d.seed) + 0.25 * shock;
        const y = d.y + 0.22 * Math.sin(time * 0.9 + d.seed) * (0.2 + rms);
        const s = d.s * (0.85 + 0.55 * shock);
        composeTo(i, Math.cos(a) * r, y, Math.sin(a) * r, 0.85 * s);
      }
      dustBase.thinInstanceBufferUpdated("matrix");

      // ritual camera drift
      if (arc) {
        const orbit = 0.035 + 0.065 * mid + 0.055 * rms;
        arc.alpha = baseAlpha + time * orbit;
        arc.beta = baseBeta + Math.sin(time * 0.25) * 0.04 + 0.02 * high;
        arc.radius = baseRadius * (0.95 + 0.05 * (1 + 0.25 * rms));
        arc.target = BABYLON.Vector3.Lerp(baseTarget, new BABYLON.Vector3(0, 0.25, 0), 0.2);
      }
    },

    dispose() {
      bjsScene.fogMode = prevFogMode;
      bjsScene.fogDensity = prevFogDensity;
      if (prevFogColor) bjsScene.fogColor = prevFogColor;

      glow?.dispose();

      dustBase.dispose(false, true);
      dustMat.dispose(true, true);

      vignette.dispose(false, true);
      vigMat.dispose(true, true);

      frame.dispose(false, true);
      frameMat.dispose(true, true);

      tapestry.dispose(false, true);
      tapestryMat.dispose(true, true);

      leftWall.dispose(false, true);
      rightWall.dispose(false, true);

      hemi.dispose();
      key.dispose();
      rim.dispose();

      root.dispose();
    },
  };
}
