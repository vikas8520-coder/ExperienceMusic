import { useState, useRef, useCallback, useEffect, type MouseEvent, type TouchEvent, type WheelEvent, type PointerEvent } from "react";
import { AnimatePresence } from "framer-motion";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { UIControls, type ThumbnailAnalysis } from "@/components/UIControls";
import { TrackLibrary } from "@/components/TrackLibrary";
import { SoundCloudPanel } from "@/components/SoundCloudPanel";
import { useAudioAnalyzer } from "@/hooks/use-audio-analyzer";
import { 
  colorPalettes, 
  type PresetName, 
  type ImageFilterId, 
  type PsyOverlayId,
  type ColorSettings,
  type ColorModeId,
  type MoodPresetId,
  defaultColorSettings,
  generateColorPalette
} from "@/lib/visualizer-presets";
import { useCreatePreset } from "@/hooks/use-presets";
import { useToast } from "@/hooks/use-toast";
import { isFractalPreset, getFractalPreset } from "@/engine/presets/registry";
import type { UniformValues, UniformSpec } from "@/engine/presets/types";
import { createCanvasRecorder } from "@/lib/canvasRecorder";
import { useAudioFeatures } from "@/audio/useAudioFeatures";
import { parseBlob } from "music-metadata";

export interface SavedTrack {
  id: string;
  name: string;
  audioUrl: string;
  thumbnailUrl?: string;
  colorPalette?: string[];
  theme?: string;
  createdAt: Date;
}

const LIBRARY_STORAGE_KEY = "auralvis-track-library";
type RenderProfile = "mobile60" | "desktopCinematic" | "exportQuality";

