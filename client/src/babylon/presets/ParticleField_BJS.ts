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
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

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

export function createParticleFieldPreset(
  scene: unknown,
  opts?: { enableGlow?: boolean },
): BabylonPresetRuntime {
  const bjsScene = scene as BABYLON.Scene;
  const enableGlow = opts?.enableGlow ?? true;

  const FIELD_R = 3.2;
  const CORE_COUNT = 5200;
  const GLOW_COUNT = 2200;
  const TRAIL_COUNT = 2800;

  const CORE_SIZE = 0.018;
  const GLOW_SIZE = 0.028;
  const TRAIL_SIZE = 0.018;

  const TRAIL_SPEED = 0.55;
  const TRAIL_DRAG = 0.985;
  const TWIST_GAIN = 0.55;

  const FOG_BASE = 0.008;
  const FOG_REACT = 0.016;

  const root = new BABYLON.TransformNode("particleFieldRoot", bjsScene);

  const hemi = new BABYLON.HemisphericLight("pfHemi", new BABYLON.Vector3(0.2, 1, 0.1), bjsScene);
  hemi.intensity = 0.55;

  const key = new BABYLON.PointLight("pfKey", new BABYLON.Vector3(0, 2.2, -2.2), bjsScene);
  key.intensity = 18;
  key.radius = 18;

  const prevFogMode = bjsScene.fogMode;
  const prevFogDensity = bjsScene.fogDensity;
  const prevFogColor = bjsScene.fogColor ? bjsScene.fogColor.clone() : null;

  bjsScene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  bjsScene.fogColor = new BABYLON.Color3(0.01, 0.015, 0.03);
  bjsScene.fogDensity = FOG_BASE;

  let glow: BABYLON.GlowLayer | null = null;
  if (enableGlow) {
    glow = new BABYLON.GlowLayer("pfGlow", bjsScene, { blurKernelSize: 64 });
    glow.intensity = 0.75;
  }

  const coreOrb = BABYLON.MeshBuilder.CreateSphere(
    "pfCoreOrb",
    { diameter: 0.62, segments: 24 },
    bjsScene,
  );
  coreOrb.parent = root;
  coreOrb.isPickable = false;

  const coreOrbMat = new BABYLON.StandardMaterial("pfCoreOrbMat", bjsScene);
  coreOrbMat.diffuseColor = new BABYLON.Color3(0.02, 0.02, 0.03);
  coreOrbMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.06);
  coreOrbMat.emissiveColor = new BABYLON.Color3(0.25, 0.9, 1.45);
  coreOrbMat.alpha = 0.9;
  coreOrb.material = coreOrbMat;

  coreOrbMat.emissiveFresnelParameters = new BABYLON.FresnelParameters();
  coreOrbMat.emissiveFresnelParameters.isEnabled = true;
  coreOrbMat.emissiveFresnelParameters.leftColor = new BABYLON.Color3(0.03, 0.09, 0.15);
  coreOrbMat.emissiveFresnelParameters.rightColor = new BABYLON.Color3(0.55, 1.05, 1.75);
  coreOrbMat.emissiveFresnelParameters.power = 2.8;
  coreOrbMat.emissiveFresnelParameters.bias = 0.08;

  const shockRingA = BABYLON.MeshBuilder.CreateTorus(
    "pfShockRingA",
    { diameter: 1.8, thickness: 0.08, tessellation: 128 },
    bjsScene,
  );
  shockRingA.parent = root;
  shockRingA.isPickable = false;
  shockRingA.rotation.x = Math.PI / 2;

  const shockRingAMat = new BABYLON.StandardMaterial("pfShockRingAMat", bjsScene);
  shockRingAMat.diffuseColor = BABYLON.Color3.Black();
  shockRingAMat.specularColor = BABYLON.Color3.Black();
  shockRingAMat.emissiveColor = new BABYLON.Color3(0.45, 1.0, 1.7);
  shockRingAMat.alpha = 0;
  shockRingAMat.backFaceCulling = false;
  shockRingA.material = shockRingAMat;

  const shockRingB = BABYLON.MeshBuilder.CreateTorus(
    "pfShockRingB",
    { diameter: 2.15, thickness: 0.06, tessellation: 112 },
    bjsScene,
  );
  shockRingB.parent = root;
  shockRingB.isPickable = false;
  shockRingB.rotation.y = Math.PI / 2;

  const shockRingBMat = new BABYLON.StandardMaterial("pfShockRingBMat", bjsScene);
  shockRingBMat.diffuseColor = BABYLON.Color3.Black();
  shockRingBMat.specularColor = BABYLON.Color3.Black();
  shockRingBMat.emissiveColor = new BABYLON.Color3(1.0, 0.5, 1.4);
  shockRingBMat.alpha = 0;
  shockRingBMat.backFaceCulling = false;
  shockRingB.material = shockRingBMat;

  const backRing = BABYLON.MeshBuilder.CreateTorus(
    "pfBackRing",
    { diameter: 5.8, thickness: 0.14, tessellation: 128 },
    bjsScene,
  );
  backRing.parent = root;
  backRing.isPickable = false;
  backRing.rotation.x = Math.PI / 2;
  backRing.position.z = 1.0;

  const backRingMat = new BABYLON.StandardMaterial("pfBackRingMat", bjsScene);
  backRingMat.diffuseColor = BABYLON.Color3.Black();
  backRingMat.specularColor = BABYLON.Color3.Black();
  backRingMat.emissiveColor = new BABYLON.Color3(0.10, 0.35, 0.95);
  backRingMat.alpha = 0.55;
  backRingMat.backFaceCulling = false;
  backRing.material = backRingMat;

  const coreBase = BABYLON.MeshBuilder.CreateSphere(
    "pfCoreBase",
    { diameter: CORE_SIZE, segments: 6 },
    bjsScene,
  );
  coreBase.parent = root;
  coreBase.isPickable = false;

  const coreMat = new BABYLON.StandardMaterial("pfCoreMat", bjsScene);
  coreMat.diffuseColor = BABYLON.Color3.Black();
  coreMat.specularColor = BABYLON.Color3.Black();
  coreMat.emissiveColor = new BABYLON.Color3(0.25, 0.9, 1.25);
  coreMat.alpha = 0.72;
  coreMat.backFaceCulling = false;
  coreBase.material = coreMat;

  const coreMatrices = new Float32Array(CORE_COUNT * 16);
  coreBase.thinInstanceSetBuffer("matrix", coreMatrices, 16, true);

  const glowBase = BABYLON.MeshBuilder.CreateSphere(
    "pfGlowBase",
    { diameter: GLOW_SIZE, segments: 6 },
    bjsScene,
  );
  glowBase.parent = root;
  glowBase.isPickable = false;

  const glowMat = new BABYLON.StandardMaterial("pfGlowMat", bjsScene);
  glowMat.diffuseColor = BABYLON.Color3.Black();
  glowMat.specularColor = BABYLON.Color3.Black();
  glowMat.emissiveColor = new BABYLON.Color3(0.85, 0.35, 1.15);
  glowMat.alpha = 0.35;
  glowMat.backFaceCulling = false;
  glowBase.material = glowMat;

  const glowMatrices = new Float32Array(GLOW_COUNT * 16);
  glowBase.thinInstanceSetBuffer("matrix", glowMatrices, 16, true);

  const trailBase = BABYLON.MeshBuilder.CreateSphere(
    "pfTrailBase",
    { diameter: TRAIL_SIZE, segments: 6 },
    bjsScene,
  );
  trailBase.parent = root;
  trailBase.isPickable = false;

  const trailMat = new BABYLON.StandardMaterial("pfTrailMat", bjsScene);
  trailMat.diffuseColor = BABYLON.Color3.Black();
  trailMat.specularColor = BABYLON.Color3.Black();
  trailMat.emissiveColor = new BABYLON.Color3(0.20, 0.75, 1.10);
  trailMat.alpha = 0.45;
  trailMat.backFaceCulling = false;
  trailBase.material = trailMat;

  const trailMatrices = new Float32Array(TRAIL_COUNT * 16);
  trailBase.thinInstanceSetBuffer("matrix", trailMatrices, 16, true);

  const tmpM = new BABYLON.Matrix();
  const tmpQ = BABYLON.Quaternion.Identity();
  const tmpPos = new BABYLON.Vector3();
  const tmpScale = new BABYLON.Vector3();

  function composeTo(arr: Float32Array, i: number, x: number, y: number, z: number, s: number) {
    tmpPos.set(x, y, z);
    tmpScale.set(s, s, s);
    BABYLON.Matrix.ComposeToRef(tmpScale, tmpQ, tmpPos, tmpM);
    tmpM.copyToArray(arr, i * 16);
  }

  type P = { x: number; y: number; z: number; w: number; phase: number };
  const core: P[] = Array.from({ length: CORE_COUNT }, () => {
    const a = Math.random() * Math.PI * 2;
    const b = Math.acos(lerp(-1, 1, Math.random()));
    const r = Math.pow(Math.random(), 0.55) * FIELD_R * 0.95;
    const x = Math.cos(a) * Math.sin(b) * r;
    const y = Math.sin(a) * Math.sin(b) * r;
    const z = Math.cos(b) * r;
    const w = 0.35 + Math.random() * 1.65;
    const phase = Math.random() * Math.PI * 2;
    return { x, y, z, w, phase };
  });

  const halo: P[] = Array.from({ length: GLOW_COUNT }, () => {
    const a = Math.random() * Math.PI * 2;
    const b = Math.acos(lerp(-1, 1, Math.random()));
    const r = (0.55 + 0.45 * Math.random()) * FIELD_R * 1.05;
    const x = Math.cos(a) * Math.sin(b) * r;
    const y = Math.sin(a) * Math.sin(b) * r;
    const z = Math.cos(b) * r;
    const w = 0.35 + Math.random() * 1.65;
    const phase = Math.random() * Math.PI * 2;
    return { x, y, z, w, phase };
  });

  type T = {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    w: number;
    phase: number;
  };
  const trails: T[] = Array.from({ length: TRAIL_COUNT }, () => {
    const a = Math.random() * Math.PI * 2;
    const b = Math.acos(lerp(-1, 1, Math.random()));
    const r = Math.pow(Math.random(), 0.6) * FIELD_R * 0.75;
    const x = Math.cos(a) * Math.sin(b) * r;
    const y = Math.sin(a) * Math.sin(b) * r;
    const z = Math.cos(b) * r;
    const v = (0.35 + Math.random() * 0.85) * 0.12;
    const vx = x * v;
    const vy = y * v;
    const vz = z * v;
    const w = 0.4 + Math.random() * 1.6;
    const phase = Math.random() * Math.PI * 2;
    return { x, y, z, vx, vy, vz, w, phase };
  });

  for (let i = 0; i < CORE_COUNT; i++) {
    const p = core[i];
    composeTo(coreMatrices, i, p.x, p.y, p.z, 0.65 + 0.45 * p.w);
  }
  coreBase.thinInstanceBufferUpdated("matrix");

  for (let i = 0; i < GLOW_COUNT; i++) {
    const p = halo[i];
    composeTo(glowMatrices, i, p.x, p.y, p.z, 0.75 + 0.55 * p.w);
  }
  glowBase.thinInstanceBufferUpdated("matrix");

  for (let i = 0; i < TRAIL_COUNT; i++) {
    const p = trails[i];
    composeTo(trailMatrices, i, p.x, p.y, p.z, 0.65 + 0.55 * p.w);
  }
  trailBase.thinInstanceBufferUpdated("matrix");

  let time = 0;
  let env = 0;
  let shockA = 0;
  let shockB = 0;
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

      const target = clamp01(rms * 0.50 + bass * 0.30 + beat * 0.35);
      const rate = target > env ? 18 : 6;
      env = env + (target - env) * (1 - Math.exp(-rate * dtc));

      const beatEdge = beat > 0.62 && prevBeat <= 0.62;
      prevBeat = beat;
      if (beatEdge) {
        shockA = 1;
        shockB = 0.85;
      }

      shockA *= Math.exp(-6.5 * dtc);
      shockB *= Math.exp(-4.8 * dtc);

      const twist = TWIST_GAIN * (0.55 * mid + 0.85 * high);
      root.rotation.z = Math.sin(time * 0.34) * 0.05;
      root.rotation.y = Math.sin(time * 0.22) * 0.05;
      root.rotation.x = 0.02 + Math.sin(time * 0.18) * 0.03;
      root.rotation.z += twist * Math.sin(time * 0.55);
      root.rotation.y += twist * Math.cos(time * 0.45);

      bjsScene.fogDensity = FOG_BASE + FOG_REACT * (0.45 * rms + 0.85 * env);
      if (glow) glow.intensity = 0.65 + 0.55 * env + 0.45 * high;

      const c0 = palette(time * 0.04 + 0.15 * mid);
      const c1 = palette(time * 0.06 + 0.30 * high);

      coreOrb.scaling.setAll(1.0 + 0.25 * env + 0.12 * shockA);
      coreOrbMat.alpha = 0.7 + 0.24 * env;
      coreOrbMat.emissiveColor = new BABYLON.Color3(
        0.18 + 0.35 * high + 0.25 * shockA,
        0.60 + 0.65 * rms,
        1.15 + 0.85 * env + 0.45 * shockA,
      );

      shockRingA.scaling.setAll(1.0 + 1.3 * shockA);
      shockRingAMat.alpha = 0.45 * shockA + 0.10 * high;
      shockRingAMat.emissiveColor = new BABYLON.Color3(
        0.45 + 0.55 * shockA,
        0.95 + 0.45 * (shockA + rms),
        1.45 + 0.65 * (shockA + high),
      );

      shockRingB.scaling.setAll(1.0 + 1.0 * shockB);
      shockRingBMat.alpha = 0.32 * shockB + 0.08 * high;
      shockRingBMat.emissiveColor = new BABYLON.Color3(
        0.85 + 0.55 * (shockB + high),
        0.35 + 0.55 * (shockB + env),
        0.95 + 0.65 * (shockB + rms),
      );

      backRingMat.emissiveColor = new BABYLON.Color3(
        0.06 + 0.22 * env,
        0.22 + 0.55 * rms,
        0.75 + 0.55 * high,
      );
      backRingMat.alpha = 0.28 + 0.34 * env;

      coreMat.alpha = 0.50 + 0.33 * (0.45 * rms + 0.55 * env);
      glowMat.alpha = 0.16 + 0.30 * (0.55 * rms + 0.45 * env);
      trailMat.alpha = 0.20 + 0.35 * (0.45 * rms + 0.55 * env);

      coreMat.emissiveColor = new BABYLON.Color3(
        0.18 + c0.r * (0.65 + 0.55 * env),
        0.35 + c0.g * (0.75 + 0.45 * rms),
        0.65 + c0.b * (0.90 + 0.55 * high),
      );
      glowMat.emissiveColor = new BABYLON.Color3(
        0.25 + c1.r * (0.55 + 0.35 * env),
        0.18 + c1.g * (0.45 + 0.35 * rms),
        0.55 + c1.b * (0.85 + 0.55 * high),
      );
      trailMat.emissiveColor = new BABYLON.Color3(
        0.14 + c0.r * (0.55 + 0.25 * env),
        0.30 + c0.g * (0.55 + 0.25 * rms),
        0.60 + c0.b * (0.75 + 0.35 * high),
      );

      const breathe = 0.06 + 0.14 * env + 0.10 * bass;
      for (let i = 0; i < CORE_COUNT; i++) {
        const p = core[i];
        const s = 0.55 + 0.55 * p.w + 0.35 * high;

        const j = 0.04 * (0.35 + env) * p.w;
        const ox = Math.sin(time * (0.8 + mid) + p.phase) * j;
        const oy = Math.cos(time * (0.7 + high) + p.phase) * j;
        const oz = Math.sin(time * (0.9 + mid) + p.phase) * j;

        const bx = p.x * (1 + breathe);
        const by = p.y * (1 + breathe);
        const bz = p.z * (1 + breathe);

        composeTo(coreMatrices, i, bx + ox, by + oy, bz + oz, s);
      }
      coreBase.thinInstanceBufferUpdated("matrix");

      const shellWob = 0.04 + 0.10 * high + 0.08 * env;
      for (let i = 0; i < GLOW_COUNT; i++) {
        const p = halo[i];
        const s = 0.75 + 0.65 * p.w + 0.25 * env;
        const w = Math.sin(time * (0.55 + 0.85 * high) + p.phase) * shellWob;
        composeTo(glowMatrices, i, p.x * (1 + w), p.y * (1 + w), p.z * (1 + w), s);
      }
      glowBase.thinInstanceBufferUpdated("matrix");

      const kick = (0.15 + 0.55 * beat) * (0.35 + 0.65 * env);
      const speed = TRAIL_SPEED * (0.55 + 0.85 * env + 0.45 * mid) * (0.55 + 0.45 * intensity);
      const vortex = dtc * (0.20 + 0.8 * mid + 0.6 * high + 0.55 * env);

      for (let i = 0; i < TRAIL_COUNT; i++) {
        const p = trails[i];

        const len = Math.max(1e-5, Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z));
        const nx = p.x / len;
        const ny = p.y / len;
        const nz = p.z / len;

        p.vx += nx * speed * dtc * (0.6 + 0.6 * p.w) + nx * kick * dtc;
        p.vy += ny * speed * dtc * (0.6 + 0.6 * p.w) + ny * kick * dtc;
        p.vz += nz * speed * dtc * (0.6 + 0.6 * p.w) + nz * kick * dtc;

        const swirlAngle = vortex * (0.35 + 0.85 * p.w);
        const cs = Math.cos(swirlAngle);
        const sn = Math.sin(swirlAngle);
        const rx = p.x * cs - p.z * sn;
        const rz = p.x * sn + p.z * cs;
        p.x = rx;
        p.z = rz;

        p.vx *= TRAIL_DRAG;
        p.vy *= TRAIL_DRAG;
        p.vz *= TRAIL_DRAG;

        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;

        p.y += Math.sin(time * 1.2 + p.phase) * (0.0008 + 0.0018 * high);

        const rr = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
        if (rr > FIELD_R * 1.35) {
          const a = Math.random() * Math.PI * 2;
          const b = Math.acos(lerp(-1, 1, Math.random()));
          const r = Math.pow(Math.random(), 0.6) * FIELD_R * 0.65;

          p.x = Math.cos(a) * Math.sin(b) * r;
          p.y = Math.sin(a) * Math.sin(b) * r;
          p.z = Math.cos(b) * r;

          const v = (0.35 + Math.random() * 0.85) * 0.10;
          p.vx = p.x * v;
          p.vy = p.y * v;
          p.vz = p.z * v;
          p.w = 0.4 + Math.random() * 1.6;
          p.phase = Math.random() * Math.PI * 2;
        }

        const s = 0.55 + 0.65 * p.w + 0.25 * high + 0.25 * shockA;
        composeTo(trailMatrices, i, p.x, p.y, p.z, s);
      }
      trailBase.thinInstanceBufferUpdated("matrix");
    },

    dispose() {
      bjsScene.fogMode = prevFogMode;
      bjsScene.fogDensity = prevFogDensity;
      if (prevFogColor) bjsScene.fogColor = prevFogColor;

      glow?.dispose();

      shockRingA.dispose(false, true);
      shockRingAMat.dispose(true, true);

      shockRingB.dispose(false, true);
      shockRingBMat.dispose(true, true);

      coreOrb.dispose(false, true);
      coreOrbMat.dispose(true, true);

      backRing.dispose(false, true);
      backRingMat.dispose(true, true);

      coreBase.dispose(false, true);
      coreMat.dispose(true, true);

      glowBase.dispose(false, true);
      glowMat.dispose(true, true);

      trailBase.dispose(false, true);
      trailMat.dispose(true, true);

      hemi.dispose();
      key.dispose();
      root.dispose();
    },
  };
}
