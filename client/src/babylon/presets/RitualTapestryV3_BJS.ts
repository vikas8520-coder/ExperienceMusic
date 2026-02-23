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

export function createRitualTapestryV3Preset(
  scene: unknown,
  opts?: { enableGlow?: boolean; heavyEdges?: boolean },
): BabylonPresetRuntime {
  const bjsScene = scene as any;
  const enableGlow = opts?.enableGlow ?? true;
  const heavyEdges = opts?.heavyEdges ?? true;

  const root = new BABYLON.TransformNode("ritualV3Root", bjsScene);

  // ---- Fog (dramatic edges) ----
  const prevFogMode = bjsScene.fogMode;
  const prevFogDensity = bjsScene.fogDensity;
  const prevFogColor = bjsScene.fogColor ? bjsScene.fogColor.clone() : null;

  bjsScene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  bjsScene.fogColor = new BABYLON.Color3(0.004, 0.006, 0.016);
  bjsScene.fogDensity = heavyEdges ? 0.022 : 0.013;

  // ---- Lights ----
  const hemi = new BABYLON.HemisphericLight("ritualV3Hemi", new BABYLON.Vector3(0.2, 1, 0.1), bjsScene);
  hemi.intensity = 0.22;

  const key = new BABYLON.PointLight("ritualV3Key", new BABYLON.Vector3(0, 2.6, -3.2), bjsScene);
  key.intensity = 20;
  key.radius = 20;
  key.diffuse = new BABYLON.Color3(0.15, 0.75, 1.0);

  const rim = new BABYLON.PointLight("ritualV3Rim", new BABYLON.Vector3(0, 2.2, 3.2), bjsScene);
  rim.intensity = 16;
  rim.radius = 18;
  rim.diffuse = new BABYLON.Color3(0.85, 0.25, 1.0);

  // ---- Optional Glow ----
  let glow: any = null;
  if (enableGlow) {
    glow = new BABYLON.GlowLayer("ritualV3Glow", bjsScene, { blurKernelSize: 64 });
    glow.intensity = 1.1;
  }

  // =========================
  // Planes: center tapestry + side wall tapestries
  // =========================
  const tapestry = BABYLON.MeshBuilder.CreatePlane(
    "ritualV3Tapestry",
    { width: 6.6, height: 3.8, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
    bjsScene,
  );
  tapestry.parent = root;
  tapestry.position.y = 0.25;
  tapestry.position.z = 0.0;

  const leftWall = BABYLON.MeshBuilder.CreatePlane(
    "ritualV3LeftWall",
    { width: 5.0, height: 3.9, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
    bjsScene,
  );
  leftWall.parent = root;
  leftWall.position.set(-3.85, 0.20, 0.55);
  leftWall.rotation.y = Math.PI * 0.35;

  const rightWall = BABYLON.MeshBuilder.CreatePlane(
    "ritualV3RightWall",
    { width: 5.0, height: 3.9, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
    bjsScene,
  );
  rightWall.parent = root;
  rightWall.position.set(3.85, 0.20, 0.55);
  rightWall.rotation.y = -Math.PI * 0.35;

  // Frame + Vignette overlays
  const frame = BABYLON.MeshBuilder.CreatePlane(
    "ritualV3Frame",
    { width: 6.8, height: 4.0, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
    bjsScene,
  );
  frame.parent = root;
  frame.position.set(0, 0.25, 0.02);

  const vignette = BABYLON.MeshBuilder.CreatePlane(
    "ritualV3Vignette",
    { width: 7.2, height: 4.3, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
    bjsScene,
  );
  vignette.parent = root;
  vignette.position.set(0, 0.25, 0.06);

  const frameMat = new BABYLON.StandardMaterial("ritualV3FrameMat", bjsScene);
  frameMat.diffuseColor = BABYLON.Color3.Black();
  frameMat.specularColor = BABYLON.Color3.Black();
  frameMat.emissiveColor = new BABYLON.Color3(0.02, 0.04, 0.08);
  frameMat.alpha = 0.88;
  frame.material = frameMat;

  const vigMat = new BABYLON.StandardMaterial("ritualV3VigMat", bjsScene);
  vigMat.diffuseColor = BABYLON.Color3.Black();
  vigMat.specularColor = BABYLON.Color3.Black();
  vigMat.emissiveColor = BABYLON.Color3.Black();
  vigMat.alpha = heavyEdges ? 0.30 : 0.18;
  vignette.material = vigMat;

  // Shader language
  const useWGSL = isWebGPU(bjsScene);
  const shaderLanguage = useWGSL ? BABYLON.ShaderLanguage.WGSL : BABYLON.ShaderLanguage.GLSL;

  // =========================
  // Shared Vertex
  // =========================
  const vertWGSL = /* wgsl */ `
struct U {
  worldViewProjection: mat4x4<f32>,
  time:f32, bass:f32, mid:f32, high:f32, rms:f32, beat:f32,
  intensity:f32, ink:f32, shock:f32,
  uVariant:f32
};
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
uniform float time,bass,mid,high,rms,beat,intensity,ink,shock,uVariant;
attribute vec3 position;
attribute vec2 uv;
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = worldViewProjection * vec4(position,1.0);
}
`;

  // =========================
  // Fragment (V3)
  // - weave (fabric threads)
  // - ink-stroke outlines (neon contour + dark ink edge)
  // - chroma shimmer (rgb split)
  // - temple blocks + third eye from V2
  // - side variants via uniform "variant"
  // =========================
  const fragWGSL = /* wgsl */ `
struct U {
  worldViewProjection: mat4x4<f32>,
  time:f32, bass:f32, mid:f32, high:f32, rms:f32, beat:f32,
  intensity:f32, ink:f32, shock:f32,
  uVariant:f32
};
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
fn templeBlocks(uv:vec2<f32>, t:f32)->f32{
  if (uv.y < 0.56) { return 0.0; }
  let y = (uv.y - 0.56) / 0.44;
  let x = uv.x;
  let gx = floor(x * 22.0);
  let gy = floor(y * 12.0);
  let id = vec2<f32>(gx, gy);
  let r1 = noise(id * 0.9 + vec2<f32>(3.2, 7.1));
  let r2 = noise(id * 1.3 + vec2<f32>(9.4, 2.6));
  var centerBias = 1.0 - abs(x - 0.5) * 2.0;
  centerBias = sat(centerBias);
  var block = smoothstep(0.78, 0.98, r1) * smoothstep(0.25, 1.0, centerBias);
  block *= smoothstep(0.35, 0.05, abs(fract(y * 6.0 + r2*0.2) - 0.5));
  block *= 0.85 + 0.15*sin(t*0.8 + r2*6.2831);
  return block;
}

fn luma(c: vec3<f32>) -> f32 {
  return dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
}

// boosts saturation without needing HSV conversion
fn satBoost(c: vec3<f32>, k: f32) -> vec3<f32> {
  let g = vec3<f32>(luma(c));
  return mix(g, c, 1.0 + k);
}

// UV "ink fluorescence": suppress non-ink, amplify ink
fn fluoresce(col: vec3<f32>, ink: f32, hi: f32, shock: f32) -> vec3<f32> {
  // brightness mask (only bright parts fluoresce)
  let y = luma(col);

  // threshold tightens with ink amount (UV makes highlights pop)
  let th = mix(0.22, 0.12, ink);
  let soft = mix(0.20, 0.10, ink);
  let m = smoothstep(th, th + soft, y);

  // extra response to highs + beat
  let punch = 0.6 + 0.8*hi + 0.9*shock;

  // reduce dull areas, boost fluorescent parts
  var out = col * (0.55 - 0.25*ink);
  out += col * (m * (1.8 + 2.2*ink) * punch);

  // hard neon clamp (push towards vivid)
  out = satBoost(out, 0.85 + 0.75*ink);

  return out;
}

// fake "inner bloom" (adds halo around bright regions)
fn innerBloom(col: vec3<f32>, uv: vec2<f32>, ink: f32, hi: f32) -> vec3<f32> {
  let y = luma(col);
  let m = smoothstep(0.35, 0.85, y);
  // radial soft halo (center glow like blacklight cloth)
  let d = length(uv - vec2<f32>(0.5));
  let halo = smoothstep(0.85, 0.20, d) * (0.12 + 0.28*ink) * (0.55 + 0.65*hi);
  return col + vec3<f32>(halo) * m;
}

// --- weave: thread grid + micro shimmer ---
fn weave(uv:vec2<f32>, t:f32, hi:f32, ink:f32)->f32{
  // more visible in dark areas; weave uses two slightly rotated thread sets
  var p = (uv - vec2<f32>(0.5)) * vec2<f32>(8.0, 5.0);
  p = rot(p, 0.18);
  let th1 = abs(sin(p.x * 18.0 + t*0.25));
  let th2 = abs(sin(p.y * 22.0 - t*0.20));
  let threads = smoothstep(0.82, 1.0, max(th1, th2));

  // micro thread noise
  let n = fbm(uv*vec2<f32>(40.0, 28.0) + vec2<f32>(t*0.07, -t*0.05));
  let micro = smoothstep(0.55, 0.95, n);

  // shimmer leans with highs; ink makes weave slightly more pronounced
  let w = (0.20 + 0.55*micro) * (0.45 + 0.65*threads);
  w *= (0.55 + 0.55*hi);
  w *= (0.85 + 0.65*ink);
  return w;
}

// --- outline: neon contour + dark ink edge ---
fn outlineMask(p:vec2<f32>, t:f32, hi:f32)->vec2<f32>{
  // return: x=neon outline, y=dark ink edge
  let lnA = abs(sin((p.x*14.0+p.y*9.0)+t*(1.1+0.9*hi)));
  let lnB = abs(sin((p.x*9.0-p.y*13.0)-t*(0.9+1.2*hi)));
  let lw = max(lnA, lnB);

  // thin neon strokes
  let neon = smoothstep(0.965, 1.0, lw);

  // slightly thicker dark edge around strokes (ink)
  let inkEdge = smoothstep(0.90, 0.98, lw) - smoothstep(0.985, 1.0, lw);
  return vec2<f32>(neon, sat(inkEdge*1.35));
}

@fragment
fn main(@location(0) uv0: vec2<f32>) -> @location(0) vec4<f32> {
  let t=u.time;

  let env=sat(u.rms*0.60 + u.bass*0.55 + u.beat*0.55);
  let hi=sat(u.high*0.95 + u.mid*0.35);
  let bass=sat(u.bass);
  let mid=sat(u.mid);

  // variants: 0=center, 1=left, 2=right
  let v = u.uVariant;
  // UV remap per variant so sides are different tapestries
  var uvA = uv0;
  if (v > 0.5 && v < 1.5) { // left
    uvA = vec2<f32>(uv0.x*1.25 + 0.08, uv0.y*1.05 - 0.02);
  } else if (v >= 1.5) { // right
    uvA = vec2<f32>(uv0.x*0.95 - 0.03, uv0.y*1.15 + 0.01);
  }
  uvA = fract(uvA);

  // Mirror symmetry like tapestry (center stronger)
  var uv = uvA;
  if (v < 0.5) {
    uv.x = abs(uv.x - 0.5) + 0.5;
  } else {
    // sides: partial mirror for a "tapestry panel" look
    uv.x = mix(uv.x, abs(uv.x - 0.5) + 0.5, 0.55);
  }

  // Main coord space
  var p=(uvA-vec2<f32>(0.5,0.5))*vec2<f32>(1.88,1.12);
  let swirl = 0.10*sin(t*0.25)*(0.35+0.65*mid);
  p=rot(p, swirl + 0.05*(v)); // different swirl per variant

  // blacklight ink
  let ink = sat(u.ink);
  let blackCrush = 1.0 + 2.25*ink;      // MUCH darker blacks
  let fluoroBoost = 1.0 + 2.45*ink;     // stronger pop
  let glowBoost = 1.0 + 1.25*ink;       // brighter emissive feel

  // background dust + stars
  let dust=fbm(p*2.7 + vec2<f32>(t*0.05, -t*0.03));
  let stars=smoothstep(0.985, 1.0, noise(p*18.0 + vec2<f32>(t*0.35, 0.0)));

  // deity + mandala
  let sc = (v < 0.5) ? 8.0 : (9.5 + 1.0*v);   // sides slightly different
  let rc = (v < 0.5) ? 18.0 : (20.0 + 2.0*v);

  let mand = mandala(p*1.05, t*(0.95+0.6*mid), sc, rc);
  let d = deity(p*0.95 + vec2<f32>(0.0,-0.08));
  let deityFill = smoothstep(0.02,-0.02,d);
  let deityEdge = smoothstep(0.05,0.0,abs(d))*(0.55+0.45*env);

  // city blocks (center strongest)
  let city = templeBlocks(uvA, t) * ((v < 0.5) ? 1.0 : 0.55);

  // crystals
  let crystal = smoothstep(0.42,0.0, abs(p.x-0.72)+abs(p.y+0.05));
  crystal *= smoothstep(0.68,0.22, abs(p.y-0.05));

  // third eye (center strongest)
  let eyeP=(uvA-vec2<f32>(0.5,0.62))*vec2<f32>(1.0,1.25);
  let eye=mandala(eyeP*1.4, t*(1.25+0.55*hi), 10.0 + 0.5*v, 22.0 + 1.0*v);
  let eyeCore=smoothstep(0.20,0.0,length(eyeP));
  let eyePulse=(0.45 + 1.05*u.shock) * (0.35 + 0.85*hi);
  let thirdEye=(eye*0.85 + eyeCore*0.65) * eyePulse * ((v < 0.5) ? 1.0 : 0.55);

  // weave
  let w = weave(uvA, t, hi, ink);

  // ink stroke outlines
  let om = outlineMask(p, t, hi);
  let neonStroke = om.x * (0.35 + 1.10*hi) * fluoroBoost;
  let darkInkEdge = om.y * (0.50 + 0.80*ink);

  // palette
  let deep=vec3<f32>(0.006, 0.012, 0.03);
  let cyan=vec3<f32>(0.05, 0.90, 1.20);
  let blue=vec3<f32>(0.12, 0.25, 1.10);
  let mag=vec3<f32>(0.98, 0.22, 0.98);
  let gold=vec3<f32>(0.98, 0.82, 0.25);
  let green=vec3<f32>(0.12, 1.10, 0.45);

  // variant hue offset
  let hue = 0.5+0.5*sin(t*0.25 + p.y*0.7 + 0.65*v);
  let ritual = mix(mag, gold, sat(hue));
  var ocean = mix(deep, cyan, 0.25 + 0.75*env);
  ocean = mix(ocean, blue, 0.20 + 0.35*hi);

  // base + blacklight darkening
  var col = ocean;
  col *= (0.85 / blackCrush);

  // weave influences brightness slightly (fabric)
  col *= (0.88 + 0.18*w);

  col += dust * vec3<f32>(0.02, 0.05, 0.10) * (0.7 + 0.5*hi);
  col += stars * vec3<f32>(0.10, 0.22, 0.45) * (0.7 + 0.6*hi);

  // mountains/city glow
  col += city * (0.45+0.75*hi) * mix(gold, cyan, 0.35) * (0.65+0.65*env) * fluoroBoost;

  // mandala + linework glow
  col += mand*(0.35+1.25*hi)*mix(cyan, ritual, 0.35)*fluoroBoost;

  // deity
  col = mix(col, col + gold*(0.55+0.85*env)*fluoroBoost, deityFill*0.85);
  col += deityEdge*(0.35+0.75*hi)*vec3<f32>(0.55,0.95,1.35)*glowBoost;

  // crystals
  col += crystal*(0.25+0.90*hi)*mix(green, ritual, 0.45)*fluoroBoost;

  // third eye
  col += thirdEye*mix(cyan, ritual, 0.42)*(0.85+0.85*env)*fluoroBoost;

  // neon ink-stroke outlines + dark edge ink
  col += neonStroke * mix(green, cyan, 0.55);
  col -= darkInkEdge * vec3<f32>(0.10, 0.12, 0.18);

  // bass ink bloom from center
  let bloom=smoothstep(0.70, 0.0, length(p));
  col += bloom*bass*vec3<f32>(0.02, 0.16, 0.22)*(0.7 + 0.6*fluoroBoost);

  // chroma shimmer (micro RGB split on highs)
  let chroma = (0.004 + 0.010*hi + 0.010*ink) * (0.6 + 0.4*sin(t*1.25 + (uvA.x+uvA.y)*6.0));
  let r = col.x + chroma;
  let g = col.y;
  let b = col.z + chroma*0.6;
  col = vec3<f32>(r,g,b);

  // --- UV BLACKLIGHT PASS (strong) ---
  col = fluoresce(col, ink, hi, u.shock);
  col = innerBloom(col, uv0, ink, hi);

  // optional: tiny posterization for "UV print" feel
  let poster = mix(1.0, 0.72, ink); // lower = more banding
  col = floor(col / poster) * poster;

  // vignette
  let dist=length(uv0-vec2<f32>(0.5));
  let vig = smoothstep(0.80, 0.25, dist);
  col *= (0.18 + 0.98*vig);

  col = pow(max(col, vec3<f32>(0.0)), vec3<f32>(0.92,0.92,0.90));
  return vec4<f32>(col, 1.0);
}
`;

  const fragGLSL = /* glsl */ `
precision highp float;
uniform float time,bass,mid,high,rms,beat,intensity,ink,shock,uVariant;
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
float luma(vec3 c){
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}
vec3 satBoost(vec3 c, float k){
  vec3 g = vec3(luma(c));
  return mix(g, c, 1.0 + k);
}
vec3 fluoresce(vec3 col, float inkv, float hi, float shockv){
  float y = luma(col);
  float th = mix(0.22, 0.12, inkv);
  float soft = mix(0.20, 0.10, inkv);
  float m = smoothstep(th, th + soft, y);
  float punch = 0.6 + 0.8*hi + 0.9*shockv;
  vec3 outc = col * (0.55 - 0.25*inkv);
  outc += col * (m * (1.8 + 2.2*inkv) * punch);
  outc = satBoost(outc, 0.85 + 0.75*inkv);
  return outc;
}
vec3 innerBloom(vec3 col, vec2 uv, float inkv, float hi){
  float y = luma(col);
  float m = smoothstep(0.35, 0.85, y);
  float d = length(uv - vec2(0.5));
  float halo = smoothstep(0.85, 0.20, d) * (0.12 + 0.28*inkv) * (0.55 + 0.65*hi);
  return col + vec3(halo) * m;
}
float weave(vec2 uv,float t,float hi,float inkv){
  vec2 p=(uv-0.5)*vec2(8.0,5.0);
  p=rot(p,0.18);
  float th1=abs(sin(p.x*18.0 + t*0.25));
  float th2=abs(sin(p.y*22.0 - t*0.20));
  float threads=smoothstep(0.82,1.0,max(th1,th2));
  float n=fbm(uv*vec2(40.0,28.0) + vec2(t*0.07, -t*0.05));
  float micro=smoothstep(0.55,0.95,n);
  float w=(0.20+0.55*micro)*(0.45+0.65*threads);
  w *= (0.55+0.55*hi);
  w *= (0.85+0.65*inkv);
  return w;
}
vec2 outlineMask(vec2 p,float t,float hi){
  float lnA=abs(sin((p.x*14.0+p.y*9.0)+t*(1.1+0.9*hi)));
  float lnB=abs(sin((p.x*9.0-p.y*13.0)-t*(0.9+1.2*hi)));
  float lw=max(lnA,lnB);
  float neon=smoothstep(0.965,1.0,lw);
  float inkEdge=smoothstep(0.90,0.98,lw) - smoothstep(0.985,1.0,lw);
  return vec2(neon, sat(inkEdge*1.35));
}

void main(){
  float t=time;
  float env=sat(rms*0.60 + bass*0.55 + beat*0.55);
  float hi=sat(high*0.95 + mid*0.35);

  float v = uVariant;
  vec2 uv0=vUv;

  vec2 uvA=uv0;
  if(v > 0.5 && v < 1.5) uvA = vec2(uv0.x*1.25+0.08, uv0.y*1.05-0.02);
  else if(v >= 1.5)      uvA = vec2(uv0.x*0.95-0.03, uv0.y*1.15+0.01);
  uvA = fract(uvA);

  vec2 uv=uvA;
  if(v < 0.5) uv.x = abs(uv.x-0.5)+0.5;
  else uv.x = mix(uv.x, abs(uv.x-0.5)+0.5, 0.55);

  vec2 p=(uvA-0.5)*vec2(1.88,1.12);
  float swirl = 0.10*sin(t*0.25)*(0.35+0.65*sat(mid));
  p=rot(p, swirl + 0.05*v);

  float inkv=sat(ink);
  float blackCrush=1.0 + 2.25*inkv;
  float fluoroBoost=1.0 + 2.45*inkv;
  float glowBoost=1.0 + 1.25*inkv;

  float dust=fbm(p*2.7 + vec2(t*0.05, -t*0.03));
  float stars=smoothstep(0.985,1.0,noise(p*18.0 + vec2(t*0.35,0.0)));

  float sc = (v < 0.5) ? 8.0 : (9.5 + 1.0*v);
  float rc = (v < 0.5) ? 18.0 : (20.0 + 2.0*v);

  float mand=mandala(p*1.05, t*(0.95+0.6*sat(mid)), sc, rc);
  float d=deity(p*0.95 + vec2(0.0,-0.08));
  float deityFill=smoothstep(0.02,-0.02,d);
  float deityEdge=smoothstep(0.05,0.0,abs(d))*(0.55+0.45*env);

  float city=templeBlocks(uvA,t) * ((v < 0.5) ? 1.0 : 0.55);

  float crystal=smoothstep(0.42,0.0,abs(p.x-0.72)+abs(p.y+0.05));
  crystal *= smoothstep(0.68,0.22,abs(p.y-0.05));

  vec2 eyeP=(uvA-vec2(0.5,0.62))*vec2(1.0,1.25);
  float eye=mandala(eyeP*1.4, t*(1.25+0.55*hi), 10.0+0.5*v, 22.0+1.0*v);
  float eyeCore=smoothstep(0.20,0.0,length(eyeP));
  float eyePulse=(0.45 + 1.05*shock) * (0.35 + 0.85*hi);
  float thirdEye=(eye*0.85 + eyeCore*0.65) * eyePulse * ((v < 0.5) ? 1.0 : 0.55);

  float w=weave(uvA,t,hi,inkv);
  vec2 om=outlineMask(p,t,hi);
  float neonStroke=om.x*(0.35+1.10*hi)*fluoroBoost;
  float darkInkEdge=om.y*(0.50+0.80*inkv);

  vec3 deep=vec3(0.006,0.012,0.03);
  vec3 cyan=vec3(0.05,0.90,1.20);
  vec3 blue=vec3(0.12,0.25,1.10);
  vec3 mag=vec3(0.98,0.22,0.98);
  vec3 gold=vec3(0.98,0.82,0.25);
  vec3 green=vec3(0.12,1.10,0.45);

  float hue=0.5+0.5*sin(t*0.25 + p.y*0.7 + 0.65*v);
  vec3 ritual=mix(mag,gold,sat(hue));
  vec3 ocean=mix(deep,cyan,0.25+0.75*env);
  ocean=mix(ocean,blue,0.20+0.35*hi);

  vec3 col=ocean;
  col *= (0.85 / blackCrush);
  col *= (0.88 + 0.18*w);

  col += dust*vec3(0.02,0.05,0.10)*(0.7+0.5*hi);
  col += stars*vec3(0.10,0.22,0.45)*(0.7+0.6*hi);

  col += city*(0.45+0.75*hi)*mix(gold,cyan,0.35)*(0.65+0.65*env)*fluoroBoost;
  col += mand*(0.35+1.25*hi)*mix(cyan,ritual,0.35)*fluoroBoost;

  col = mix(col, col + gold*(0.55+0.85*env)*fluoroBoost, deityFill*0.85);
  col += deityEdge*(0.35+0.75*hi)*vec3(0.55,0.95,1.35)*glowBoost;

  col += crystal*(0.25+0.90*hi)*mix(green,ritual,0.45)*fluoroBoost;
  col += thirdEye*mix(cyan,ritual,0.42)*(0.85+0.85*env)*fluoroBoost;

  col += neonStroke * mix(green,cyan,0.55);
  col -= darkInkEdge * vec3(0.10,0.12,0.18);

  float bloom=smoothstep(0.70,0.0,length(p));
  col += bloom*sat(bass)*vec3(0.02,0.16,0.22)*(0.7 + 0.6*fluoroBoost);

  float chroma=(0.004 + 0.010*hi + 0.010*inkv) * (0.6 + 0.4*sin(t*1.25 + (uvA.x+uvA.y)*6.0));
  col = vec3(col.r + chroma, col.g, col.b + chroma*0.6);

  col = fluoresce(col, inkv, hi, shock);
  col = innerBloom(col, uv0, inkv, hi);
  float poster = mix(1.0, 0.72, inkv);
  col = floor(col / poster) * poster;

  float dist=length(uv0-0.5);
  float vig=smoothstep(0.80,0.25,dist);
  col *= (0.18 + 0.98*vig);

  col = pow(max(col,0.0), vec3(0.92,0.92,0.90));
  gl_FragColor = vec4(col, 1.0);
}
`;

  function makeMat(name: string) {
    return new BABYLON.ShaderMaterial(
      name,
      bjsScene,
      {
        vertexSource: useWGSL ? vertWGSL : vertGLSL,
        fragmentSource: useWGSL ? fragWGSL : fragGLSL,
      } as any,
      {
        attributes: ["position", "normal", "uv"],
        uniforms: [
          "worldViewProjection",
          "time",
          "bass",
          "mid",
          "high",
          "rms",
          "beat",
          "intensity",
          "ink",
          "shock",
          "uVariant",
        ],
        shaderLanguage,
      },
    );
  }

  // Create 3 materials so side patterns are genuinely different
  const matCenter = makeMat("ritualV3MatCenter");
  const matLeft = makeMat("ritualV3MatLeft");
  const matRight = makeMat("ritualV3MatRight");

  // Assign
  tapestry.material = matCenter;
  leftWall.material = matLeft;
  rightWall.material = matRight;

  // =========================
  // Ritual Dust (thin instances)
  // =========================
  const DUST_COUNT = 850;
  const dustBase = BABYLON.MeshBuilder.CreateSphere("ritualV3DustBase", { diameter: 0.024, segments: 4 }, bjsScene);
  dustBase.parent = root;
  dustBase.isPickable = false;

  const dustMat = new BABYLON.StandardMaterial("ritualV3DustMat", bjsScene);
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
    composeTo(i, Math.cos(d.a) * d.r, d.y, Math.sin(d.a) * d.r, 1.0 * d.s);
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
  let shock = 0; // beat shock envelope
  let ink = 0; // blacklight ink envelope

  function setUniforms(mat: BABYLON.ShaderMaterial, variant: number, rms: number, bass: number, mid: number, high: number, beat: number, intensity: number) {
    mat.setFloat("time", time);
    mat.setFloat("bass", bass);
    mat.setFloat("mid", mid);
    mat.setFloat("high", high);
    mat.setFloat("rms", rms);
    mat.setFloat("beat", beat);
    mat.setFloat("intensity", intensity);
    mat.setFloat("shock", shock);
    mat.setFloat("ink", ink);
    mat.setFloat("uVariant", variant);
  }

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
      const inkTarget = clamp01(0.52 * high + 0.22 * rms + 0.45 * shock);
      const rate = inkTarget > ink ? 6.5 : 2.2;
      ink = ink + (inkTarget - ink) * (1 - Math.exp(-rate * dtc));

      // set material uniforms (different variants)
      setUniforms(matCenter, 0.0, rms, bass, mid, high, beat, intensity);
      setUniforms(matLeft, 1.0, rms, bass, mid, high, beat, intensity);
      setUniforms(matRight, 2.0, rms, bass, mid, high, beat, intensity);

      // side walls drift slightly (fabric panel feel)
      leftWall.position.z = 0.55 + 0.05 * Math.sin(time * 0.35);
      rightWall.position.z = 0.55 + 0.05 * Math.cos(time * 0.33);

      // glow + fog react
      if (glow) glow.intensity = 0.95 + 0.95 * (rms + high) + 0.50 * shock + 0.70 * ink;
      bjsScene.fogDensity = (heavyEdges ? 0.022 : 0.013) + 0.02 * (0.55 * rms + 0.75 * shock);

      // vignette heavier in low energy, opens slightly on shock
      vigMat.alpha = (heavyEdges ? 0.30 : 0.18) + 0.16 * (1.0 - high) + 0.10 * shock;

      // subtle "fabric breath"
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
      leftWall.dispose(false, true);
      rightWall.dispose(false, true);

      matCenter.dispose(true, true);
      matLeft.dispose(true, true);
      matRight.dispose(true, true);

      hemi.dispose();
      key.dispose();
      rim.dispose();

      root.dispose();
    },
  };
}
