import * as BABYLON from "@babylonjs/core";
import type { BabylonPresetRuntime } from "../types";

type EnergyRingsOptions = {
  enableGlow?: boolean;
};

type AudioLike = {
  rms?: number;
  bass?: number;
  mid?: number;
  high?: number;
  beat?: number;
  energy?: number;
  kick?: number;
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function createEnergyRingsPreset(
  scene: unknown,
  opts?: EnergyRingsOptions,
): BabylonPresetRuntime {
  const bjsScene = scene as BABYLON.Scene;
  const enableGlow = opts?.enableGlow ?? true;

  const RING_COUNT = 9;
  const BASE_RADIUS = 0.98;
  const RADIUS_STEP = 0.20;
  const BASE_THICKNESS = 0.042;
  const THICKNESS_BOOST = 0.11;
  const SEGMENTS = 160;

  const SPARK_COUNT = 320;

  const ROT_SPEED = 0.34;
  const WOBBLE = 0.2;
  const WOBBLE_SPEED = 0.92;

  const BASE_ALPHA = 0.93;
  const GHOST_ALPHA = 0.20;

  const root = new BABYLON.TransformNode("energyRingsRoot", bjsScene);
  root.position.y = 0.22;

  let glowLayer: BABYLON.GlowLayer | null = null;
  if (enableGlow) {
    glowLayer = new BABYLON.GlowLayer("ringsGlow", bjsScene, {
      blurKernelSize: 72,
    });
    glowLayer.intensity = 0.65;
  }

  const cDeep = new BABYLON.Color3(0.03, 0.10, 0.18);
  const cCyan = new BABYLON.Color3(0.08, 0.65, 0.98);
  const cWarm = new BABYLON.Color3(0.90, 0.72, 0.35);
  const cWhite = new BABYLON.Color3(1, 1, 1);

  const makeMat = (name: string, emissive: BABYLON.Color3, alpha: number) => {
    const m = new BABYLON.StandardMaterial(name, bjsScene);
    m.diffuseColor = cDeep;
    m.specularColor = new BABYLON.Color3(0.06, 0.06, 0.07);
    m.emissiveColor = emissive;
    m.alpha = alpha;
    m.backFaceCulling = false;
    return m;
  };

  const rings: BABYLON.Mesh[] = [];
  const mats: BABYLON.StandardMaterial[] = [];
  const ghosts: BABYLON.Mesh[] = [];
  const ghostMats: BABYLON.StandardMaterial[] = [];

  for (let i = 0; i < RING_COUNT; i++) {
    const t = i / Math.max(1, RING_COUNT - 1);
    const baseCol = BABYLON.Color3.Lerp(cCyan, cWarm, t * 0.85);

    const diameter = (BASE_RADIUS + i * RADIUS_STEP) * 2;
    const ring = BABYLON.MeshBuilder.CreateTorus(
      `ring_${i}`,
      { diameter, thickness: BASE_THICKNESS, tessellation: SEGMENTS },
      bjsScene,
    );
    ring.parent = root;
    ring.rotation.y = Math.PI / 2;
    ring.rotation.z = (i % 2 === 0 ? 1 : -1) * (0.04 + 0.06 * t);

    const mat = makeMat(`ringMat_${i}`, baseCol, BASE_ALPHA);
    ring.material = mat;

    rings.push(ring);
    mats.push(mat);

    const ghost = BABYLON.MeshBuilder.CreateTorus(
      `ghost_${i}`,
      {
        diameter: diameter * 1.012,
        thickness: BASE_THICKNESS * 0.88,
        tessellation: SEGMENTS,
      },
      bjsScene,
    );
    ghost.parent = root;
    ghost.rotation.y = ring.rotation.y;
    ghost.rotation.z = ring.rotation.z;
    ghost.position.x = -0.02;

    const gmat = makeMat(`ghostMat_${i}`, BABYLON.Color3.Lerp(baseCol, cDeep, 0.28), GHOST_ALPHA);
    ghost.material = gmat;

    ghosts.push(ghost);
    ghostMats.push(gmat);
  }

  const core = BABYLON.MeshBuilder.CreateTorus(
    "portalCore",
    { diameter: BASE_RADIUS * 0.70 * 2, thickness: BASE_THICKNESS * 0.52, tessellation: SEGMENTS },
    bjsScene,
  );
  core.parent = root;
  core.rotation.y = Math.PI / 2;

  const coreMat = makeMat("coreMat", cCyan.scale(0.92), 0.38);
  core.material = coreMat;

  const auraSphere = BABYLON.MeshBuilder.CreateSphere(
    "energyAuraSphere",
    { diameter: BASE_RADIUS * 1.0, segments: 26 },
    bjsScene,
  );
  auraSphere.parent = root;
  const auraMat = new BABYLON.StandardMaterial("energyAuraMat", bjsScene);
  auraMat.diffuseColor = BABYLON.Color3.Black();
  auraMat.specularColor = BABYLON.Color3.Black();
  auraMat.emissiveColor = new BABYLON.Color3(0.18, 0.72, 1.35);
  auraMat.alpha = 0.24;
  auraMat.backFaceCulling = false;
  auraSphere.material = auraMat;

  const scanRing = BABYLON.MeshBuilder.CreateTorus(
    "energyScanRing",
    { diameter: BASE_RADIUS * 2.24, thickness: BASE_THICKNESS * 0.44, tessellation: 128 },
    bjsScene,
  );
  scanRing.parent = root;
  scanRing.rotation.y = Math.PI / 2;
  const scanMat = new BABYLON.StandardMaterial("energyScanMat", bjsScene);
  scanMat.diffuseColor = BABYLON.Color3.Black();
  scanMat.specularColor = BABYLON.Color3.Black();
  scanMat.emissiveColor = new BABYLON.Color3(0.5, 1.0, 1.75);
  scanMat.alpha = 0;
  scanMat.backFaceCulling = false;
  scanRing.material = scanMat;

  const accentRingA = BABYLON.MeshBuilder.CreateTorus(
    "energyAccentA",
    { diameter: BASE_RADIUS * 2.9, thickness: BASE_THICKNESS * 0.35, tessellation: 120 },
    bjsScene,
  );
  accentRingA.parent = root;
  accentRingA.rotation.x = Math.PI / 2;
  const accentMatA = new BABYLON.StandardMaterial("energyAccentMatA", bjsScene);
  accentMatA.diffuseColor = BABYLON.Color3.Black();
  accentMatA.specularColor = BABYLON.Color3.Black();
  accentMatA.emissiveColor = new BABYLON.Color3(0.20, 0.65, 1.25);
  accentMatA.alpha = 0.22;
  accentMatA.backFaceCulling = false;
  accentRingA.material = accentMatA;

  const accentRingB = BABYLON.MeshBuilder.CreateTorus(
    "energyAccentB",
    { diameter: BASE_RADIUS * 3.45, thickness: BASE_THICKNESS * 0.28, tessellation: 120 },
    bjsScene,
  );
  accentRingB.parent = root;
  accentRingB.rotation.z = Math.PI / 2;
  const accentMatB = new BABYLON.StandardMaterial("energyAccentMatB", bjsScene);
  accentMatB.diffuseColor = BABYLON.Color3.Black();
  accentMatB.specularColor = BABYLON.Color3.Black();
  accentMatB.emissiveColor = new BABYLON.Color3(1.0, 0.45, 1.4);
  accentMatB.alpha = 0.17;
  accentMatB.backFaceCulling = false;
  accentRingB.material = accentMatB;

  const sparkBase = BABYLON.MeshBuilder.CreateSphere(
    "energySparkBase",
    { diameter: 0.028, segments: 6 },
    bjsScene,
  );
  sparkBase.parent = root;
  sparkBase.isPickable = false;

  const sparkMat = new BABYLON.StandardMaterial("energySparkMat", bjsScene);
  sparkMat.diffuseColor = BABYLON.Color3.Black();
  sparkMat.specularColor = BABYLON.Color3.Black();
  sparkMat.emissiveColor = new BABYLON.Color3(0.6, 0.95, 1.7);
  sparkMat.alpha = 0.82;
  sparkBase.material = sparkMat;

  const sparkMatrices = new Float32Array(SPARK_COUNT * 16);
  sparkBase.thinInstanceSetBuffer("matrix", sparkMatrices, 16, true);

  type Spark = { ring: number; a: number; speed: number; phase: number; w: number };
  const sparks: Spark[] = Array.from({ length: SPARK_COUNT }, () => ({
    ring: Math.floor(Math.random() * RING_COUNT),
    a: Math.random() * Math.PI * 2,
    speed: 0.35 + Math.random() * 1.35,
    phase: Math.random() * Math.PI * 2,
    w: 0.6 + Math.random() * 1.3,
  }));

  const tmpM = new BABYLON.Matrix();
  const tmpQ = BABYLON.Quaternion.Identity();
  const tmpScale = new BABYLON.Vector3();
  const tmpPos = new BABYLON.Vector3();

  function composeSpark(i: number, x: number, y: number, z: number, s: number) {
    tmpScale.set(s, s, s);
    tmpPos.set(x, y, z);
    BABYLON.Matrix.ComposeToRef(tmpScale, tmpQ, tmpPos, tmpM);
    tmpM.copyToArray(sparkMatrices, i * 16);
  }

  let beatEnv = 0;
  let scanEnv = 0;
  let time = 0;

  return {
    update(audio, dt, blend) {
      const a = audio as AudioLike;
      const dtc = Math.max(1 / 240, Math.min(1 / 20, dt || 1 / 60));
      time += dtc;

      const intensity = clamp01(blend?.intensity ?? 1);
      const rms = clamp01(a.rms ?? a.energy ?? 0);
      const bass = clamp01(a.bass ?? 0);
      const mid = clamp01(a.mid ?? 0);
      const high = clamp01(a.high ?? 0);
      const beat = clamp01(a.beat ?? a.kick ?? 0);

      const target = clamp01(0.55 * beat + 0.35 * bass + 0.15 * rms);
      const rate = target > beatEnv ? 18 : 6;
      beatEnv = beatEnv + (target - beatEnv) * (1 - Math.exp(-rate * dtc));

      scanEnv = Math.max(scanEnv * Math.exp(-4.4 * dtc), beat > 0.62 ? 1 : 0);

      const env = clamp01(0.55 * rms + 0.45 * beatEnv + 0.25 * high);

      const wob = WOBBLE * (0.25 + 0.9 * rms + 0.7 * beatEnv);
      root.position.y = 0.22 + Math.sin(time * WOBBLE_SPEED) * wob * 0.50;
      root.position.z = Math.cos(time * (WOBBLE_SPEED * 0.86)) * wob * 0.40;
      root.position.x = Math.sin(time * (WOBBLE_SPEED * 0.72)) * wob * 0.38;

      root.rotation.y = Math.sin(time * 0.35) * 0.11;
      root.rotation.z = Math.cos(time * 0.28) * 0.08;
      root.rotation.x += dtc * ROT_SPEED * (0.22 + 0.9 * mid + 0.5 * intensity);

      if (glowLayer) {
        glowLayer.intensity = 0.55 + 0.45 * rms + 0.35 * high + 0.35 * beatEnv;
      }

      const coreBreath = 1 + 0.04 * Math.sin(time * 1.1) + 0.12 * beatEnv;
      core.scaling.set(coreBreath, coreBreath, coreBreath);
      coreMat.emissiveColor = BABYLON.Color3.Lerp(cCyan, cWhite, clamp01(0.15 * high + 0.13 * beatEnv))
        .scale(0.38 + 0.92 * rms + 0.55 * beatEnv);

      auraSphere.scaling.setAll(1.0 + 0.14 * env + 0.11 * Math.sin(time * 1.5));
      auraMat.alpha = 0.14 + 0.22 * env;
      auraMat.emissiveColor = new BABYLON.Color3(
        0.14 + 0.28 * beatEnv,
        0.55 + 0.58 * rms,
        1.1 + 0.8 * high,
      );

      const sweep = 0.5 + 0.5 * Math.sin(time * (1.6 + 0.8 * mid));
      scanRing.position.x = (sweep * 2.0 - 1.0) * 0.45;
      scanRing.scaling.setAll(1.0 + 0.2 * scanEnv);
      scanRing.rotation.z += dtc * (0.6 + 1.2 * high);
      scanMat.alpha = 0.08 + 0.55 * scanEnv;
      scanMat.emissiveColor = new BABYLON.Color3(
        0.45 + 0.55 * scanEnv,
        0.95 + 0.4 * (scanEnv + rms),
        1.55 + 0.75 * (scanEnv + high),
      );

      accentRingA.scaling.setAll(1.0 + 0.08 * env);
      accentRingA.rotation.y += dtc * (0.15 + 0.65 * mid);
      accentRingA.rotation.z = Math.sin(time * 0.22) * 0.2;
      accentMatA.alpha = 0.14 + 0.25 * env;
      accentMatA.emissiveColor = new BABYLON.Color3(
        0.12 + 0.22 * env,
        0.45 + 0.55 * rms,
        1.0 + 0.62 * high,
      );

      accentRingB.scaling.setAll(1.0 + 0.05 * Math.sin(time * 0.25) + 0.09 * beatEnv);
      accentRingB.rotation.x += dtc * (0.12 + 0.38 * high);
      accentRingB.rotation.y += dtc * (0.1 + 0.28 * mid);
      accentMatB.alpha = 0.12 + 0.22 * env;
      accentMatB.emissiveColor = new BABYLON.Color3(
        0.65 + 0.45 * high,
        0.28 + 0.35 * env,
        0.85 + 0.6 * rms,
      );

      sparkMat.emissiveColor = new BABYLON.Color3(
        0.45 + 0.4 * high,
        0.75 + 0.55 * rms,
        1.2 + 0.85 * beatEnv,
      );
      sparkMat.alpha = 0.35 + 0.45 * env;

      for (let i = 0; i < RING_COUNT; i++) {
        const t = i / Math.max(1, RING_COUNT - 1);
        const phase = time * (1.2 + 0.7 * t) + i * 0.55;
        const ripple = Math.sin(phase) * 0.5 + 0.5;

        const innerBias = 0.30 + 0.70 * (1 - t);
        const thick =
          BASE_THICKNESS +
          THICKNESS_BOOST * innerBias * (0.16 + 0.84 * beatEnv) * (0.55 + 0.45 * bass);

        rings[i].scaling.y = thick / BASE_THICKNESS;

        const breath = 1 + 0.03 * Math.sin(time * 1.1 + i) + 0.08 * beatEnv * innerBias;
        rings[i].scaling.x = breath;
        rings[i].scaling.z = breath;

        const baseCol = BABYLON.Color3.Lerp(cCyan, cWarm, t * 0.85);
        const whiteMix = clamp01(0.18 * beatEnv + 0.11 * high + 0.08 * scanEnv);
        const ringGlow =
          (0.72 + 0.98 * rms + 1.35 * beatEnv + 0.42 * high + 0.25 * ripple) *
          (0.75 + 0.55 * intensity);

        mats[i].emissiveColor = BABYLON.Color3.Lerp(baseCol, cWhite, whiteMix).scale(ringGlow);

        const gGlow = 0.16 + 0.35 * rms + 0.38 * beatEnv;
        ghostMats[i].emissiveColor = baseCol.scale(gGlow);
        ghosts[i].scaling.x = 1 + 0.04 * beatEnv;
        ghosts[i].scaling.z = 1 + 0.04 * beatEnv;
      }

      for (let i = 0; i < SPARK_COUNT; i++) {
        const p = sparks[i];
        p.a += dtc * p.speed * (0.55 + 0.85 * high + 0.65 * beatEnv);

        const rr = BASE_RADIUS + p.ring * RADIUS_STEP;
        const wobble = 1 + 0.06 * Math.sin(time * 0.9 + p.phase);
        const x = Math.cos(p.a) * rr * wobble;
        const y = Math.sin(p.a) * rr * wobble;
        const z = Math.sin(time * 1.35 + p.phase) * (0.08 + 0.16 * env);

        const twinkle = 0.65 + 0.35 * Math.sin(time * 7.0 + p.phase);
        const s = (0.55 + 0.85 * p.w + 0.65 * env) * twinkle;

        composeSpark(i, x, y, z, s);
      }
      sparkBase.thinInstanceBufferUpdated("matrix");
    },

    dispose() {
      rings.forEach((m) => m.dispose(false, true));
      ghosts.forEach((m) => m.dispose(false, true));
      mats.forEach((m) => m.dispose(true, true));
      ghostMats.forEach((m) => m.dispose(true, true));

      core.dispose(false, true);
      coreMat.dispose(true, true);

      auraSphere.dispose(false, true);
      auraMat.dispose(true, true);

      scanRing.dispose(false, true);
      scanMat.dispose(true, true);

      accentRingA.dispose(false, true);
      accentMatA.dispose(true, true);
      accentRingB.dispose(false, true);
      accentMatB.dispose(true, true);

      sparkBase.dispose(false, true);
      sparkMat.dispose(true, true);

      glowLayer?.dispose();
      root.dispose();
    },
  };
}
