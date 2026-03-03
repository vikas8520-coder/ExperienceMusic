import { useEffect, useRef } from "react";
import * as BABYLON from "@babylonjs/core";
import type { Engine } from "@babylonjs/core/Engines/engine";
import type { Scene } from "@babylonjs/core/scene";
import type { AudioData } from "@/hooks/use-audio-analyzer";
import { BABYLON_PRESETS } from "@/babylon/registry";
import type { BabylonPresetRuntime } from "@/babylon/types";

type BabylonVisualizerProps = {
  presetName: string;
  getAudioData: () => AudioData;
  intensity: number;
  backgroundImage?: string | null;
  onEngineLabelChange?: (label: string) => void;
  onFatalError?: (error: unknown) => void;
};

const WEBGPU_EXPERIMENT_ENABLED = import.meta.env.VITE_ENABLE_WEBGPU !== "0";
const SPECTRUM_BINS = 128;

function supportsWebGPU(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export default function BabylonVisualizer({
  presetName,
  getAudioData,
  intensity,
  backgroundImage,
  onEngineLabelChange,
  onFatalError,
}: BabylonVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const runtimeRef = useRef<BabylonPresetRuntime | null>(null);
  const disposeResizeRef = useRef<(() => void) | null>(null);
  const getAudioDataRef = useRef(getAudioData);
  const intensityRef = useRef(intensity);
  const presetNameRef = useRef(presetName);
  const onEngineLabelChangeRef = useRef(onEngineLabelChange);
  const onFatalErrorRef = useRef(onFatalError);
  const spectrumRef = useRef<number[]>(Array.from({ length: SPECTRUM_BINS }, () => 0));

  useEffect(() => {
    getAudioDataRef.current = getAudioData;
  }, [getAudioData]);

  useEffect(() => {
    intensityRef.current = intensity;
  }, [intensity]);

  useEffect(() => {
    presetNameRef.current = presetName;
  }, [presetName]);

  useEffect(() => {
    onEngineLabelChangeRef.current = onEngineLabelChange;
  }, [onEngineLabelChange]);

  useEffect(() => {
    onFatalErrorRef.current = onFatalError;
  }, [onFatalError]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const definition = BABYLON_PRESETS[presetName];
    if (!definition) return;

    try {
      runtimeRef.current?.dispose();
      runtimeRef.current = definition.create({ scene });
    } catch (error) {
      console.error("[BabylonMain] preset switch failed", error);
      onFatalErrorRef.current?.(error);
    }
  }, [presetName]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let stopped = false;

    const disposeRuntime = () => {
      try {
        runtimeRef.current?.dispose();
      } catch (error) {
        console.warn("[BabylonMain] runtime dispose failed", error);
      } finally {
        runtimeRef.current = null;
      }
    };

    const createRuntime = (name: string) => {
      const scene = sceneRef.current;
      if (!scene) return;

      const definition = BABYLON_PRESETS[name];
      if (!definition) return;

      try {
        disposeRuntime();
        runtimeRef.current = definition.create({ scene });
      } catch (error) {
        console.error("[BabylonMain] runtime create failed", error);
        onFatalErrorRef.current?.(error);
      }
    };

    const start = async () => {
      try {
        let engine: Engine | null = null;

        if (WEBGPU_EXPERIMENT_ENABLED && supportsWebGPU()) {
          try {
            const WebGPUEngineCtor = (BABYLON as unknown as { WebGPUEngine?: new (...args: unknown[]) => Engine & { initAsync: () => Promise<void> } }).WebGPUEngine;
            if (typeof WebGPUEngineCtor === "function") {
              const webgpuEngine = new WebGPUEngineCtor(canvas, {
                antialiasing: true,
                powerPreference: "high-performance",
              });
              await webgpuEngine.initAsync();
              engine = webgpuEngine;
              onEngineLabelChangeRef.current?.("Babylon WebGPU");
            }
          } catch (error) {
            console.warn("[BabylonMain] WebGPU init failed; falling back to WebGL", error);
          }
        }

        if (!engine) {
          engine = new BABYLON.Engine(canvas, true, {
            preserveDrawingBuffer: false,
            stencil: false,
            antialias: true,
            powerPreference: "high-performance",
          });
          onEngineLabelChangeRef.current?.("Babylon WebGL fallback");
        }
        if (!engine) return;
        const activeEngine = engine;

        if (stopped) {
          activeEngine.dispose();
          return;
        }

        engineRef.current = activeEngine;

        const scene = new BABYLON.Scene(activeEngine);
        scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);
        sceneRef.current = scene;

        const camera = new BABYLON.ArcRotateCamera(
          "babylon-main-camera",
          -Math.PI / 2,
          1.18,
          5.35,
          new BABYLON.Vector3(0, -0.65, 0),
          scene,
        );
        camera.lowerRadiusLimit = 2.2;
        camera.upperRadiusLimit = 9.0;
        camera.wheelDeltaPercentage = 0.01;
        camera.attachControl(canvas, true);

        createRuntime(presetNameRef.current);

        let last = performance.now();
        let runtimeFailed = false;
        activeEngine.runRenderLoop(() => {
          if (runtimeFailed) return;

          const activeScene = sceneRef.current;
          const runtime = runtimeRef.current;
          if (!activeScene || !runtime) return;

          const now = performance.now();
          const dt = Math.min(1 / 20, Math.max(1 / 240, (now - last) / 1000));
          last = now;

          const audio = getAudioDataRef.current();
          const spectrum = spectrumRef.current;
          const freq = audio.frequencyData;
          const binCount = Math.min(SPECTRUM_BINS, freq?.length ?? 0);
          for (let i = 0; i < binCount; i++) {
            spectrum[i] = clamp01((freq?.[i] ?? 0) / 255);
          }
          for (let i = binCount; i < SPECTRUM_BINS; i++) {
            spectrum[i] = 0;
          }

          const frame = {
            ...audio,
            rms: audio.energy,
            beat: audio.kick,
            spectrum,
            bands: spectrum,
          } as unknown as AudioData;

          try {
            runtime.update(frame, dt, { intensity: intensityRef.current, morph: 0 });
          } catch (error) {
            runtimeFailed = true;
            console.error("[BabylonMain] runtime update failed", error);
            onFatalErrorRef.current?.(error);
            return;
          }

          activeScene.render();
        });

        const onResize = () => {
          engineRef.current?.resize();
        };
        window.addEventListener("resize", onResize);
        disposeResizeRef.current = () => window.removeEventListener("resize", onResize);
      } catch (error) {
        console.error("[BabylonMain] failed to start", error);
        onFatalErrorRef.current?.(error);
      }
    };

    start();

    return () => {
      stopped = true;
      try {
        disposeResizeRef.current?.();
        disposeResizeRef.current = null;
        disposeRuntime();
        sceneRef.current?.dispose();
        sceneRef.current = null;
        engineRef.current?.dispose();
        engineRef.current = null;
      } catch (error) {
        console.warn("[BabylonMain] cleanup failed", error);
      }
    };
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
        touchAction: "none",
        background: backgroundImage
          ? `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.9)), url(${backgroundImage}) center / cover`
          : "radial-gradient(ellipse at center, #081126 0%, #04060b 100%)",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          touchAction: "none",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
