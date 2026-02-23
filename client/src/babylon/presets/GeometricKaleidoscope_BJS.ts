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

function palette(t: number) {
  const a = new BABYLON.Color3(0.10, 0.85, 0.98);
  const b = new BABYLON.Color3(0.20, 0.35, 1.00);
  const c = new BABYLON.Color3(0.95, 0.20, 0.95);
  const d = new BABYLON.Color3(0.98, 0.80, 0.22);

  const u = ((t % 1) + 1) % 1;
  if (u < 0.33) return BABYLON.Color3.Lerp(a, b, u / 0.33);
  if (u < 0.66) return BABYLON.Color3.Lerp(b, c, (u - 0.33) / 0.33);
  return BABYLON.Color3.Lerp(c, d, (u - 0.66) / 0.34);
}

export function createGeometricKaleidoscopePreset(
  scene: unknown,
  opts?: { enableGlow?: boolean; heavyEdges?: boolean },
): BabylonPresetRuntime {
  const bjsScene = scene as any;
  const enableGlow = opts?.enableGlow ?? true;
  const heavyEdges = opts?.heavyEdges ?? true;

  const SEGMENTS = 14;
  const LAYERS = 6;
  const RADIUS = 3.2;
  const DEPTH = 2.2;

  const WEDGE_ARC = (Math.PI * 2) / SEGMENTS;
  const WEDGE_WIDTH = RADIUS * 1.12;
  const WEDGE_HEIGHT = RADIUS * 1.12;

  const FOG_BASE = 0.010;
  const FOG_REACT = 0.018;

  const VIGNETTE_ALPHA_OUTER = heavyEdges ? 0.50 : 0.34;
  const VIGNETTE_ALPHA_INNER = heavyEdges ? 0.26 : 0.16;

  const ROT_BASE = 0.18;
  const ROT_MID_GAIN = 0.95;
  const SHIMMER_HIGH_GAIN = 0.55;

  const PULSE_DECAY = 7.0;
  const PULSE_GAIN = 0.26;

  const root = new BABYLON.TransformNode("kaleidRoot", bjsScene);

  const hemi = new BABYLON.HemisphericLight("kHemi", new BABYLON.Vector3(0.2, 1, 0.1), bjsScene);
  hemi.intensity = 0.45;

  const key = new BABYLON.PointLight("kKey", new BABYLON.Vector3(0, 2.2, -2.2), bjsScene);
  key.intensity = 18;
  key.radius = 16;

  const prevFogMode = bjsScene.fogMode;
  const prevFogDensity = bjsScene.fogDensity;
  const prevFogColor = bjsScene.fogColor ? bjsScene.fogColor.clone() : null;

  bjsScene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  bjsScene.fogColor = new BABYLON.Color3(0.01, 0.015, 0.03);
  bjsScene.fogDensity = FOG_BASE;

  let glow: any = null;
  if (enableGlow) {
    glow = new BABYLON.GlowLayer("kGlow", bjsScene, { blurKernelSize: 64 });
    glow.intensity = 0.75;
  }

  const wedge = BABYLON.MeshBuilder.CreatePlane(
    "kWedgeBase",
    { width: WEDGE_WIDTH, height: WEDGE_HEIGHT, sideOrientation: BABYLON.Mesh.DOUBLESIDE },
    bjsScene,
  );
  wedge.parent = root;
  wedge.isPickable = false;

  const wedgeMat = new BABYLON.StandardMaterial("kWedgeMat", bjsScene);
  wedgeMat.diffuseColor = new BABYLON.Color3(0.02, 0.02, 0.02);
  wedgeMat.specularColor = new BABYLON.Color3(0.08, 0.08, 0.09);
  wedgeMat.emissiveColor = new BABYLON.Color3(0.20, 0.75, 1.15);
  wedgeMat.alpha = 0.85;
  wedgeMat.backFaceCulling = false;
  (wedgeMat as any).useVertexColor = true;
  (wedgeMat as any).useVertexColors = true;
  wedge.material = wedgeMat;

  const INSTANCE_COUNT = SEGMENTS * LAYERS;
  const matrices = new Float32Array(INSTANCE_COUNT * 16);
  const colors = new Float32Array(INSTANCE_COUNT * 4);
  wedge.thinInstanceSetBuffer("matrix", matrices, 16, true);
  wedge.thinInstanceSetBuffer("color", colors, 4, true);

  const core = BABYLON.MeshBuilder.CreateSphere("kCore", { diameter: 0.55, segments: 20 }, bjsScene);
  core.parent = root;
  core.isPickable = false;

  const coreMat = new BABYLON.StandardMaterial("kCoreMat", bjsScene);
  coreMat.diffuseColor = new BABYLON.Color3(0.02, 0.02, 0.03);
  coreMat.specularColor = new BABYLON.Color3(0.12, 0.12, 0.13);
  coreMat.emissiveColor = new BABYLON.Color3(0.30, 0.95, 1.35);
  coreMat.alpha = 0.95;
  coreMat.backFaceCulling = false;
  core.material = coreMat;

  coreMat.emissiveFresnelParameters = new BABYLON.FresnelParameters();
  coreMat.emissiveFresnelParameters.isEnabled = true;
  coreMat.emissiveFresnelParameters.leftColor = new BABYLON.Color3(0.05, 0.10, 0.18);
  coreMat.emissiveFresnelParameters.rightColor = new BABYLON.Color3(0.65, 1.05, 1.55);
  coreMat.emissiveFresnelParameters.power = 2.8;
  coreMat.emissiveFresnelParameters.bias = 0.08;

  const vignetteOuter = BABYLON.MeshBuilder.CreateDisc(
    "kVignetteOuter",
    { radius: RADIUS * 1.15, tessellation: 96 },
    bjsScene,
  );
  vignetteOuter.parent = root;
  vignetteOuter.isPickable = false;
  vignetteOuter.position.z = -0.35;

  const vigOuterMat = new BABYLON.StandardMaterial("kVigOuterMat", bjsScene);
  vigOuterMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
  vigOuterMat.specularColor = new BABYLON.Color3(0, 0, 0);
  vigOuterMat.emissiveColor = new BABYLON.Color3(0, 0, 0);
  vigOuterMat.alpha = VIGNETTE_ALPHA_OUTER;
  vigOuterMat.backFaceCulling = false;
  vignetteOuter.material = vigOuterMat;

  const vignetteInner = vignetteOuter.clone("kVignetteInner") as any;
  vignetteInner.scaling.setAll(0.84);
  vignetteInner.position.z = -0.34;

  const vigInnerMat = vigOuterMat.clone("kVigInnerMat") as any;
  vigInnerMat.alpha = VIGNETTE_ALPHA_INNER;
  vignetteInner.material = vigInnerMat;

  const tmpM = new BABYLON.Matrix();
  const tmpQ = new BABYLON.Quaternion();
  const tmpPos = new BABYLON.Vector3();

  type Inst = {
    seg: number;
    layer: number;
    baseAngle: number;
    baseZ: number;
    baseScale: number;
    phase: number;
  };
  const inst: Inst[] = [];

  let idx = 0;
  for (let l = 0; l < LAYERS; l++) {
    const tL = l / Math.max(1, LAYERS - 1);
    const z = -DEPTH * 0.5 + tL * DEPTH;
    const sc = 0.42 + 0.78 * (1 - tL);

    for (let s = 0; s < SEGMENTS; s++) {
      const a = s * WEDGE_ARC;

      inst.push({
        seg: s,
        layer: l,
        baseAngle: a,
        baseZ: z,
        baseScale: sc,
        phase: Math.random() * Math.PI * 2,
      });

      const col = palette(s / SEGMENTS + tL * 0.25);
      colors[idx * 4 + 0] = col.r;
      colors[idx * 4 + 1] = col.g;
      colors[idx * 4 + 2] = col.b;
      colors[idx * 4 + 3] = 1.0;
      idx++;
    }
  }

  idx = 0;
  for (const it of inst) {
    tmpPos.set(0, 0, it.baseZ);
    BABYLON.Quaternion.FromEulerAnglesToRef(0, 0, it.baseAngle, tmpQ);
    BABYLON.Matrix.ComposeToRef(new BABYLON.Vector3(it.baseScale, it.baseScale, 1), tmpQ, tmpPos, tmpM);
    tmpM.copyToArray(matrices, idx * 16);
    idx++;
  }
  wedge.thinInstanceBufferUpdated("matrix");
  wedge.thinInstanceBufferUpdated("color");

  let time = 0;
  let env = 0;
  let prevBeat = 0;
  let beatEnv = 0;

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

      const target = clamp01(0.55 * rms + 0.35 * bass + 0.35 * beat);
      const rate = target > env ? 16 : 6;
      env = env + (target - env) * (1 - Math.exp(-rate * dtc));

      const beatEdge = beat > 0.62 && prevBeat <= 0.62;
      prevBeat = beat;
      if (beatEdge) beatEnv = 1.0;
      beatEnv *= Math.exp(-PULSE_DECAY * dtc);

      bjsScene.fogDensity = FOG_BASE + FOG_REACT * (0.45 * rms + 0.85 * env);
      if (glow) glow.intensity = 0.55 + 0.60 * env + 0.45 * high;

      root.rotation.z = Math.sin(time * 0.18) * 0.06;
      root.rotation.y = Math.cos(time * 0.14) * 0.05;

      const rot = time * (ROT_BASE + ROT_MID_GAIN * mid) + 0.35 * Math.sin(time * 0.35);
      const shimmer = SHIMMER_HIGH_GAIN * high;

      wedgeMat.alpha = 0.70 + 0.18 * env + 0.10 * high;
      wedgeMat.emissiveColor = new BABYLON.Color3(
        0.10 + 0.18 * shimmer + 0.18 * env,
        0.45 + 0.55 * rms,
        0.95 + 0.65 * env + 0.55 * high,
      );

      core.scaling.setAll(1.0 + 0.18 * env + 0.10 * beatEnv);
      coreMat.emissiveColor = new BABYLON.Color3(
        0.22 + 0.25 * high + 0.25 * beatEnv,
        0.75 + 0.55 * rms,
        1.10 + 0.55 * env + 0.55 * high,
      );

      vigOuterMat.alpha = VIGNETTE_ALPHA_OUTER + 0.14 * env;
      vigInnerMat.alpha = VIGNETTE_ALPHA_INNER + 0.10 * rms;

      const bassPulse =
        1 +
        PULSE_GAIN * (0.55 * bass + 0.75 * beatEnv) * (0.65 + 0.35 * intensity);
      const sym = 0.55 + 0.45 * Math.sin(time * (0.35 + mid * 0.8));

      idx = 0;
      for (const it of inst) {
        const tL = it.layer / Math.max(1, LAYERS - 1);
        const depthFade = 0.35 + 0.65 * (1 - tL);

        const segWob =
          0.10 * Math.sin(time * (0.9 + 0.8 * mid) + it.phase + it.seg * 0.7) * (0.25 + env) +
          0.07 * Math.cos(time * (1.1 + 1.2 * high) + it.phase * 1.3) * (0.15 + high);
        const segAlt = (it.seg % 2 === 0 ? 1 : -1) * (0.12 * (sym - 0.5));
        const angle = it.baseAngle + rot + segWob + segAlt;

        const sc = it.baseScale * bassPulse * (0.90 + 0.20 * depthFade);
        const iris = 1.0 - 0.10 * high * (0.35 + 0.65 * tL);
        const scx = sc * iris;
        const scy = sc * (1.0 + 0.08 * shimmer);
        const z =
          it.baseZ +
          0.12 * Math.sin(time * 0.8 + it.phase) * (0.25 + env) -
          0.15 * high * (tL - 0.5);

        tmpPos.set(0, 0, z);
        BABYLON.Quaternion.FromEulerAnglesToRef(0, 0, angle, tmpQ);
        BABYLON.Matrix.ComposeToRef(new BABYLON.Vector3(scx, scy, 1), tmpQ, tmpPos, tmpM);
        tmpM.copyToArray(matrices, idx * 16);

        const col = palette((it.seg / SEGMENTS) + time * 0.02 + tL * 0.15);
        const bright = (0.55 + 1.25 * env + 0.85 * high + 0.65 * beatEnv) * depthFade;
        colors[idx * 4 + 0] = col.r * bright;
        colors[idx * 4 + 1] = col.g * bright;
        colors[idx * 4 + 2] = col.b * bright;
        colors[idx * 4 + 3] = 1.0;
        idx++;
      }

      wedge.thinInstanceBufferUpdated("matrix");
      wedge.thinInstanceBufferUpdated("color");
    },

    dispose() {
      bjsScene.fogMode = prevFogMode;
      bjsScene.fogDensity = prevFogDensity;
      if (prevFogColor) bjsScene.fogColor = prevFogColor;

      glow?.dispose();

      vignetteInner.dispose(false, true);
      vigInnerMat.dispose(true, true);
      vignetteOuter.dispose(false, true);
      vigOuterMat.dispose(true, true);

      core.dispose(false, true);
      coreMat.dispose(true, true);

      wedge.dispose(false, true);
      wedgeMat.dispose(true, true);

      hemi.dispose();
      key.dispose();

      root.dispose();
    },
  };
}
