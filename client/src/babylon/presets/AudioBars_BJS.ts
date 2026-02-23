import * as BABYLON from "@babylonjs/core";
import type { BabylonPresetRuntime } from "../types";

type AudioLike = {
  spectrum?: number[];
  bands?: number[];
  rms?: number;
  bass?: number;
  mid?: number;
  high?: number;
  energy?: number;
  frequencyData?: Uint8Array;
};

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function palette(t: number) {
  const deep = new BABYLON.Color3(0.03, 0.10, 0.18);
  const cyan = new BABYLON.Color3(0.08, 0.65, 0.98);
  const warm = new BABYLON.Color3(0.90, 0.72, 0.35);

  const u = t % 1;
  if (u < 0.6) {
    const k = u / 0.6;
    return BABYLON.Color3.Lerp(deep, cyan, k);
  }
  const k = (u - 0.6) / 0.4;
  return BABYLON.Color3.Lerp(cyan, warm, k);
}

function getBins(audio: AudioLike): number[] {
  if (Array.isArray(audio.spectrum) && audio.spectrum.length) {
    return audio.spectrum.map((v) => clamp01(v ?? 0));
  }
  if (Array.isArray(audio.bands) && audio.bands.length) {
    return audio.bands.map((v) => clamp01(v ?? 0));
  }
  if (audio.frequencyData && typeof audio.frequencyData.length === "number") {
    const bins: number[] = [];
    const count = Math.min(audio.frequencyData.length, 128);
    for (let i = 0; i < count; i++) {
      bins.push(clamp01((audio.frequencyData[i] ?? 0) / 255));
    }
    return bins;
  }
  return [];
}

function sampleBin(bins: number[], i: number, barCount: number): number {
  if (!bins.length) return 0;
  const idx = Math.floor((i / (barCount - 1)) * (bins.length - 1));
  return clamp01(bins[idx] ?? 0);
}

