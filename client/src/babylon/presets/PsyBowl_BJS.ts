import * as BABYLON from "@babylonjs/core";
import type { BabylonPresetRuntime } from "../types";

type PsyBowlOptions = {
  enableGlow?: boolean;
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function palette(t: number) {
  // Premium psy palette: cyan -> blue -> violet -> warm.
  const c1 = new BABYLON.Color3(0.10, 0.85, 0.98);
  const c2 = new BABYLON.Color3(0.15, 0.35, 0.98);
  const c3 = new BABYLON.Color3(0.72, 0.15, 0.95);
  const c4 = new BABYLON.Color3(0.98, 0.80, 0.25);

  const u = (t % 1 + 1) % 1;
  if (u < 0.33) return BABYLON.Color3.Lerp(c1, c2, u / 0.33);
  if (u < 0.66) return BABYLON.Color3.Lerp(c2, c3, (u - 0.33) / 0.33);
  return BABYLON.Color3.Lerp(c3, c4, (u - 0.66) / 0.34);
}

export function createPsyBowlPreset(
  scene: unknown,
  opts?: PsyBowlOptions,
): BabylonPresetRuntime {
  const bjsScene = scene as any;
  const enableGlow = opts?.enableGlow ?? true;

  const RING_COUNT = 360;
  const INNER_RADIUS = 0.25;
  const OUTER_RADIUS = 6.2;
  const LINE_THICKNESS = 0.010;
  const BOWL_DEPTH = 1.55;
  const BOWL_TIGHTNESS = 1.35;
  const HOLE_RADIUS = 1.05;
  const CHROMA_OFFSET = 0.018;
  const CHROMA_ALPHA = 0.38;

  const root = new BABYLON.TransformNode("psyBowlRoot", bjsScene);

  const hemi = new BABYLON.HemisphericLight("psyHemi", new BABYLON.Vector3(0.2, 1, 0.1), bjsScene);
  hemi.intensity = 0.9;

  const key = new BABYLON.PointLight("psyKey", new BABYLON.Vector3(0, 2.2, -1.4), bjsScene);
  key.intensity = 25;
  key.radius = 15;

  // Dramatic atmospheric depth for the bowl scene.
  bjsScene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  bjsScene.fogDensity = 0.022;
  bjsScene.fogColor = new BABYLON.Color3(0.01, 0.015, 0.03);

  let glow: any = null;
  if (enableGlow) {
    glow = new BABYLON.GlowLayer("psyGlow", bjsScene, { blurKernelSize: 64 });
    glow.intensity = 0.55;
  }

  const baseLine = BABYLON.MeshBuilder.CreateTorus(
    "psyLineBase",
    { diameter: 2, thickness: LINE_THICKNESS, tessellation: 96 },
    bjsScene,
  );
  baseLine.parent = root;
  baseLine.rotation.x = Math.PI / 2;

  const lineMat = new BABYLON.StandardMaterial("psyLineMat", bjsScene);
  lineMat.diffuseColor = new BABYLON.Color3(0.06, 0.06, 0.07);
  lineMat.specularColor = new BABYLON.Color3(0.08, 0.08, 0.08);
  lineMat.emissiveColor = new BABYLON.Color3(0.12, 0.55, 1.0);
  lineMat.alpha = 0.95;
  lineMat.backFaceCulling = false;
  (lineMat as any).useVertexColor = true;
  (lineMat as any).useVertexColors = true;
  baseLine.material = lineMat;

  const layerSpecs = [
    {
      name: "main",
      offset: new BABYLON.Vector3(0, 0, 0),
      alpha: 0.95,
      tint: new BABYLON.Color3(1, 1, 1),
    },
    {
      name: "R",
      offset: new BABYLON.Vector3(CHROMA_OFFSET, 0, 0),
      alpha: CHROMA_ALPHA,
      tint: new BABYLON.Color3(1.2, 0.4, 0.4),
    },
    {
      name: "B",
      offset: new BABYLON.Vector3(-CHROMA_OFFSET, 0, 0),
      alpha: CHROMA_ALPHA,
      tint: new BABYLON.Color3(0.4, 0.6, 1.2),
    },
  ] as const;

  type LayerRuntime = {
    mesh: any;
    mat: any;
    matrices: Float32Array;
    colors: Float32Array;
    tint: any;
  };

  const layers: LayerRuntime[] = layerSpecs.map((spec) => {
    const mesh =
      spec.name === "main"
        ? baseLine
        : (baseLine.clone(`psyLine_${spec.name}`) as any);
    mesh.parent = root;
    mesh.position.copyFrom(spec.offset);

    const mat =
      spec.name === "main"
        ? lineMat
        : (lineMat.clone(`psyLineMat_${spec.name}`) as any);
    mat.alpha = spec.alpha;
    mat.backFaceCulling = false;
    mesh.material = mat;

    const matrices = new Float32Array(RING_COUNT * 16);
    const colors = new Float32Array(RING_COUNT * 4);
    mesh.thinInstanceSetBuffer("matrix", matrices, 16, true);
    mesh.thinInstanceSetBuffer("color", colors, 4, true);

    return {
      mesh,
      mat,
      matrices,
      colors,
      tint: spec.tint,
    };
  });

  const bowl = BABYLON.MeshBuilder.CreateDisc(
    "psyBowlBody",
    { radius: OUTER_RADIUS * 1.02, tessellation: 96 },
    bjsScene,
  );
  bowl.parent = root;
  bowl.rotation.x = Math.PI / 2;
  bowl.position.y = -0.06;

  const bowlMat = new BABYLON.StandardMaterial("psyBowlBodyMat", bjsScene);
  bowlMat.diffuseColor = new BABYLON.Color3(0.02, 0.02, 0.03);
  bowlMat.specularColor = new BABYLON.Color3(0.04, 0.04, 0.04);
  bowlMat.emissiveColor = new BABYLON.Color3(0.01, 0.01, 0.012);
  bowlMat.alpha = 1.0;
  bowl.material = bowlMat;

  const hole = BABYLON.MeshBuilder.CreateDisc(
    "psyHole",
    { radius: HOLE_RADIUS, tessellation: 64 },
    bjsScene,
  );
  hole.parent = root;
  hole.rotation.x = Math.PI / 2;
  hole.position.y = 0.03;

  const holeMat = new BABYLON.StandardMaterial("psyHoleMat", bjsScene);
  holeMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
  holeMat.emissiveColor = new BABYLON.Color3(0, 0, 0);
  holeMat.specularColor = new BABYLON.Color3(0, 0, 0);
  hole.material = holeMat;

  const vignetteOuter = BABYLON.MeshBuilder.CreateDisc(
    "psyVignetteOuter",
    { radius: OUTER_RADIUS * 1.15, tessellation: 128 },
    bjsScene,
  );
  vignetteOuter.parent = root;
  vignetteOuter.rotation.x = Math.PI / 2;
  vignetteOuter.position.y = 0.14;

  const vignetteOuterMat = new BABYLON.StandardMaterial("psyVignetteOuterMat", bjsScene);
  vignetteOuterMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
  vignetteOuterMat.emissiveColor = new BABYLON.Color3(0, 0, 0);
  vignetteOuterMat.specularColor = new BABYLON.Color3(0, 0, 0);
  vignetteOuterMat.alpha = 0.45;
  vignetteOuterMat.backFaceCulling = false;
  vignetteOuter.material = vignetteOuterMat;

  const vignetteInner = BABYLON.MeshBuilder.CreateDisc(
    "psyVignetteInner",
    { radius: OUTER_RADIUS * 0.95, tessellation: 128 },
    bjsScene,
  );
  vignetteInner.parent = root;
  vignetteInner.rotation.x = Math.PI / 2;
  vignetteInner.position.y = 0.13;

  const vignetteInnerMat = new BABYLON.StandardMaterial("psyVignetteInnerMat", bjsScene);
  vignetteInnerMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
  vignetteInnerMat.emissiveColor = new BABYLON.Color3(0, 0, 0);
  vignetteInnerMat.specularColor = new BABYLON.Color3(0, 0, 0);
  vignetteInnerMat.alpha = 0.25;
  vignetteInnerMat.backFaceCulling = false;
  vignetteInner.material = vignetteInnerMat;

  let env = 0;
  let time = 0;
  const tmpM = new BABYLON.Matrix();

  function bowlY(r: number) {
    const x = r / OUTER_RADIUS;
    const g = Math.exp(-Math.pow(x * BOWL_TIGHTNESS, 2.0));
    return -BOWL_DEPTH * g;
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

      layer.colors[i * 4 + 0] = 0.75;
      layer.colors[i * 4 + 1] = 0.78;
      layer.colors[i * 4 + 2] = 0.82;
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

      root.rotation.y = Math.sin(time * 0.22) * 0.10;
      root.rotation.z = Math.cos(time * 0.18) * 0.07;
      root.rotation.x = 0.08 * Math.sin(time * 0.25);

      bjsScene.fogDensity = 0.018 + 0.02 * rms + 0.015 * env;

      if (glow) glow.intensity = 0.45 + 0.30 * rms + 0.35 * high + 0.25 * env;
      vignetteOuterMat.alpha = 0.42 + 0.10 * env;
      vignetteInnerMat.alpha = 0.22 + 0.08 * rms;

      const em = 0.55 + 0.95 * rms + 0.85 * env + 0.30 * high;
      lineMat.emissiveColor = new BABYLON.Color3(0.10 * em, 0.55 * em, 1.12 * em);

      const cycle = time * (0.06 + 0.12 * mid + 0.10 * intensity);

      for (let i = 0; i < RING_COUNT; i++) {
        const t = i / (RING_COUNT - 1);
        const r = INNER_RADIUS + t * (OUTER_RADIUS - INNER_RADIUS);
        const ripple = Math.sin(r * 0.9 + time * (0.8 + 1.2 * mid)) * (0.03 + 0.08 * bass);
        const y = bowlY(r) + ripple;

        const centerBoost = 1.0 - clamp01((r - INNER_RADIUS) / (OUTER_RADIUS - INNER_RADIUS));
        const bright = 0.55 + 0.55 * env + 0.35 * high + 0.45 * centerBoost;
        const col = palette(t * 1.2 + cycle);

        for (let li = 0; li < layers.length; li++) {
          const layer = layers[li];
          const s = r * (1.0 + 0.01 * Math.sin(time * 0.7 + i * 0.03) * (0.4 + rms));

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

          rr *= bright;
          gg *= bright;
          bb *= bright;

          layer.colors[i * 4 + 0] = rr;
          layer.colors[i * 4 + 1] = gg;
          layer.colors[i * 4 + 2] = bb;
          layer.colors[i * 4 + 3] = 1.0;
        }
      }

      for (const layer of layers) {
        layer.mesh.thinInstanceBufferUpdated("matrix");
        layer.mesh.thinInstanceBufferUpdated("color");
      }

      hole.scaling.setAll(1.0 + 0.03 * env);
    },

    dispose() {
      for (const layer of layers) {
        if (layer.mesh !== baseLine) layer.mesh.dispose(false, true);
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

      hemi.dispose();
      key.dispose();

      bjsScene.fogMode = BABYLON.Scene.FOGMODE_NONE;
      glow?.dispose();
      root.dispose();
    },
  };
}
