import { useState, useRef, useCallback, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { PsyDomainWarp, defaultDomainWarpParams, type DomainWarpParams } from "@/components/PsyDomainWarp";
import { PsyMandala, defaultMandalaParams, type MandalaParams } from "@/components/PsyMandala";
import { PsyFractalFlame, defaultFractalFlameParams, FLAME_VARIATION_NAMES, type FractalFlameParams } from "@/components/PsyFractalFlame";
import { PsyVoronoi, defaultVoronoiParams, VORONOI_MODE_NAMES, type VoronoiParams } from "@/components/PsyVoronoi";
import { psyPalettes, type PsyPalette } from "@/lib/psyPalettes";
import {
  type EngineType,
  type PsyPresetEntry,
  type SweepConfig,
  type GalleryItem,
  type PrintSize,
  PRINT_SIZES,
  createPresetPack,
  downloadPackJSON,
  importPackJSON,
  generateSweepVariants,
  generateRandomDesign,
  encodeParamsToHash,
  decodeParamsFromHash,
  loadGallery,
  saveGallery,
  addToGallery,
  rehydrateGalleryParams,
} from "@/lib/psyPresetPack";

const ENGINE_LABELS: Record<EngineType, string> = {
  "domain-warp": "Domain Warp",
  "mandala": "Mandala",
  "fractal-flame": "Fractal Flame",
  "voronoi": "Voronoi",
};

type StudioTab = "design" | "sweep" | "presets" | "gallery" | "record";

// --- Reusable Controls ---

function SliderControl({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-zinc-400">
        <span>{label}</span>
        <span>{typeof step === "number" && step < 1 ? value.toFixed(1) : value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
      />
    </div>
  );
}

function ButtonSelector({ label, options, value, onChange }: {
  label: string; options: string[]; value: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-zinc-400">{label}</span>
      <div className="flex gap-1 flex-wrap">
        {options.map((opt, i) => (
          <button key={i} onClick={() => onChange(i)}
            className={`py-1 px-2 rounded text-xs ${
              value === i ? "bg-purple-600 text-white" : "bg-zinc-800 text-zinc-400"
            }`}
          >{opt}</button>
        ))}
      </div>
    </div>
  );
}

function PaletteSelector({ selected, onSelect }: {
  selected: PsyPalette; onSelect: (p: PsyPalette) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-zinc-400 uppercase tracking-wide">Palette</span>
      <div className="grid grid-cols-3 gap-1.5">
        {psyPalettes.map((pal) => {
          const isActive = pal.id === selected.id;
          const colors = [0, 0.2, 0.4, 0.6, 0.8].map((t) => {
            const r = Math.round((pal.a[0] + pal.b[0] * Math.cos(6.28 * (pal.c[0] * t + pal.d[0]))) * 255);
            const g = Math.round((pal.a[1] + pal.b[1] * Math.cos(6.28 * (pal.c[1] * t + pal.d[1]))) * 255);
            const b = Math.round((pal.a[2] + pal.b[2] * Math.cos(6.28 * (pal.c[2] * t + pal.d[2]))) * 255);
            return `rgb(${Math.min(255, Math.max(0, r))},${Math.min(255, Math.max(0, g))},${Math.min(255, Math.max(0, b))})`;
          });
          const gradient = `linear-gradient(90deg, ${colors.join(", ")})`;
          return (
            <button key={pal.id} onClick={() => onSelect(pal)}
              className={`rounded p-0.5 border-2 transition-all ${
                isActive ? "border-purple-400 scale-105" : "border-zinc-700 hover:border-zinc-500"
              }`}
            >
              <div className="h-5 rounded-sm" style={{ background: gradient }} />
              <div className="text-[10px] text-zinc-400 mt-0.5 truncate">{pal.name}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- Sweep Panel ---

function SweepPanel({ engine, baseParams, onRunSweep, exporting }: {
  engine: EngineType;
  baseParams: any;
  onRunSweep: (config: SweepConfig) => void;
  exporting: boolean;
}) {
  const [seedCount, setSeedCount] = useState(5);
  const [seedStart, setSeedStart] = useState(baseParams.seed || 100);
  const [seedStep, setSeedStep] = useState(1000);
  const [symmetryValues, setSymmetryValues] = useState("3,6,8,12");
  const [sweepPalettes, setSweepPalettes] = useState<Set<string>>(new Set(["dmt-hyperspace", "acid-neon", "crystal-cave"]));
  const [variantCount, setVariantCount] = useState(0);

  const seeds = Array.from({ length: seedCount }, (_, i) => seedStart + i * seedStep);
  const symVals = symmetryValues.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n));
  const selectedPalettes = psyPalettes.filter((p) => sweepPalettes.has(p.id));

  useEffect(() => {
    const total = Math.max(1, seeds.length) * Math.max(1, symVals.length) * Math.max(1, selectedPalettes.length);
    setVariantCount(total);
  }, [seeds, symVals, selectedPalettes]);

  const togglePalette = (id: string) => {
    setSweepPalettes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const run = () => {
    onRunSweep({
      engine,
      baseParams,
      axes: symVals.length > 0 ? [{ param: "symmetry", values: symVals }] : [],
      palettes: selectedPalettes,
      seeds,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs text-zinc-400 uppercase tracking-wide">Parameter Sweep</span>
      <div className="flex flex-col gap-2 bg-zinc-800/50 rounded p-3">
        <span className="text-xs text-zinc-300 font-medium">Seeds</span>
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-500">Count</span>
            <input type="number" value={seedCount} min={1} max={20}
              onChange={(e) => setSeedCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
              className="bg-zinc-700 text-white text-xs px-2 py-1 rounded border border-zinc-600" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-500">Start</span>
            <input type="number" value={seedStart}
              onChange={(e) => setSeedStart(parseInt(e.target.value) || 0)}
              className="bg-zinc-700 text-white text-xs px-2 py-1 rounded border border-zinc-600" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-zinc-500">Step</span>
            <input type="number" value={seedStep}
              onChange={(e) => setSeedStep(parseInt(e.target.value) || 100)}
              className="bg-zinc-700 text-white text-xs px-2 py-1 rounded border border-zinc-600" />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2 bg-zinc-800/50 rounded p-3">
        <span className="text-xs text-zinc-300 font-medium">Symmetry Values</span>
        <input type="text" value={symmetryValues}
          onChange={(e) => setSymmetryValues(e.target.value)} placeholder="3,6,8,12"
          className="bg-zinc-700 text-white text-xs px-2 py-1 rounded border border-zinc-600" />
        <span className="text-[10px] text-zinc-500">Comma-separated values</span>
      </div>
      <div className="flex flex-col gap-2 bg-zinc-800/50 rounded p-3">
        <span className="text-xs text-zinc-300 font-medium">Palettes</span>
        <div className="grid grid-cols-2 gap-1">
          {psyPalettes.map((pal) => {
            const active = sweepPalettes.has(pal.id);
            const colors = [0, 0.25, 0.5, 0.75, 1].map((t) => {
              const r = Math.round((pal.a[0] + pal.b[0] * Math.cos(6.28 * (pal.c[0] * t + pal.d[0]))) * 255);
              const g = Math.round((pal.a[1] + pal.b[1] * Math.cos(6.28 * (pal.c[1] * t + pal.d[1]))) * 255);
              const b = Math.round((pal.a[2] + pal.b[2] * Math.cos(6.28 * (pal.c[2] * t + pal.d[2]))) * 255);
              return `rgb(${Math.min(255, Math.max(0, r))},${Math.min(255, Math.max(0, g))},${Math.min(255, Math.max(0, b))})`;
            });
            return (
              <button key={pal.id} onClick={() => togglePalette(pal.id)}
                className={`flex items-center gap-1.5 rounded px-2 py-1 border text-[10px] ${
                  active ? "border-purple-400 bg-purple-900/30" : "border-zinc-700 bg-zinc-800"
                }`}
              >
                <div className="w-8 h-3 rounded-sm flex-shrink-0"
                  style={{ background: `linear-gradient(90deg, ${colors.join(", ")})` }} />
                <span className="truncate text-zinc-300">{pal.name}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="bg-zinc-800 rounded p-3 text-center">
        <span className="text-sm text-purple-300 font-medium">{variantCount} variants</span>
        <span className="text-[10px] text-zinc-500 block">
          {seeds.length} seeds x {symVals.length || 1} symmetry x {selectedPalettes.length || 1} palettes
        </span>
      </div>
      <button onClick={run} disabled={exporting || variantCount === 0}
        className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 rounded font-medium text-sm transition-colors"
      >{exporting ? `Exporting...` : `Run Sweep (${variantCount} PNGs)`}</button>
    </div>
  );
}

// --- Preset Pack Panel ---

function PresetPackPanel({ engine, currentParams, savedPresets, onSave, onLoad, onRemove, onExportPack, onImportPack }: {
  engine: EngineType;
  currentParams: any;
  savedPresets: PsyPresetEntry[];
  onSave: (name: string) => void;
  onLoad: (entry: PsyPresetEntry) => void;
  onRemove: (index: number) => void;
  onExportPack: () => void;
  onImportPack: (json: string) => void;
}) {
  const [presetName, setPresetName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onImportPack(reader.result);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs text-zinc-400 uppercase tracking-wide">Preset Packs</span>
      <div className="flex gap-2">
        <input type="text" value={presetName} onChange={(e) => setPresetName(e.target.value)}
          placeholder="Preset name..."
          className="flex-1 bg-zinc-800 text-white text-sm px-2 py-1.5 rounded border border-zinc-700" />
        <button onClick={() => { if (presetName.trim()) { onSave(presetName.trim()); setPresetName(""); } }}
          disabled={!presetName.trim()}
          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 rounded text-xs font-medium"
        >Save</button>
      </div>
      {savedPresets.length > 0 && (
        <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto">
          {savedPresets.map((entry, i) => (
            <div key={i} className="flex items-center gap-2 bg-zinc-800 rounded px-2 py-1.5">
              <span className="text-[10px] text-purple-400 uppercase w-10 flex-shrink-0">{entry.engine.slice(0, 4)}</span>
              <span className="text-xs text-zinc-200 flex-1 truncate">{entry.name}</span>
              <button onClick={() => onLoad(entry)} className="text-[10px] text-green-400 hover:text-green-300">Load</button>
              <button onClick={() => onRemove(i)} className="text-[10px] text-red-400 hover:text-red-300">X</button>
            </div>
          ))}
        </div>
      )}
      {savedPresets.length === 0 && (
        <div className="text-xs text-zinc-500 text-center py-4">No saved presets yet</div>
      )}
      <div className="flex flex-col gap-2 border-t border-zinc-800 pt-3">
        <button onClick={onExportPack} disabled={savedPresets.length === 0}
          className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-600 rounded text-sm text-zinc-300 transition-colors"
        >Export Pack (.json)</button>
        <button onClick={() => fileInputRef.current?.click()}
          className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm text-zinc-300 transition-colors"
        >Import Pack (.json)</button>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
      </div>
    </div>
  );
}

// --- Gallery Panel ---

function GalleryPanel({ gallery, onLoad, onToggleFavorite, onDelete, showFavoritesOnly }: {
  gallery: GalleryItem[];
  onLoad: (item: GalleryItem) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  showFavoritesOnly: boolean;
}) {
  const [favOnly, setFavOnly] = useState(showFavoritesOnly);
  const filtered = favOnly ? gallery.filter((g) => g.favorite) : gallery;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400 uppercase tracking-wide">Gallery ({gallery.length})</span>
        <button onClick={() => setFavOnly(!favOnly)}
          className={`text-[10px] px-2 py-0.5 rounded ${favOnly ? "bg-yellow-600 text-white" : "bg-zinc-800 text-zinc-400"}`}
        >{favOnly ? "Favorites" : "All"}</button>
      </div>

      {filtered.length === 0 && (
        <div className="text-xs text-zinc-500 text-center py-8">
          {favOnly ? "No favorites yet" : "Snapshot designs to build your gallery"}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">
        {filtered.map((item) => (
          <div key={item.id} className="relative group rounded overflow-hidden border border-zinc-700 hover:border-purple-500 transition-colors">
            <img src={item.thumbnail} alt="" className="w-full aspect-square object-cover" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
              <button onClick={() => onLoad(item)}
                className="text-[10px] bg-purple-600 hover:bg-purple-500 px-2 py-1 rounded">Load</button>
              <div className="flex gap-1">
                <button onClick={() => onToggleFavorite(item.id)}
                  className={`text-[10px] px-2 py-0.5 rounded ${item.favorite ? "bg-yellow-600" : "bg-zinc-700"}`}
                >{item.favorite ? "Unfav" : "Fav"}</button>
                <button onClick={() => onDelete(item.id)}
                  className="text-[10px] bg-red-800 hover:bg-red-700 px-2 py-0.5 rounded">Del</button>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1.5 py-0.5">
              <span className="text-[9px] text-zinc-400">{ENGINE_LABELS[item.engine]} #{item.params.seed}</span>
            </div>
            {item.favorite && (
              <div className="absolute top-1 right-1 text-yellow-400 text-[10px]">*</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Record Panel ---

function RecordPanel() {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(10);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    const stream = canvas.captureStream(30);
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `psy-wallpaper-${Date.now()}.webm`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      setRecording(false);
    };
    recorder.start(100);
    mediaRecorderRef.current = recorder;
    setRecording(true);
    setTimeout(() => {
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    }, duration * 1000);
  }, [duration]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs text-zinc-400 uppercase tracking-wide">Video Recording</span>
      <SliderControl label="Duration (seconds)" value={duration} min={3} max={60} step={1} onChange={(v) => setDuration(v)} />
      <div className="bg-zinc-800/50 rounded p-3 text-xs text-zinc-400">
        <div>Format: WebM (VP9) | 8 Mbps | 30 FPS</div>
        <div className="mt-1 text-zinc-500">For TikTok, Reels, or animated wallpaper previews</div>
      </div>
      {!recording ? (
        <button onClick={startRecording}
          className="w-full py-2.5 bg-red-600 hover:bg-red-500 rounded font-medium text-sm transition-colors"
        >Start Recording ({duration}s)</button>
      ) : (
        <button onClick={stopRecording}
          className="w-full py-2.5 bg-red-800 animate-pulse rounded font-medium text-sm transition-colors"
        >Stop Recording</button>
      )}
    </div>
  );
}

// --- Main Studio ---

export default function WallpaperStudio() {
  const [tab, setTab] = useState<StudioTab>("design");
  const [engine, setEngine] = useState<EngineType>("domain-warp");
  const [warpParams, setWarpParams] = useState<DomainWarpParams>({ ...defaultDomainWarpParams });
  const [mandalaParams, setMandalaParams] = useState<MandalaParams>({ ...defaultMandalaParams });
  const [flameParams, setFlameParams] = useState<FractalFlameParams>({ ...defaultFractalFlameParams });
  const [voronoiParams, setVoronoiParams] = useState<VoronoiParams>({ ...defaultVoronoiParams });
  const [exportSize, setExportSize] = useState<PrintSize>(PRINT_SIZES[0]);
  const [sizeCategory, setSizeCategory] = useState<"screen" | "print">("screen");
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [gallery, setGallery] = useState<GalleryItem[]>(() => loadGallery());
  const [savedPresets, setSavedPresets] = useState<PsyPresetEntry[]>(() => {
    try {
      const saved = localStorage.getItem("psy-saved-presets");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Persist saved presets
  useEffect(() => {
    localStorage.setItem("psy-saved-presets", JSON.stringify(savedPresets));
  }, [savedPresets]);

  // Load from URL hash on mount
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const decoded = decodeParamsFromHash(hash);
      if (decoded) {
        setEngine(decoded.engine);
        setParamsForEngine(decoded.engine, decoded.params);
      }
    }
  }, []);

  const updateWarp = useCallback((key: keyof DomainWarpParams, value: any) => {
    setWarpParams((prev) => ({ ...prev, [key]: value }));
  }, []);
  const updateMandala = useCallback((key: keyof MandalaParams, value: any) => {
    setMandalaParams((prev) => ({ ...prev, [key]: value }));
  }, []);
  const updateFlame = useCallback((key: keyof FractalFlameParams, value: any) => {
    setFlameParams((prev) => ({ ...prev, [key]: value }));
  }, []);
  const updateVoronoi = useCallback((key: keyof VoronoiParams, value: any) => {
    setVoronoiParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  const currentParams = (): any => {
    switch (engine) {
      case "domain-warp": return warpParams;
      case "mandala": return mandalaParams;
      case "fractal-flame": return flameParams;
      case "voronoi": return voronoiParams;
    }
  };

  const setParamsForEngine = (eng: EngineType, params: any) => {
    switch (eng) {
      case "domain-warp": setWarpParams(params); break;
      case "mandala": setMandalaParams(params); break;
      case "fractal-flame": setFlameParams(params); break;
      case "voronoi": setVoronoiParams(params); break;
    }
  };

  const currentPalette = currentParams().palette;

  const setSeed = (seed: number) => {
    switch (engine) {
      case "domain-warp": updateWarp("seed", seed); break;
      case "mandala": updateMandala("seed", seed); break;
      case "fractal-flame": updateFlame("seed", seed); break;
      case "voronoi": updateVoronoi("seed", seed); break;
    }
  };

  const randomizeSeed = useCallback(() => {
    setSeed(Math.floor(Math.random() * 99999));
  }, [engine]);

  const setCurrentPalette = (p: PsyPalette) => {
    switch (engine) {
      case "domain-warp": updateWarp("palette", p); break;
      case "mandala": updateMandala("palette", p); break;
      case "fractal-flame": updateFlame("palette", p); break;
      case "voronoi": updateVoronoi("palette", p); break;
    }
  };

  // --- Discover Mode ---
  const discover = useCallback(() => {
    const { engine: newEngine, params } = generateRandomDesign();
    setEngine(newEngine);
    setParamsForEngine(newEngine, params);
  }, []);

  // --- Share Link ---
  const copyShareLink = useCallback(() => {
    const hash = encodeParamsToHash(engine, currentParams());
    const url = `${window.location.origin}${window.location.pathname}${hash}`;
    navigator.clipboard.writeText(url).then(() => {
      window.location.hash = hash.slice(1);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }, [engine, warpParams, mandalaParams, flameParams, voronoiParams]);

  // --- Snapshot to Gallery ---
  const snapshotToGallery = useCallback(async () => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    await new Promise((r) => setTimeout(r, 50));
    // Create small thumbnail
    const thumbCanvas = document.createElement("canvas");
    thumbCanvas.width = 200;
    thumbCanvas.height = 200;
    const ctx = thumbCanvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(canvas, 0, 0, 200, 200);
    const thumbnail = thumbCanvas.toDataURL("image/jpeg", 0.7);
    const item = addToGallery(engine, currentParams(), thumbnail);
    setGallery(loadGallery());
  }, [engine, warpParams, mandalaParams, flameParams, voronoiParams]);

  // --- Gallery actions ---
  const toggleFavorite = useCallback((id: string) => {
    const items = loadGallery().map((g) => g.id === id ? { ...g, favorite: !g.favorite } : g);
    saveGallery(items);
    setGallery(items);
  }, []);

  const deleteFromGallery = useCallback((id: string) => {
    const items = loadGallery().filter((g) => g.id !== id);
    saveGallery(items);
    setGallery(items);
  }, []);

  const loadFromGallery = useCallback((item: GalleryItem) => {
    const params = rehydrateGalleryParams(item);
    setEngine(item.engine);
    setParamsForEngine(item.engine, params);
    setTab("design");
  }, []);

  // --- Export ---
  const exportPNG = useCallback(async () => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;
    setExporting(true);
    await new Promise((r) => setTimeout(r, 100));
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `psy-${engine}-seed${currentParams().seed}-${exportSize.label.replace(/["\s]/g, "")}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error("Export failed:", e);
    }
    setExporting(false);
  }, [engine, warpParams, mandalaParams, flameParams, voronoiParams, exportSize]);

  // --- Sweep Export ---
  const runSweepExport = useCallback(async (config: SweepConfig) => {
    const variants = generateSweepVariants(config);
    if (variants.length === 0) return;
    setExporting(true);
    let exported = 0;
    for (const variant of variants) {
      setExportProgress(`${exported + 1} / ${variants.length}`);
      setParamsForEngine(config.engine, variant.params);
      await new Promise((r) => setTimeout(r, 400));
      const canvas = document.querySelector("canvas");
      if (!canvas) break;
      try {
        const dataUrl = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.download = `psy-${config.engine}-${variant.label}-${exportSize.label.replace(/["\s]/g, "")}.png`;
        link.href = dataUrl;
        link.click();
      } catch { break; }
      exported++;
      await new Promise((r) => setTimeout(r, 200));
    }
    setExporting(false);
    setExportProgress("");
  }, [exportSize]);

  // --- Preset Pack ---
  const savePreset = useCallback((name: string) => {
    const entry: PsyPresetEntry = { name, engine, params: { ...currentParams() } };
    setSavedPresets((prev) => [...prev, entry]);
  }, [engine, warpParams, mandalaParams, flameParams, voronoiParams]);

  const loadPreset = useCallback((entry: PsyPresetEntry) => {
    setEngine(entry.engine);
    setParamsForEngine(entry.engine, { ...entry.params });
  }, []);

  const removePreset = useCallback((index: number) => {
    setSavedPresets((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const exportPack = useCallback(() => {
    const pack = createPresetPack("PSY Preset Pack", "PSY Studio", "Custom preset collection", savedPresets);
    downloadPackJSON(pack);
  }, [savedPresets]);

  const importPack = useCallback((json: string) => {
    const pack = importPackJSON(json);
    if (pack) setSavedPresets((prev) => [...prev, ...pack.presets]);
  }, []);

  // --- Batch Export ---
  const batchExport = useCallback(async () => {
    setExporting(true);
    const baseSeed = currentParams().seed;
    for (let i = 0; i < 10; i++) {
      const seed = baseSeed + i * 1000;
      setExportProgress(`${i + 1} / 10`);
      setSeed(seed);
      await new Promise((r) => setTimeout(r, 300));
      const canvas = document.querySelector("canvas");
      if (!canvas) break;
      try {
        const dataUrl = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.download = `psy-${engine}-seed${seed}-${exportSize.label.replace(/["\s]/g, "")}.png`;
        link.href = dataUrl;
        link.click();
      } catch { break; }
      await new Promise((r) => setTimeout(r, 200));
    }
    setExporting(false);
    setExportProgress("");
  }, [engine, warpParams, mandalaParams, flameParams, voronoiParams, exportSize]);

  const TABS: { id: StudioTab; label: string }[] = [
    { id: "design", label: "Design" },
    { id: "sweep", label: "Sweep" },
    { id: "presets", label: "Presets" },
    { id: "gallery", label: "Gallery" },
    { id: "record", label: "Record" },
  ];

  const screenSizes = PRINT_SIZES.filter((s) => s.category === "screen");
  const printSizes = PRINT_SIZES.filter((s) => s.category === "print");
  const activeSizes = sizeCategory === "screen" ? screenSizes : printSizes;

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden">
      {/* Left panel */}
      <div className="w-80 flex-shrink-0 bg-zinc-900 border-r border-zinc-800 overflow-y-auto p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight">PSY Studio</h1>
          <a href="/" className="text-xs text-zinc-500 hover:text-zinc-300">Back</a>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0.5 bg-zinc-800 rounded p-0.5">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 py-1.5 rounded text-[11px] font-medium transition-all ${
                tab === t.id ? "bg-purple-600 text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >{t.label}</button>
          ))}
        </div>

        {/* Engine + Discover */}
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(ENGINE_LABELS) as EngineType[]).map((e) => (
              <button key={e} onClick={() => setEngine(e)}
                className={`py-2 px-3 rounded text-sm font-medium transition-all ${
                  engine === e ? "bg-purple-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >{ENGINE_LABELS[e]}</button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <button onClick={discover}
              className="flex-1 py-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 rounded text-sm font-medium transition-all"
            >Discover</button>
            <button onClick={snapshotToGallery}
              className="py-2 px-3 bg-zinc-800 hover:bg-zinc-700 rounded text-sm transition-all" title="Save to gallery"
            >+</button>
            <button onClick={copyShareLink}
              className={`py-2 px-3 rounded text-sm transition-all ${linkCopied ? "bg-green-700" : "bg-zinc-800 hover:bg-zinc-700"}`}
              title="Copy share link"
            >{linkCopied ? "Copied" : "Link"}</button>
          </div>
        </div>

        {/* Tab content */}
        {tab === "design" && (
          <>
            <PaletteSelector selected={currentPalette} onSelect={setCurrentPalette} />

            <div className="flex flex-col gap-3 border-t border-zinc-800 pt-3">
              <span className="text-xs text-zinc-400 uppercase tracking-wide">Parameters</span>

              {engine === "domain-warp" && (
                <>
                  <SliderControl label="Symmetry" value={warpParams.symmetry} min={1} max={24} step={1} onChange={(v) => updateWarp("symmetry", v)} />
                  <SliderControl label="Warp Strength" value={warpParams.warpStrength} min={0} max={10} step={0.1} onChange={(v) => updateWarp("warpStrength", v)} />
                  <SliderControl label="Warp Layers" value={warpParams.warpLayers} min={1} max={3} step={1} onChange={(v) => updateWarp("warpLayers", v)} />
                  <SliderControl label="Noise Scale" value={warpParams.noiseScale} min={0.5} max={8} step={0.1} onChange={(v) => updateWarp("noiseScale", v)} />
                  <SliderControl label="Octaves" value={warpParams.noiseOctaves} min={1} max={8} step={1} onChange={(v) => updateWarp("noiseOctaves", v)} />
                  <SliderControl label="Zoom" value={warpParams.zoom} min={0.1} max={10} step={0.1} onChange={(v) => updateWarp("zoom", v)} />
                  <SliderControl label="Rotation" value={warpParams.rotation} min={0} max={360} step={1} onChange={(v) => updateWarp("rotation", v)} />
                  <SliderControl label="Speed" value={warpParams.speed} min={0} max={2} step={0.1} onChange={(v) => updateWarp("speed", v)} />
                </>
              )}
              {engine === "mandala" && (
                <>
                  <SliderControl label="Symmetry" value={mandalaParams.symmetry} min={2} max={24} step={1} onChange={(v) => updateMandala("symmetry", v)} />
                  <SliderControl label="Rings" value={mandalaParams.ringCount} min={1} max={12} step={1} onChange={(v) => updateMandala("ringCount", v)} />
                  <SliderControl label="Complexity" value={mandalaParams.complexity} min={1} max={10} step={0.5} onChange={(v) => updateMandala("complexity", v)} />
                  <SliderControl label="Zoom" value={mandalaParams.zoom} min={0.1} max={10} step={0.1} onChange={(v) => updateMandala("zoom", v)} />
                  <SliderControl label="Rotation" value={mandalaParams.rotation} min={0} max={360} step={1} onChange={(v) => updateMandala("rotation", v)} />
                  <SliderControl label="Speed" value={mandalaParams.speed} min={0} max={2} step={0.1} onChange={(v) => updateMandala("speed", v)} />
                  <ButtonSelector label="Inner Pattern" options={["fBm", "Voronoi", "Spirals"]} value={mandalaParams.innerPattern} onChange={(v) => updateMandala("innerPattern", v)} />
                </>
              )}
              {engine === "fractal-flame" && (
                <>
                  <ButtonSelector label="Variation" options={FLAME_VARIATION_NAMES} value={flameParams.variation} onChange={(v) => updateFlame("variation", v)} />
                  <SliderControl label="Symmetry" value={flameParams.symmetry} min={1} max={12} step={1} onChange={(v) => updateFlame("symmetry", v)} />
                  <SliderControl label="Iterations" value={flameParams.iterations} min={5} max={20} step={1} onChange={(v) => updateFlame("iterations", v)} />
                  <SliderControl label="Spread" value={flameParams.spread} min={0.5} max={5} step={0.1} onChange={(v) => updateFlame("spread", v)} />
                  <SliderControl label="Zoom" value={flameParams.zoom} min={0.1} max={10} step={0.1} onChange={(v) => updateFlame("zoom", v)} />
                  <SliderControl label="Rotation" value={flameParams.rotation} min={0} max={360} step={1} onChange={(v) => updateFlame("rotation", v)} />
                  <SliderControl label="Speed" value={flameParams.speed} min={0} max={2} step={0.1} onChange={(v) => updateFlame("speed", v)} />
                </>
              )}
              {engine === "voronoi" && (
                <>
                  <ButtonSelector label="Mode" options={VORONOI_MODE_NAMES} value={voronoiParams.mode} onChange={(v) => updateVoronoi("mode", v)} />
                  <SliderControl label="Cell Scale" value={voronoiParams.cellScale} min={2} max={30} step={1} onChange={(v) => updateVoronoi("cellScale", v)} />
                  <SliderControl label="Symmetry" value={voronoiParams.symmetry} min={1} max={24} step={1} onChange={(v) => updateVoronoi("symmetry", v)} />
                  <SliderControl label="Edge Width" value={voronoiParams.edgeWidth} min={0} max={1} step={0.05} onChange={(v) => updateVoronoi("edgeWidth", v)} />
                  <SliderControl label="Warp Strength" value={voronoiParams.warpStrength} min={0} max={5} step={0.1} onChange={(v) => updateVoronoi("warpStrength", v)} />
                  <SliderControl label="Zoom" value={voronoiParams.zoom} min={0.1} max={10} step={0.1} onChange={(v) => updateVoronoi("zoom", v)} />
                  <SliderControl label="Rotation" value={voronoiParams.rotation} min={0} max={360} step={1} onChange={(v) => updateVoronoi("rotation", v)} />
                  <SliderControl label="Speed" value={voronoiParams.speed} min={0} max={2} step={0.1} onChange={(v) => updateVoronoi("speed", v)} />
                </>
              )}

              {/* Seed */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 w-12">Seed</span>
                <input type="number" value={currentParams().seed}
                  onChange={(e) => setSeed(parseInt(e.target.value) || 0)}
                  className="flex-1 bg-zinc-800 text-white text-sm px-2 py-1 rounded border border-zinc-700" />
                <button onClick={randomizeSeed} className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs">Random</button>
              </div>
            </div>

            {/* Export */}
            <div className="flex flex-col gap-2 border-t border-zinc-800 pt-3 mt-auto">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 uppercase tracking-wide">Export</span>
                <div className="flex gap-1">
                  <button onClick={() => setSizeCategory("screen")}
                    className={`text-[10px] px-2 py-0.5 rounded ${sizeCategory === "screen" ? "bg-purple-600 text-white" : "bg-zinc-800 text-zinc-400"}`}
                  >Screen</button>
                  <button onClick={() => setSizeCategory("print")}
                    className={`text-[10px] px-2 py-0.5 rounded ${sizeCategory === "print" ? "bg-purple-600 text-white" : "bg-zinc-800 text-zinc-400"}`}
                  >Print</button>
                </div>
              </div>
              <div className="flex gap-1 flex-wrap">
                {activeSizes.map((size) => (
                  <button key={size.label} onClick={() => setExportSize(size)}
                    className={`py-1 px-2 rounded text-[10px] ${
                      exportSize.label === size.label ? "bg-purple-600 text-white" : "bg-zinc-800 text-zinc-400"
                    }`}
                  >{size.label}</button>
                ))}
              </div>
              <button onClick={exportPNG} disabled={exporting}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 rounded font-medium text-sm transition-colors"
              >{exporting ? "Exporting..." : "Export PNG"}</button>
              <button onClick={batchExport} disabled={exporting}
                className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800 rounded text-sm text-zinc-300 transition-colors"
              >{exporting ? `Generating... ${exportProgress}` : "Batch Export (10 variants)"}</button>
            </div>
          </>
        )}

        {tab === "sweep" && (
          <SweepPanel engine={engine} baseParams={currentParams()} onRunSweep={runSweepExport} exporting={exporting} />
        )}

        {tab === "presets" && (
          <PresetPackPanel
            engine={engine} currentParams={currentParams()} savedPresets={savedPresets}
            onSave={savePreset} onLoad={loadPreset} onRemove={removePreset}
            onExportPack={exportPack} onImportPack={importPack}
          />
        )}

        {tab === "gallery" && (
          <GalleryPanel
            gallery={gallery}
            onLoad={loadFromGallery}
            onToggleFavorite={toggleFavorite}
            onDelete={deleteFromGallery}
            showFavoritesOnly={false}
          />
        )}

        {tab === "record" && <RecordPanel />}
      </div>

      {/* Main canvas */}
      <div className="flex-1 relative">
        <Canvas
          gl={{ preserveDrawingBuffer: true, antialias: true, powerPreference: "high-performance", alpha: false }}
          style={{ width: "100%", height: "100%" }}
        >
          {engine === "domain-warp" && <PsyDomainWarp params={warpParams} />}
          {engine === "mandala" && <PsyMandala params={mandalaParams} />}
          {engine === "fractal-flame" && <PsyFractalFlame params={flameParams} />}
          {engine === "voronoi" && <PsyVoronoi params={voronoiParams} />}
        </Canvas>

        {/* Info overlay */}
        <div className="absolute bottom-4 right-4 text-xs text-zinc-500 bg-black/50 px-3 py-1.5 rounded">
          {exportSize.width} x {exportSize.height} | Seed: {currentParams().seed}
          {sizeCategory === "print" && <span className="ml-1 text-amber-500">PRINT</span>}
          {exportProgress && <span className="ml-2 text-purple-400">| {exportProgress}</span>}
        </div>
      </div>
    </div>
  );
}
