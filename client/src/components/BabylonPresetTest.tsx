import { useEffect, useRef, useState } from "react";
import * as BABYLON from "@babylonjs/core";
import type { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import type { Engine } from "@babylonjs/core/Engines/engine";
import type { Scene } from "@babylonjs/core/scene";
import type { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { createRitualTapestryV3_GLSLOnlyPreset } from "@/babylon/presets/RitualTapestryV3_GLSLOnly_BJS";

type PresetRuntime = {
  update: (
    audio: {
      rms?: number;
      bass?: number;
      mid?: number;
      high?: number;
      beat?: number;
      energy?: number;
      kick?: number;
      [key: string]: number | undefined;
    },
    dt: number,
    blend: { intensity: number; morph: number },
  ) => void;
  dispose: () => void;
};

type AudioMode = "Cinematic" | "Club" | "Hypnotic";

const PRESET_NAMES = ["Ritual Tapestry V3 GLSL Only"];
const DEFAULT_PRESET = PRESET_NAMES[0];
const AUTO_CYCLE_SECONDS = 10;
const HAS_PRESETS = PRESET_NAMES.length > 0;
const FORCE_WEBGL_FOR_DEBUG = true;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function nextPresetName(current: string) {
  if (PRESET_NAMES.length <= 1) return current;
  const index = PRESET_NAMES.indexOf(current);
  if (index < 0) return PRESET_NAMES[0];
  return PRESET_NAMES[(index + 1) % PRESET_NAMES.length];
}

function prevPresetName(current: string) {
  if (PRESET_NAMES.length <= 1) return current;
  const index = PRESET_NAMES.indexOf(current);
  if (index < 0) return PRESET_NAMES[0];
  return PRESET_NAMES[(index - 1 + PRESET_NAMES.length) % PRESET_NAMES.length];
}

function makeDemoAudio(t: number, mode: AudioMode) {
  const bpm = mode === "Club" ? 136 : mode === "Hypnotic" ? 106 : 124;
  const beatPhase = (t * bpm) / 60.0;
  const beatFrac = beatPhase - Math.floor(beatPhase);
  const beatImpulse = beatFrac < 0.10 ? Math.pow(1.0 - beatFrac / 0.10, 2.3) : 0.0;

  const sub = 0.5 + 0.5 * Math.sin(t * (mode === "Club" ? 0.58 : 0.72));
  const groove = 0.5 + 0.5 * Math.sin(t * (mode === "Hypnotic" ? 1.05 : 1.62) + Math.sin(t * 0.23) * 0.8);
  const texture = 0.5 + 0.5 * Math.sin(t * (mode === "Club" ? 4.2 : 3.0) + Math.cos(t * 0.94) * 1.35);
  const shimmer = 0.5 + 0.5 * Math.sin(t * 6.3 + Math.sin(t * 0.42));

  const bassWeight = mode === "Club" ? 0.86 : 0.68;
  const highWeight = mode === "Hypnotic" ? 0.45 : 0.62;

  const rms = clamp01(0.14 + 0.38 * groove + 0.34 * beatImpulse + 0.12 * sub);
  const bass = clamp01(0.20 + 0.52 * sub + bassWeight * beatImpulse);
  const mid = clamp01(0.18 + 0.48 * groove + 0.24 * texture + 0.1 * shimmer);
  const high = clamp01(0.12 + 0.42 * texture + highWeight * beatImpulse + 0.25 * shimmer);
  const beat = clamp01(beatImpulse);

  return {
    rms,
    bass,
    mid,
    high,
    beat,
    energy: rms,
    kick: beat,
  };
}

export default function BabylonPresetTest() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<ArcRotateCamera | null>(null);
  const runtimeRef = useRef<PresetRuntime | null>(null);
  const pipelineRef = useRef<DefaultRenderingPipeline | null>(null);

  const intensityRef = useRef(1.4);
  const audioModeRef = useRef<AudioMode>("Cinematic");
  const showcaseFxRef = useRef(true);

  const [presetName, setPresetName] = useState(DEFAULT_PRESET);
  const [intensity, setIntensity] = useState(1.4);
  const [showcaseFx, setShowcaseFx] = useState(true);
  const [autoCycle, setAutoCycle] = useState(true);
  const [audioMode, setAudioMode] = useState<AudioMode>("Cinematic");
  const [engineLabel, setEngineLabel] = useState("Booting...");

  useEffect(() => {
    intensityRef.current = intensity;
  }, [intensity]);

  useEffect(() => {
    audioModeRef.current = audioMode;
  }, [audioMode]);

  useEffect(() => {
    showcaseFxRef.current = showcaseFx;
  }, [showcaseFx]);

  useEffect(() => {
    if (!autoCycle || PRESET_NAMES.length <= 1) return;
    const id = window.setInterval(() => {
      setPresetName((current) => nextPresetName(current));
    }, AUTO_CYCLE_SECONDS * 1000);
    return () => window.clearInterval(id);
  }, [autoCycle]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        setPresetName((current) => nextPresetName(current));
      } else if (event.key === "ArrowLeft") {
        setPresetName((current) => prevPresetName(current));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let stopped = false;
    let removeResize: (() => void) | null = null;

    const disposeRuntime = () => {
      try {
        runtimeRef.current?.dispose();
      } catch (error) {
        console.warn("[BabylonPresetTest] runtime dispose failed", error);
      } finally {
        runtimeRef.current = null;
      }
    };

    const applyPipeline = () => {
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      if (!scene || !camera) return;

      pipelineRef.current?.dispose();
      pipelineRef.current = null;

      if (!showcaseFxRef.current) {
        const ip = scene.imageProcessingConfiguration;
        if (ip) {
          ip.vignetteEnabled = false;
          ip.toneMappingEnabled = false;
          ip.exposure = 1.0;
          ip.contrast = 1.0;
        }
        return;
      }

      const pipeline = new BABYLON.DefaultRenderingPipeline(
        "babylon-showcase-pipeline",
        true,
        scene,
        [camera],
      );
      pipeline.samples = 4;
      pipeline.fxaaEnabled = true;
      pipeline.bloomEnabled = true;
      pipeline.bloomThreshold = 0.52;
      pipeline.bloomWeight = 1.0;
      pipeline.bloomKernel = 64;
      pipeline.bloomScale = 0.6;
      pipeline.chromaticAberrationEnabled = true;
      pipeline.chromaticAberration.aberrationAmount = 14;
      pipeline.chromaticAberration.radialIntensity = 0.6;
      pipeline.grainEnabled = true;
      pipeline.grain.animated = true;
      pipeline.grain.intensity = 12;
      pipeline.sharpenEnabled = true;
      pipeline.sharpen.edgeAmount = 0.3;
      pipeline.sharpen.colorAmount = 0.42;

      const ip = scene.imageProcessingConfiguration;
      if (ip) {
        ip.toneMappingEnabled = true;
        ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
        ip.exposure = 1.15;
        ip.contrast = 1.24;
        ip.vignetteEnabled = true;
        ip.vignetteWeight = 1.85;
        ip.vignetteStretch = 0.08;
        ip.vignetteBlendMode = BABYLON.ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;
        ip.vignetteColor = new BABYLON.Color4(0, 0, 0, 1);
      }

      pipelineRef.current = pipeline;
    };

    const createRuntime = (name: string) => {
      const scene = sceneRef.current;
      if (!scene) return;
      disposeRuntime();
      const runtime = createRitualTapestryV3_GLSLOnlyPreset(scene, {
        enableGlow: true,
        heavyEdges: true,
      });
      runtimeRef.current = runtime as unknown as PresetRuntime;
      console.log("[BabylonPresetTest] Preset:", name);
    };

    const start = async () => {
      if (engineRef.current) return;
      let engine: Engine | null = null;
      try {
        if (FORCE_WEBGL_FOR_DEBUG) {
          engine = new BABYLON.Engine(canvas, true, {
            preserveDrawingBuffer: false,
            stencil: false,
            antialias: true,
            powerPreference: "high-performance",
          });
          setEngineLabel("Engine (WebGL forced)");
          console.log("[BabylonPresetTest] Engine:", engine?.getClassName(), "WebGL forced");
        } else {
          try {
            const WebGPUEngineCtor = (BABYLON as any).WebGPUEngine;
            if (typeof WebGPUEngineCtor === "function") {
              const webgpuEngine = new WebGPUEngineCtor(canvas, {
                antialiasing: true,
                powerPreference: "high-performance",
              });
              await webgpuEngine.initAsync();
              engine = webgpuEngine as Engine;
              setEngineLabel("WebGPUEngine");
              console.log("[BabylonPresetTest] Engine:", webgpuEngine.getClassName(), "WebGPU");
            } else {
              throw new Error("WebGPUEngine unavailable");
            }
          } catch (error) {
            engine = new BABYLON.Engine(canvas, true, {
              preserveDrawingBuffer: false,
              stencil: false,
              antialias: true,
              powerPreference: "high-performance",
            });
            setEngineLabel("Engine (WebGL fallback)");
            console.log("[BabylonPresetTest] Engine:", engine?.getClassName(), "WebGL fallback", error);
          }
        }

        if (!engine) return;
        const activeEngine = engine;
        if (stopped) {
          activeEngine.dispose();
          return;
        }
        if (engineRef.current) {
          activeEngine.dispose();
          return;
        }
        engineRef.current = activeEngine;
        activeEngine.onContextLostObservable.add(() => console.warn("Babylon context lost"));
        activeEngine.onContextRestoredObservable.add(() => console.warn("Babylon context restored"));
        console.log("Babylon engine:", activeEngine.getClassName());

        const scene = new BABYLON.Scene(activeEngine);
        scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);
        sceneRef.current = scene;
        const canvasRect = canvas.getBoundingClientRect();
        console.log(
          "[BabylonPresetTest] Canvas size:",
          Math.round(canvasRect.width),
          "x",
          Math.round(canvasRect.height),
        );
        if (canvasRect.width < 2 || canvasRect.height < 2) {
          console.warn("[BabylonPresetTest] Canvas has zero/near-zero size.");
        }

        const camera = new BABYLON.ArcRotateCamera(
          "babylon-test-cam",
          -Math.PI / 2,
          1.18,
          5.35,
          new BABYLON.Vector3(0, -0.65, 0),
          scene,
        );
        scene.activeCamera = camera;
        camera.setTarget(new BABYLON.Vector3(0, 0.25, 0));
        camera.alpha = Math.PI / 2;
        camera.beta = Math.PI / 2.2;
        camera.radius = 7.5;
        camera.lowerRadiusLimit = 2.5;
        camera.upperRadiusLimit = 9.0;
        camera.wheelDeltaPercentage = 0.01;
        camera.attachControl(canvas, true);
        cameraRef.current = camera;

        applyPipeline();
        createRuntime(presetName);

        let last = performance.now();
        let t = 0;
        activeEngine.runRenderLoop(() => {
          const activeScene = sceneRef.current;
          if (!activeScene) return;

          const now = performance.now();
          const dt = Math.min(1 / 20, Math.max(1 / 240, (now - last) / 1000));
          last = now;
          t += dt;

          const fake = makeDemoAudio(t, audioModeRef.current);
          const pipeline = pipelineRef.current;
          if (pipeline) {
            pipeline.bloomWeight = 0.7 + fake.rms * 1.0 + fake.beat * 0.55;
            pipeline.bloomThreshold = 0.52 - fake.rms * 0.12;
            pipeline.chromaticAberration.aberrationAmount = 10 + fake.high * 24 + fake.beat * 10;
            pipeline.grain.intensity = 10 + fake.high * 14;

            const ip = activeScene.imageProcessingConfiguration;
            if (ip) {
              ip.exposure = 1.04 + fake.rms * 0.46;
              ip.contrast = 1.14 + fake.mid * 0.26;
              ip.vignetteWeight = 1.55 + fake.rms * 1.2;
            }
          }

          const w = window as any;
          if (!w.__once) {
            console.log("runtime.update running");
            w.__once = true;
          }
          runtimeRef.current?.update(fake, dt, { intensity: intensityRef.current, morph: 0 });
          activeScene.render();
        });

        const onResize = () => {
          activeEngine.resize();
        };
        activeEngine.resize();
        window.requestAnimationFrame(() => activeEngine.resize());
        window.addEventListener("resize", onResize);
        removeResize = () => window.removeEventListener("resize", onResize);
      } catch (error) {
        if (engine && engineRef.current !== engine) {
          try {
            engine.stopRenderLoop();
            engine.dispose();
          } catch {
            // ignore secondary cleanup errors
          }
        }
        console.error("[BabylonPresetTest] failed to start", error);
      }
    };

    start();

    return () => {
      stopped = true;
      removeResize?.();
      const engine = engineRef.current;
      try {
        engine?.stopRenderLoop();
        pipelineRef.current?.dispose();
        pipelineRef.current = null;
        disposeRuntime();
        sceneRef.current?.dispose();
        sceneRef.current = null;
        cameraRef.current = null;
        engine?.dispose();
        engineRef.current = null;
      } catch (error) {
        console.warn("[BabylonPresetTest] cleanup error", error);
      }
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    try {
      runtimeRef.current?.dispose();
      const runtime = createRitualTapestryV3_GLSLOnlyPreset(scene, {
        enableGlow: true,
        heavyEdges: true,
      });
      runtimeRef.current = runtime as unknown as PresetRuntime;
      console.log("[BabylonPresetTest] Preset:", presetName);
    } catch (error) {
      console.error("[BabylonPresetTest] preset switch failed", error);
    }
  }, [presetName]);

  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!scene || !camera) return;

    pipelineRef.current?.dispose();
    pipelineRef.current = null;

    if (!showcaseFx) {
      const ip = scene.imageProcessingConfiguration;
      if (ip) {
        ip.vignetteEnabled = false;
        ip.toneMappingEnabled = false;
        ip.exposure = 1.0;
        ip.contrast = 1.0;
      }
      return;
    }

    const pipeline = new BABYLON.DefaultRenderingPipeline(
      "babylon-showcase-pipeline",
      true,
      scene,
      [camera],
    );
    pipeline.samples = 4;
    pipeline.fxaaEnabled = true;
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.52;
    pipeline.bloomWeight = 1.0;
    pipeline.bloomKernel = 64;
    pipeline.bloomScale = 0.6;
    pipeline.chromaticAberrationEnabled = true;
    pipeline.chromaticAberration.aberrationAmount = 14;
    pipeline.chromaticAberration.radialIntensity = 0.6;
    pipeline.grainEnabled = true;
    pipeline.grain.animated = true;
    pipeline.grain.intensity = 12;
    pipeline.sharpenEnabled = true;
    pipeline.sharpen.edgeAmount = 0.3;
    pipeline.sharpen.colorAmount = 0.42;

    const ip = scene.imageProcessingConfiguration;
    if (ip) {
      ip.toneMappingEnabled = true;
      ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
      ip.exposure = 1.15;
      ip.contrast = 1.24;
      ip.vignetteEnabled = true;
      ip.vignetteWeight = 1.85;
      ip.vignetteStretch = 0.08;
      ip.vignetteBlendMode = BABYLON.ImageProcessingConfiguration.VIGNETTEMODE_MULTIPLY;
      ip.vignetteColor = new BABYLON.Color4(0, 0, 0, 1);
    }

    pipelineRef.current = pipeline;
  }, [showcaseFx]);

  const presetIndex = Math.max(0, PRESET_NAMES.indexOf(presetName)) + 1;

  return (
    <div style={{ width: "100%", height: "100vh", background: "black", position: "relative" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }}
      />
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 5,
          width: 420,
          maxWidth: "calc(100vw - 24px)",
          background: "rgba(0,0,0,0.62)",
          border: "1px solid rgba(255,255,255,0.22)",
          borderRadius: 10,
          padding: 10,
          color: "#fff",
          fontSize: 12,
          backdropFilter: "blur(8px)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Babylon Preset Showcase</div>
          <div style={{ opacity: 0.75 }}>
            {presetIndex}/{PRESET_NAMES.length}
          </div>
        </div>
        <div style={{ marginTop: 4, opacity: 0.72 }}>
          Engine: {engineLabel} | Arrows: prev/next preset
        </div>
        {!HAS_PRESETS ? (
          <div
            style={{
              marginTop: 12,
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 8,
              padding: "10px 12px",
              background: "rgba(255,255,255,0.04)",
              opacity: 0.9,
            }}
          >
            No Babylon presets configured.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                onClick={() => setPresetName((current) => prevPresetName(current))}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.24)",
                  background: "rgba(24,24,34,0.9)",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Prev
              </button>
              <button
                onClick={() => setPresetName((current) => nextPresetName(current))}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.24)",
                  background: "rgba(24,24,34,0.9)",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Next
              </button>
              <label style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 4 }}>
                <input
                  type="checkbox"
                  checked={autoCycle}
                  onChange={(e) => setAutoCycle(e.target.checked)}
                />
                <span style={{ opacity: 0.9 }}>
                  Auto-cycle ({AUTO_CYCLE_SECONDS}s)
                </span>
              </label>
            </div>

            <div style={{ marginTop: 9, display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ whiteSpace: "nowrap", opacity: 0.9 }}>Intensity</label>
              <input
                type="range"
                min={0.6}
                max={2.4}
                step={0.05}
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
                style={{ width: "100%" }}
              />
              <span style={{ minWidth: 35, textAlign: "right", opacity: 0.85 }}>
                {intensity.toFixed(2)}
              </span>
            </div>

            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ opacity: 0.9 }}>Audio</label>
              <select
                value={audioMode}
                onChange={(e) => setAudioMode(e.target.value as AudioMode)}
                style={{
                  flex: 1,
                  background: "rgba(20,20,30,0.9)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.25)",
                  borderRadius: 6,
                  padding: "6px 8px",
                }}
              >
                <option value="Cinematic">Cinematic</option>
                <option value="Club">Club</option>
                <option value="Hypnotic">Hypnotic</option>
              </select>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={showcaseFx}
                  onChange={(e) => setShowcaseFx(e.target.checked)}
                />
                <span style={{ opacity: 0.9 }}>Showcase FX</span>
              </label>
            </div>

            <div
              style={{
                marginTop: 10,
                maxHeight: 132,
                overflowY: "auto",
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                paddingRight: 4,
              }}
            >
              {PRESET_NAMES.map((name) => {
                const active = name === presetName;
                return (
                  <button
                    key={name}
                    onClick={() => setPresetName(name)}
                    style={{
                      padding: "5px 8px",
                      borderRadius: 999,
                      border: active
                        ? "1px solid rgba(120,220,255,0.95)"
                        : "1px solid rgba(255,255,255,0.20)",
                      background: active
                        ? "rgba(40,95,125,0.6)"
                        : "rgba(20,20,30,0.88)",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: 11,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
