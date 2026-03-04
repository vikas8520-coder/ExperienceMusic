import { useRef, useEffect, useState, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { AudioData } from "@/hooks/use-audio-analyzer";
import { convertAudioForButterchurn, resolveButterchurnPresetKey } from "./MilkdropBridge";
import type { ImageFilterId } from "@/lib/visualizer-presets";

// Presets not in the base butterchurn bundle — must be imported explicitly for Vite
const JSON_PRESET_LOADERS: Record<string, () => Promise<any>> = {
  "Geiss - Tokamak Plus 3": () => import("butterchurn-presets/presets/converted/Geiss - Tokamak Plus 3.json"),
  "ShadowHarlequin - mashup - Satin Sunburst (Neon Tokyo Megamix) v1": () => import("butterchurn-presets/presets/converted/ShadowHarlequin - mashup - Satin Sunburst (Neon Tokyo Megamix) v1.json"),
  "Flexi - molten neon fire spirit": () => import("butterchurn-presets/presets/converted/Flexi - molten neon fire spirit.json"),
  "Flexi - gold plated maelstrom of chaos": () => import("butterchurn-presets/presets/converted/Flexi - gold plated maelstrom of chaos.json"),
  "martin - golden mirror": () => import("butterchurn-presets/presets/converted/martin - golden mirror.json"),
  "Geiss - Cosmic Dust 2": () => import("butterchurn-presets/presets/converted/Geiss - Cosmic Dust 2.json"),
  "Geiss - Reaction Diffusion 3": () => import("butterchurn-presets/presets/converted/Geiss - Reaction Diffusion 3.json"),
  "Geiss - Aurora 2": () => import("butterchurn-presets/presets/converted/Geiss - Aurora 2.json"),
  "Geiss - Cosmic Dust 2 - Trails 7": () => import("butterchurn-presets/presets/converted/Geiss - Cosmic Dust 2 - Trails 7.json"),
  "Goody - Aurora Totalis": () => import("butterchurn-presets/presets/converted/Goody - Aurora Totalis.json"),
  "Rovastar - Cosmic Echoes 2": () => import("butterchurn-presets/presets/converted/Rovastar - Cosmic Echoes 2.json"),
  "martin - mandelbulb slideshow": () => import("butterchurn-presets/presets/converted/martin - mandelbulb slideshow.json"),
  "Flexi - working with infinity": () => import("butterchurn-presets/presets/converted/Flexi - working with infinity.json"),
  "flexi - fractal descent": () => import("butterchurn-presets/presets/converted/flexi - fractal descent.json"),
  "Flexi - reality tunnel": () => import("butterchurn-presets/presets/converted/Flexi - reality tunnel.json"),
  "Flexi - smashing fractals 2.0": () => import("butterchurn-presets/presets/converted/Flexi - smashing fractals 2.0.json"),
  "Flexi - intensive shader fractal": () => import("butterchurn-presets/presets/converted/Flexi - intensive shader fractal.json"),
  "Flexi - Julia fractal": () => import("butterchurn-presets/presets/converted/Flexi - Julia fractal.json"),
  "martin + flexi - mandelbox explorer - high speed oversustained bipolar": () => import("butterchurn-presets/presets/converted/martin + flexi - mandelbox explorer - high speed oversustained bipolar.json"),
};

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;

const filterIdToType: Record<string, number> = {
  none: 0,
  kaleidoscope: 1,
  mirror: 2,
  colorshift: 3,
  invert: 4,
  pixelate: 5,
  rgbsplit: 6,
  wave: 7,
  zoompulse: 8,
};

interface MilkdropTextureBridgeProps {
  presetName: string;
  getAudioData: () => AudioData;
  intensity?: number;
  imageFilters?: ImageFilterId[];
}

export function MilkdropTextureBridge({
  presetName,
  getAudioData,
  intensity = 1,
  imageFilters = ["none"],
}: MilkdropTextureBridgeProps) {
  const materialRef = useRef<any>(null);
  const visualizerRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const copyCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const copyCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const dummyCtxRef = useRef<AudioContext | null>(null);
  const [ready, setReady] = useState(false);
  const { viewport } = useThree();

  // Create offscreen canvas and init Butterchurn once
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        // Butterchurn renders to a WebGL2 canvas (no preserveDrawingBuffer).
        // We copy its output to a separate 2D canvas for Three.js texture upload.
        const glCanvas = document.createElement("canvas");
        glCanvas.width = CANVAS_WIDTH;
        glCanvas.height = CANVAS_HEIGHT;
        canvasRef.current = glCanvas;

        const copyCanvas = document.createElement("canvas");
        copyCanvas.width = CANVAS_WIDTH;
        copyCanvas.height = CANVAS_HEIGHT;
        copyCanvasRef.current = copyCanvas;
        copyCtxRef.current = copyCanvas.getContext("2d");

        // Butterchurn requires an AudioContext, but we feed data manually via render()
        const audioCtx = new AudioContext();
        dummyCtxRef.current = audioCtx;

        const butterchurn = await import("butterchurn");
        const butterchurnPresets = await import("butterchurn-presets");

        if (cancelled) return;

        const visualizer = butterchurn.default.createVisualizer(
          audioCtx,
          glCanvas,
          { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
        );

        const allPresets = butterchurnPresets.default.getPresets();
        const key = resolveButterchurnPresetKey(presetName);
        let presetData = key ? allPresets[key] : undefined;
        // Fallback: load individual JSON for presets not in the base bundle
        if (!presetData && key && JSON_PRESET_LOADERS[key]) {
          try {
            const json = await JSON_PRESET_LOADERS[key]();
            presetData = json.default || json;
          } catch { /* preset not found, fall through to default */ }
        }
        if (!presetData) presetData = Object.values(allPresets)[0];
        if (presetData) {
          visualizer.loadPreset(presetData, 0);
        }

        visualizerRef.current = visualizer;

        // Create THREE texture from the 2D copy canvas (not the WebGL canvas)
        const tex = new THREE.CanvasTexture(copyCanvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        textureRef.current = tex;

        if (!cancelled) setReady(true);
      } catch (e) {
        console.warn("MilkdropTextureBridge: Butterchurn init failed", e);
      }
    };

    init();

    return () => {
      cancelled = true;
      visualizerRef.current = null;
      if (textureRef.current) {
        textureRef.current.dispose();
        textureRef.current = null;
      }
      if (dummyCtxRef.current) {
        dummyCtxRef.current.close().catch(() => {});
        dummyCtxRef.current = null;
      }
      canvasRef.current = null;
      copyCanvasRef.current = null;
      copyCtxRef.current = null;
      setReady(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle preset changes
  useEffect(() => {
    if (!visualizerRef.current) return;

    const loadPreset = async () => {
      try {
        const butterchurnPresets = await import("butterchurn-presets");
        const allPresets = butterchurnPresets.default.getPresets();
        const key = resolveButterchurnPresetKey(presetName);
        let presetData = key ? allPresets[key] : undefined;
        if (!presetData && key && JSON_PRESET_LOADERS[key]) {
          try {
            const json = await JSON_PRESET_LOADERS[key]();
            presetData = json.default || json;
          } catch { /* preset not found */ }
        }
        if (!presetData) presetData = Object.values(allPresets)[0];
        if (presetData) {
          visualizerRef.current.loadPreset(presetData, 1.0);
        }
      } catch (e) {
        console.warn("MilkdropTextureBridge: failed to load preset", e);
      }
    };

    loadPreset();
  }, [presetName]);

  // Render loop: feed audio → render Butterchurn → copy to 2D canvas → update texture
  useFrame((state) => {
    const viz = visualizerRef.current;
    const tex = textureRef.current;
    const copyCtx = copyCtxRef.current;
    const glCanvas = canvasRef.current;
    if (!viz || !tex || !copyCtx || !glCanvas) return;

    // Convert our audio data into Butterchurn's waveform format
    const audioData = getAudioData();
    const { waveformData } = convertAudioForButterchurn(audioData);

    // Feed audio through Butterchurn's public render() API
    try {
      viz.render({
        audioLevels: {
          timeByteArray: waveformData,
          timeByteArrayL: waveformData,
          timeByteArrayR: waveformData,
        },
      });
    } catch {
      // Butterchurn can throw during transitions
    }

    // Copy WebGL canvas to 2D canvas (avoids preserveDrawingBuffer issue)
    // This must happen immediately after render(), before the buffer is cleared
    copyCtx.drawImage(glCanvas, 0, 0);

    // Signal Three.js to re-upload the texture from the 2D copy canvas
    tex.needsUpdate = true;

    // Update material uniforms
    if (materialRef.current) {
      const activeFilter = (imageFilters && imageFilters[0]) || "none";
      materialRef.current.uTexture = tex;
      materialRef.current.uTime = state.clock.getElapsedTime();
      materialRef.current.uIntensity = intensity;
      materialRef.current.uFilterType = filterIdToType[activeFilter] || 0;
      materialRef.current.uEnergy = audioData.energy;
      materialRef.current.uBass = audioData.bass;
      materialRef.current.uMid = audioData.mid;
      materialRef.current.uHigh = audioData.high;
    }
  });

  // Compute mesh scale to fill the viewport (same math as BackgroundImage "cover")
  const meshScale = useMemo(() => {
    const distance = 45; // camera z=15, plane z=-30
    const visibleHeight = 2 * distance * Math.tan((45 * Math.PI) / 360);
    const viewAspect = viewport.width / viewport.height;
    const visibleWidth = visibleHeight * viewAspect;
    const canvasAspect = CANVAS_WIDTH / CANVAS_HEIGHT;

    if (canvasAspect > viewAspect) {
      const h = visibleHeight;
      const w = h * canvasAspect;
      return [w, h, 1] as [number, number, number];
    } else {
      const w = visibleWidth;
      const h = w / canvasAspect;
      return [w, h, 1] as [number, number, number];
    }
  }, [viewport.width, viewport.height]);

  if (!ready) return null;

  return (
    <mesh position={[0, 0, -30]} scale={meshScale} renderOrder={-10}>
      <planeGeometry />
      <psyFilterMaterial
        ref={materialRef}
        uTexture={textureRef.current}
        transparent
        depthTest
        depthWrite
      />
    </mesh>
  );
}
