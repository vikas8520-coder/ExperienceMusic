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

function randDisc(radius: number) {
  const a = Math.random() * Math.PI * 2;
  const r = radius * Math.sqrt(Math.random());
  return { x: Math.cos(a) * r, z: Math.sin(a) * r };
}

function chladni(x: number, z: number, t: number, m: number, n: number) {
  const s1 = Math.sin(m * x + t * 0.6) * Math.sin(n * z - t * 0.45);
  const s2 = Math.sin((m + 1) * (x + z) * 0.6 - t * 0.25);
  const s3 = Math.cos((n + 2) * (x - z) * 0.55 + t * 0.35);
  return 0.55 * s1 + 0.25 * s2 + 0.20 * s3;
}

export function createCymaticSandPlatePreset(
  scene: unknown,
  opts?: { enableGlow?: boolean; heavyEdges?: boolean; controlCamera?: boolean },
): BabylonPresetRuntime {
  const bjsScene = scene as any;
  const enableGlow = opts?.enableGlow ?? true;
  const heavyEdges = opts?.heavyEdges ?? true;
  const controlCamera = opts?.controlCamera ?? true;

  const PLATE_R = 2.35;
  const PLATE_Y = -0.15;

  const GRAIN_COUNT = 9000;
  const GRAIN_SIZE = 0.012;
  const GRAIN_SIZE_VAR = 0.010;

  const SETTLE_RATE = 1.10;
  const DRIFT_RATE = 0.25;
  const KICK_LIFT = 0.22;
  const HIGH_SHIMMER = 0.28;

  const MODE_M_MIN = 3;
  const MODE_M_MAX = 9;
  const MODE_N_MIN = 3;
  const MODE_N_MAX = 9;
  const MODE_CHANGE_RATE = 0.14;

  const RIPPLE_SPEED = 2.6;
  const RIPPLE_DECAY = 2.4;

  const FOG_BASE = 0.012;
  const FOG_REACT = 0.018;
  const VIGNETTE_OUTER = heavyEdges ? 0.55 : 0.38;
  const VIGNETTE_INNER = heavyEdges ? 0.26 : 0.16;

  const SCAN_THICKNESS = 0.065;
  const SCAN_ALPHA_BASE = 0.10;
  const SCAN_ALPHA_BOOST = 0.75;
  const SCAN_SPEED = 2.35;
  const SCAN_DECAY = 4.0;

  const SPARKLE_COUNT = 650;
  const SPARKLE_SIZE = 0.020;

  const CAM_ORBIT_SPEED = 0.06;
  const CAM_BREATHE = 0.20;

  const root = new BABYLON.TransformNode("sandRoot", bjsScene);

  const hemi = new BABYLON.HemisphericLight("sandHemi", new BABYLON.Vector3(0.2, 1, 0.1), bjsScene);
  hemi.intensity = 0.55;

  const key = new BABYLON.PointLight("sandKey", new BABYLON.Vector3(0, 2.1, -2.2), bjsScene);
  key.intensity = 22;
  key.radius = 18;

  const rim = new BABYLON.PointLight("sandRim", new BABYLON.Vector3(0, 1.4, 2.4), bjsScene);
  rim.intensity = 14;
  rim.radius = 16;
  rim.diffuse = new BABYLON.Color3(0.3, 0.7, 1.0);

  const prevFogMode = bjsScene.fogMode;
  const prevFogDensity = bjsScene.fogDensity;
  const prevFogColor = bjsScene.fogColor ? bjsScene.fogColor.clone() : null;

  bjsScene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  bjsScene.fogColor = new BABYLON.Color3(0.01, 0.015, 0.03);
  bjsScene.fogDensity = FOG_BASE;

  let glow: any = null;
  if (enableGlow) {
    glow = new BABYLON.GlowLayer("sandGlow", bjsScene, { blurKernelSize: 64 });
    glow.intensity = 0.65;
  }

  const plate = BABYLON.MeshBuilder.CreateDisc("sandPlate", { radius: PLATE_R, tessellation: 160 }, bjsScene);
  plate.parent = root;
  plate.isPickable = false;
  plate.position.y = PLATE_Y;
  plate.rotation.x = Math.PI / 2;

  const plateMat = new BABYLON.StandardMaterial("sandPlateMat", bjsScene);
  plateMat.diffuseColor = new BABYLON.Color3(0.035, 0.035, 0.04);
  plateMat.specularColor = new BABYLON.Color3(0.14, 0.14, 0.15);
  plateMat.emissiveColor = new BABYLON.Color3(0.02, 0.05, 0.10);
  plateMat.alpha = 1.0;
  plateMat.backFaceCulling = false;
  plate.material = plateMat;

  // Luxury Glass Top Plate (transparent + fresnel rim)
  const glass = BABYLON.MeshBuilder.CreateDisc(
    "sandGlassTop",
    { radius: PLATE_R * 0.995, tessellation: 160 },
    bjsScene,
  );
  glass.parent = root;
  glass.isPickable = false;
  glass.position.y = PLATE_Y + 0.018;
  glass.rotation.x = Math.PI / 2;

  const glassMat = new BABYLON.PBRMaterial("sandGlassMat", bjsScene);
  glassMat.alpha = 0.18;
  glassMat.roughness = 0.08;
  glassMat.metallic = 0.0;
  glassMat.indexOfRefraction = 1.48;
  const glassSubSurface = (glassMat as any).subSurface;
  if (glassSubSurface) {
    glassSubSurface.isRefractionEnabled = true;
    glassSubSurface.refractionIntensity = 0.65;
    glassSubSurface.tintColor = new BABYLON.Color3(0.60, 0.85, 1.00);
    glassSubSurface.tintColorAtDistance = 2.0;
  }
  glassMat.emissiveColor = new BABYLON.Color3(0.04, 0.12, 0.22);

  const fres = new BABYLON.FresnelParameters();
  fres.isEnabled = true;
  fres.bias = 0.08;
  fres.power = 3.0;
  fres.leftColor = new BABYLON.Color3(0.02, 0.05, 0.10);
  fres.rightColor = new BABYLON.Color3(0.35, 0.85, 1.35);
  glassMat.emissiveFresnelParameters = fres;
  glass.material = glassMat;

  const glassRim = BABYLON.MeshBuilder.CreateTorus(
    "sandGlassRim",
    { diameter: PLATE_R * 2.005, thickness: 0.03, tessellation: 160 },
    bjsScene,
  );
  glassRim.parent = root;
  glassRim.isPickable = false;
  glassRim.position.y = PLATE_Y + 0.020;
  glassRim.rotation.x = Math.PI / 2;

  const glassRimMat = new BABYLON.StandardMaterial("sandGlassRimMat", bjsScene);
  glassRimMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
  glassRimMat.specularColor = new BABYLON.Color3(0, 0, 0);
  glassRimMat.emissiveColor = new BABYLON.Color3(0.20, 0.75, 1.25);
  glassRimMat.alpha = 0.28;
  glassRimMat.backFaceCulling = false;
  glassRim.material = glassRimMat;

  const rimRing = BABYLON.MeshBuilder.CreateTorus(
    "sandRimRing",
    { diameter: PLATE_R * 2.02, thickness: 0.07, tessellation: 140 },
    bjsScene,
  );
  rimRing.parent = root;
  rimRing.isPickable = false;
  rimRing.position.y = PLATE_Y + 0.005;
  rimRing.rotation.x = Math.PI / 2;

  const rimMat = new BABYLON.StandardMaterial("sandRimMat", bjsScene);
  rimMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
  rimMat.specularColor = new BABYLON.Color3(0, 0, 0);
  rimMat.emissiveColor = new BABYLON.Color3(0.10, 0.55, 1.15);
  rimMat.alpha = 0.55;
  rimMat.backFaceCulling = false;
  rimRing.material = rimMat;

  const vigOuter = BABYLON.MeshBuilder.CreateDisc(
    "sandVigOuter",
    { radius: PLATE_R * 1.22, tessellation: 96 },
    bjsScene,
  );
  vigOuter.parent = root;
  vigOuter.isPickable = false;
  vigOuter.position.y = PLATE_Y + 0.02;
  vigOuter.rotation.x = Math.PI / 2;

  const vigOuterMat = new BABYLON.StandardMaterial("sandVigOuterMat", bjsScene);
  vigOuterMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
  vigOuterMat.specularColor = new BABYLON.Color3(0, 0, 0);
  vigOuterMat.emissiveColor = new BABYLON.Color3(0, 0, 0);
  vigOuterMat.alpha = VIGNETTE_OUTER;
  vigOuterMat.backFaceCulling = false;
  vigOuter.material = vigOuterMat;

  const vigInner = vigOuter.clone("sandVigInner") as any;
  vigInner.scaling.setAll(0.84);
  vigInner.position.y = PLATE_Y + 0.022;

  const vigInnerMat = vigOuterMat.clone("sandVigInnerMat") as any;
  vigInnerMat.alpha = VIGNETTE_INNER;
  vigInner.material = vigInnerMat;

  const scanRing = BABYLON.MeshBuilder.CreateTorus(
    "sandScanRing",
    { diameter: PLATE_R * 0.6, thickness: SCAN_THICKNESS, tessellation: 140 },
    bjsScene,
  );
  scanRing.parent = root;
  scanRing.isPickable = false;
  scanRing.position.y = PLATE_Y + 0.012;
  scanRing.rotation.x = Math.PI / 2;

  const scanMat = new BABYLON.StandardMaterial("sandScanMat", bjsScene);
  scanMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
  scanMat.specularColor = new BABYLON.Color3(0, 0, 0);
  scanMat.emissiveColor = new BABYLON.Color3(0.55, 0.95, 1.55);
  scanMat.alpha = 0.0;
  scanMat.backFaceCulling = false;
  scanRing.material = scanMat;

  const grainBase = BABYLON.MeshBuilder.CreateSphere(
    "sandGrainBase",
    { diameter: GRAIN_SIZE, segments: 6 },
    bjsScene,
  );
  grainBase.parent = root;
  grainBase.isPickable = false;

  const grainMat = new BABYLON.StandardMaterial("sandGrainMat", bjsScene);
  grainMat.diffuseColor = new BABYLON.Color3(0.03, 0.03, 0.03);
  grainMat.specularColor = new BABYLON.Color3(0.10, 0.10, 0.11);
  grainMat.emissiveColor = new BABYLON.Color3(0.08, 0.35, 0.85);
  grainMat.alpha = 0.92;
  grainMat.backFaceCulling = false;
  grainBase.material = grainMat;

  const grainMatrices = new Float32Array(GRAIN_COUNT * 16);
  grainBase.thinInstanceSetBuffer("matrix", grainMatrices, 16, true);

  type Grain = {
    x: number;
    z: number;
    y: number;
    vx: number;
    vz: number;
    s: number;
    seed: number;
  };
  const grains: Grain[] = Array.from({ length: GRAIN_COUNT }, () => {
    const p = randDisc(PLATE_R * 0.985);
    return {
      x: p.x,
      z: p.z,
      y: PLATE_Y + 0.012 + Math.random() * 0.01,
      vx: (Math.random() * 2 - 1) * 0.004,
      vz: (Math.random() * 2 - 1) * 0.004,
      s: 0.75 + Math.random() * 1.65,
      seed: Math.random() * 1000,
    };
  });

  const sparkleBase = BABYLON.MeshBuilder.CreateSphere(
    "sandSparkleBase",
    { diameter: SPARKLE_SIZE, segments: 6 },
    bjsScene,
  );
  sparkleBase.parent = root;
  sparkleBase.isPickable = false;

  const sparkleMat = new BABYLON.StandardMaterial("sandSparkleMat", bjsScene);
  sparkleMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
  sparkleMat.specularColor = new BABYLON.Color3(0, 0, 0);
  sparkleMat.emissiveColor = new BABYLON.Color3(0.95, 0.95, 1.35);
  sparkleMat.alpha = 0.0;
  sparkleMat.backFaceCulling = false;
  sparkleBase.material = sparkleMat;

  const sparkleMatrices = new Float32Array(SPARKLE_COUNT * 16);
  sparkleBase.thinInstanceSetBuffer("matrix", sparkleMatrices, 16, true);

  type Spark = { x: number; z: number; y: number; seed: number; s: number; pop: number };
  const sparks: Spark[] = Array.from({ length: SPARKLE_COUNT }, () => {
    const p = randDisc(PLATE_R * 0.95);
    return {
      x: p.x,
      z: p.z,
      y: PLATE_Y + 0.03,
      seed: Math.random() * 10000,
      s: 0.75 + Math.random() * 1.6,
      pop: 0,
    };
  });

  const tmpM = new BABYLON.Matrix();
  const tmpQ = BABYLON.Quaternion.Identity();

  function composeTo(arr: Float32Array, i: number, x: number, y: number, z: number, s: number) {
    BABYLON.Matrix.ComposeToRef(
      new BABYLON.Vector3(s, s, s),
      tmpQ,
      new BABYLON.Vector3(x, y, z),
      tmpM,
    );
    tmpM.copyToArray(arr, i * 16);
  }

  for (let i = 0; i < GRAIN_COUNT; i++) {
    const g = grains[i];
    const sc = 0.75 + 18.0 * (GRAIN_SIZE + (Math.random() * 2 - 1) * GRAIN_SIZE_VAR) * g.s;
    composeTo(grainMatrices, i, g.x, g.y, g.z, sc);
  }
  grainBase.thinInstanceBufferUpdated("matrix");

  for (let i = 0; i < SPARKLE_COUNT; i++) {
    const s = sparks[i];
    const sc = 0.55 + 12.0 * SPARKLE_SIZE * s.s;
    composeTo(sparkleMatrices, i, s.x, s.y, s.z, sc);
  }
  sparkleBase.thinInstanceBufferUpdated("matrix");

  type Ripple = { r: number; s: number; alive: boolean };
  const ripples: Ripple[] = Array.from({ length: 4 }, () => ({ r: 0, s: 0, alive: false }));

  function emitRipple(strength: number) {
    let idx = ripples.findIndex((r) => !r.alive);
    if (idx === -1) idx = 0;
    ripples[idx].alive = true;
    ripples[idx].r = 0;
    ripples[idx].s = strength;
  }

  let time = 0;
  let env = 0;
  let prevBeat = 0;

  let m = 5;
  let n = 7;
  let m2 = 7;
  let n2 = 5;
  let modeT = 0;

  let scanEnv = 0;
  let scanR = 0.25;

  const cam0 = bjsScene.activeCamera;
  const arc0 =
    cam0 && cam0 instanceof (BABYLON as any).ArcRotateCamera ? cam0 : null;
  const baseAlpha = arc0 ? arc0.alpha : 0;
  const baseBeta = arc0 ? arc0.beta : 0;
  const baseRadius = arc0 ? arc0.radius : 0;
  const baseTarget = arc0 ? arc0.target.clone() : new BABYLON.Vector3(0, PLATE_Y, 0);

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
      const rate = target > env ? 18 : 6;
      env = env + (target - env) * (1 - Math.exp(-rate * dtc));

      const beatEdge = beat > 0.62 && prevBeat <= 0.62;
      prevBeat = beat;

      if (beatEdge) {
        emitRipple(0.85 + 0.85 * env + 0.65 * high);
        scanEnv = Math.min(1.0, scanEnv + 0.85 + 0.55 * env);
        for (let k = 0; k < 24; k++) {
          const idx = (Math.random() * SPARKLE_COUNT) | 0;
          sparks[idx].pop = Math.min(1.0, sparks[idx].pop + 0.65 + 0.35 * high);
        }
      }

      bjsScene.fogDensity = FOG_BASE + FOG_REACT * (0.45 * rms + 0.85 * env);
      if (glow) glow.intensity = 0.55 + 0.60 * env + 0.45 * high;

      const plateBreath = 1 + 0.02 * Math.sin(time * 0.9) * (0.35 + env);
      plate.scaling.setAll(plateBreath);

      rimMat.emissiveColor = new BABYLON.Color3(
        0.06 + 0.22 * env,
        0.35 + 0.55 * rms,
        0.85 + 0.55 * high,
      );
      rimMat.alpha = 0.38 + 0.22 * env;

      vigOuterMat.alpha = VIGNETTE_OUTER + 0.14 * env;
      vigInnerMat.alpha = VIGNETTE_INNER + 0.10 * rms;

      if (controlCamera && arc0) {
        const orbit = CAM_ORBIT_SPEED * (0.55 + 0.75 * mid + 0.45 * env);
        const breathe = 1.0 + CAM_BREATHE * (0.18 * env + 0.10 * bass);
        arc0.alpha = baseAlpha + time * orbit;
        arc0.beta = baseBeta + Math.sin(time * 0.28) * 0.05 + 0.02 * high;
        arc0.radius = baseRadius * (0.92 + 0.08 * breathe);
        arc0.target = BABYLON.Vector3.Lerp(baseTarget, new BABYLON.Vector3(0, PLATE_Y, 0), 0.25);
      }

      modeT += MODE_CHANGE_RATE * dtc * (0.35 + 0.65 * mid);
      if (modeT >= 1) {
        modeT = 0;
        m = m2;
        n = n2;
        m2 = MODE_M_MIN + ((Math.random() * (MODE_M_MAX - MODE_M_MIN + 1)) | 0);
        n2 = MODE_N_MIN + ((Math.random() * (MODE_N_MAX - MODE_N_MIN + 1)) | 0);
      }

      const mm = lerp(m, m2, modeT);
      const nn = lerp(n, n2, modeT);

      for (const r of ripples) {
        if (!r.alive) continue;
        r.r += RIPPLE_SPEED * dtc;
        r.s *= Math.exp(-RIPPLE_DECAY * dtc);
        if (r.r > PLATE_R * 1.25 || r.s < 0.05) r.alive = false;
      }

      const col = palette(time * 0.03 + 0.35 * mid);
      const bright = 0.55 + 1.25 * env + 0.75 * high;
      grainMat.emissiveColor = new BABYLON.Color3(col.r * bright, col.g * bright, col.b * bright);

      plateMat.emissiveColor = new BABYLON.Color3(
        0.02 + 0.06 * env,
        0.05 + 0.08 * rms,
        0.10 + 0.12 * high,
      );

      // Glass responds subtly (premium light catch)
      const glassPulse = 0.06 + 0.16 * env + 0.10 * high;
      glassMat.alpha = 0.14 + glassPulse * 0.22;
      glassMat.emissiveColor = new BABYLON.Color3(
        0.03 + 0.08 * env,
        0.10 + 0.12 * rms,
        0.18 + 0.18 * high,
      );

      // Rim gets brighter on beat + scan
      glassRimMat.alpha = 0.22 + 0.18 * env + 0.18 * scanEnv;
      glassRimMat.emissiveColor = new BABYLON.Color3(
        0.18 + 0.25 * (env + scanEnv),
        0.65 + 0.55 * rms,
        1.05 + 0.55 * (high + scanEnv),
      );

      scanEnv *= Math.exp(-SCAN_DECAY * dtc);
      if (scanEnv > 0.01) {
        scanR += SCAN_SPEED * dtc * (0.55 + 0.75 * mid + 0.45 * env);
        if (scanR > 1.05) scanR = 0.05;

        const d = lerp(PLATE_R * 0.30, PLATE_R * 2.02, clamp01(scanR));
        const baseD = PLATE_R * 0.6;
        const sc = d / baseD;
        scanRing.scaling.setAll(sc);
        scanRing.rotation.y = Math.sin(time * 1.1) * 0.08 * (0.25 + high);

        scanMat.alpha = SCAN_ALPHA_BASE + SCAN_ALPHA_BOOST * scanEnv * (0.55 + 0.45 * high);
        scanMat.emissiveColor = new BABYLON.Color3(
          0.45 + 0.55 * scanEnv,
          0.85 + 0.55 * (scanEnv + rms),
          1.25 + 0.65 * (scanEnv + high),
        );
      } else {
        scanMat.alpha = 0.0;
      }

      const settle = SETTLE_RATE * (0.35 + 0.65 * intensity) * (0.45 + 0.85 * env);
      const drift = DRIFT_RATE * (0.25 + 0.75 * rms);
      const shimmer = HIGH_SHIMMER * high;

      for (let i = 0; i < GRAIN_COUNT; i++) {
        const g = grains[i];

        const x = g.x / PLATE_R;
        const z = g.z / PLATE_R;

        const f = chladni(x * Math.PI, z * Math.PI, time, mm, nn);
        const nodal = Math.abs(f);
        const attract = Math.exp(-18.0 * nodal * nodal);

        const nx = Math.sin(time * 0.9 + g.seed * 0.17) * 0.0015;
        const nz = Math.cos(time * 0.85 + g.seed * 0.19) * 0.0015;

        const eps = 0.012;
        const fX = chladni((x + eps) * Math.PI, z * Math.PI, time, mm, nn);
        const fZ = chladni(x * Math.PI, (z + eps) * Math.PI, time, mm, nn);
        const gx = Math.abs(fX) - nodal;
        const gz = Math.abs(fZ) - nodal;

        g.vx += (-gx * 0.035) * settle * (0.35 + 0.65 * attract);
        g.vz += (-gz * 0.035) * settle * (0.35 + 0.65 * attract);

        g.vx += (nx + (Math.random() * 2 - 1) * 0.0002) * drift;
        g.vz += (nz + (Math.random() * 2 - 1) * 0.0002) * drift;

        const rr = Math.sqrt(g.x * g.x + g.z * g.z);
        if (rr > 1e-5) {
          const rx = g.x / rr;
          const rz = g.z / rr;
          let ripplePush = 0;
          for (const r of ripples) {
            if (!r.alive) continue;
            const d = Math.abs(rr - r.r);
            const k = Math.max(0, 1 - d / 0.22);
            ripplePush += k * r.s;
          }
          g.vx += rx * ripplePush * 0.010;
          g.vz += rz * ripplePush * 0.010;
        }

        if (scanEnv > 0.01) {
          const scanRadius = lerp(PLATE_R * 0.15, PLATE_R * 1.01, clamp01(scanR));
          const d = Math.abs(rr - scanRadius);
          if (d < 0.18) {
            const k = 1 - d / 0.18;
            const tx = -g.z / Math.max(1e-5, rr);
            const tz = g.x / Math.max(1e-5, rr);
            g.vx += tx * k * 0.010 * scanEnv;
            g.vz += tz * k * 0.010 * scanEnv;
          }
        }

        g.vx *= 0.985;
        g.vz *= 0.985;

        g.x += g.vx;
        g.z += g.vz;

        const rNow = Math.sqrt(g.x * g.x + g.z * g.z);
        if (rNow > PLATE_R * 0.985) {
          const s = (PLATE_R * 0.985) / rNow;
          g.x *= s;
          g.z *= s;
          g.vx *= -0.35;
          g.vz *= -0.35;
        }

        const lift =
          KICK_LIFT * (0.45 * beat + 0.75 * env) * (0.35 + 0.65 * intensity) * attract +
          shimmer * (0.02 + 0.03 * Math.sin(time * 6.0 + g.seed));
        g.y = PLATE_Y + 0.010 + lift;

        const sc =
          0.75 +
          18.0 *
            (GRAIN_SIZE + (Math.sin(g.seed + time) * 0.5 + 0.5) * GRAIN_SIZE_VAR) *
            g.s;
        composeTo(grainMatrices, i, g.x, g.y, g.z, sc);
      }
      grainBase.thinInstanceBufferUpdated("matrix");

      const highPopRate = 6;
      const highPopChance = 0.02 + 0.06 * high + 0.05 * env;
      if (Math.random() < highPopChance) {
        const idx = (Math.random() * SPARKLE_COUNT) | 0;
        sparks[idx].pop = Math.min(1.0, sparks[idx].pop + 0.35 + 0.55 * high);
      }

      const spCol = palette(time * 0.06 + 0.2 * high);
      sparkleMat.emissiveColor = new BABYLON.Color3(
        0.45 + spCol.r * (0.75 + 0.75 * env),
        0.55 + spCol.g * (0.65 + 0.55 * rms),
        0.85 + spCol.b * (0.85 + 0.65 * high),
      );

      let sparkleAlphaAcc = 0;
      for (let i = 0; i < SPARKLE_COUNT; i++) {
        const s = sparks[i];
        s.pop *= Math.exp(-highPopRate * dtc);

        const wig = 0.015 + 0.03 * high;
        const ox = Math.sin(time * 1.7 + s.seed) * wig;
        const oz = Math.cos(time * 1.5 + s.seed * 0.9) * wig;
        const oy = (0.01 + 0.06 * s.pop) + Math.sin(time * 3.5 + s.seed) * 0.01;

        const rr = Math.sqrt(s.x * s.x + s.z * s.z);
        const nx = rr > 1e-5 ? s.x / rr : 1;
        const nz = rr > 1e-5 ? s.z / rr : 0;

        const fx = (s.x / PLATE_R) * Math.PI;
        const fz = (s.z / PLATE_R) * Math.PI;
        const f = chladni(fx, fz, time, mm, nn);
        const attract = Math.exp(-18.0 * (Math.abs(f) ** 2));

        const px = s.x + ox + nx * 0.05 * s.pop * (0.2 + 0.8 * attract);
        const pz = s.z + oz + nz * 0.05 * s.pop * (0.2 + 0.8 * attract);

        const scale = (0.55 + 14.0 * SPARKLE_SIZE * s.s) * (0.85 + 0.75 * s.pop);
        composeTo(sparkleMatrices, i, px, PLATE_Y + 0.03 + oy, pz, scale);
        sparkleAlphaAcc += s.pop;
      }

      sparkleBase.thinInstanceBufferUpdated("matrix");
      const avgPop = sparkleAlphaAcc / SPARKLE_COUNT;
      sparkleMat.alpha = Math.min(0.85, 0.05 + 0.95 * avgPop);
    },

    dispose() {
      bjsScene.fogMode = prevFogMode;
      bjsScene.fogDensity = prevFogDensity;
      if (prevFogColor) bjsScene.fogColor = prevFogColor;

      glow?.dispose();

      sparkleBase.dispose(false, true);
      sparkleMat.dispose(true, true);

      scanRing.dispose(false, true);
      scanMat.dispose(true, true);

      grainBase.dispose(false, true);
      grainMat.dispose(true, true);

      vigInner.dispose(false, true);
      vigInnerMat.dispose(true, true);
      vigOuter.dispose(false, true);
      vigOuterMat.dispose(true, true);

      rimRing.dispose(false, true);
      rimMat.dispose(true, true);

      plate.dispose(false, true);
      plateMat.dispose(true, true);

      glassRim.dispose(false, true);
      glassRimMat.dispose(true, true);

      glass.dispose(false, true);
      glassMat.dispose(true, true);

      hemi.dispose();
      key.dispose();
      rim.dispose();

      root.dispose();
    },
  };
}
