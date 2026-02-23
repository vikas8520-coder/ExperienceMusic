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

type RingsPortalOptions = {
  enableGlow?: boolean;
  verticalPortal?: boolean;
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function ringPalette(t: number) {
  const a = new BABYLON.Color3(0.10, 0.85, 0.98);
  const b = new BABYLON.Color3(0.20, 0.35, 1.00);
  const c = new BABYLON.Color3(0.95, 0.20, 0.95);
  const d = new BABYLON.Color3(0.98, 0.80, 0.22);

  const u = ((t % 1) + 1) % 1;
  if (u < 0.33) return BABYLON.Color3.Lerp(a, b, u / 0.33);
  if (u < 0.66) return BABYLON.Color3.Lerp(b, c, (u - 0.33) / 0.33);
  return BABYLON.Color3.Lerp(c, d, (u - 0.66) / 0.34);
}

export function createRingsPortalPreset(
  scene: unknown,
  opts?: RingsPortalOptions,
): BabylonPresetRuntime {
  const bjsScene = scene as BABYLON.Scene;
  const enableGlow = opts?.enableGlow ?? true;
  const verticalPortal = opts?.verticalPortal ?? true;

  const RING_COUNT = 240;
  const RING_RADIUS = 2.35;
  const RING_THICKNESS = 0.019;
  const DEPTH = 16.0;

  const SHOCK_MAX = 6;
  const SHOCK_SPEED = 10.8;
  const SHOCK_WIDTH = 0.55;
  const SHOCK_GAIN = 2.4;

  const FOG_BASE = 0.012;
  const FOG_REACT = 0.019;
  const VIGNETTE_ALPHA_OUTER = 0.36;
  const VIGNETTE_ALPHA_INNER = 0.18;

  const TWIST_GAIN = 0.68;
  const ROTATE_SPEED = 0.2;

  const CORK_AMP = 0.24;
  const CORK_FREQ = 1.55;
  const CORK_SPEED = 0.5;
  const CORK_AUDIO = 0.68;

  const DUST_COUNT = 2400;
  const DUST_RADIUS = RING_RADIUS * 0.85;
  const DUST_FLOW_SPEED = 2.9;
  const DUST_SWIRL = 1.42;
  const DUST_JITTER = 0.085;
  const DUST_SIZE_BASE = 0.018;
  const DUST_SIZE_VAR = 0.022;

  const STREAK_COUNT = 420;

  const root = new BABYLON.TransformNode("ringsPortalRoot", bjsScene);

  const hemi = new BABYLON.HemisphericLight("ringsHemi", new BABYLON.Vector3(0, 1, 0.15), bjsScene);
  hemi.intensity = 0.65;

  const key = new BABYLON.PointLight("ringsKey", new BABYLON.Vector3(0, 2.0, -1.8), bjsScene);
  key.intensity = 22;
  key.radius = 18;

  const rimLight = new BABYLON.PointLight("ringsRim", new BABYLON.Vector3(0, 1.4, 2.6), bjsScene);
  rimLight.intensity = 13;
  rimLight.radius = 16;
  rimLight.diffuse = new BABYLON.Color3(0.6, 0.25, 1.0);

  const prevFogMode = bjsScene.fogMode;
  const prevFogDensity = bjsScene.fogDensity;
  const prevFogColor = bjsScene.fogColor ? bjsScene.fogColor.clone() : null;

  bjsScene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  bjsScene.fogColor = new BABYLON.Color3(0.01, 0.015, 0.03);
  bjsScene.fogDensity = FOG_BASE;

  let glow: BABYLON.GlowLayer | null = null;
  if (enableGlow) {
    glow = new BABYLON.GlowLayer("ringsGlow", bjsScene, { blurKernelSize: 72 });
    glow.intensity = 0.68;
  }

  const backGlow = BABYLON.MeshBuilder.CreateTorus(
    "ringsBackGlow",
    { diameter: RING_RADIUS * 2.05, thickness: 0.14, tessellation: 128 },
    bjsScene,
  );
  backGlow.parent = root;
  backGlow.isPickable = false;
  if (verticalPortal) backGlow.rotation.y = Math.PI / 2;
  else backGlow.rotation.x = Math.PI / 2;
  backGlow.position.z = 0.8;

  const backGlowMat = new BABYLON.StandardMaterial("ringsBackGlowMat", bjsScene);
  backGlowMat.diffuseColor = BABYLON.Color3.Black();
  backGlowMat.specularColor = BABYLON.Color3.Black();
  backGlowMat.emissiveColor = new BABYLON.Color3(0.08, 0.35, 0.9);
  backGlowMat.alpha = 0.55;
  backGlowMat.backFaceCulling = false;
  backGlow.material = backGlowMat;

  const entranceHalo = BABYLON.MeshBuilder.CreateTorus(
    "ringsEntranceHalo",
    { diameter: RING_RADIUS * 2.25, thickness: 0.09, tessellation: 128 },
    bjsScene,
  );
  entranceHalo.parent = root;
  if (verticalPortal) entranceHalo.rotation.y = Math.PI / 2;
  else entranceHalo.rotation.x = Math.PI / 2;

  const entranceHaloMat = new BABYLON.StandardMaterial("ringsEntranceHaloMat", bjsScene);
  entranceHaloMat.diffuseColor = BABYLON.Color3.Black();
  entranceHaloMat.specularColor = BABYLON.Color3.Black();
  entranceHaloMat.emissiveColor = new BABYLON.Color3(0.3, 0.75, 1.4);
  entranceHaloMat.alpha = 0.3;
  entranceHaloMat.backFaceCulling = false;
  entranceHalo.material = entranceHaloMat;

  const portalCore = BABYLON.MeshBuilder.CreateSphere(
    "ringsPortalCore",
    { diameter: 0.7, segments: 24 },
    bjsScene,
  );
  portalCore.parent = root;
  const portalCoreMat = new BABYLON.StandardMaterial("ringsPortalCoreMat", bjsScene);
  portalCoreMat.diffuseColor = new BABYLON.Color3(0.02, 0.02, 0.03);
  portalCoreMat.specularColor = new BABYLON.Color3(0.04, 0.04, 0.06);
  portalCoreMat.emissiveColor = new BABYLON.Color3(0.24, 0.9, 1.65);
  portalCoreMat.alpha = 0.85;
  portalCore.material = portalCoreMat;

  portalCoreMat.emissiveFresnelParameters = new BABYLON.FresnelParameters();
  portalCoreMat.emissiveFresnelParameters.isEnabled = true;
  portalCoreMat.emissiveFresnelParameters.leftColor = new BABYLON.Color3(0.04, 0.09, 0.14);
  portalCoreMat.emissiveFresnelParameters.rightColor = new BABYLON.Color3(0.55, 1.1, 1.85);
  portalCoreMat.emissiveFresnelParameters.power = 2.6;
  portalCoreMat.emissiveFresnelParameters.bias = 0.06;

  const baseRing = BABYLON.MeshBuilder.CreateTorus(
    "ringsBaseRing",
    { diameter: RING_RADIUS * 2, thickness: RING_THICKNESS, tessellation: 96 },
    bjsScene,
  );
  baseRing.parent = root;
  baseRing.isPickable = false;
  if (verticalPortal) baseRing.rotation.y = Math.PI / 2;
  else baseRing.rotation.x = Math.PI / 2;

  const ringMat = new BABYLON.StandardMaterial("ringsMat", bjsScene);
  ringMat.diffuseColor = new BABYLON.Color3(0.04, 0.04, 0.05);
  ringMat.specularColor = new BABYLON.Color3(0.08, 0.08, 0.09);
  ringMat.emissiveColor = new BABYLON.Color3(0.10, 0.65, 1.10);
  ringMat.alpha = 0.95;
  ringMat.backFaceCulling = false;
  (ringMat as any).useVertexColor = true;
  (ringMat as any).useVertexColors = true;

  const matrices = new Float32Array(RING_COUNT * 16);
  const colors = new Float32Array(RING_COUNT * 4);
  baseRing.thinInstanceSetBuffer("matrix", matrices, 16, true);
  baseRing.thinInstanceSetBuffer("color", colors, 4, true);
  baseRing.material = ringMat;

  const sweepRingA = BABYLON.MeshBuilder.CreateTorus(
    "ringsSweepA",
    { diameter: RING_RADIUS * 2.08, thickness: 0.055, tessellation: 128 },
    bjsScene,
  );
  sweepRingA.parent = root;
  if (verticalPortal) sweepRingA.rotation.y = Math.PI / 2;
  else sweepRingA.rotation.x = Math.PI / 2;
  const sweepMatA = new BABYLON.StandardMaterial("ringsSweepMatA", bjsScene);
  sweepMatA.diffuseColor = BABYLON.Color3.Black();
  sweepMatA.specularColor = BABYLON.Color3.Black();
  sweepMatA.emissiveColor = new BABYLON.Color3(0.5, 1.0, 1.7);
  sweepMatA.alpha = 0;
  sweepMatA.backFaceCulling = false;
  sweepRingA.material = sweepMatA;

  const sweepRingB = BABYLON.MeshBuilder.CreateTorus(
    "ringsSweepB",
    { diameter: RING_RADIUS * 1.92, thickness: 0.04, tessellation: 120 },
    bjsScene,
  );
  sweepRingB.parent = root;
  if (verticalPortal) sweepRingB.rotation.y = Math.PI / 2;
  else sweepRingB.rotation.x = Math.PI / 2;
  const sweepMatB = new BABYLON.StandardMaterial("ringsSweepMatB", bjsScene);
  sweepMatB.diffuseColor = BABYLON.Color3.Black();
  sweepMatB.specularColor = BABYLON.Color3.Black();
  sweepMatB.emissiveColor = new BABYLON.Color3(1.0, 0.45, 1.45);
  sweepMatB.alpha = 0;
  sweepMatB.backFaceCulling = false;
  sweepRingB.material = sweepMatB;

  const vignetteOuter = BABYLON.MeshBuilder.CreateDisc(
    "ringsVignetteOuter",
    { radius: RING_RADIUS * 2.6, tessellation: 96 },
    bjsScene,
  );
  vignetteOuter.parent = root;
  vignetteOuter.isPickable = false;
  if (verticalPortal) vignetteOuter.rotation.y = Math.PI / 2;
  else vignetteOuter.rotation.x = Math.PI / 2;
  vignetteOuter.position.z = -2.0;

  const vignetteOuterMat = new BABYLON.StandardMaterial("ringsVignetteOuterMat", bjsScene);
  vignetteOuterMat.diffuseColor = BABYLON.Color3.Black();
  vignetteOuterMat.emissiveColor = BABYLON.Color3.Black();
  vignetteOuterMat.specularColor = BABYLON.Color3.Black();
  vignetteOuterMat.alpha = VIGNETTE_ALPHA_OUTER;
  vignetteOuterMat.backFaceCulling = false;
  vignetteOuter.material = vignetteOuterMat;

  const vignetteInner = vignetteOuter.clone("ringsVignetteInner") as BABYLON.Mesh;
  vignetteInner.scaling.setAll(0.82);
  vignetteInner.position.z = -1.98;

  const vignetteInnerMat = vignetteOuterMat.clone("ringsVignetteInnerMat") as BABYLON.StandardMaterial;
  vignetteInnerMat.alpha = VIGNETTE_ALPHA_INNER;
  vignetteInner.material = vignetteInnerMat;

  const dustBase = BABYLON.MeshBuilder.CreateSphere(
    "ringsDustBase",
    { diameter: DUST_SIZE_BASE, segments: 6 },
    bjsScene,
  );
  dustBase.parent = root;
  dustBase.isPickable = false;

  const dustMat = new BABYLON.StandardMaterial("ringsDustMat", bjsScene);
  dustMat.diffuseColor = BABYLON.Color3.Black();
  dustMat.specularColor = BABYLON.Color3.Black();
  dustMat.emissiveColor = new BABYLON.Color3(0.40, 0.85, 1.15);
  dustMat.alpha = 0.70;
  dustMat.backFaceCulling = false;
  dustBase.material = dustMat;

  const dustMatrices = new Float32Array(DUST_COUNT * 16);
  dustBase.thinInstanceSetBuffer("matrix", dustMatrices, 16, true);

  const streakBase = BABYLON.MeshBuilder.CreateBox(
    "ringsStreakBase",
    { width: 0.014, height: 0.014, depth: 0.22 },
    bjsScene,
  );
  streakBase.parent = root;
  streakBase.isPickable = false;
  const streakMat = new BABYLON.StandardMaterial("ringsStreakMat", bjsScene);
  streakMat.diffuseColor = BABYLON.Color3.Black();
  streakMat.specularColor = BABYLON.Color3.Black();
  streakMat.emissiveColor = new BABYLON.Color3(0.55, 0.95, 1.8);
  streakMat.alpha = 0.5;
  streakMat.backFaceCulling = false;
  streakBase.material = streakMat;

  const streakMatrices = new Float32Array(STREAK_COUNT * 16);
  streakBase.thinInstanceSetBuffer("matrix", streakMatrices, 16, true);

  type Dust = { a: number; r: number; z: number; w: number; spin: number };
  const dust: Dust[] = Array.from({ length: DUST_COUNT }, () => {
    const a = Math.random() * Math.PI * 2;
    const r = Math.pow(Math.random(), 0.55) * DUST_RADIUS;
    const z = (Math.random() - 0.5) * DEPTH;
    const w = 0.4 + Math.random() * 1.8;
    const spin = (Math.random() * 2 - 1) * (0.8 + Math.random() * 1.6);
    return { a, r, z, w, spin };
  });

  type Streak = { a: number; r: number; z: number; speed: number; w: number; phase: number };
  const streaks: Streak[] = Array.from({ length: STREAK_COUNT }, () => ({
    a: Math.random() * Math.PI * 2,
    r: (0.45 + Math.random() * 0.55) * RING_RADIUS,
    z: (Math.random() - 0.5) * DEPTH,
    speed: 0.5 + Math.random() * 1.3,
    w: 0.55 + Math.random() * 1.2,
    phase: Math.random() * Math.PI * 2,
  }));

  type Shock = { z: number; strength: number; alive: boolean };
  const shocks: Shock[] = Array.from({ length: SHOCK_MAX }, () => ({
    z: -DEPTH * 0.5,
    strength: 0,
    alive: false,
  }));

  const tmpM = new BABYLON.Matrix();
  const tmpQ = BABYLON.Quaternion.Identity();
  const tmpScale = new BABYLON.Vector3();
  const tmpPos = new BABYLON.Vector3();

  function emitShock(strength: number) {
    let idx = shocks.findIndex((s) => !s.alive);
    if (idx === -1) {
      idx = 0;
      for (let i = 1; i < shocks.length; i++) {
        if (shocks[i].strength < shocks[idx].strength) idx = i;
      }
    }
    shocks[idx].alive = true;
    shocks[idx].z = -DEPTH * 0.5;
    shocks[idx].strength = strength;
  }

  function composeTo(
    arr: Float32Array,
    i: number,
    sx: number,
    sy: number,
    sz: number,
    q: BABYLON.Quaternion,
    x: number,
    y: number,
    z: number,
  ) {
    tmpScale.set(sx, sy, sz);
    tmpPos.set(x, y, z);
    BABYLON.Matrix.ComposeToRef(tmpScale, q, tmpPos, tmpM);
    tmpM.copyToArray(arr, i * 16);
  }

  for (let i = 0; i < RING_COUNT; i++) {
    const t = i / (RING_COUNT - 1);
    const z = -DEPTH * 0.5 + t * DEPTH;
    const scale = 1.0 + 0.12 * t;

    composeTo(matrices, i, scale, 1, scale, tmpQ, 0, 0, z);

    const col = ringPalette(t * 1.05);
    colors[i * 4 + 0] = col.r;
    colors[i * 4 + 1] = col.g;
    colors[i * 4 + 2] = col.b;
    colors[i * 4 + 3] = 1.0;
  }
  baseRing.thinInstanceBufferUpdated("matrix");
  baseRing.thinInstanceBufferUpdated("color");

  for (let i = 0; i < DUST_COUNT; i++) {
    const p = dust[i];
    const x = Math.cos(p.a) * p.r;
    const y = Math.sin(p.a) * p.r;
    const s = 0.6 + p.w * 0.35;
    composeTo(dustMatrices, i, s, s, s, tmpQ, x, y, p.z);
  }
  dustBase.thinInstanceBufferUpdated("matrix");

  for (let i = 0; i < STREAK_COUNT; i++) {
    const s = streaks[i];
    const x = Math.cos(s.a) * s.r;
    const y = Math.sin(s.a) * s.r;
    const scale = 0.55 + 0.65 * s.w;
    composeTo(streakMatrices, i, scale, scale, 2.0 + 2.8 * s.w, tmpQ, x, y, s.z);
  }
  streakBase.thinInstanceBufferUpdated("matrix");

  let time = 0;
  let env = 0;
  let scanEnv = 0;
  let scanPos = -DEPTH * 0.5;
  let prevBeat = 0;

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

      const target = clamp01(0.55 * beat + 0.35 * bass + 0.20 * rms);
      const rate = target > env ? 18 : 6;
      env = env + (target - env) * (1 - Math.exp(-rate * dtc));

      const beatEdge = beat > 0.62 && prevBeat <= 0.62;
      prevBeat = beat;
      if (beatEdge) {
        emitShock(0.78 + 0.95 * env + 0.65 * high);
        scanEnv = 1;
      }

      scanEnv *= Math.exp(-2.8 * dtc);
      scanPos += dtc * (7.5 + 4.8 * mid + 3.4 * high);
      if (scanPos > DEPTH * 0.5 + 0.8) scanPos = -DEPTH * 0.5;

      bjsScene.fogDensity = FOG_BASE + FOG_REACT * (0.52 * rms + 0.94 * env);
      if (glow) {
        glow.intensity = 0.55 + 0.6 * rms + 0.52 * high + 0.42 * env;
      }

      vignetteOuterMat.alpha = VIGNETTE_ALPHA_OUTER + 0.16 * env;
      vignetteInnerMat.alpha = VIGNETTE_ALPHA_INNER + 0.11 * rms;

      root.rotation.z = Math.sin(time * 0.28) * 0.045;
      root.rotation.y = Math.sin(time * 0.22) * 0.05;
      root.rotation.x = Math.cos(time * 0.18) * 0.02;

      const twist = TWIST_GAIN * (0.55 * mid + 0.85 * high);
      const rotBase = time * ROTATE_SPEED;

      const corkAmp = CORK_AMP * (0.55 + CORK_AUDIO * (0.45 * env + 0.55 * mid));
      const corkSpeed = CORK_SPEED * (0.55 + 0.75 * mid + 0.65 * high);
      const corkPhaseBase = time * corkSpeed;

      for (const shock of shocks) {
        if (!shock.alive) continue;
        shock.z += SHOCK_SPEED * dtc;
        shock.strength *= Math.exp(-1.6 * dtc);
        if (shock.z > DEPTH * 0.5 + 1.0 || shock.strength < 0.05) {
          shock.alive = false;
        }
      }

      const scanHotWidth = 0.62 + 0.35 * env;
      for (let i = 0; i < RING_COUNT; i++) {
        const t = i / (RING_COUNT - 1);
        const z = -DEPTH * 0.5 + t * DEPTH;

        let scale = 1.0 + 0.12 * t;
        scale *= 1.0 + 0.03 * Math.sin(time * 1.2 + t * 7.0) * (0.35 + rms);
        scale *= 1.0 + 0.12 * bass * (0.2 + t);

        let shockBoost = 0;
        for (const shock of shocks) {
          if (!shock.alive) continue;
          const dz = Math.abs(z - shock.z);
          if (dz < SHOCK_WIDTH) {
            const k = 1 - dz / SHOCK_WIDTH;
            shockBoost += k * shock.strength * SHOCK_GAIN;
          }
        }

        const dzScan = Math.abs(z - scanPos);
        const scanBoost = dzScan < scanHotWidth
          ? (1 - dzScan / scanHotWidth) * (0.45 + 0.95 * scanEnv)
          : 0;

        const depthFade = 0.33 + 0.67 * (1 - t);
        const energy = (0.35 * rms + 0.55 * env + 0.30 * high) * (0.6 + 0.4 * intensity);

        const ringRot = rotBase + twist * (t - 0.5) * 1.25;
        const corkPhase = corkPhaseBase + t * Math.PI * 2 * CORK_FREQ;
        const ox = Math.cos(corkPhase) * (corkAmp * RING_RADIUS);
        const oy = Math.sin(corkPhase) * (corkAmp * RING_RADIUS);

        const q = BABYLON.Quaternion.FromEulerAngles(
          verticalPortal ? 0 : ringRot,
          verticalPortal ? ringRot : 0,
          0,
        );

        composeTo(matrices, i, scale, 1, scale, q, ox, oy, z);

        const col = ringPalette(t * 1.15 + time * (0.02 + 0.08 * mid));
        const bright = (0.58 + 1.4 * energy + shockBoost + scanBoost * 2.0) * depthFade;

        const hotMix = clamp01(scanBoost * 0.9 + shockBoost * 0.16);
        const r = col.r + (1 - col.r) * hotMix;
        const g = col.g + (1 - col.g) * hotMix;
        const b = col.b + (1 - col.b) * hotMix;

        colors[i * 4 + 0] = r * bright;
        colors[i * 4 + 1] = g * bright;
        colors[i * 4 + 2] = b * bright;
        colors[i * 4 + 3] = 1.0;
      }

      baseRing.thinInstanceBufferUpdated("matrix");
      baseRing.thinInstanceBufferUpdated("color");

      sweepRingA.position.z = scanPos;
      sweepRingA.scaling.setAll(1.0 + 0.35 * scanEnv);
      sweepRingA.rotation.z += dtc * (0.2 + 1.5 * high);
      sweepMatA.alpha = 0.05 + 0.45 * scanEnv;
      sweepMatA.emissiveColor = new BABYLON.Color3(
        0.42 + 0.58 * scanEnv,
        0.88 + 0.45 * (scanEnv + rms),
        1.45 + 0.65 * (scanEnv + high),
      );

      sweepRingB.position.z = scanPos * 0.72;
      sweepRingB.scaling.setAll(1.0 + 0.24 * scanEnv);
      sweepRingB.rotation.x += dtc * (0.15 + 1.1 * mid);
      sweepMatB.alpha = 0.04 + 0.34 * scanEnv;
      sweepMatB.emissiveColor = new BABYLON.Color3(
        0.75 + 0.55 * (scanEnv + high),
        0.30 + 0.45 * (scanEnv + env),
        0.95 + 0.55 * (scanEnv + rms),
      );

      backGlowMat.emissiveColor = new BABYLON.Color3(
        0.06 + 0.24 * env,
        0.20 + 0.56 * rms,
        0.65 + 0.68 * high,
      );
      backGlowMat.alpha = 0.42 + 0.24 * env;

      entranceHalo.scaling.setAll(1.0 + 0.08 * env + 0.04 * Math.sin(time * 0.8));
      entranceHalo.rotation.z = Math.sin(time * 0.3) * 0.1;
      entranceHaloMat.alpha = 0.18 + 0.30 * env;
      entranceHaloMat.emissiveColor = new BABYLON.Color3(
        0.22 + 0.25 * env,
        0.55 + 0.55 * rms,
        1.1 + 0.72 * high,
      );

      portalCore.scaling.setAll(1.0 + 0.22 * env + 0.12 * scanEnv);
      portalCoreMat.alpha = 0.65 + 0.24 * env;
      portalCoreMat.emissiveColor = new BABYLON.Color3(
        0.2 + 0.35 * high,
        0.65 + 0.65 * rms,
        1.25 + 0.85 * env + 0.35 * scanEnv,
      );

      const flow = DUST_FLOW_SPEED * (0.55 + 0.9 * env + 0.45 * bass);
      const swirl = DUST_SWIRL * (0.55 + 0.75 * mid + 0.65 * high);

      const dustCol = ringPalette(time * 0.06 + mid * 0.2);
      dustMat.emissiveColor = new BABYLON.Color3(
        lerp(0.25, dustCol.r, 0.75) * (0.9 + 0.8 * high),
        lerp(0.55, dustCol.g, 0.65) * (0.8 + 0.8 * rms),
        lerp(0.95, dustCol.b, 0.85) * (0.9 + 0.9 * env),
      );
      dustMat.alpha = 0.3 + 0.45 * (0.55 * rms + 0.45 * env);

      for (let i = 0; i < DUST_COUNT; i++) {
        const p = dust[i];
        p.z += flow * dtc * (0.4 + 0.9 * p.w);
        if (p.z > DEPTH * 0.5) {
          p.z = -DEPTH * 0.5;
          p.r = Math.pow(Math.random(), 0.55) * DUST_RADIUS;
          p.w = 0.4 + Math.random() * 1.8;
        }

        p.a += dtc * swirl * p.spin * (0.35 + 0.8 * p.w);

        const j = DUST_JITTER * (0.35 + 0.65 * env);
        const rr = p.r * (0.85 + 0.20 * Math.sin(time * 0.8 + p.a));
        const x = Math.cos(p.a) * rr + Math.sin(time * 1.8 + i * 0.07) * j;
        const y = Math.sin(p.a) * rr + Math.cos(time * 1.6 + i * 0.05) * j;

        const s = (DUST_SIZE_BASE + DUST_SIZE_VAR * (0.25 + 0.75 * high)) * (0.55 + 0.65 * p.w);
        const sc = 0.6 + 18.0 * s;
        composeTo(dustMatrices, i, sc, sc, sc, tmpQ, x, y, p.z);
      }
      dustBase.thinInstanceBufferUpdated("matrix");

      streakMat.emissiveColor = new BABYLON.Color3(
        0.35 + 0.55 * high,
        0.75 + 0.52 * rms,
        1.25 + 0.82 * env,
      );
      streakMat.alpha = 0.25 + 0.35 * env;

      for (let i = 0; i < STREAK_COUNT; i++) {
        const p = streaks[i];
        p.z += dtc * (2.2 + 3.4 * env) * p.speed;
        if (p.z > DEPTH * 0.5) {
          p.z = -DEPTH * 0.5;
          p.r = (0.45 + Math.random() * 0.55) * RING_RADIUS;
          p.w = 0.55 + Math.random() * 1.2;
          p.speed = 0.5 + Math.random() * 1.3;
        }

        p.a += dtc * (0.2 + 0.65 * mid + 0.45 * high) * (0.35 + p.w * 0.5);
        const wob = 1 + 0.09 * Math.sin(time * 1.1 + p.phase);
        const x = Math.cos(p.a) * p.r * wob;
        const y = Math.sin(p.a) * p.r * wob;

        const sz = 1.6 + 3.2 * p.w * (0.8 + 0.6 * env);
        const ss = 0.45 + 0.75 * p.w;
        composeTo(streakMatrices, i, ss, ss, sz, tmpQ, x, y, p.z);
      }
      streakBase.thinInstanceBufferUpdated("matrix");
    },

    dispose() {
      bjsScene.fogMode = prevFogMode;
      bjsScene.fogDensity = prevFogDensity;
      if (prevFogColor) {
        bjsScene.fogColor = prevFogColor;
      }

      glow?.dispose();

      vignetteInner.dispose(false, true);
      vignetteInnerMat.dispose(true, true);
      vignetteOuter.dispose(false, true);
      vignetteOuterMat.dispose(true, true);

      baseRing.dispose(false, true);
      ringMat.dispose(true, true);

      sweepRingA.dispose(false, true);
      sweepMatA.dispose(true, true);
      sweepRingB.dispose(false, true);
      sweepMatB.dispose(true, true);

      portalCore.dispose(false, true);
      portalCoreMat.dispose(true, true);

      entranceHalo.dispose(false, true);
      entranceHaloMat.dispose(true, true);

      backGlow.dispose(false, true);
      backGlowMat.dispose(true, true);

      dustBase.dispose(false, true);
      dustMat.dispose(true, true);

      streakBase.dispose(false, true);
      streakMat.dispose(true, true);

      hemi.dispose();
      key.dispose();
      rimLight.dispose();

      root.dispose();
    },
  };
}
