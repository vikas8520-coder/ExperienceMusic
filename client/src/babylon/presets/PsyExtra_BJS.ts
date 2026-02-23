import * as BABYLON from "@babylonjs/core";
import type { BabylonPresetRuntime } from "../types";

type PsyExtraOptions = {
  enableGlow?: boolean;
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function psyPalette(t: number) {
  const a = new BABYLON.Color3(0.12, 0.95, 0.98);
  const b = new BABYLON.Color3(0.20, 0.35, 1.00);
  const c = new BABYLON.Color3(0.95, 0.20, 0.95);
  const d = new BABYLON.Color3(0.98, 0.80, 0.20);
  const e = new BABYLON.Color3(0.22, 0.95, 0.35);

  const u = ((t % 1) + 1) % 1;
  if (u < 0.25) return BABYLON.Color3.Lerp(a, b, u / 0.25);
  if (u < 0.50) return BABYLON.Color3.Lerp(b, c, (u - 0.25) / 0.25);
  if (u < 0.75) return BABYLON.Color3.Lerp(c, d, (u - 0.50) / 0.25);
  return BABYLON.Color3.Lerp(d, e, (u - 0.75) / 0.25);
}

function wrapDist01(a: number, b: number) {
  const d = Math.abs(a - b);
  return Math.min(d, 1 - d);
}

function wrap01(x: number) {
  return ((x % 1) + 1) % 1;
}

export function createPsyExtraPreset(
  scene: unknown,
  opts?: PsyExtraOptions,
): BabylonPresetRuntime {
  const bjsScene = scene as any;
  const enableGlow = opts?.enableGlow ?? true;

  const RING_COUNT = 420;
  const INNER_RADIUS = 0.22;
  const OUTER_RADIUS = 6.6;
  const LINE_THICKNESS = 0.010;
  const LINE_TESSELLATION = 96;
  const BOWL_DEPTH = 1.75;
  const BOWL_TIGHTNESS = 1.55;
  const HOLE_RADIUS = 1.12;
  const CHROMA_OFFSET = 0.024;
  const CHROMA_ALPHA = 0.42;
  const SCAN_STEPS = 24;
  const STEP_JITTER = 0.15;
  const DOT_COUNT = 1200;

  const root = new BABYLON.TransformNode("psyExtraRoot", bjsScene);

  const hemi = new BABYLON.HemisphericLight(
    "psyExtraHemi",
    new BABYLON.Vector3(0.2, 1, 0.1),
    bjsScene,
  );
  hemi.intensity = 0.75;

  const key = new BABYLON.PointLight(
    "psyExtraKey",
    new BABYLON.Vector3(0, 2.6, -1.6),
    bjsScene,
  );
  key.intensity = 28;
  key.radius = 18;

  const prevFogMode = bjsScene.fogMode;
  const prevFogDensity = bjsScene.fogDensity;
  const prevFogColor = bjsScene.fogColor ? bjsScene.fogColor.clone() : null;

  bjsScene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  bjsScene.fogColor = new BABYLON.Color3(0.008, 0.012, 0.03);
  bjsScene.fogDensity = 0.022;

  let glow: any = null;
  if (enableGlow) {
    glow = new BABYLON.GlowLayer("psyExtraGlow", bjsScene, { blurKernelSize: 96 });
    glow.intensity = 0.75;
  }

  const bowl = BABYLON.MeshBuilder.CreateDisc(
    "psyExtraBowlBody",
    { radius: OUTER_RADIUS * 1.05, tessellation: 128 },
    bjsScene,
  );
  bowl.parent = root;
  bowl.rotation.x = Math.PI / 2;
  bowl.position.y = -0.10;
  bowl.isPickable = false;

  const bowlMat = new BABYLON.StandardMaterial("psyExtraBowlBodyMat", bjsScene);
  bowlMat.diffuseColor = new BABYLON.Color3(0.02, 0.02, 0.03);
  bowlMat.specularColor = new BABYLON.Color3(0.06, 0.06, 0.07);
  bowlMat.emissiveColor = new BABYLON.Color3(0.01, 0.012, 0.02);
  bowlMat.alpha = 1.0;

  let noiseTex: any = null;
  try {
    const NoiseProceduralTexture = (BABYLON as any).NoiseProceduralTexture;
    if (typeof NoiseProceduralTexture === "function") {
      noiseTex = new NoiseProceduralTexture("psyExtraNoise", 512, bjsScene);
      noiseTex.brightness = 0.55;
      noiseTex.octaves = 5;
      noiseTex.persistence = 0.75;
      noiseTex.animationSpeedFactor = 1.2;
      bowlMat.emissiveTexture = noiseTex;
      bowlMat.emissiveTexture.level = 0.45;
    }
  } catch {
    // no-op
  }

  bowl.material = bowlMat;

  const hole = BABYLON.MeshBuilder.CreateDisc(
    "psyExtraHole",
    { radius: HOLE_RADIUS, tessellation: 96 },
    bjsScene,
  );
  hole.parent = root;
  hole.rotation.x = Math.PI / 2;
  hole.position.y = 0.04;
  hole.isPickable = false;

  const holeMat = new BABYLON.StandardMaterial("psyExtraHoleMat", bjsScene);
  holeMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
  holeMat.emissiveColor = new BABYLON.Color3(0, 0, 0);
  holeMat.specularColor = new BABYLON.Color3(0, 0, 0);
  hole.material = holeMat;

  const baseLine = BABYLON.MeshBuilder.CreateTorus(
    "psyExtraLineBase",
    { diameter: 2, thickness: LINE_THICKNESS, tessellation: LINE_TESSELLATION },
    bjsScene,
  );
  baseLine.parent = root;
  baseLine.rotation.x = Math.PI / 2;
  baseLine.isPickable = false;

  const lineMat = new BABYLON.StandardMaterial("psyExtraLineMat", bjsScene);
  lineMat.diffuseColor = new BABYLON.Color3(0.06, 0.06, 0.07);
  lineMat.specularColor = new BABYLON.Color3(0.09, 0.09, 0.10);
  lineMat.emissiveColor = new BABYLON.Color3(0.12, 0.55, 1.0);
  lineMat.alpha = 0.96;
  lineMat.backFaceCulling = false;
  (lineMat as any).useVertexColor = true;
  (lineMat as any).useVertexColors = true;
  baseLine.material = lineMat;

  const layerSpecs = [
    {
      name: "main",
      offset: new BABYLON.Vector3(0, 0, 0),
      alpha: 0.96,
      tint: new BABYLON.Color3(1, 1, 1),
    },
    {
      name: "R",
      offset: new BABYLON.Vector3(CHROMA_OFFSET, 0, 0),
      alpha: CHROMA_ALPHA,
      tint: new BABYLON.Color3(1.25, 0.55, 0.55),
    },
    {
      name: "B",
      offset: new BABYLON.Vector3(-CHROMA_OFFSET, 0, 0),
      alpha: CHROMA_ALPHA,
      tint: new BABYLON.Color3(0.55, 0.75, 1.35),
    },
    {
      name: "G",
      offset: new BABYLON.Vector3(0, 0, CHROMA_OFFSET),
      alpha: 0.28,
      tint: new BABYLON.Color3(0.55, 1.35, 0.75),
    },
  ] as const;

  type LayerRuntime = {
    mesh: any;
    mat: any;
    matrices: Float32Array;
    colors: Float32Array;
    tint: any;
  };

  const layers: LayerRuntime[] = layerSpecs.map((spec, idx) => {
    const mesh =
      idx === 0
        ? baseLine
        : (baseLine.clone(`psyExtraLine_${spec.name}`) as any);
    mesh.parent = root;
    mesh.position.copyFrom(spec.offset);
    mesh.isPickable = false;

    const mat =
      idx === 0
        ? lineMat
        : (lineMat.clone(`psyExtraLineMat_${spec.name}`) as any);
    mat.alpha = spec.alpha;
    mat.backFaceCulling = false;
    mesh.material = mat;

    const matrices = new Float32Array(RING_COUNT * 16);
    const colors = new Float32Array(RING_COUNT * 4);
    mesh.thinInstanceSetBuffer("matrix", matrices, 16, true);
    mesh.thinInstanceSetBuffer("color", colors, 4, true);

    return { mesh, mat, matrices, colors, tint: spec.tint };
  });

  const vignetteOuter = BABYLON.MeshBuilder.CreateDisc(
    "psyExtraVignetteOuter",
    { radius: OUTER_RADIUS * 1.18, tessellation: 128 },
    bjsScene,
  );
  vignetteOuter.parent = root;
  vignetteOuter.rotation.x = Math.PI / 2;
  vignetteOuter.position.y = 0.16;
  vignetteOuter.isPickable = false;

  const vignetteOuterMat = new BABYLON.StandardMaterial("psyExtraVignetteOuterMat", bjsScene);
  vignetteOuterMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
  vignetteOuterMat.emissiveColor = new BABYLON.Color3(0, 0, 0);
  vignetteOuterMat.specularColor = new BABYLON.Color3(0, 0, 0);
  vignetteOuterMat.alpha = 0.48;
  vignetteOuterMat.backFaceCulling = false;
  vignetteOuter.material = vignetteOuterMat;

  const vignetteInner = BABYLON.MeshBuilder.CreateDisc(
    "psyExtraVignetteInner",
    { radius: OUTER_RADIUS * 0.98, tessellation: 128 },
    bjsScene,
  );
  vignetteInner.parent = root;
  vignetteInner.rotation.x = Math.PI / 2;
  vignetteInner.position.y = 0.15;
  vignetteInner.isPickable = false;

  const vignetteInnerMat = new BABYLON.StandardMaterial("psyExtraVignetteInnerMat", bjsScene);
  vignetteInnerMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
  vignetteInnerMat.emissiveColor = new BABYLON.Color3(0, 0, 0);
  vignetteInnerMat.specularColor = new BABYLON.Color3(0, 0, 0);
  vignetteInnerMat.alpha = 0.28;
  vignetteInnerMat.backFaceCulling = false;
  vignetteInner.material = vignetteInnerMat;

  const grainPlane = BABYLON.MeshBuilder.CreatePlane(
    "psyExtraGrainPlane",
    { size: 20 },
    bjsScene,
  );
  grainPlane.parent = root;
  grainPlane.isPickable = false;
  grainPlane.position.copyFrom(new BABYLON.Vector3(0, 3.5, -8.0));
  grainPlane.rotation.copyFrom(new BABYLON.Vector3(0, 0, 0));

  const grainTex = new BABYLON.DynamicTexture(
    "psyExtraGrainTex",
    { width: 256, height: 256 },
    bjsScene,
    false,
  );
  grainTex.hasAlpha = true;
  const gctx = grainTex.getContext();

  const grainMat = new BABYLON.StandardMaterial("psyExtraGrainMat", bjsScene);
  grainMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
  grainMat.emissiveColor = new BABYLON.Color3(0, 0, 0);
  grainMat.specularColor = new BABYLON.Color3(0, 0, 0);
  grainMat.opacityTexture = grainTex;
  grainMat.alpha = 0.18;
  grainMat.backFaceCulling = false;
  grainPlane.material = grainMat;

  const dotBase = BABYLON.MeshBuilder.CreateSphere(
    "psyExtraDotBase",
    { diameter: 0.018, segments: 6 },
    bjsScene,
  );
  dotBase.parent = root;
  dotBase.isPickable = false;

  const dotMat = new BABYLON.StandardMaterial("psyExtraDotMat", bjsScene);
  dotMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
  dotMat.specularColor = new BABYLON.Color3(0, 0, 0);
  dotMat.emissiveColor = new BABYLON.Color3(0.65, 0.9, 1.0);
  dotMat.alpha = 0.65;
  dotMat.backFaceCulling = false;
  dotBase.material = dotMat;

  const dotMatrices = new Float32Array(DOT_COUNT * 16);
  dotBase.thinInstanceSetBuffer("matrix", dotMatrices, 16, true);

  type Dot = { ang: number; r: number; z: number; w: number };
  const dots: Dot[] = Array.from({ length: DOT_COUNT }, () => {
    const ang = Math.random() * Math.PI * 2;
    const r = Math.pow(Math.random(), 0.55) * (HOLE_RADIUS * 1.05);
    const z = (Math.random() - 0.5) * 0.18;
    const w = 0.6 + Math.random() * 1.6;
    return { ang, r, z, w };
  });

  const sweepRing = BABYLON.MeshBuilder.CreateTorus(
    "psyExtraSweepRing",
    { diameter: OUTER_RADIUS * 2.04, thickness: 0.06, tessellation: 192 },
    bjsScene,
  );
  sweepRing.parent = root;
  sweepRing.rotation.x = Math.PI / 2;
  sweepRing.position.y = 0.22;
  sweepRing.isPickable = false;

  const sweepTex = new BABYLON.DynamicTexture(
    "psyExtraSweepTex",
    { width: 512, height: 64 },
    bjsScene,
    false,
  );
  sweepTex.hasAlpha = true;
  const sctx = sweepTex.getContext();

  function redrawSweepTexture(strength: number) {
    const w = 512;
    const h = 64;
    const img = sctx.createImageData(w, h);
    const d = img.data;

    const bandCenter = Math.floor(w * 0.18);
    const bandWidth = Math.floor(w * 0.08);
    const soft = Math.floor(w * 0.03);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = Math.abs(x - bandCenter);

        let a = 0;
        if (dx < bandWidth) a = 1;
        else if (dx < bandWidth + soft) a = 1 - (dx - bandWidth) / soft;
        a = clamp01(a);

        const v = 1 - Math.abs(y / (h - 1) - 0.5) * 1.6;
        const alpha = a * Math.max(0, v) * strength;

        const i = (y * w + x) * 4;
        d[i + 0] = 255;
        d[i + 1] = 255;
        d[i + 2] = 255;
        d[i + 3] = Math.floor(255 * alpha);
      }
    }

    sctx.putImageData(img, 0, 0);
    sweepTex.update(false);
  }

  redrawSweepTexture(0.65);

  const sweepMat = new BABYLON.StandardMaterial("psyExtraSweepMat", bjsScene);
  sweepMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
  sweepMat.specularColor = new BABYLON.Color3(0, 0, 0);
  sweepMat.opacityTexture = sweepTex;
  sweepMat.emissiveTexture = sweepTex;
  sweepMat.emissiveColor = new BABYLON.Color3(0.65, 0.9, 1.2);
  sweepMat.alpha = 0.55;
  sweepMat.backFaceCulling = false;
  sweepRing.material = sweepMat;

  sweepTex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
  sweepTex.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
  sweepTex.uScale = 1.8;

  const sweepRing2 = BABYLON.MeshBuilder.CreateTorus(
    "psyExtraSweepRing2",
    { diameter: OUTER_RADIUS * 1.96, thickness: 0.048, tessellation: 192 },
    bjsScene,
  );
  sweepRing2.parent = root;
  sweepRing2.rotation.x = Math.PI / 2;
  sweepRing2.position.y = 0.205;
  sweepRing2.isPickable = false;

  const sweepTex2 = new BABYLON.DynamicTexture(
    "psyExtraSweepTex2",
    { width: 512, height: 64 },
    bjsScene,
    false,
  );
  sweepTex2.hasAlpha = true;
  const sctx2 = sweepTex2.getContext();

  function redrawSweepTexture2(strength: number) {
    const w = 512;
    const h = 64;
    const img = sctx2.createImageData(w, h);
    const d = img.data;

    const bandCenter = Math.floor(w * 0.62);
    const bandWidth = Math.floor(w * 0.06);
    const soft = Math.floor(w * 0.05);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = Math.abs(x - bandCenter);

        let a = 0;
        if (dx < bandWidth) a = 1;
        else if (dx < bandWidth + soft) a = 1 - (dx - bandWidth) / soft;
        a = clamp01(a);

        const v = 1 - Math.pow(Math.abs(y / (h - 1) - 0.5) * 1.75, 1.25);
        const alpha = a * Math.max(0, v) * strength;

        const i = (y * w + x) * 4;
        d[i + 0] = 255;
        d[i + 1] = 255;
        d[i + 2] = 255;
        d[i + 3] = Math.floor(255 * alpha);
      }
    }

    sctx2.putImageData(img, 0, 0);
    sweepTex2.update(false);
  }

  redrawSweepTexture2(0.55);

  const sweepMat2 = new BABYLON.StandardMaterial("psyExtraSweepMat2", bjsScene);
  sweepMat2.diffuseColor = new BABYLON.Color3(0, 0, 0);
  sweepMat2.specularColor = new BABYLON.Color3(0, 0, 0);
  sweepMat2.opacityTexture = sweepTex2;
  sweepMat2.emissiveTexture = sweepTex2;
  sweepMat2.emissiveColor = new BABYLON.Color3(1.15, 0.45, 1.05);
  sweepMat2.alpha = 0.42;
  sweepMat2.backFaceCulling = false;
  sweepRing2.material = sweepMat2;

  sweepTex2.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
  sweepTex2.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
  sweepTex2.uScale = 1.55;

  const tmpM = new BABYLON.Matrix();
  const tmpQ = BABYLON.Quaternion.Identity();

  let env = 0;
  let time = 0;
  let scanStep = 0;
  let scanPhase = 0;
  let prevBeat = 0;

  function bowlY(r: number) {
    const x = r / OUTER_RADIUS;
    const g = Math.exp(-Math.pow(x * BOWL_TIGHTNESS, 2.0));
    return -BOWL_DEPTH * g;
  }

  function writeMat(
    arr: Float32Array,
    i: number,
    pos: any,
    scale: any,
  ) {
    BABYLON.Matrix.ComposeToRef(scale, tmpQ, pos, tmpM);
    tmpM.copyToArray(arr, i * 16);
  }

  for (let i = 0; i < RING_COUNT; i++) {
    const t = i / (RING_COUNT - 1);
    const r = INNER_RADIUS + t * (OUTER_RADIUS - INNER_RADIUS);
    const y = bowlY(r);
    const s = r;

    for (const layer of layers) {
      BABYLON.Matrix.ComposeToRef(
        new BABYLON.Vector3(s, 1, s),
        BABYLON.Quaternion.Identity(),
        new BABYLON.Vector3(0, y, 0),
        tmpM,
      );
      tmpM.copyToArray(layer.matrices, i * 16);
      layer.colors[i * 4 + 0] = 0.7;
      layer.colors[i * 4 + 1] = 0.75;
      layer.colors[i * 4 + 2] = 0.85;
      layer.colors[i * 4 + 3] = 1.0;
    }
  }

  for (const layer of layers) {
    layer.mesh.thinInstanceBufferUpdated("matrix");
    layer.mesh.thinInstanceBufferUpdated("color");
  }

  return {
    update(audio, dt, blend) {
      const a = audio as any;
      const dtc = Math.max(1 / 240, Math.min(1 / 20, dt || 1 / 60));
      time += dtc;

      const intensity = clamp01(blend?.intensity ?? 1);
      const rms = clamp01(a?.rms ?? a?.energy ?? 0);
      const bass = clamp01(a?.bass ?? 0);
      const mid = clamp01(a?.mid ?? 0);
      const high = clamp01(a?.high ?? 0);
      const beat = clamp01(a?.beat ?? a?.kick ?? 0);

      const target = clamp01(0.55 * beat + 0.35 * bass + 0.20 * rms);
      const rate = target > env ? 18 : 6;
      env = env + (target - env) * (1 - Math.exp(-rate * dtc));

      bjsScene.fogDensity = 0.018 + 0.022 * rms + 0.016 * env;
      if (glow) {
        glow.intensity = 0.65 + 0.55 * rms + 0.45 * high + 0.35 * env;
      }

      root.rotation.y = Math.sin(time * 0.22) * 0.12;
      root.rotation.z = Math.cos(time * 0.18) * 0.085;
      root.rotation.x = 0.10 * Math.sin(time * 0.25);

      vignetteOuterMat.alpha = 0.44 + 0.12 * env;
      vignetteInnerMat.alpha = 0.24 + 0.10 * rms;

      if (noiseTex) {
        noiseTex.animationSpeedFactor = 0.8 + 2.0 * (0.35 * rms + 0.65 * env);
      }

      const em = 0.65 + 1.15 * rms + 1.05 * env + 0.45 * high;
      lineMat.emissiveColor = new BABYLON.Color3(0.12 * em, 0.62 * em, 1.20 * em);

      const beatEdge = beat > 0.62 && prevBeat <= 0.62;
      prevBeat = beat;
      if (beatEdge) {
        const jump = 1 + (high > 0.75 ? 1 : 0) + (env > 0.75 ? 1 : 0);
        scanStep = (scanStep + jump) % SCAN_STEPS;
        const jitter = (Math.random() * 2 - 1) * STEP_JITTER;
        scanPhase = wrap01(scanStep / SCAN_STEPS + jitter);
      }

      const cycle = time * (0.10 + 0.22 * mid + 0.18 * intensity);

      for (let i = 0; i < RING_COUNT; i++) {
        const t = i / (RING_COUNT - 1);
        const r = INNER_RADIUS + t * (OUTER_RADIUS - INNER_RADIUS);

        const ripple =
          Math.sin(r * 0.95 + time * (0.95 + 1.55 * mid)) * (0.035 + 0.11 * bass) +
          Math.sin(r * 0.30 - time * (1.25 + 2.10 * high)) * (0.010 + 0.045 * high);

        const y = bowlY(r) + ripple;

        const centerBoost = 1.0 - clamp01((r - INNER_RADIUS) / (OUTER_RADIUS - INNER_RADIUS));
        let bright = 0.40 + 0.85 * env + 0.45 * high + 0.65 * centerBoost;

        const d = wrapDist01(t, scanPhase);
        const strobeWidth = 0.010 + 0.010 * high;
        const strobeSoft = 0.016 + 0.020 * env;

        let strobe = 0;
        if (d < strobeWidth) strobe = 1;
        else if (d < strobeWidth + strobeSoft) {
          strobe = 1 - (d - strobeWidth) / strobeSoft;
        }

        const d2 = wrapDist01(t, wrap01(scanPhase + 0.20));
        let strobe2 = 0;
        if (d2 < strobeWidth * 0.75) strobe2 = 1;
        else if (d2 < strobeWidth * 0.75 + strobeSoft) {
          strobe2 = 1 - (d2 - strobeWidth * 0.75) / strobeSoft;
        }

        const strobeIntensity = 0.65 + 0.95 * high + 0.85 * env;
        bright += (strobe * 1.45 + strobe2 * 0.60) * strobeIntensity;
        bright = Math.min(bright, 4.4);

        const col = psyPalette(t * 1.55 + cycle);

        for (const layer of layers) {
          const s = r * (1.0 + 0.012 * Math.sin(time * 0.7 + i * 0.03) * (0.4 + rms));

          BABYLON.Matrix.ComposeToRef(
            new BABYLON.Vector3(s, 1, s),
            BABYLON.Quaternion.Identity(),
            new BABYLON.Vector3(0, y, 0),
            tmpM,
          );
          tmpM.copyToArray(layer.matrices, i * 16);

          let rr = col.r * layer.tint.r;
          let gg = col.g * layer.tint.g;
          let bb = col.b * layer.tint.b;

          const strobeWhite = Math.min(1, strobe * 0.65 + strobe2 * 0.28);
          rr = rr + (1.0 - rr) * strobeWhite;
          gg = gg + (1.0 - gg) * strobeWhite;
          bb = bb + (1.0 - bb) * strobeWhite;

          layer.colors[i * 4 + 0] = rr * bright;
          layer.colors[i * 4 + 1] = gg * bright;
          layer.colors[i * 4 + 2] = bb * bright;
          layer.colors[i * 4 + 3] = 1.0;
        }
      }

      for (const layer of layers) {
        layer.mesh.thinInstanceBufferUpdated("matrix");
        layer.mesh.thinInstanceBufferUpdated("color");
      }

      hole.scaling.setAll(1.0 + 0.035 * env);

      const swirl = 0.9 + 2.2 * mid + 1.8 * high;
      const pull = 1.0 - 0.22 * bass;

      dotMat.emissiveColor = new BABYLON.Color3(
        0.35 + 0.55 * high,
        0.55 + 0.60 * rms,
        0.90 + 0.80 * env,
      );
      dotMat.alpha = 0.35 + 0.35 * rms;

      for (let i = 0; i < DOT_COUNT; i++) {
        const p = dots[i];
        p.ang += dtc * swirl * (0.35 + 0.9 * p.w);
        const rr = p.r * (0.65 + 0.55 * rms + 0.45 * env);
        const x = Math.cos(p.ang) * rr * pull;
        const z = Math.sin(p.ang) * rr * pull;
        const yy = -0.35 + 0.25 * Math.sin(time * 1.2 + p.ang) * (0.25 + env);
        writeMat(
          dotMatrices,
          i,
          new BABYLON.Vector3(x, yy, z),
          new BABYLON.Vector3(1, 1, 1),
        );
      }
      dotBase.thinInstanceBufferUpdated("matrix");

      if ((time * 60) % 3 < 1) {
        const img = gctx.getImageData(0, 0, 256, 256);
        const d = img.data;
        const aMul = 0.20 + 0.20 * rms + 0.15 * env;
        for (let i = 0; i < d.length; i += 4) {
          const n = (Math.random() * 255) | 0;
          d[i + 0] = 0;
          d[i + 1] = 0;
          d[i + 2] = 0;
          d[i + 3] = (n * aMul) | 0;
        }
        gctx.putImageData(img, 0, 0);
        grainTex.update(false);
      }
      grainMat.alpha = 0.14 + 0.12 * rms + 0.10 * env;

      const sweepSpeed1 = 0.08 + 0.35 * mid + 0.25 * high + 0.22 * env;
      sweepTex.uOffset = wrap01(sweepTex.uOffset + sweepSpeed1 * dtc);

      sweepRing.rotation.z = Math.sin(time * 0.35) * 0.08;
      sweepRing.scaling.setAll(1.0 + 0.025 * env + 0.015 * rms);
      sweepMat.alpha = 0.42 + 0.22 * env + 0.12 * high;
      sweepMat.emissiveColor = new BABYLON.Color3(
        0.45 + 0.55 * env,
        0.75 + 0.65 * rms,
        1.05 + 0.55 * high,
      );
      if ((time * 60) % 12 < 1) {
        redrawSweepTexture(0.55 + 0.45 * env);
      }

      const sweepSpeed2 = 0.06 + 0.28 * mid + 0.38 * high + 0.18 * env;
      sweepTex2.uOffset = wrap01(sweepTex2.uOffset - sweepSpeed2 * dtc);

      sweepRing2.rotation.z = -Math.sin(time * 0.42) * 0.09;
      sweepRing2.scaling.setAll(1.0 + 0.018 * env + 0.010 * rms);
      sweepMat2.alpha = 0.30 + 0.16 * env + 0.22 * high;
      sweepMat2.emissiveColor = new BABYLON.Color3(
        0.85 + 0.85 * high,
        0.30 + 0.55 * env,
        0.85 + 0.75 * rms,
      );
      if ((time * 60) % 14 < 1) {
        redrawSweepTexture2(0.45 + 0.55 * (0.55 * env + 0.45 * high));
      }
    },

    dispose() {
      bjsScene.fogMode = prevFogMode;
      bjsScene.fogDensity = prevFogDensity;
      if (prevFogColor) {
        bjsScene.fogColor = prevFogColor;
      }

      for (const layer of layers) {
        if (layer.mesh !== baseLine) {
          layer.mesh.dispose(false, true);
        }
        layer.mat.dispose(true, true);
      }
      baseLine.dispose(false, true);

      bowl.dispose(false, true);
      bowlMat.dispose(true, true);

      hole.dispose(false, true);
      holeMat.dispose(true, true);

      vignetteOuter.dispose(false, true);
      vignetteOuterMat.dispose(true, true);
      vignetteInner.dispose(false, true);
      vignetteInnerMat.dispose(true, true);

      grainPlane.dispose(false, true);
      grainMat.dispose(true, true);
      grainTex.dispose();

      dotBase.dispose(false, true);
      dotMat.dispose(true, true);

      sweepRing.dispose(false, true);
      sweepMat.dispose(true, true);
      sweepTex.dispose();

      sweepRing2.dispose(false, true);
      sweepMat2.dispose(true, true);
      sweepTex2.dispose();

      hemi.dispose();
      key.dispose();
      glow?.dispose();

      try {
        if (noiseTex?.dispose) {
          noiseTex.dispose();
        }
      } catch {
        // no-op
      }

      root.dispose();
    },
  };
}
