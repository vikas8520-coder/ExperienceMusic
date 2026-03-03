import { useEffect, useRef, useCallback } from "react";
import type { AudioData } from "@/hooks/use-audio-analyzer";
import { convertAudioForButterchurn, MILKDROP_PRESET_NAMES } from "./MilkdropBridge";

interface MilkdropRendererProps {
  width: number;
  height: number;
  presetName: string;
  getAudioData: () => AudioData;
  visible?: boolean;
}

/**
 * MilkdropRenderer: Creates an offscreen canvas and renders Butterchurn
 * MilkDrop presets to it. The canvas is composited as a background layer.
 *
 * Butterchurn is loaded dynamically to keep the main bundle size small.
 */
export function MilkdropRenderer({
  width,
  height,
  presetName,
  getAudioData,
  visible = true,
}: MilkdropRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visualizerRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);
  const loadedRef = useRef(false);

  // Initialize Butterchurn
  useEffect(() => {
    if (!canvasRef.current || loadedRef.current) return;

    const initButterchurn = async () => {
      try {
        const butterchurn = await import("butterchurn");
        const butterchurnPresets = await import("butterchurn-presets");

        const canvas = canvasRef.current;
        if (!canvas) return;

        const visualizer = butterchurn.default.createVisualizer(
          new AudioContext(),
          canvas,
          {
            width: width || 800,
            height: height || 600,
          },
        );

        const allPresets = butterchurnPresets.default.getPresets();
        const presetKeys = Object.keys(allPresets);

        // Load initial preset
        const matchedKey =
          presetKeys.find((k) => k.includes(presetName)) || presetKeys[0];
        if (matchedKey) {
          visualizer.loadPreset(allPresets[matchedKey], 0.5);
        }

        visualizerRef.current = visualizer;
        loadedRef.current = true;
      } catch (e) {
        console.warn("Butterchurn not available:", e);
      }
    };

    initButterchurn();

    return () => {
      loadedRef.current = false;
      visualizerRef.current = null;
    };
  }, []);

  // Handle preset changes
  useEffect(() => {
    if (!visualizerRef.current) return;

    const loadPreset = async () => {
      try {
        const butterchurnPresets = await import("butterchurn-presets");
        const allPresets = butterchurnPresets.default.getPresets();
        const presetKeys = Object.keys(allPresets);
        const matchedKey = presetKeys.find((k) => k.includes(presetName));
        if (matchedKey) {
          visualizerRef.current.loadPreset(allPresets[matchedKey], 1.0);
        }
      } catch (e) {
        console.warn("Failed to load MilkDrop preset:", e);
      }
    };

    loadPreset();
  }, [presetName]);

  // Render loop
  useEffect(() => {
    if (!visible) return;

    const render = () => {
      if (visualizerRef.current) {
        const audioData = getAudioData();
        const { frequencyData, waveformData } =
          convertAudioForButterchurn(audioData);

        // Butterchurn render expects audio data to be set
        try {
          visualizerRef.current.render();
        } catch {
          // Butterchurn can throw during transitions
        }
      }
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [visible, getAudioData]);

  // Resize
  useEffect(() => {
    if (visualizerRef.current && width > 0 && height > 0) {
      try {
        visualizerRef.current.setRendererSize(width, height);
      } catch {
        // May fail during initialization
      }
    }
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width || 800}
      height={height || 600}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{
        display: visible ? "block" : "none",
        zIndex: 0,
      }}
      data-testid="milkdrop-canvas"
    />
  );
}

export { MILKDROP_PRESET_NAMES };
