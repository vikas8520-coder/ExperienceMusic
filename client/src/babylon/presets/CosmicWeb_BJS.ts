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

function randInSphere(radius: number) {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const r = radius * Math.pow(Math.random(), 0.55);
  return new BABYLON.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
    r * Math.cos(phi),
  );
}

function randomUnitVector() {
  const v = randInSphere(1);
  if (v.lengthSquared() < 1e-6) return new BABYLON.Vector3(0.4, 0.6, 0.2);
  return v.normalize();
}

export function createCosmicWebPreset(
  scene: unknown,
  opts?: { enableGlow?: boolean },
): BabylonPresetRuntime {
  const bjsScene = scene as BABYLON.Scene;
  const enableGlow = opts?.enableGlow ?? true;

  const WEB_R = 3.6;
  const NODE_COUNT = 150;
  const NEIGHBORS = 3;
  const EDGE_MAX = NODE_COUNT * NEIGHBORS;

  const NODE_SIZE = 0.055;
  const SPARK_COUNT = 340;

  const FOG_BASE = 0.010;
  const FOG_REACT = 0.020;
  const TWIST_GAIN = 0.55;
  const ROT_SPEED = 0.10;
  const PULSE_SPEED = 2.2;
  const PULSE_DECAY = 1.25;
  const PULSE_GAIN = 2.2;

  const root = new BABYLON.TransformNode("cosmicWebRoot", bjsScene);

  const hemi = new BABYLON.HemisphericLight("cwHemi", new BABYLON.Vector3(0.2, 1, 0.1), bjsScene);
  hemi.intensity = 0.45;

  const key = new BABYLON.PointLight("cwKey", new BABYLON.Vector3(0, 2.2, -2.4), bjsScene);
  key.intensity = 16;
  key.radius = 18;

  const prevFogMode = bjsScene.fogMode;
  const prevFogDensity = bjsScene.fogDensity;
  const prevFogColor = bjsScene.fogColor ? bjsScene.fogColor.clone() : null;

  bjsScene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  bjsScene.fogColor = new BABYLON.Color3(0.01, 0.015, 0.03);
  bjsScene.fogDensity = FOG_BASE;

  let glow: BABYLON.GlowLayer | null = null;
  if (enableGlow) {
    glow = new BABYLON.GlowLayer("cwGlow", bjsScene, { blurKernelSize: 64 });
    glow.intensity = 0.7;
  }

  const nodeBase = BABYLON.MeshBuilder.CreateSphere(
    "cwNodeBase",
    { diameter: NODE_SIZE, segments: 6 },
    bjsScene,
  );
  nodeBase.parent = root;
  nodeBase.isPickable = false;

  const nodeMat = new BABYLON.StandardMaterial("cwNodeMat", bjsScene);
  nodeMat.diffuseColor = BABYLON.Color3.Black();
  nodeMat.specularColor = BABYLON.Color3.Black();
  nodeMat.emissiveColor = new BABYLON.Color3(0.25, 0.9, 1.25);
  nodeMat.alpha = 0.85;
  nodeMat.backFaceCulling = false;
  nodeBase.material = nodeMat;

  const nodeMatrices = new Float32Array(NODE_COUNT * 16);
  nodeBase.thinInstanceSetBuffer("matrix", nodeMatrices, 16, true);

  const core = BABYLON.MeshBuilder.CreateSphere(
    "cwCore",
    { diameter: 0.66, segments: 26 },
    bjsScene,
  );
  core.parent = root;
  core.isPickable = false;

  const coreMat = new BABYLON.StandardMaterial("cwCoreMat", bjsScene);
  coreMat.diffuseColor = new BABYLON.Color3(0.02, 0.02, 0.03);
  coreMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.06);
  coreMat.emissiveColor = new BABYLON.Color3(0.2, 0.85, 1.45);
  coreMat.alpha = 0.88;
  core.material = coreMat;

  coreMat.emissiveFresnelParameters = new BABYLON.FresnelParameters();
  coreMat.emissiveFresnelParameters.isEnabled = true;
  coreMat.emissiveFresnelParameters.leftColor = new BABYLON.Color3(0.03, 0.08, 0.14);
  coreMat.emissiveFresnelParameters.rightColor = new BABYLON.Color3(0.5, 1.05, 1.75);
  coreMat.emissiveFresnelParameters.power = 2.6;
  coreMat.emissiveFresnelParameters.bias = 0.08;

  type Node = {
    base: BABYLON.Vector3;
    p: BABYLON.Vector3;
    drift: BABYLON.Vector3;
    s: number;
    phase: number;
    pulse: number;
  };

  const nodes: Node[] = Array.from({ length: NODE_COUNT }, () => {
    const base = randInSphere(WEB_R);
    return {
      base,
      p: base.clone(),
      drift: randomUnitVector(),
      s: 0.7 + Math.random() * 1.7,
      phase: Math.random() * Math.PI * 2,
      pulse: 0,
    };
  });

  type Edge = { a: number; b: number };
  const edges: Edge[] = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    const dists: { j: number; d: number }[] = [];
    const pi = nodes[i].base;
    for (let j = 0; j < NODE_COUNT; j++) {
      if (j === i) continue;
      const pj = nodes[j].base;
      dists.push({ j, d: BABYLON.Vector3.DistanceSquared(pi, pj) });
    }
    dists.sort((x, y) => x.d - y.d);
    for (let k = 0; k < NEIGHBORS; k++) {
      const j = dists[k]?.j;
      if (j == null) continue;
      if (edges.length < EDGE_MAX) edges.push({ a: i, b: j });
    }
  }

  const linePoints: BABYLON.Vector3[][] = edges.map((e) => [nodes[e.a].p.clone(), nodes[e.b].p.clone()]);
  const lineColorsInit: BABYLON.Color4[][] = edges.map(() => [
    new BABYLON.Color4(0.2, 0.8, 1.0, 0.22),
    new BABYLON.Color4(0.2, 0.8, 1.0, 0.22),
  ]);

  const webLines = BABYLON.MeshBuilder.CreateLineSystem(
    "cwLines",
    { lines: linePoints, colors: lineColorsInit, updatable: true },
    bjsScene,
  );
  webLines.parent = root;
  webLines.isPickable = false;
  webLines.alpha = 0.9;

  const backRing = BABYLON.MeshBuilder.CreateTorus(
    "cwBackRing",
    { diameter: 5.8, thickness: 0.14, tessellation: 128 },
    bjsScene,
  );
  backRing.parent = root;
  backRing.isPickable = false;
  backRing.rotation.x = Math.PI / 2;
  backRing.position.z = 1.0;

  const backRingMat = new BABYLON.StandardMaterial("cwBackRingMat", bjsScene);
  backRingMat.diffuseColor = BABYLON.Color3.Black();
  backRingMat.specularColor = BABYLON.Color3.Black();
  backRingMat.emissiveColor = new BABYLON.Color3(0.1, 0.35, 0.95);
  backRingMat.alpha = 0.55;
  backRingMat.backFaceCulling = false;
  backRing.material = backRingMat;

  const crossRing = BABYLON.MeshBuilder.CreateTorus(
    "cwCrossRing",
    { diameter: 6.2, thickness: 0.08, tessellation: 96 },
    bjsScene,
  );
  crossRing.parent = root;
  crossRing.isPickable = false;
  crossRing.rotation.y = Math.PI / 2;
  const crossRingMat = new BABYLON.StandardMaterial("cwCrossRingMat", bjsScene);
  crossRingMat.diffuseColor = BABYLON.Color3.Black();
  crossRingMat.specularColor = BABYLON.Color3.Black();
  crossRingMat.emissiveColor = new BABYLON.Color3(0.25, 0.65, 1.2);
  crossRingMat.alpha = 0.24;
  crossRingMat.backFaceCulling = false;
  crossRing.material = crossRingMat;

  const sparkBase = BABYLON.MeshBuilder.CreateSphere(
    "cwSparkBase",
    { diameter: 0.032, segments: 6 },
    bjsScene,
  );
  sparkBase.parent = root;
  sparkBase.isPickable = false;

  const sparkMat = new BABYLON.StandardMaterial("cwSparkMat", bjsScene);
  sparkMat.diffuseColor = BABYLON.Color3.Black();
  sparkMat.specularColor = BABYLON.Color3.Black();
  sparkMat.emissiveColor = new BABYLON.Color3(0.65, 0.9, 1.6);
  sparkMat.alpha = 0.75;
  sparkBase.material = sparkMat;

  const sparkMatrices = new Float32Array(SPARK_COUNT * 16);
  sparkBase.thinInstanceSetBuffer("matrix", sparkMatrices, 16, true);

  type Spark = { edgeIndex: number; t: number; speed: number; phase: number; w: number };
  const sparks: Spark[] = Array.from({ length: SPARK_COUNT }, () => ({
    edgeIndex: Math.floor(Math.random() * Math.max(1, edges.length)),
    t: Math.random(),
    speed: 0.35 + Math.random() * 1.1,
    phase: Math.random() * Math.PI * 2,
    w: 0.65 + Math.random() * 1.2,
  }));

  const tmpM = new BABYLON.Matrix();
  const tmpQ = BABYLON.Quaternion.Identity();

  const linePositions = new Float32Array(edges.length * 6);
  const lineColors = new Float32Array(edges.length * 8);

  let time = 0;
  let env = 0;
  let prevBeat = 0;

  function composeNode(i: number, scale: number) {
    const p = nodes[i].p;
    BABYLON.Matrix.ComposeToRef(
      new BABYLON.Vector3(scale, scale, scale),
      tmpQ,
      p,
      tmpM,
    );
    tmpM.copyToArray(nodeMatrices, i * 16);
  }

  function composeSpark(i: number, x: number, y: number, z: number, scale: number) {
    BABYLON.Matrix.ComposeToRef(
      new BABYLON.Vector3(scale, scale, scale),
      tmpQ,
      new BABYLON.Vector3(x, y, z),
      tmpM,
    );
    tmpM.copyToArray(sparkMatrices, i * 16);
  }

  for (let i = 0; i < NODE_COUNT; i++) {
    composeNode(i, 0.85 + nodes[i].s * 0.28);
  }
  nodeBase.thinInstanceBufferUpdated("matrix");

  for (let i = 0; i < SPARK_COUNT; i++) {
    const edge = edges[sparks[i].edgeIndex];
    const A = nodes[edge.a].p;
    const B = nodes[edge.b].p;
    const p = BABYLON.Vector3.Lerp(A, B, sparks[i].t);
    composeSpark(i, p.x, p.y, p.z, 1);
  }
  sparkBase.thinInstanceBufferUpdated("matrix");

  function emitPulse(seedCount: number, strength: number) {
    for (let k = 0; k < seedCount; k++) {
      const idx = (Math.random() * NODE_COUNT) | 0;
      nodes[idx].pulse += strength;
    }
  }

  function reseedSpark(i: number) {
    sparks[i].edgeIndex = (Math.random() * Math.max(1, edges.length)) | 0;
    sparks[i].t = 0;
    sparks[i].speed = 0.35 + Math.random() * 1.1;
    sparks[i].phase = Math.random() * Math.PI * 2;
    sparks[i].w = 0.65 + Math.random() * 1.2;
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

      const target = clamp01(0.55 * beat + 0.35 * bass + 0.20 * rms);
      const rate = target > env ? 16 : 6;
      env = env + (target - env) * (1 - Math.exp(-rate * dtc));

      const beatEdge = beat > 0.62 && prevBeat <= 0.62;
      prevBeat = beat;
      if (beatEdge) emitPulse(5, 1.4 + 1.35 * env + 0.95 * high);

      bjsScene.fogDensity = FOG_BASE + FOG_REACT * (0.45 * rms + 0.85 * env);
      if (glow) glow.intensity = 0.55 + 0.55 * env + 0.45 * high;

      const twist = TWIST_GAIN * (0.55 * mid + 0.85 * high);
      root.rotation.y = Math.sin(time * 0.22) * 0.06 + twist * Math.sin(time * 0.35);
      root.rotation.z = Math.cos(time * 0.18) * 0.05 + twist * Math.cos(time * 0.28);
      root.rotation.x = Math.sin(time * 0.14) * 0.03;
      root.rotation.y += time * ROT_SPEED * 0.12;

      backRingMat.emissiveColor = new BABYLON.Color3(
        0.06 + 0.22 * env,
        0.22 + 0.55 * rms,
        0.75 + 0.55 * high,
      );
      backRingMat.alpha = 0.35 + 0.26 * env;
      crossRingMat.emissiveColor = new BABYLON.Color3(
        0.12 + 0.3 * high,
        0.45 + 0.45 * rms,
        1.0 + 0.55 * env,
      );
      crossRingMat.alpha = 0.18 + 0.25 * env;
      crossRing.rotation.z += dtc * (0.08 + 0.35 * mid);

      core.scaling.setAll(1.0 + 0.25 * env + 0.12 * Math.sin(time * 1.2));
      coreMat.emissiveColor = new BABYLON.Color3(
        0.12 + 0.35 * high,
        0.55 + 0.65 * rms,
        1.15 + 0.75 * env,
      );
      coreMat.alpha = 0.72 + 0.24 * env;

      nodeMat.alpha = 0.66 + 0.26 * (0.45 * rms + 0.55 * env);
      nodeMat.emissiveColor = new BABYLON.Color3(
        0.18 + 0.30 * high + 0.30 * env,
        0.65 + 0.58 * rms,
        1.05 + 0.60 * env + 0.52 * high,
      );

      sparkMat.emissiveColor = new BABYLON.Color3(
        0.42 + 0.45 * high,
        0.72 + 0.55 * rms,
        1.25 + 0.85 * env,
      );
      sparkMat.alpha = 0.45 + 0.45 * env;

      for (let i = 0; i < NODE_COUNT; i++) {
        nodes[i].pulse *= Math.exp(-PULSE_DECAY * dtc);
      }

      const flow = PULSE_SPEED * dtc * (0.35 + 0.65 * intensity);
      for (let i = 0; i < edges.length; i++) {
        const a = edges[i].a;
        const b = edges[i].b;
        const delta = (nodes[a].pulse - nodes[b].pulse) * 0.10 * flow;
        nodes[a].pulse -= delta;
        nodes[b].pulse += delta;
      }

      const driftAmp = 0.08 + 0.16 * env + 0.09 * high;
      for (let i = 0; i < NODE_COUNT; i++) {
        const n = nodes[i];

        const breathe = 0.04 * Math.sin(time * (0.8 + 0.6 * mid) + n.phase) * (0.35 + env);
        const pulseScale = 1 + 0.22 * clamp01(n.pulse);
        const s = (0.85 + n.s * 0.28) * (1 + breathe) * pulseScale * (0.85 + 0.25 * rms);

        n.p.x = n.base.x * (1 + 0.03 * Math.sin(time * 0.33 + n.phase)) + n.drift.x * driftAmp * Math.sin(time * 0.65 + n.phase);
        n.p.y = n.base.y * (1 + 0.03 * Math.cos(time * 0.28 + n.phase)) + n.drift.y * driftAmp * Math.cos(time * 0.58 + n.phase * 1.1);
        n.p.z = n.base.z * (1 + 0.03 * Math.sin(time * 0.31 + n.phase * 1.2)) + n.drift.z * driftAmp * Math.sin(time * 0.62 + n.phase * 0.8);

        composeNode(i, s);
      }
      nodeBase.thinInstanceBufferUpdated("matrix");

      const baseA = 0.10 + 0.16 * env + 0.10 * high;
      for (let i = 0; i < edges.length; i++) {
        const a = edges[i].a;
        const b = edges[i].b;
        const pa = nodes[a].p;
        const pb = nodes[b].p;

        const pIndex = i * 6;
        linePositions[pIndex + 0] = pa.x;
        linePositions[pIndex + 1] = pa.y;
        linePositions[pIndex + 2] = pa.z;
        linePositions[pIndex + 3] = pb.x;
        linePositions[pIndex + 4] = pb.y;
        linePositions[pIndex + 5] = pb.z;

        const ep = 0.5 * (nodes[a].pulse + nodes[b].pulse);
        const bright = 0.35 + 1.6 * clamp01(ep) * PULSE_GAIN + 0.55 * (0.35 * rms + 0.65 * env);
        const col = palette(time * 0.02 + (i / edges.length) * 1.2);
        const alpha = Math.min(0.9, baseA + 0.28 * clamp01(ep));

        const cIndex = i * 8;
        lineColors[cIndex + 0] = col.r * bright;
        lineColors[cIndex + 1] = col.g * bright;
        lineColors[cIndex + 2] = col.b * bright;
        lineColors[cIndex + 3] = alpha;
        lineColors[cIndex + 4] = col.r * bright;
        lineColors[cIndex + 5] = col.g * bright;
        lineColors[cIndex + 6] = col.b * bright;
        lineColors[cIndex + 7] = alpha;
      }

      webLines.setVerticesData(BABYLON.VertexBuffer.PositionKind, linePositions, true);
      webLines.setVerticesData(BABYLON.VertexBuffer.ColorKind, lineColors, true);

      for (let i = 0; i < SPARK_COUNT; i++) {
        const spark = sparks[i];
        const edge = edges[spark.edgeIndex];
        if (!edge) {
          reseedSpark(i);
          continue;
        }

        const pulseBias = 0.5 * (nodes[edge.a].pulse + nodes[edge.b].pulse);
        spark.t += dtc * spark.speed * (0.45 + 0.95 * env + 0.65 * high + 0.35 * clamp01(pulseBias));
        if (spark.t > 1.0) {
          reseedSpark(i);
        }

        const tEdge = clamp01(spark.t);
        const A = nodes[edge.a].p;
        const B = nodes[edge.b].p;
        const p = BABYLON.Vector3.Lerp(A, B, tEdge);

        const twinkle = 0.75 + 0.25 * Math.sin(time * 7.0 + spark.phase);
        const s = (0.55 + 0.9 * spark.w + 0.8 * clamp01(pulseBias)) * twinkle;
        composeSpark(i, p.x, p.y, p.z, s);
      }
      sparkBase.thinInstanceBufferUpdated("matrix");
    },

    dispose() {
      bjsScene.fogMode = prevFogMode;
      bjsScene.fogDensity = prevFogDensity;
      if (prevFogColor) bjsScene.fogColor = prevFogColor;

      glow?.dispose();

      webLines.dispose(false, true);

      nodeBase.dispose(false, true);
      nodeMat.dispose(true, true);

      sparkBase.dispose(false, true);
      sparkMat.dispose(true, true);

      core.dispose(false, true);
      coreMat.dispose(true, true);

      backRing.dispose(false, true);
      backRingMat.dispose(true, true);

      crossRing.dispose(false, true);
      crossRingMat.dispose(true, true);

      hemi.dispose();
      key.dispose();

      root.dispose();
    },
  };
}