export function createAudioBarsPreset(scene: unknown): BabylonPresetRuntime {
  const bjsScene = scene as BABYLON.Scene;

  const BAR_COUNT = 112;
  const RADIUS = 1.55;
  const GHOST_RADIUS = 1.72;
  const BAR_WIDTH = 0.05;
  const BAR_DEPTH = 0.06;
  const MIN_H = 0.05;
  const MAX_H = 2.05;

  const TWIST_Z_MAX = 0.28;
  const TWIST_WAVES = 2.0;
  const TWIST_SPEED = 0.6;

  const GLOW_RING_RADIUS = 1.33;
  const GLOW_RING_THICKNESS = 0.06;
  const SWEEP_RING_RADIUS = 1.62;
  const SWEEP_RING_THICKNESS = 0.045;

  const root = new BABYLON.TransformNode("audioBarsRoot", bjsScene);

  const base = BABYLON.MeshBuilder.CreateBox(
    "audioBarBase",
    { width: BAR_WIDTH, height: 1, depth: BAR_DEPTH },
    bjsScene,
  );
  base.parent = root;

  const mat = new BABYLON.StandardMaterial("audioBarsMat", bjsScene);
  mat.diffuseColor = new BABYLON.Color3(0.02, 0.05, 0.08);
  mat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
  mat.emissiveColor = new BABYLON.Color3(0.1, 0.5, 1.0);
  (mat as any).useVertexColor = true;
  (mat as any).useVertexColors = true;
  base.material = mat;

  const ghost = BABYLON.MeshBuilder.CreateBox(
    "audioBarGhostBase",
    { width: BAR_WIDTH * 0.95, height: 1, depth: BAR_DEPTH * 0.95 },
    bjsScene,
  );
  ghost.parent = root;
  const ghostMat = new BABYLON.StandardMaterial("audioBarGhostMat", bjsScene);
  ghostMat.diffuseColor = BABYLON.Color3.Black();
  ghostMat.specularColor = BABYLON.Color3.Black();
  ghostMat.emissiveColor = new BABYLON.Color3(0.35, 0.8, 1.4);
  ghostMat.alpha = 0.32;
  ghostMat.backFaceCulling = false;
  (ghostMat as any).useVertexColor = true;
  (ghostMat as any).useVertexColors = true;
  ghost.material = ghostMat;

  const glowRing = BABYLON.MeshBuilder.CreateTorus(
    "audioGlowRing",
    { diameter: GLOW_RING_RADIUS * 2, thickness: GLOW_RING_THICKNESS, tessellation: 96 },
    bjsScene,
  );
  glowRing.parent = root;
  glowRing.position.y = 0.12;
  glowRing.rotation.x = Math.PI / 2;

  const glowMat = new BABYLON.StandardMaterial("audioGlowMat", bjsScene);
  glowMat.diffuseColor = BABYLON.Color3.Black();
  glowMat.specularColor = BABYLON.Color3.Black();
  glowMat.emissiveColor = new BABYLON.Color3(0.08, 0.35, 0.9);
  glowMat.alpha = 0.28;
  glowRing.material = glowMat;

  const sweepRing = BABYLON.MeshBuilder.CreateTorus(
    "audioSweepRing",
    { diameter: SWEEP_RING_RADIUS * 2, thickness: SWEEP_RING_THICKNESS, tessellation: 120 },
    bjsScene,
  );
  sweepRing.parent = root;
  sweepRing.position.y = 0.14;
  sweepRing.rotation.x = Math.PI / 2;

  const sweepMat = new BABYLON.StandardMaterial("audioSweepRingMat", bjsScene);
  sweepMat.diffuseColor = BABYLON.Color3.Black();
  sweepMat.specularColor = BABYLON.Color3.Black();
  sweepMat.emissiveColor = new BABYLON.Color3(0.45, 0.9, 1.55);
  sweepMat.alpha = 0.18;
  sweepMat.backFaceCulling = false;
  sweepRing.material = sweepMat;

  const core = BABYLON.MeshBuilder.CreateSphere(
    "audioBarsCore",
    { diameter: 0.36, segments: 24 },
    bjsScene,
  );
  core.parent = root;
  core.position.y = 0.12;
  const coreMat = new BABYLON.StandardMaterial("audioBarsCoreMat", bjsScene);
  coreMat.diffuseColor = new BABYLON.Color3(0.02, 0.02, 0.03);
  coreMat.specularColor = new BABYLON.Color3(0.04, 0.04, 0.06);
  coreMat.emissiveColor = new BABYLON.Color3(0.18, 0.75, 1.45);
  coreMat.alpha = 0.88;
  core.material = coreMat;

  coreMat.emissiveFresnelParameters = new BABYLON.FresnelParameters();
  coreMat.emissiveFresnelParameters.isEnabled = true;
  coreMat.emissiveFresnelParameters.leftColor = new BABYLON.Color3(0.03, 0.07, 0.12);
  coreMat.emissiveFresnelParameters.rightColor = new BABYLON.Color3(0.45, 1.0, 1.65);
  coreMat.emissiveFresnelParameters.power = 2.7;
  coreMat.emissiveFresnelParameters.bias = 0.07;

  const matrices = new Float32Array(BAR_COUNT * 16);
  const colors = new Float32Array(BAR_COUNT * 4);
  const ghostMatrices = new Float32Array(BAR_COUNT * 16);
  const ghostColors = new Float32Array(BAR_COUNT * 4);

  const tmpM = new BABYLON.Matrix();
  const axisY = new BABYLON.Vector3(0, 1, 0);
  const smoothH = new Float32Array(BAR_COUNT);
  const smoothGhost = new Float32Array(BAR_COUNT);
  smoothH.fill(MIN_H);
  smoothGhost.fill(MIN_H);

  const baseColors = new Array<BABYLON.Color3>(BAR_COUNT);
  for (let i = 0; i < BAR_COUNT; i++) {
    const t = i / BAR_COUNT;
    const c = palette(t);
    baseColors[i] = c;

    colors[i * 4 + 0] = c.r;
    colors[i * 4 + 1] = c.g;
    colors[i * 4 + 2] = c.b;
    colors[i * 4 + 3] = 1.0;

    ghostColors[i * 4 + 0] = c.r * 0.7;
    ghostColors[i * 4 + 1] = c.g * 0.7;
    ghostColors[i * 4 + 2] = c.b * 0.9;
    ghostColors[i * 4 + 3] = 0.62;
  }

  base.thinInstanceSetBuffer("color", colors, 4, true);
  ghost.thinInstanceSetBuffer("color", ghostColors, 4, true);

  for (let i = 0; i < BAR_COUNT; i++) {
    const t = i / BAR_COUNT;
    const ang = t * Math.PI * 2;

    const dir = new BABYLON.Vector3(Math.cos(ang), 0, Math.sin(ang));
    const pos = dir.scale(RADIUS);
    const h = MIN_H;

    BABYLON.Matrix.ComposeToRef(
      new BABYLON.Vector3(1, h, 1),
      BABYLON.Quaternion.RotationAxis(axisY, ang),
      new BABYLON.Vector3(pos.x, h * 0.5, pos.z),
      tmpM,
    );
    tmpM.copyToArray(matrices, i * 16);

    const ghostPos = dir.scale(GHOST_RADIUS);
    BABYLON.Matrix.ComposeToRef(
      new BABYLON.Vector3(1, h * 0.92, 1),
      BABYLON.Quaternion.RotationAxis(axisY, ang),
      new BABYLON.Vector3(ghostPos.x, h * 0.52, ghostPos.z),
      tmpM,
    );
    tmpM.copyToArray(ghostMatrices, i * 16);
  }

  base.thinInstanceSetBuffer("matrix", matrices, 16, true);
  ghost.thinInstanceSetBuffer("matrix", ghostMatrices, 16, true);

  let time = 0;
  let sweep = 0;

  return {
    update(audio, dt, blend) {
      const a = audio as AudioLike;
      const bins = getBins(a);

      const intensity = clamp01(blend?.intensity ?? 1);
      const rms = clamp01(a.rms ?? a.energy ?? 0);
      const bass = clamp01(a.bass ?? 0);
      const mid = clamp01(a.mid ?? 0);
      const high = clamp01(a.high ?? 0);

      const rise = 16;
      const fall = 7;
      const dtc = Math.max(1 / 240, Math.min(1 / 20, dt || 1 / 60));

      time += dtc;
      sweep += dtc * (0.7 + 1.25 * mid + 0.85 * high);
      const env = clamp01(0.55 * rms + 0.4 * bass + 0.25 * mid);

      const twistAmp = TWIST_Z_MAX * clamp01(0.25 + 0.55 * mid + 0.75 * high + 0.25 * rms);
      const twistPhase = time * TWIST_SPEED;

      const glowBoost = 0.18 + 0.55 * rms + 0.25 * high;
      glowMat.emissiveColor = new BABYLON.Color3(
        0.06 + 0.10 * glowBoost,
        0.22 + 0.35 * glowBoost,
        0.70 + 0.55 * glowBoost,
      );
      glowMat.alpha = 0.18 + 0.22 * rms;

      const emissiveMul = 0.65 + 0.85 * rms + 0.35 * intensity;
      mat.emissiveColor = new BABYLON.Color3(0.10 * emissiveMul, 0.55 * emissiveMul, 1.10 * emissiveMul);
      ghostMat.emissiveColor = new BABYLON.Color3(
        0.12 + 0.38 * env,
        0.45 + 0.55 * rms,
        1.0 + 0.55 * high,
      );
      ghostMat.alpha = 0.22 + 0.22 * env;

      const maxH = MAX_H * (0.85 + 0.35 * rms + 0.25 * bass);

      for (let i = 0; i < BAR_COUNT; i++) {
        const raw = sampleBin(bins, i, BAR_COUNT);

        const fallback =
          (rms * 0.55) +
          (bass * 0.25) +
          (mid * 0.15) +
          (high * 0.05);

        const v = bins.length ? raw : clamp01(fallback);
        const targetH = MIN_H + (maxH - MIN_H) * (v * (0.55 + 0.45 * intensity));

        const prev = smoothH[i];
        const rate = targetH > prev ? rise : fall;
        const k = 1 - Math.exp(-rate * dtc);
        const h = prev + (targetH - prev) * k;
        smoothH[i] = h;

        const prevGhost = smoothGhost[i];
        const ghostTarget = targetH * (0.58 + 0.26 * Math.sin(time * 0.8 + i * 0.09));
        const gk = 1 - Math.exp(-(targetH > prevGhost ? 11 : 5.4) * dtc);
        const gh = prevGhost + (ghostTarget - prevGhost) * gk;
        smoothGhost[i] = gh;

        const t = i / BAR_COUNT;
        const ang = t * Math.PI * 2;
        const dir = new BABYLON.Vector3(Math.cos(ang), 0, Math.sin(ang));
        const pos = dir.scale(RADIUS);
        const twist = Math.sin((t * Math.PI * 2) * TWIST_WAVES + twistPhase) * twistAmp;

        BABYLON.Matrix.ComposeToRef(
          new BABYLON.Vector3(1, h, 1),
          BABYLON.Quaternion.RotationAxis(axisY, ang),
          new BABYLON.Vector3(pos.x, h * 0.5, pos.z + twist),
          tmpM,
        );
        tmpM.copyToArray(matrices, i * 16);

        const ghostPos = dir.scale(GHOST_RADIUS * (0.95 + 0.08 * Math.sin(time * 0.6 + i * 0.03)));
        const ghostTwist = Math.sin((t * Math.PI * 2) * (TWIST_WAVES + 0.6) + twistPhase * 0.75) * (twistAmp * 0.55);
        BABYLON.Matrix.ComposeToRef(
          new BABYLON.Vector3(1, Math.max(MIN_H, gh), 1),
          BABYLON.Quaternion.RotationAxis(axisY, ang + 0.03 * Math.sin(time * 0.5 + i * 0.07)),
          new BABYLON.Vector3(ghostPos.x, gh * 0.52, ghostPos.z - ghostTwist),
          tmpM,
        );
        tmpM.copyToArray(ghostMatrices, i * 16);

        const brighten = clamp01(0.35 + 1.05 * v + 0.35 * rms);
        const bc = baseColors[i];
        colors[i * 4 + 0] = bc.r * brighten;
        colors[i * 4 + 1] = bc.g * brighten;
        colors[i * 4 + 2] = bc.b * brighten;
        colors[i * 4 + 3] = 1.0;

        const ghostBright = clamp01(0.25 + 0.75 * v + 0.55 * env);
        ghostColors[i * 4 + 0] = bc.r * ghostBright * 0.85;
        ghostColors[i * 4 + 1] = bc.g * ghostBright * 0.9;
        ghostColors[i * 4 + 2] = bc.b * ghostBright * 1.1;
        ghostColors[i * 4 + 3] = 0.52 + 0.35 * ghostBright;
      }

      const sweepScalar = 0.65 + 0.65 * env + 0.35 * Math.sin(sweep);
      sweepRing.scaling.setAll(0.76 + 0.34 * (0.5 + 0.5 * Math.sin(sweep * 1.25)));
      sweepRing.rotation.z = Math.sin(time * 0.9) * 0.2;
      sweepMat.alpha = 0.10 + 0.32 * env + 0.25 * Math.max(0, Math.sin(sweep * 1.8));
      sweepMat.emissiveColor = new BABYLON.Color3(
        0.35 + 0.35 * sweepScalar,
        0.70 + 0.55 * rms,
        1.10 + 0.65 * high,
      );

      const corePulse = 1.0 + 0.22 * env + 0.12 * Math.sin(time * (1.1 + mid));
      core.scaling.setAll(corePulse);
      coreMat.alpha = 0.72 + 0.2 * env;
      coreMat.emissiveColor = new BABYLON.Color3(
        0.14 + 0.25 * bass,
        0.55 + 0.65 * rms,
        1.0 + 0.75 * high + 0.35 * env,
      );

      root.rotation.y += dtc * (0.08 + 0.22 * mid + 0.18 * high);
      root.rotation.x = Math.sin(time * 0.27) * 0.08;
      root.rotation.z = Math.cos(time * 0.22) * 0.07;

      base.thinInstanceBufferUpdated("matrix");
      base.thinInstanceBufferUpdated("color");
      ghost.thinInstanceBufferUpdated("matrix");
      ghost.thinInstanceBufferUpdated("color");
    },

    dispose() {
      base.dispose(false, true);
      mat.dispose(true, true);

      ghost.dispose(false, true);
      ghostMat.dispose(true, true);

      glowRing.dispose(false, true);
      glowMat.dispose(true, true);

      sweepRing.dispose(false, true);
      sweepMat.dispose(true, true);

      core.dispose(false, true);
      coreMat.dispose(true, true);

      root.dispose();
    },
  };
}
