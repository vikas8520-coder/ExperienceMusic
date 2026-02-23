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

export function createWaveformSpherePreset(
  scene: unknown,
  opts?: { enableGlow?: boolean },
): BabylonPresetRuntime {
  const bjsScene = scene as any;
  const enableGlow = opts?.enableGlow ?? true;

  const BASE_RADIUS = 1.45;
  const SEGMENTS = 64;
  const DEFORM_GAIN = 0.28;
  const BASS_PUSH = 0.34;
  const HIGH_RIPPLE = 0.22;
  const TWIST_GAIN = 0.22;
  const DUST_COUNT = 1400;
  const DUST_RING_R = BASE_RADIUS * 1.55;
  const DUST_RING_THICK = 0.20;
  const DUST_SPEED = 0.55;
  const DUST_SWIRL = 1.35;
  const HALO_COUNT = 56;
  const HALO_BASE_R = BASE_RADIUS * 1.18;
  const HALO_R_SPREAD = BASE_RADIUS * 0.55;
  const HALO_THICK = 0.012;
  const SHOCK_SHELL_R = BASE_RADIUS * 2.28;
  const SHOCK_EXPAND = 0.28;
  const SHOCK_DECAY = 7.5;

  const root = new BABYLON.TransformNode("sphereRoot", bjsScene);

  const hemi = new BABYLON.HemisphericLight("sphereHemi", new BABYLON.Vector3(0.2, 1, 0.1), bjsScene);
  hemi.intensity = 0.8;

  const key = new BABYLON.PointLight("sphereKey", new BABYLON.Vector3(0, 2.2, -2.0), bjsScene);
  key.intensity = 26;
  key.radius = 12;

  let glow: any = null;
  if (enableGlow) {
    glow = new BABYLON.GlowLayer("sphereGlow", bjsScene, { blurKernelSize: 64 });
    glow.intensity = 0.65;
  }

  const sphere = BABYLON.MeshBuilder.CreateSphere(
    "waveformSphere",
    { diameter: BASE_RADIUS * 2, segments: SEGMENTS },
    bjsScene,
  );
  sphere.parent = root;
  sphere.isPickable = false;

  const mat = new BABYLON.StandardMaterial("waveformSphereMat", bjsScene);
  mat.diffuseColor = new BABYLON.Color3(0.03, 0.03, 0.04);
  mat.specularColor = new BABYLON.Color3(0.10, 0.10, 0.11);
  mat.emissiveColor = new BABYLON.Color3(0.12, 0.65, 1.1);
  mat.alpha = 1.0;

  mat.emissiveFresnelParameters = new BABYLON.FresnelParameters();
  mat.emissiveFresnelParameters.isEnabled = true;
  mat.emissiveFresnelParameters.leftColor = new BABYLON.Color3(0.08, 0.20, 0.35);
  mat.emissiveFresnelParameters.rightColor = new BABYLON.Color3(0.35, 0.85, 1.25);
  mat.emissiveFresnelParameters.power = 2.6;
  mat.emissiveFresnelParameters.bias = 0.08;
  sphere.material = mat;

  const atmos = BABYLON.MeshBuilder.CreateSphere(
    "waveformSphereAtmos",
    { diameter: BASE_RADIUS * 2.14, segments: 48 },
    bjsScene,
  );
  atmos.parent = root;
  atmos.isPickable = false;

  const atmosMat = new BABYLON.StandardMaterial("waveformSphereAtmosMat", bjsScene);
  atmosMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
  atmosMat.specularColor = new BABYLON.Color3(0, 0, 0);
  atmosMat.emissiveColor = new BABYLON.Color3(0.20, 0.65, 1.15);
  atmosMat.alpha = 0.22;
  atmosMat.backFaceCulling = false;
  atmosMat.emissiveFresnelParameters = new BABYLON.FresnelParameters();
  atmosMat.emissiveFresnelParameters.isEnabled = true;
  atmosMat.emissiveFresnelParameters.leftColor = new BABYLON.Color3(0.02, 0.06, 0.12);
  atmosMat.emissiveFresnelParameters.rightColor = new BABYLON.Color3(0.35, 0.9, 1.35);
  atmosMat.emissiveFresnelParameters.power = 3.4;
  atmosMat.emissiveFresnelParameters.bias = 0.12;
  atmos.material = atmosMat;

  const shockShell = BABYLON.MeshBuilder.CreateSphere(
    "waveformSphereShock",
    { diameter: SHOCK_SHELL_R, segments: 40 },
    bjsScene,
  );
  shockShell.parent = root;
  shockShell.isPickable = false;

  const shockMat = new BABYLON.StandardMaterial("waveformSphereShockMat", bjsScene);
  shockMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
  shockMat.specularColor = new BABYLON.Color3(0, 0, 0);
  shockMat.emissiveColor = new BABYLON.Color3(0.35, 0.95, 1.35);
  shockMat.alpha = 0.0;
  shockMat.backFaceCulling = false;
  shockMat.emissiveFresnelParameters = new BABYLON.FresnelParameters();
  shockMat.emissiveFresnelParameters.isEnabled = true;
  shockMat.emissiveFresnelParameters.leftColor = new BABYLON.Color3(0.02, 0.03, 0.06);
  shockMat.emissiveFresnelParameters.rightColor = new BABYLON.Color3(0.65, 1.05, 1.65);
  shockMat.emissiveFresnelParameters.power = 2.2;
  shockMat.emissiveFresnelParameters.bias = 0.06;
  shockShell.material = shockMat;

  const dustBase = BABYLON.MeshBuilder.CreateSphere(
    "waveformSphereDustBase",
    { diameter: 0.016, segments: 6 },
    bjsScene,
  );
  dustBase.parent = root;
  dustBase.isPickable = false;

  const dustMat = new BABYLON.StandardMaterial("waveformSphereDustMat", bjsScene);
  dustMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
  dustMat.specularColor = new BABYLON.Color3(0, 0, 0);
  dustMat.emissiveColor = new BABYLON.Color3(0.35, 0.9, 1.25);
  dustMat.alpha = 0.55;
  dustMat.backFaceCulling = false;
  dustBase.material = dustMat;

  const dustMatrices = new Float32Array(DUST_COUNT * 16);
  dustBase.thinInstanceSetBuffer("matrix", dustMatrices, 16, true);

  type Dust = { a: number; r: number; y: number; z: number; w: number; spin: number };
  const dust: Dust[] = Array.from({ length: DUST_COUNT }, () => {
    const a = Math.random() * Math.PI * 2;
    const r = DUST_RING_R + (Math.random() * 2 - 1) * DUST_RING_THICK;
    const y = (Math.random() * 2 - 1) * 0.09;
    const z = (Math.random() * 2 - 1) * 0.06;
    const w = 0.4 + Math.random() * 1.8;
    const spin = (Math.random() * 2 - 1) * (0.6 + Math.random() * 1.2);
    return { a, r, y, z, w, spin };
  });

  const haloBase = BABYLON.MeshBuilder.CreateTorus(
    "waveformSphereHaloBase",
    { diameter: 2, thickness: HALO_THICK, tessellation: 96 },
    bjsScene,
  );
  haloBase.parent = root;
  haloBase.isPickable = false;

  const haloMat = new BABYLON.StandardMaterial("waveformSphereHaloMat", bjsScene);
  haloMat.diffuseColor = new BABYLON.Color3(0.02, 0.02, 0.02);
  haloMat.specularColor = new BABYLON.Color3(0.06, 0.06, 0.06);
  haloMat.emissiveColor = new BABYLON.Color3(0.20, 0.75, 1.20);
  haloMat.alpha = 0.55;
  haloMat.backFaceCulling = false;
  (haloMat as any).useVertexColor = true;
  (haloMat as any).useVertexColors = true;
  haloBase.material = haloMat;

  const haloMatrices = new Float32Array(HALO_COUNT * 16);
  const haloColors = new Float32Array(HALO_COUNT * 4);
  haloBase.thinInstanceSetBuffer("matrix", haloMatrices, 16, true);
  haloBase.thinInstanceSetBuffer("color", haloColors, 4, true);

  type Halo = { r: number; tiltX: number; tiltZ: number; phase: number; speed: number };
  const halo: Halo[] = Array.from({ length: HALO_COUNT }, (_, i) => {
    const u = i / Math.max(1, HALO_COUNT - 1);
    const r = HALO_BASE_R + u * HALO_R_SPREAD;
    const tiltX = (Math.random() * 2 - 1) * 0.55;
    const tiltZ = (Math.random() * 2 - 1) * 0.55;
    const phase = Math.random() * Math.PI * 2;
    const speed = 0.18 + Math.random() * 0.45;
    return { r, tiltX, tiltZ, phase, speed };
  });

  const positions = sphere.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  const normals = sphere.getVerticesData(BABYLON.VertexBuffer.NormalKind);
  if (!positions || !normals) {
    throw new Error("WaveformSphere: missing vertex buffers.");
  }

  const basePos = new Float32Array(positions.length);
  basePos.set(positions);

  const seeds = new Float32Array(positions.length / 3);
  for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();

  const tmpM = new BABYLON.Matrix();
  const tmpQ = BABYLON.Quaternion.Identity();

  let time = 0;
  let env = 0;
  let prevBeat = 0;
  let shockEnv = 0;

  function composeTo(
    arr: Float32Array,
    i: number,
    scale: any,
    q: any,
    pos: any,
  ) {
    BABYLON.Matrix.ComposeToRef(scale, q, pos, tmpM);
    tmpM.copyToArray(arr, i * 16);
  }

  for (let i = 0; i < DUST_COUNT; i++) {
    const p = dust[i];
    const x = Math.cos(p.a) * p.r;
    const z = Math.sin(p.a) * p.r;
    const s = 0.8 + 0.35 * p.w;
    composeTo(
      dustMatrices,
      i,
      new BABYLON.Vector3(s, s, s),
      tmpQ,
      new BABYLON.Vector3(x, p.y, z + p.z),
    );
  }
  dustBase.thinInstanceBufferUpdated("matrix");

  for (let i = 0; i < HALO_COUNT; i++) {
    const h = halo[i];
    const q = BABYLON.Quaternion.FromEulerAngles(h.tiltX, 0, h.tiltZ);
    composeTo(
      haloMatrices,
      i,
      new BABYLON.Vector3(h.r, 1, h.r),
      q,
      BABYLON.Vector3.Zero(),
    );
    haloColors[i * 4 + 0] = 0.3;
    haloColors[i * 4 + 1] = 0.85;
    haloColors[i * 4 + 2] = 1.2;
    haloColors[i * 4 + 3] = 1.0;
  }
  haloBase.thinInstanceBufferUpdated("matrix");
  haloBase.thinInstanceBufferUpdated("color");

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

      const target = clamp01(rms * 0.55 + bass * 0.30 + beat * 0.35);
      const rate = target > env ? 16 : 6;
      env = env + (target - env) * (1 - Math.exp(-rate * dtc));

      const beatEdge = beat > 0.62 && prevBeat <= 0.62;
      prevBeat = beat;
      if (beatEdge) shockEnv = 1.0;
      shockEnv *= Math.exp(-SHOCK_DECAY * dtc);

      const em = 0.75 + 1.15 * env + 0.85 * high + 0.35 * mid;
      mat.emissiveColor = new BABYLON.Color3(0.10 * em, 0.55 * em, 1.15 * em);

      atmosMat.alpha = 0.16 + 0.18 * env + 0.10 * rms;
      atmosMat.emissiveColor = new BABYLON.Color3(
        0.14 + 0.20 * env,
        0.55 + 0.55 * rms,
        1.05 + 0.55 * high,
      );

      if (glow) glow.intensity = 0.55 + 0.60 * env + 0.45 * high;

      root.rotation.z = Math.sin(time * 0.38) * (0.05 + TWIST_GAIN * mid);
      root.rotation.y = Math.sin(time * 0.24) * (0.06 + TWIST_GAIN * high);
      root.rotation.x = Math.cos(time * 0.22) * 0.03;

      const shockScale = 1.0 + SHOCK_EXPAND * shockEnv * (0.55 + 0.45 * (0.5 * high + 0.5 * env));
      shockShell.scaling.setAll(shockScale);
      shockMat.alpha = Math.min(0.75, 0.55 * shockEnv + 0.12 * high);
      shockMat.emissiveColor = new BABYLON.Color3(
        0.35 + 0.65 * shockEnv,
        0.85 + 0.45 * (shockEnv + rms),
        1.20 + 0.55 * (shockEnv + high),
      );

      const deform = DEFORM_GAIN * (0.35 + 0.65 * intensity);
      const bassBulge = BASS_PUSH * bass;
      const highRipple = HIGH_RIPPLE * high;
      const f1 = 1.4 + 2.2 * mid;
      const f2 = 3.8 + 6.5 * high;

      for (let i = 0, vi = 0; i < seeds.length; i++, vi += 3) {
        const bx = basePos[vi + 0];
        const by = basePos[vi + 1];
        const bz = basePos[vi + 2];

        const nx = normals[vi + 0];
        const ny = normals[vi + 1];
        const nz = normals[vi + 2];

        const s = seeds[i];
        const p1 = Math.sin(
          (bx * 0.9 + by * 1.1 + bz * 1.0) * f1 +
            time * (1.1 + mid * 2.0) +
            s * 6.283,
        );
        const p2 = Math.sin(
          (bx * 1.6 - by * 1.2 + bz * 0.7) * f2 -
            time * (1.6 + high * 2.4) +
            s * 4.0,
        );
        const pulse = 0.12 * env + 0.18 * shockEnv;

        const disp =
          deform * (0.55 * p1 + 0.45 * p2) +
          bassBulge * (0.12 + 0.08 * p1) +
          highRipple * (0.10 * p2) +
          pulse;

        positions[vi + 0] = bx + nx * disp;
        positions[vi + 1] = by + ny * disp;
        positions[vi + 2] = bz + nz * disp;
      }

      sphere.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions, true);
      BABYLON.VertexData.ComputeNormals(
        positions as any,
        sphere.getIndices() as any,
        normals as any,
      );
      sphere.updateVerticesData(BABYLON.VertexBuffer.NormalKind, normals, true);

      const atmosScale = 1.0 + 0.02 * env + 0.01 * rms + 0.02 * shockEnv;
      atmos.scaling.setAll(atmosScale);

      const dustSpeed = DUST_SPEED * (0.55 + 0.95 * env + 0.65 * mid);
      const dustSwirl = DUST_SWIRL * (0.45 + 0.85 * mid + 0.75 * high);

      dustMat.alpha = 0.35 + 0.35 * (0.55 * rms + 0.45 * env);
      dustMat.emissiveColor = new BABYLON.Color3(
        0.20 + 0.35 * high + 0.35 * shockEnv,
        0.65 + 0.55 * rms,
        1.05 + 0.65 * env + 0.55 * high,
      );

      for (let i = 0; i < DUST_COUNT; i++) {
        const p = dust[i];
        p.a += dtc * (dustSpeed * (0.35 + 0.85 * p.w) + dustSwirl * p.spin * 0.25);

        const rr = p.r * (0.92 + 0.08 * Math.sin(time * 0.8 + p.a) * (0.35 + env));
        const jit = (0.010 + 0.030 * env) * (0.35 + 0.65 * p.w);
        const tx = Math.sin(time * 1.6 + i * 0.07) * jit;
        const tz = Math.cos(time * 1.4 + i * 0.05) * jit;

        const x = Math.cos(p.a) * rr + tx;
        const z = Math.sin(p.a) * rr + tz;
        const y = p.y + Math.sin(time * 1.9 + p.a * 2.0) * (0.02 + 0.05 * high) + 0.04 * shockEnv;

        const s = 0.65 + 0.55 * p.w + 0.35 * high + 0.45 * shockEnv;
        composeTo(
          dustMatrices,
          i,
          new BABYLON.Vector3(s, s, s),
          tmpQ,
          new BABYLON.Vector3(x, y, z + p.z),
        );
      }
      dustBase.thinInstanceBufferUpdated("matrix");

      haloMat.alpha = 0.38 + 0.22 * env + 0.10 * high;

      const haloBrightBase = 0.55 + 0.95 * env + 0.55 * high;
      for (let i = 0; i < HALO_COUNT; i++) {
        const h = halo[i];
        h.phase += dtc * h.speed * (0.35 + 0.75 * mid + 0.55 * env);

        const wobX = h.tiltX + Math.sin(h.phase + time * 0.35) * (0.08 + 0.18 * mid);
        const wobZ = h.tiltZ + Math.cos(h.phase + time * 0.28) * (0.08 + 0.18 * high);
        const yaw = Math.sin(h.phase * 0.7 + time * 0.22) * (0.18 + 0.35 * mid);
        const q = BABYLON.Quaternion.FromEulerAngles(wobX, yaw, wobZ);

        const rr = h.r * (1.0 + 0.012 * Math.sin(time * 1.05 + i * 0.4) * (0.35 + env));
        const shockPing = Math.exp(-12 * Math.abs(i / (HALO_COUNT - 1) - 0.55)) * shockEnv;

        composeTo(
          haloMatrices,
          i,
          new BABYLON.Vector3(rr, 1, rr),
          q,
          BABYLON.Vector3.Zero(),
        );

        const u = i / Math.max(1, HALO_COUNT - 1);
        const scan = 0.5 + 0.5 * Math.sin(time * (0.85 + 1.1 * mid) + u * 10.0);
        const b = haloBrightBase * (0.55 + 0.75 * scan) + 1.6 * shockPing;

        haloColors[i * 4 + 0] = 0.18 * b;
        haloColors[i * 4 + 1] = 0.70 * b;
        haloColors[i * 4 + 2] = 1.25 * b;
        haloColors[i * 4 + 3] = 1.0;
      }
      haloBase.thinInstanceBufferUpdated("matrix");
      haloBase.thinInstanceBufferUpdated("color");
    },

    dispose() {
      glow?.dispose();

      sphere.dispose(false, true);
      mat.dispose(true, true);

      atmos.dispose(false, true);
      atmosMat.dispose(true, true);

      shockShell.dispose(false, true);
      shockMat.dispose(true, true);

      dustBase.dispose(false, true);
      dustMat.dispose(true, true);

      haloBase.dispose(false, true);
      haloMat.dispose(true, true);

      hemi.dispose();
      key.dispose();
      root.dispose();
    },
  };
}