function uint8ArrayToBase64(data: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < data.length; i += chunkSize) {
    binary += String.fromCharCode(...Array.from(data.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

export default function Home() {
  const [audioFile, setAudioFile] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string>("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const previousVolumeRef = useRef(1);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingQuality, setRecordingQuality] = useState<"1080p" | "2k" | "4k">("1080p");
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showSoundCloud, setShowSoundCloud] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [visualizationZoom, setVisualizationZoom] = useState(1);
  const [activeTab, setActiveTab] = useState<"listen" | "create" | "perform" | "record">("listen");
  const [uiAutoHidden, setUiAutoHidden] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [adaptiveQualityTier, setAdaptiveQualityTier] = useState<0 | 1 | 2>(1);
  const [micReactiveEnabled, setMicReactiveEnabled] = useState(false);
  const lastTapRef = useRef(0);
  const hideTimerRef = useRef<number | null>(null);
  const pinchRef = useRef<{ startDist: number; startZoom: number; mode: "fractal" | "scene"; min: number; max: number } | null>(null);
  const screenZoomLayerRef = useRef<HTMLDivElement | null>(null);
  const centerDragRef = useRef<{ active: boolean; pointerId: number | null; x: number; y: number; dx: number; dy: number }>({
    active: false,
    pointerId: null,
    x: 0,
    y: 0,
    dx: 0,
    dy: 0,
  });
  const centerDragRafRef = useRef<number | null>(null);
  const zoomAnimRef = useRef<{ mode: "fractal" | "scene"; target: number; min: number; max: number } | null>(null);
  const zoomRafRef = useRef<number | null>(null);
  const fractalZoomRef = useRef(1);
  const sceneZoomRef = useRef(1);
  const fractalCenterRef = useRef<[number, number]>([0, 0]);
  const fractalZoomTargetRef = useRef<[number, number]>([0, 0]);
  const fractalRotationRef = useRef(0);
  
  const [savedTracks, setSavedTracks] = useState<SavedTrack[]>(() => {
    try {
      const stored = localStorage.getItem(LIBRARY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map((t: any) => ({ ...t, createdAt: new Date(t.createdAt) }));
      }
    } catch (e) {
      console.error("Failed to load saved tracks:", e);
    }
    return [];
  });

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px), (pointer: coarse)");
    const update = () => setIsMobileDevice(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const renderProfile: RenderProfile = isRecording
    ? "exportQuality"
    : isMobileDevice
      ? "mobile60"
      : "desktopCinematic";
  const renderProfileLabel =
    renderProfile === "mobile60"
      ? "Mobile 60 FPS"
      : renderProfile === "exportQuality"
        ? "Export Quality"
        : "Desktop Cinematic";

  useEffect(() => {
    if (renderProfile === "mobile60") {
      setAdaptiveQualityTier(0);
      return;
    }
    if (renderProfile === "exportQuality") {
      setAdaptiveQualityTier(2);
      return;
    }
    setAdaptiveQualityTier(1);
  }, [renderProfile]);

  useEffect(() => {
    if (renderProfile === "exportQuality") return;
    let raf = 0;
    let last = performance.now();
    let emaMs = 16.7;
    let highMsCount = 0;
    let lowMsCount = 0;
    let cooldown = 0;
    const maxTier = renderProfile === "desktopCinematic" ? 2 : 1;

    const tick = (now: number) => {
      const dt = Math.min((now - last) * 0.001, 0.05);
      last = now;
      const frameMs = dt * 1000;
      emaMs += (frameMs - emaMs) * 0.08;
      cooldown = Math.max(0, cooldown - dt);

      const tooSlow = emaMs > 22;
      const stable = emaMs < 16.5;
      highMsCount = tooSlow ? highMsCount + 1 : Math.max(0, highMsCount - 1);
      lowMsCount = stable ? lowMsCount + 1 : Math.max(0, lowMsCount - 1);

      if (cooldown <= 0 && highMsCount > 24) {
        setAdaptiveQualityTier((prev) => {
          if (prev <= 0) return prev;
          cooldown = 1.0;
          highMsCount = 0;
          lowMsCount = 0;
          return (prev - 1) as 0 | 1 | 2;
        });
      } else if (cooldown <= 0 && lowMsCount > 180) {
        setAdaptiveQualityTier((prev) => {
          if (prev >= maxTier) return prev;
          cooldown = 2.0;
          highMsCount = 0;
          lowMsCount = 0;
          return (prev + 1) as 0 | 1 | 2;
        });
      }

      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [renderProfile]);

  useEffect(() => {
    try {
      localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(savedTracks));
    } catch (e) {
      console.error("Failed to save tracks:", e);
    }
  }, [savedTracks]);
  
  const recorderRef = useRef<ReturnType<typeof createCanvasRecorder> | null>(null);

  const { toast } = useToast();
  const createPreset = useCreatePreset();
  const {
    status: micStatus,
    features: micFeatures,
    error: micError,
    start: startMic,
    stop: stopMic,
  } = useAudioFeatures();

  const [colorSettings, setColorSettings] = useState<ColorSettings>(defaultColorSettings);
  const [colorTime, setColorTime] = useState(0);
  
  // Update color time for spectrum mode
  useEffect(() => {
    if (colorSettings.mode === "spectrum") {
      const interval = setInterval(() => {
        setColorTime(t => t + 0.1);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [colorSettings.mode]);
  
  const [settings, setSettings] = useState({
    intensity: 1.0,
    speed: 0.5,
    colorPalette: generateColorPalette(defaultColorSettings),
    presetName: "Energy Rings" as PresetName,
    presetEnabled: true,
    imageFilters: ["none"] as ImageFilterId[],
    psyOverlays: [] as PsyOverlayId[],
    trailsOn: false,
    trailsAmount: 0.75,
    glowEnabled: true,
    glowIntensity: 1.0,
  });

  const [fractalUniforms, setFractalUniforms] = useState<UniformValues>({});
  const [fractalSpecs, setFractalSpecs] = useState<UniformSpec[]>([]);
  const [fractalMacros, setFractalMacros] = useState<UniformSpec[]>([]);

  useEffect(() => {
    const fp = getFractalPreset(settings.presetName);
    if (fp) {
      const defaults: UniformValues = {};
      for (const spec of fp.uniformSpecs) defaults[spec.key] = spec.default;
      setFractalUniforms(defaults);
      setFractalSpecs(fp.uniformSpecs);
      setFractalMacros(fp.uniformSpecs.filter(s => s.macro));
    } else {
      setFractalSpecs([]);
      setFractalMacros([]);
    }
  }, [settings.presetName]);

  const setFractalUniform = useCallback((key: string, value: any) => {
    setFractalUniforms(prev => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    if (!isFractalPreset(settings.presetName)) return;
    const aaSpec = fractalSpecs.find((s) => s.key === "u_aaLevel" && s.type === "int");
    if (!aaSpec) return;

    const tierToAA = [1, 2, 3] as const;
    const min = aaSpec.min ?? 1;
    const max = aaSpec.max ?? 3;
    const target = Math.max(min, Math.min(max, tierToAA[adaptiveQualityTier]));
    setFractalUniform("u_aaLevel", target);
  }, [adaptiveQualityTier, fractalSpecs, settings.presetName, setFractalUniform]);

  useEffect(() => {
    sceneZoomRef.current = visualizationZoom;
  }, [visualizationZoom]);

  useEffect(() => {
    const infiniteZoom = !!fractalUniforms.u_infiniteZoom;
    const zoom = typeof fractalUniforms.u_zoom === "number" ? fractalUniforms.u_zoom : 1;
    const zoomExp = typeof fractalUniforms.u_zoomExp === "number" ? fractalUniforms.u_zoomExp : Math.log2(Math.max(1e-12, zoom));
    fractalZoomRef.current = Math.max(1e-12, infiniteZoom ? Math.pow(2, zoomExp) : zoom);
  }, [fractalUniforms.u_zoom, fractalUniforms.u_zoomExp, fractalUniforms.u_infiniteZoom]);

  useEffect(() => {
    if (Array.isArray(fractalUniforms.u_center) && fractalUniforms.u_center.length === 2) {
      fractalCenterRef.current = [fractalUniforms.u_center[0], fractalUniforms.u_center[1]];
    }
  }, [fractalUniforms.u_center]);

  useEffect(() => {
    if (Array.isArray(fractalUniforms.u_zoomTarget) && fractalUniforms.u_zoomTarget.length === 2) {
      fractalZoomTargetRef.current = [fractalUniforms.u_zoomTarget[0], fractalUniforms.u_zoomTarget[1]];
    }
  }, [fractalUniforms.u_zoomTarget]);

  useEffect(() => {
    if (typeof fractalUniforms.u_rotation === "number") {
      fractalRotationRef.current = fractalUniforms.u_rotation;
    }
  }, [fractalUniforms.u_rotation]);

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const hasFractalUniform = useCallback((key: string) => fractalSpecs.some((s) => s.key === key), [fractalSpecs]);

  useEffect(() => {
    if (!micReactiveEnabled || micStatus !== "running") return;
    if (!isFractalPreset(settings.presetName)) return;

    const energy = clamp(micFeatures.rms * 6, 0, 1);
    const centroid = clamp(micFeatures.centroid, 0, 1);
    const onset = clamp(micFeatures.onset, 0, 1);

    if (hasFractalUniform("u_audioGain")) setFractalUniform("u_audioGain", clamp(0.6 + energy * 1.4, 0, 2));
    if (hasFractalUniform("u_bassImpact")) setFractalUniform("u_bassImpact", clamp(energy * 1.7, 0, 2));
    if (hasFractalUniform("u_midMorph")) setFractalUniform("u_midMorph", clamp(centroid * 1.6, 0, 2));
    if (hasFractalUniform("u_trebleShimmer")) setFractalUniform("u_trebleShimmer", clamp((centroid * 0.5 + onset * 0.5) * 1.8, 0, 2));
    if (hasFractalUniform("u_beatPunch")) setFractalUniform("u_beatPunch", clamp(onset * 2.2, 0, 2));
  }, [micReactiveEnabled, micStatus, micFeatures, hasFractalUniform, settings.presetName, setFractalUniform]);

  const toggleMicReactivity = useCallback(async () => {
    if (micStatus === "running" || micStatus === "starting") {
      await stopMic();
      setMicReactiveEnabled(false);
      toast({ title: "Mic Reactivity Disabled" });
      return;
    }
    try {
      await startMic();
      setMicReactiveEnabled(true);
      toast({ title: "Mic Reactivity Enabled", description: "Microphone is now driving visual parameters." });
    } catch (error: any) {
      setMicReactiveEnabled(false);
      toast({
        title: "Mic Reactivity Failed",
        description: error?.message || micError || "Microphone access failed.",
        variant: "destructive",
      });
    }
  }, [micStatus, startMic, stopMic, toast, micError]);

  useEffect(() => {
    if (micStatus !== "running" && micReactiveEnabled) {
      setMicReactiveEnabled(false);
    }
  }, [micStatus, micReactiveEnabled]);

  // Update color palette when color settings or time changes
  useEffect(() => {
    const newPalette = generateColorPalette(colorSettings, colorTime);
    setSettings(prev => ({ ...prev, colorPalette: newPalette }));
  }, [colorSettings, colorTime]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const isUIOpen = activeTab !== "listen" || showLibrary || showSoundCloud;

  const closeAllUI = useCallback(() => {
    setActiveTab("listen");
    setShowLibrary(false);
    setShowSoundCloud(false);
  }, []);

  const markUiActivity = useCallback(() => {
    setUiAutoHidden(false);
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(() => {
      setUiAutoHidden(true);
    }, 1800);
  }, []);

  const handleCanvasClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (isUIOpen) {
      closeAllUI();
    }
  }, [isUIOpen, closeAllUI]);

  const applyFractalDragDelta = useCallback((dx: number, dy: number) => {
    if (dx === 0 && dy === 0) return;
    if (!isFractalPreset(settings.presetName)) return;
    const layer = screenZoomLayerRef.current;
    if (!layer) return;

    const infiniteZoom = !!fractalUniforms.u_infiniteZoom;
    const center = infiniteZoom ? fractalZoomTargetRef.current : fractalCenterRef.current;
    const zoom = Math.max(fractalZoomRef.current, 1e-6);
    const rotation = fractalRotationRef.current;

    const rect = layer.getBoundingClientRect();
    let uvx = (dx / rect.width) * 2;
    let uvy = -(dy / rect.height) * 2;
    uvx *= rect.width / rect.height;

    const c = Math.cos(rotation);
    const s = Math.sin(rotation);
    const rx = c * uvx - s * uvy;
    const ry = s * uvx + c * uvy;

    const sensitivity = infiniteZoom ? 0.42 : 1.4;
    const nextCenter: [number, number] = [
      center[0] - (rx / zoom) * sensitivity,
      center[1] - (ry / zoom) * sensitivity,
    ];
    if (infiniteZoom) {
      fractalZoomTargetRef.current = nextCenter;
      setFractalUniform("u_zoomTarget", nextCenter);
      return;
    }
    fractalCenterRef.current = nextCenter;
    setFractalUniform("u_center", nextCenter);
  }, [settings.presetName, fractalUniforms.u_infiniteZoom, setFractalUniform]);

  const scheduleCenterDragUpdate = useCallback(() => {
    if (centerDragRafRef.current !== null) return;
    centerDragRafRef.current = window.requestAnimationFrame(() => {
      centerDragRafRef.current = null;
      const drag = centerDragRef.current;
      if (!drag.active) return;
      const dx = drag.dx;
      const dy = drag.dy;
      drag.dx = 0;
      drag.dy = 0;
      applyFractalDragDelta(dx, dy);
    });
  }, [applyFractalDragDelta]);

  const handleCanvasPointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (isUIOpen) return;
    if (!isFractalPreset(settings.presetName)) return;
    if (e.pointerType === "touch") return;
    if (e.button !== 0) return;

    markUiActivity();
    centerDragRef.current = { active: true, pointerId: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [isUIOpen, settings.presetName, markUiActivity]);

  const handleCanvasPointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const drag = centerDragRef.current;
    if (!drag.active || drag.pointerId !== e.pointerId) return;
    markUiActivity();
    drag.dx += e.clientX - drag.x;
    drag.dy += e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    scheduleCenterDragUpdate();
  }, [markUiActivity, scheduleCenterDragUpdate]);

  const handleCanvasPointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const drag = centerDragRef.current;
    if (!drag.active || drag.pointerId !== e.pointerId) return;
    centerDragRef.current = { active: false, pointerId: null, x: drag.x, y: drag.y, dx: 0, dy: 0 };
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  }, []);

  const handleCanvasDoubleClick = useCallback(() => {
    toggleFullscreen();
  }, [toggleFullscreen]);

  const handleCanvasTouchEnd = useCallback(() => {
    const now = Date.now();
    const delta = now - lastTapRef.current;
    if (delta < 300 && delta > 0) {
      toggleFullscreen();
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      if (isUIOpen) {
        closeAllUI();
      }
    }
  }, [isUIOpen, closeAllUI, toggleFullscreen]);

  const startZoomAnimation = useCallback(() => {
    if (zoomRafRef.current !== null) return;
    const tick = () => {
      const z = zoomAnimRef.current;
      if (!z) {
        zoomRafRef.current = null;
        return;
      }

      const current = z.mode === "fractal" ? fractalZoomRef.current : sceneZoomRef.current;
      const next = current + (z.target - current) * 0.08;
      const clamped = Math.max(z.min, Math.min(z.max, next));

      if (z.mode === "fractal") {
        fractalZoomRef.current = clamped;
        if (fractalUniforms.u_infiniteZoom) {
          setFractalUniform("u_zoomExp", Math.log2(Math.max(1e-12, clamped)));
        } else {
          setFractalUniform("u_zoom", clamped);
        }
      } else {
        sceneZoomRef.current = clamped;
        setVisualizationZoom(clamped);
      }

      if (Math.abs(z.target - clamped) < 1e-4) {
        zoomAnimRef.current = null;
        zoomRafRef.current = null;
        return;
      }

      zoomRafRef.current = window.requestAnimationFrame(tick);
    };
    zoomRafRef.current = window.requestAnimationFrame(tick);
  }, [setFractalUniform, fractalUniforms.u_infiniteZoom]);

  useEffect(() => {
    return () => {
      if (zoomRafRef.current !== null) {
        window.cancelAnimationFrame(zoomRafRef.current);
      }
    };
  }, []);

  const applyScreenZoom = useCallback((factor: number) => {
    if (!isFinite(factor) || factor <= 0) return;

    if (isFractalPreset(settings.presetName)) {
      const spec = fractalSpecs.find((s) => s.key === "u_zoom" && s.type === "float");
      const min = fractalUniforms.u_infiniteZoom ? 1e-12 : (spec?.min ?? 0.05);
      const max = spec?.max ?? 50;
      const base = zoomAnimRef.current?.mode === "fractal" ? zoomAnimRef.current.target : fractalZoomRef.current;
      zoomAnimRef.current = {
        mode: "fractal",
        min,
        max,
        target: Math.max(min, Math.min(max, base * factor)),
      };
      startZoomAnimation();
      return;
    }

    const min = 0.5;
    const max = 3;
    const base = zoomAnimRef.current?.mode === "scene" ? zoomAnimRef.current.target : sceneZoomRef.current;
    zoomAnimRef.current = {
      mode: "scene",
      min,
      max,
      target: Math.max(min, Math.min(max, base * factor)),
    };
    startZoomAnimation();
  }, [settings.presetName, fractalSpecs, fractalUniforms.u_infiniteZoom, startZoomAnimation]);

  useEffect(() => {
    const handler = (e: globalThis.WheelEvent) => {
      if (!e.ctrlKey) return;
      const layer = screenZoomLayerRef.current;
      if (!layer) return;

      const target = e.target as Node | null;
      const inPath = typeof e.composedPath === "function" ? e.composedPath().includes(layer) : false;
      const inLayer = target ? layer.contains(target) : false;
      const hovered = layer.matches(":hover");
      if (!inPath && !inLayer && !hovered) return;

      e.preventDefault();
      e.stopPropagation();
      markUiActivity();

      const modeScale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 120 : 1;
      const delta = e.deltaY * modeScale;
      const speed = isFractalPreset(settings.presetName)
        ? (renderProfile === "mobile60" ? 0.009 : renderProfile === "exportQuality" ? 0.0065 : 0.0081)
        : (renderProfile === "mobile60" ? 0.0064 : 0.0057);
      const factor = Math.exp(-delta * speed);
      applyScreenZoom(factor);
    };

    window.addEventListener("wheel", handler, { passive: false, capture: true });
    return () => window.removeEventListener("wheel", handler, { capture: true });
  }, [applyScreenZoom, markUiActivity, settings.presetName, renderProfile]);

  const getTouchDist = (t1: { clientX: number; clientY: number }, t2: { clientX: number; clientY: number }) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.hypot(dx, dy);
  };

  const handleScreenTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 2) return;
    e.preventDefault();
    markUiActivity();

    const startDist = getTouchDist(e.touches[0], e.touches[1]);
    if (startDist <= 0) return;

    if (isFractalPreset(settings.presetName)) {
      const spec = fractalSpecs.find((s) => s.key === "u_zoom" && s.type === "float");
      pinchRef.current = {
        startDist,
        startZoom: fractalZoomRef.current,
        mode: "fractal",
        min: fractalUniforms.u_infiniteZoom ? 1e-12 : (spec?.min ?? 0.05),
        max: spec?.max ?? 50,
      };
      return;
    }

    pinchRef.current = {
      startDist,
      startZoom: visualizationZoom,
      mode: "scene",
      min: 0.5,
      max: 3,
    };
  }, [settings.presetName, fractalSpecs, fractalUniforms.u_infiniteZoom, visualizationZoom, markUiActivity]);

  const handleScreenTouchMove = useCallback((e: TouchEvent<HTMLDivElement>) => {
    const pinch = pinchRef.current;
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    markUiActivity();

    const dist = getTouchDist(e.touches[0], e.touches[1]);
    if (dist <= 0) return;
    const ratio = dist / pinch.startDist;
    const next = Math.max(pinch.min, Math.min(pinch.max, pinch.startZoom * ratio));

    zoomAnimRef.current = {
      mode: pinch.mode,
      min: pinch.min,
      max: pinch.max,
      target: next,
    };
    startZoomAnimation();
  }, [markUiActivity, startZoomAnimation]);

  const handleScreenTouchEnd = useCallback((e: TouchEvent<HTMLDivElement>) => {
    if (pinchRef.current) {
      if (e.touches.length < 2) pinchRef.current = null;
      return;
    }
    handleCanvasTouchEnd();
  }, [handleCanvasTouchEnd]);

  useEffect(() => {
    markUiActivity();
    const onActivity = () => markUiActivity();
    window.addEventListener("mousemove", onActivity, { passive: true });
    window.addEventListener("mousedown", onActivity, { passive: true });
    window.addEventListener("wheel", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity);
    window.addEventListener("touchstart", onActivity, { passive: true });

    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("mousedown", onActivity);
      window.removeEventListener("wheel", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("touchstart", onActivity);
    };
  }, [markUiActivity]);

  useEffect(() => {
    return () => {
      if (centerDragRafRef.current !== null) {
        window.cancelAnimationFrame(centerDragRafRef.current);
      }
    };
  }, []);

  const { getAudioData, destNode } = useAudioAnalyzer(audioRef.current, audioFile);
  const getReactiveAudioData = useCallback(() => {
    const base = getAudioData();
    if (!micReactiveEnabled || micStatus !== "running") return base;

    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    const energy = clamp01(micFeatures.rms * 6);
    const centroid = clamp01(micFeatures.centroid);
    const onset = clamp01(micFeatures.onset);

    const micSub = clamp01(energy * 0.9);
    const micBass = clamp01(energy);
    const micMid = clamp01(energy * 0.35 + centroid * 0.65);
    const micHigh = clamp01(centroid * 0.5 + onset * 0.5);
    const micEnergy = clamp01(micSub * 0.25 + micBass * 0.35 + micMid * 0.25 + micHigh * 0.15);
    const micKick = onset;

    // Strongly bias toward external mic when enabled, while keeping a little continuity.
    const mix = 0.9;
    const blend = (a: number, b: number) => a * (1 - mix) + b * mix;

    const dominantFreq = 60 + centroid * 440;
    const modeIndex = Math.max(1, Math.min(8, Math.round(1 + centroid * 7)));

    return {
      ...base,
      sub: clamp01(blend(base.sub, micSub)),
      bass: clamp01(blend(base.bass, micBass)),
      mid: clamp01(blend(base.mid, micMid)),
      high: clamp01(blend(base.high, micHigh)),
      energy: clamp01(blend(base.energy, micEnergy)),
      kick: clamp01(blend(base.kick, micKick)),
      dominantFreq,
      modeIndex,
    };
  }, [getAudioData, micReactiveEnabled, micStatus, micFeatures]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is interacting with form elements, dropdowns, or dialogs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.tagName === 'SELECT' ||
        target.tagName === 'BUTTON' ||
        target.isContentEditable ||
        target.role === 'listbox' ||
        target.role === 'option' ||
        target.role === 'combobox' ||
        target.role === 'menu' ||
        target.role === 'menuitem' ||
        target.role === 'dialog' ||
        target.role === 'slider' ||
        target.closest('[role="listbox"]') ||
        target.closest('[role="dialog"]') ||
        target.closest('[role="menu"]') ||
        target.closest('[data-radix-popper-content-wrapper]') ||
        target.closest('.settings-panel')
      ) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (audioRef.current && audioFile) {
            if (isPlaying) {
              audioRef.current.pause();
              setIsPlaying(false);
            } else {
              audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
            }
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(prev => {
            const newVol = Math.min(1, prev + 0.1);
            if (audioRef.current) audioRef.current.volume = newVol;
            return newVol;
          });
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(prev => {
            const newVol = Math.max(0, prev - 0.1);
            if (audioRef.current) audioRef.current.volume = newVol;
            return newVol;
          });
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (audioRef.current) {
            audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (audioRef.current && duration) {
            audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 5);
          }
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'KeyM':
          e.preventDefault();
          setVolume(prev => {
            if (prev > 0) {
              previousVolumeRef.current = prev;
              if (audioRef.current) audioRef.current.volume = 0;
              return 0;
            } else {
              const restoreVol = previousVolumeRef.current > 0 ? previousVolumeRef.current : 1;
              if (audioRef.current) audioRef.current.volume = restoreVol;
              return restoreVol;
            }
          });
          break;
        case 'Escape':
          e.preventDefault();
          closeAllUI();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [audioFile, isPlaying, duration, toggleFullscreen, closeAllUI]);

  // Audio time/duration tracking
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration || 0);
    const handleEnded = () => {
      setIsPlaying(false);
      // Auto-play next track if available
      if (savedTracks.length > 0 && currentTrackIndex >= 0 && currentTrackIndex < savedTracks.length - 1) {
        handleNextTrack();
      }
    };
    const handleLoadedMetadata = () => setDuration(audio.duration || 0);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [audioRef.current, savedTracks.length, currentTrackIndex]);

  const handleSeek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  }, []);

  const handlePreviousTrack = useCallback(() => {
    if (savedTracks.length === 0) return;
    
    // If we're more than 3 seconds into the track, restart it
    if (currentTime > 3 && audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    
    // Go to previous track
    const newIndex = currentTrackIndex > 0 ? currentTrackIndex - 1 : savedTracks.length - 1;
    const track = savedTracks[newIndex];
    if (track) {
      loadTrackByIndex(newIndex, track);
    }
  }, [savedTracks, currentTrackIndex, currentTime]);

  const handleNextTrack = useCallback(() => {
    if (savedTracks.length === 0) return;
    
    const newIndex = currentTrackIndex < savedTracks.length - 1 ? currentTrackIndex + 1 : 0;
    const track = savedTracks[newIndex];
    if (track) {
      loadTrackByIndex(newIndex, track);
    }
  }, [savedTracks, currentTrackIndex]);

  const loadTrackByIndex = useCallback(async (index: number, track: SavedTrack) => {
    setAudioFile(track.audioUrl);
    setAudioFileName(track.name);
    setCurrentTrackIndex(index);
    
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    audioRef.current.src = track.audioUrl;
    audioRef.current.volume = volume;
    audioRef.current.load();
    
    if (track.thumbnailUrl) {
      setThumbnailUrl(track.thumbnailUrl);
    }
    if (track.colorPalette) {
      setSettings(prev => ({ ...prev, colorPalette: track.colorPalette! }));
    }
    
    // Auto-play after loading
    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (e) {
      setIsPlaying(false);
    }
  }, [volume]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAudioFile(url);
      setAudioFileName(file.name);
      // Clear previous background so stale artwork does not carry over to a new track.
      setThumbnailUrl(null);
      
      // Create or update audio element
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      audioRef.current.src = url;
      audioRef.current.load();
      setIsPlaying(false);
      
      toast({
        title: "Track Loaded",
        description: `Ready to play: ${file.name}`,
      });
      
      let artworkApplied = false;

      // Attempt server-side extraction first when backend API is available.
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") resolve(reader.result);
            else reject(new Error("Failed to read audio file as data URL"));
          };
          reader.onerror = () => reject(new Error("Failed to read audio file"));
          reader.readAsDataURL(file);
        });

        const base64 = dataUrl.split(",")[1];
        if (base64) {
          const response = await fetch("/api/extract-artwork", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audioBase64: base64 }),
          });
          const contentType = response.headers.get("content-type") ?? "";

          if (response.ok && contentType.includes("application/json")) {
            const data = await response.json();
            if (data.artwork && data.mimeType) {
              const artworkUrl = `data:${data.mimeType};base64,${data.artwork}`;
              setThumbnailUrl(artworkUrl);
              toast({
                title: "Artwork Found",
                description: "Extracted embedded artwork from audio file.",
              });
              artworkApplied = true;
            }
          }
        }
      } catch (error) {
        console.warn("Server artwork extraction unavailable, falling back to client parsing.", error);
      }

      // Fallback: parse artwork directly from the uploaded file in-browser.
      if (!artworkApplied) {
        try {
          const metadata = await parseBlob(file);
          const picture = metadata.common.picture?.[0];
          if (picture?.data && picture.format) {
            const base64 = uint8ArrayToBase64(picture.data);
            const artworkUrl = `data:${picture.format};base64,${base64}`;
            setThumbnailUrl(artworkUrl);
            toast({
              title: "Artwork Found",
              description: "Extracted embedded artwork from uploaded audio.",
            });
            artworkApplied = true;
          }
        } catch (error) {
          console.warn("Client-side artwork parsing failed:", error);
        }
      }

      if (!artworkApplied) {
        toast({
          title: "No Embedded Artwork",
          description: "This track has no embedded cover image. Upload artwork manually.",
        });
      }
    }
  }, [toast]);

  const handleSoundCloudTrack = useCallback(async (streamUrl: string, title: string, artworkUrl?: string) => {
    setAudioFile(streamUrl);
    setAudioFileName(title);
    setCurrentTrackIndex(-1);
    
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    audioRef.current.src = streamUrl;
    audioRef.current.volume = volume;
    audioRef.current.load();
    
    if (artworkUrl) {
      setThumbnailUrl(artworkUrl);
    }
    
    try {
      await audioRef.current.play();
      setIsPlaying(true);
      toast({
        title: "Now Playing",
        description: title,
      });
    } catch (e) {
      console.error("Playback error:", e);
      setIsPlaying(false);
    }
  }, [volume, toast]);

  const togglePlay = useCallback(async () => {
    if (!audioFile || !audioRef.current) {
      toast({
        title: "No Audio",
        description: "Please upload an audio file first.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (e) {
      console.error("Play error:", e);
      toast({
        title: "Playback Error",
        description: "Failed to play audio. Try uploading again.",
        variant: "destructive",
      });
    }
  }, [audioFile, isPlaying, toast]);

  const handleSavePreset = () => {
    createPreset.mutate({
      name: `My ${settings.presetName} Preset`,
      settings: settings,
    }, {
      onSuccess: () => {
        toast({ title: "Preset Saved", description: "Your visual settings have been saved." });
      }
    });
  };

  const handleThumbnailAnalysis = (analysis: ThumbnailAnalysis) => {
    toast({
      title: "AI Analysis Complete",
      description: `Detected theme: ${analysis.theme} | Mood: ${analysis.mood}`,
    });
  };

  const handleThumbnailUpload = (url: string) => {
    setThumbnailUrl(url);
    toast({
      title: "Artwork Applied",
      description: "Background artwork updated.",
    });
  };

  const handleSaveToLibrary = () => {
    if (!audioFile || !audioFileName) {
      toast({
        title: "No Track",
        description: "Please upload an audio file first.",
        variant: "destructive",
      });
      return;
    }

    const newTrack: SavedTrack = {
      id: `track-${Date.now()}`,
      name: audioFileName.replace(/\.[^/.]+$/, ""),
      audioUrl: audioFile,
      thumbnailUrl: thumbnailUrl || undefined,
      colorPalette: settings.colorPalette,
      theme: "custom",
      createdAt: new Date(),
    };

    setSavedTracks(prev => [newTrack, ...prev]);
    toast({
      title: "Track Saved",
      description: `"${newTrack.name}" added to your library.`,
    });
  };

  const handleLoadTrack = (track: SavedTrack) => {
    setAudioFile(track.audioUrl);
    setAudioFileName(track.name);
    
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    audioRef.current.src = track.audioUrl;
    audioRef.current.load();
    
    if (track.thumbnailUrl) {
      setThumbnailUrl(track.thumbnailUrl);
    }
    if (track.colorPalette) {
      setSettings(prev => ({ ...prev, colorPalette: track.colorPalette! }));
    }
    
    setIsPlaying(false);
    setShowLibrary(false);
    
    toast({
      title: "Track Loaded",
      description: `Now playing: ${track.name}`,
    });
  };

  const handleDeleteTrack = (trackId: string) => {
    setSavedTracks(prev => prev.filter(t => t.id !== trackId));
    toast({
      title: "Track Removed",
      description: "Track has been removed from your library.",
    });
  };

  const toggleRecording = async () => {
    if (isRecording) {
      if (!recorderRef.current) return;
      setIsRecording(false);
      toast({ title: "Processing Video", description: "Your recording is being prepared..." });
      try {
        const labels = { "1080p": "1080p", "2k": "2K", "4k": "4K" } as const;
        await recorderRef.current.download(`experience-${labels[recordingQuality]}-${Date.now()}.webm`);
        toast({ title: "Download Started", description: `Your ${labels[recordingQuality]} video has been saved.` });
      } catch (e) {
        console.error("Stop recording failed:", e);
        toast({ title: "Recording Error", description: "Failed to finalize recording.", variant: "destructive" });
      } finally {
        recorderRef.current = null;
      }
    } else {
      const canvas = document.querySelector('canvas');
      if (!canvas) return;

      const qualitySettings = {
        "1080p": { bitrate: 15_000_000, label: "1080p" },
        "2k": { bitrate: 35_000_000, label: "2K" },
        "4k": { bitrate: 50_000_000, label: "4K" }
      };
      
      const settings = qualitySettings[recordingQuality];

      const audioTrack = destNode?.stream.getAudioTracks?.()[0];
      const recorder = createCanvasRecorder(canvas, {
        fps: 60,
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: settings.bitrate,
        audioTrack,
      });

      try {
        await recorder.start();
        recorderRef.current = recorder;
        setIsRecording(true);
        toast({ title: `Recording ${settings.label}`, description: "High quality recording started at 60fps" });
        if (!isPlaying) togglePlay();
      } catch (e) {
        console.error("Start recording failed:", e);
        toast({ title: "Recording Error", description: "Failed to start recording.", variant: "destructive" });
      }
    }
  };

  return (
    <div 
      className="w-full h-screen relative bg-background overflow-hidden selection:bg-primary/30"
      data-testid="app-root"
      onMouseMove={markUiActivity}
    >
      
      {/* Background Thumbnail Layer */}
      {thumbnailUrl && (
        <div 
          className="absolute inset-0 z-0 opacity-20 blur-xl"
          style={{
            backgroundImage: `url(${thumbnailUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}
      
      {/* 3D Visualizer Layer */}
      <AudioVisualizer 
        getAudioData={getReactiveAudioData}
        settings={settings}
        backgroundImage={thumbnailUrl}
        zoom={visualizationZoom}
        fractalUniforms={fractalUniforms}
        renderProfile={renderProfile}
        adaptiveQualityTier={adaptiveQualityTier}
      />

      <div className="pointer-events-none absolute right-3 top-3 z-30 rounded-md border border-white/15 bg-black/45 px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-white/85">
        <span className="font-semibold">Quality:</span> {renderProfileLabel}{" "}
        <span className="text-white/60">Tier {adaptiveQualityTier}</span>
      </div>

      {/* Canvas Click Catcher - covers visualization area, sits below UI panels */}
      <div
        ref={screenZoomLayerRef}
        className="absolute inset-0 z-10"
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={handleCanvasPointerUp}
        onClick={handleCanvasClick}
        onDoubleClick={handleCanvasDoubleClick}
        onTouchStart={handleScreenTouchStart}
        onTouchMove={handleScreenTouchMove}
        onTouchEnd={handleScreenTouchEnd}
        onTouchCancel={handleScreenTouchEnd}
        style={{ pointerEvents: 'auto', touchAction: "none" }}
        data-testid="canvas-click-catcher"
      />

      <div className={uiAutoHidden ? "opacity-0 pointer-events-none transition-opacity duration-300" : "opacity-100 transition-opacity duration-300"}>
        {/* UI Overlay */}
        <UIControls 
          isPlaying={isPlaying}
          onPlayPause={togglePlay}
          onFileUpload={handleFileUpload}
          settings={settings}
          setSettings={setSettings}
          colorSettings={colorSettings}
          setColorSettings={setColorSettings}
          isRecording={isRecording}
          onToggleRecording={toggleRecording}
          recordingQuality={recordingQuality}
          onRecordingQualityChange={setRecordingQuality}
          onSavePreset={handleSavePreset}
          onThumbnailAnalysis={handleThumbnailAnalysis}
          onThumbnailUpload={handleThumbnailUpload}
          thumbnailUrl={thumbnailUrl}
          onSaveToLibrary={handleSaveToLibrary}
          onToggleLibrary={() => setShowLibrary(!showLibrary)}
          onToggleSoundCloud={() => setShowSoundCloud(!showSoundCloud)}
          activeTab={activeTab}
          onActiveTabChange={setActiveTab}
          trackName={audioFileName}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          zoom={visualizationZoom}
          onZoomChange={setVisualizationZoom}
          currentTime={currentTime}
          duration={duration}
          onSeek={handleSeek}
          volume={volume}
          onVolumeChange={handleVolumeChange}
          onPreviousTrack={handlePreviousTrack}
          onNextTrack={handleNextTrack}
          hasLibraryTracks={savedTracks.length > 0}
          fractalSpecs={fractalSpecs}
          fractalMacros={fractalMacros}
          fractalUniforms={fractalUniforms}
          onFractalUniformChange={setFractalUniform}
          micStatus={micStatus}
          onToggleMicReactivity={toggleMicReactivity}
        />
        
        {/* Track Library Panel */}
        <AnimatePresence>
          {showLibrary && (
            <TrackLibrary 
              tracks={savedTracks}
              onLoadTrack={handleLoadTrack}
              onDeleteTrack={handleDeleteTrack}
              onClose={() => setShowLibrary(false)}
            />
          )}
        </AnimatePresence>
        
        {/* SoundCloud Panel */}
        <SoundCloudPanel
          isOpen={showSoundCloud}
          onClose={() => setShowSoundCloud(false)}
          onPlayTrack={handleSoundCloudTrack}
        />
      </div>
      
    </div>
  );
}
