import { useState, useRef, useCallback, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Upload, Save, Disc as DiscIcon, ImagePlus, Sparkles, Loader2, Library, FolderPlus, ChevronUp, ChevronDown, Settings, Maximize, Minimize, ZoomIn, Cloud, Pin, PinOff, Plus, Minus, SkipBack, SkipForward, Music } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ControlPanel as FractalControlPanel } from "@/engine/presets/ControlPanel";
import { PerformOverlay as FractalPerformOverlay } from "@/engine/presets/PerformOverlay";
import { 
  colorPalettes, 
  presets,
  presetCategories,
  imageFilters, 
  psyOverlays, 
  colorModes,
  moodPresets,
  type PresetName, 
  type ImageFilterId, 
  type PsyOverlayId,
  type ColorSettings,
  type ColorModeId,
  type MoodPresetId
} from "@/lib/visualizer-presets";
import { 
  Circle, 
  Disc, 
  Globe, 
  BarChart3, 
  Hexagon, 
  Network,
  Waves,
  Droplet,
  Triangle,
  Magnet,
  CircleDot,
  RotateCcw,
  Rainbow,
  Sun,
  Eye,
  Zap,
  Video,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Box
} from "lucide-react";

const presetIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  rings: Circle,
  tunnel: Disc,
  particles: Sparkles,
  sphere: Globe,
  bars: BarChart3,
  kaleidoscope: Hexagon,
  web: Network,
  sand: Waves,
  water: Droplet,
  geometry: Triangle,
  field: Magnet,
  blue: CircleDot,
  vortex: RotateCcw,
  rainbow: Rainbow,
  mandala: Sun,
  mandelbrot: Hexagon,
  mandelbulb3d: Box,
};

interface UIControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  settings: {
    intensity: number;
    speed: number;
    colorPalette: string[];
    presetName: PresetName;
    presetEnabled: boolean;
    imageFilters: ImageFilterId[];
    psyOverlays: PsyOverlayId[];
    trailsOn?: boolean;
    trailsAmount?: number;
    glowEnabled?: boolean;
    glowIntensity?: number;
  };
  setSettings: (s: any) => void;
  colorSettings: ColorSettings;
  setColorSettings: (s: ColorSettings) => void;
  isRecording: boolean;
  onToggleRecording: () => void;
  recordingQuality?: "1080p" | "2k" | "4k";
  onRecordingQualityChange?: (quality: "1080p" | "2k" | "4k") => void;
  onSavePreset: () => void;
  onThumbnailAnalysis?: (analysis: ThumbnailAnalysis) => void;
  onThumbnailUpload?: (url: string) => void;
  thumbnailUrl?: string | null;
  onSaveToLibrary?: () => void;
  onToggleLibrary?: () => void;
  onToggleSoundCloud?: () => void;
  trackName?: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  currentTime?: number;
  duration?: number;
  onSeek?: (time: number) => void;
  volume?: number;
  onVolumeChange?: (volume: number) => void;
  onPreviousTrack?: () => void;
  onNextTrack?: () => void;
  hasLibraryTracks?: boolean;
  fractalSpecs?: import("@/engine/presets/types").UniformSpec[];
  fractalMacros?: import("@/engine/presets/types").UniformSpec[];
  fractalUniforms?: import("@/engine/presets/types").UniformValues;
  onFractalUniformChange?: (key: string, value: any) => void;
  activeTab?: "listen" | "create" | "perform" | "record";
  onActiveTabChange?: (tab: "listen" | "create" | "perform" | "record") => void;
}

export interface ThumbnailAnalysis {
  colorPalette: string[];
  theme: string;
  mood: string;
  visualSuggestions: string[];
}

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

type TabId = "listen" | "create" | "perform" | "record";

export function UIControls({
  isPlaying,
  onPlayPause,
  onFileUpload,
  settings,
  setSettings,
  colorSettings,
  setColorSettings,
  isRecording,
  onToggleRecording,
  recordingQuality = "1080p",
  onRecordingQualityChange,
  onSavePreset,
  onThumbnailAnalysis,
  onThumbnailUpload,
  thumbnailUrl,
  onSaveToLibrary,
  onToggleLibrary,
  onToggleSoundCloud,
  trackName,
  isFullscreen,
  onToggleFullscreen,
  zoom,
  onZoomChange,
  currentTime = 0,
  duration = 0,
  onSeek,
  volume = 1,
  onVolumeChange,
  onPreviousTrack,
  onNextTrack,
  hasLibraryTracks = false,
  fractalSpecs,
  fractalMacros,
  fractalUniforms,
  onFractalUniformChange,
  activeTab: controlledTab,
  onActiveTabChange,
}: UIControlsProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ThumbnailAnalysis | null>(null);
  const [localThumbnailUrl, setLocalThumbnailUrl] = useState<string | null>(null);
  const [internalTab, setInternalTab] = useState<TabId>("listen");
  const activeTab = controlledTab ?? internalTab;
  const setActiveTab = useCallback((tab: TabId) => {
    if (onActiveTabChange) onActiveTabChange(tab);
    else setInternalTab(tab);
  }, [onActiveTabChange]);

  const audioInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const updateSetting = useCallback(<K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    setSettings((prev: typeof settings) => ({ ...prev, [key]: value }));
  }, [setSettings]);

  const displayThumbnail = thumbnailUrl || localThumbnailUrl;

  const lastAnalyzedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const analyzeArtwork = async () => {
      if (thumbnailUrl && 
          thumbnailUrl !== localThumbnailUrl && 
          thumbnailUrl !== lastAnalyzedUrlRef.current &&
          !isAnalyzing) {
        
        lastAnalyzedUrlRef.current = thumbnailUrl;
        setIsAnalyzing(true);
        setAnalysis(null);
        
        try {
          const response = await fetch(thumbnailUrl);
          const blob = await response.blob();
          
          const reader = new FileReader();
          reader.onload = async (event) => {
            const base64 = (event.target?.result as string).split(',')[1];
            
            try {
              const analysisResponse = await fetch('/api/analyze-thumbnail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: base64 })
              });
              
              if (analysisResponse.ok) {
                const data: ThumbnailAnalysis = await analysisResponse.json();
                setAnalysis(data);
                onThumbnailAnalysis?.(data);
              }
            } catch (error) {
              console.error('Thumbnail analysis failed:', error);
            } finally {
              setIsAnalyzing(false);
            }
          };
          reader.readAsDataURL(blob);
        } catch (error) {
          console.error('Failed to fetch artwork for analysis:', error);
          setIsAnalyzing(false);
        }
      }
    };
    
    analyzeArtwork();
  }, [thumbnailUrl, localThumbnailUrl, isAnalyzing, onThumbnailAnalysis]);

  const currentPaletteName = colorPalettes.find(
    (p) => JSON.stringify(p.colors) === JSON.stringify(settings.colorPalette)
  )?.name || (analysis ? `AI: ${analysis.theme}` : "Custom");

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = (event.target?.result as string).split(',')[1];
      const previewUrl = URL.createObjectURL(file);
      setLocalThumbnailUrl(previewUrl);
      onThumbnailUpload?.(previewUrl);
      setIsAnalyzing(true);

      try {
        const response = await fetch('/api/analyze-thumbnail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64 })
        });

        if (response.ok) {
          const data: ThumbnailAnalysis = await response.json();
          setAnalysis(data);
          onThumbnailAnalysis?.(data);
        }
      } catch (error) {
        console.error('Thumbnail analysis failed:', error);
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const updateColorSetting = useCallback(<K extends keyof ColorSettings>(key: K, value: ColorSettings[K]) => {
    setColorSettings({ ...colorSettings, [key]: value });
  }, [colorSettings, setColorSettings]);

  const applyAIPalette = () => {
    if (analysis?.colorPalette) {
      setColorSettings({ ...colorSettings, mode: "ai", aiColors: analysis.colorPalette });
    }
  };

  const currentColorModeName = colorModes.find(m => m.id === colorSettings.mode)?.name || "Gradient";

  const tabs: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "listen", label: "Listen", icon: Eye },
    { id: "create", label: "Create", icon: Sparkles },
    { id: "perform", label: "Perform", icon: Zap },
    { id: "record", label: "Record", icon: Video },
  ];

  return (
    <>
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        onChange={(e) => { onFileUpload(e); e.target.value = ''; }}
        className="hidden"
        data-testid="input-audio-upload"
      />
      <input
        ref={thumbnailInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => { handleThumbnailUpload(e); e.target.value = ''; }}
        className="hidden"
        data-testid="input-thumbnail-upload"
      />

      {/* Top Navigation Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 glass-panel border-b border-white/10" data-ui-root="true" style={{ pointerEvents: 'auto' }}>
        <div className="flex items-center justify-between px-3 md:px-6 py-2 gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <h1 className="text-sm md:text-lg font-bold font-display text-primary text-glow tracking-widest" data-testid="text-title">
              EXPERIENCE
            </h1>
            <span className="text-[10px] md:text-xs text-muted-foreground hidden sm:inline">Instrument for seeing sound</span>
          </div>

          <div className="flex items-center gap-1 md:gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1 md:gap-1.5 px-2.5 md:px-4 py-1.5 md:py-2 rounded-full text-[11px] md:text-xs font-medium transition-all ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-white/50 hover:text-white/80"
                  }`}
                  data-testid={`tab-${tab.id}`}
                >
                  <Icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="w-16 md:w-24 shrink-0" />
        </div>
      </div>

      {/* Right-side Floating Action Buttons */}
      <div className="fixed right-3 md:right-5 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-3" data-ui-root="true" style={{ pointerEvents: 'auto' }}>
        <button
          onClick={onToggleLibrary}
          className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors"
          data-testid="button-toggle-library"
        >
          <BarChart3 className="w-4 h-4 md:w-5 md:h-5" />
        </button>
        <button
          onClick={onToggleSoundCloud}
          className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-orange-500/20 backdrop-blur-sm border border-orange-500/30 flex items-center justify-center text-orange-400 hover:text-orange-300 transition-colors"
          data-testid="button-toggle-soundcloud"
        >
          <Cloud className="w-4 h-4 md:w-5 md:h-5" />
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "create" && <CreateTabContent
        settings={settings}
        setSettings={setSettings}
        updateSetting={updateSetting}
        colorSettings={colorSettings}
        updateColorSetting={updateColorSetting}
        displayThumbnail={displayThumbnail}
        isAnalyzing={isAnalyzing}
        analysis={analysis}
        applyAIPalette={applyAIPalette}
        thumbnailInputRef={thumbnailInputRef}
        zoom={zoom}
        onZoomChange={onZoomChange}
        fractalSpecs={fractalSpecs}
        fractalUniforms={fractalUniforms}
        onFractalUniformChange={onFractalUniformChange}
      />}

      {activeTab === "perform" && <PerformTabContent
        settings={settings}
        updateSetting={updateSetting}
        zoom={zoom}
        onZoomChange={onZoomChange}
        fractalMacros={fractalMacros}
        fractalUniforms={fractalUniforms}
        onFractalUniformChange={onFractalUniformChange}
      />}

      {activeTab === "record" && <RecordTabContent
        isRecording={isRecording}
        onToggleRecording={onToggleRecording}
        recordingQuality={recordingQuality}
        onRecordingQualityChange={onRecordingQualityChange}
        onSaveToLibrary={onSaveToLibrary}
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
      />}

      {/* Bottom Player Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 glass-panel border-t border-white/10" data-ui-root="true" style={{ pointerEvents: 'auto' }}>
        <div className="flex items-center gap-2 md:gap-3 px-3 md:px-6 py-2">
          <button
            onClick={() => audioInputRef.current?.click()}
            className="text-white/50 hover:text-white transition-colors shrink-0"
            data-testid="button-audio-upload"
          >
            <Upload className="w-4 h-4" />
          </button>

          {hasLibraryTracks && (
            <button
              onClick={onPreviousTrack}
              className="text-white/50 hover:text-white transition-colors shrink-0"
              data-testid="button-previous-track"
            >
              <SkipBack className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onPlayPause}
            className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0 hover:bg-white/20 transition-colors"
            data-testid="button-play-pause"
          >
            {isPlaying ? <Pause className="w-4 h-4 md:w-5 md:h-5" /> : <Play className="w-4 h-4 md:w-5 md:h-5 ml-0.5" />}
          </button>

          {hasLibraryTracks && (
            <button
              onClick={onNextTrack}
              className="text-white/50 hover:text-white transition-colors shrink-0"
              data-testid="button-next-track"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          )}

          <div className="hidden md:block max-w-[120px] truncate text-xs text-white/60 shrink-0" data-testid="text-track-name">
            {trackName ? trackName.replace(/\.[^/.]+$/, "") : "No Track"}
          </div>

          <span className="text-[11px] md:text-xs text-muted-foreground font-mono w-10 md:w-12 text-right shrink-0" data-testid="text-current-time">
            {formatTime(currentTime)}
          </span>

          <div className="flex-1 min-w-0">
            <Slider
              min={0}
              max={duration || 1}
              step={0.1}
              value={[currentTime]}
              onValueChange={([val]) => onSeek?.(val)}
              className="w-full"
              data-testid="slider-seek"
            />
          </div>

          <span className="text-[11px] md:text-xs text-muted-foreground font-mono w-10 md:w-12 shrink-0" data-testid="text-duration">
            {formatTime(duration)}
          </span>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onVolumeChange?.(volume > 0 ? 0 : 1)}
              className="text-white/60 hover:text-white transition-colors"
              data-testid="button-volume-toggle"
            >
              {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={[volume]}
              onValueChange={([val]) => onVolumeChange?.(val)}
              className="w-16 md:w-24"
              data-testid="slider-volume"
            />
          </div>
        </div>
      </div>
    </>
  );
}

function CreateTabContent({
  settings,
  setSettings,
  updateSetting,
  colorSettings,
  updateColorSetting,
  displayThumbnail,
  isAnalyzing,
  analysis,
  applyAIPalette,
  thumbnailInputRef,
  zoom,
  onZoomChange,
  fractalSpecs,
  fractalUniforms,
  onFractalUniformChange,
}: {
  settings: UIControlsProps["settings"];
  setSettings: UIControlsProps["setSettings"];
  updateSetting: <K extends keyof UIControlsProps["settings"]>(key: K, value: UIControlsProps["settings"][K]) => void;
  colorSettings: ColorSettings;
  updateColorSetting: <K extends keyof ColorSettings>(key: K, value: ColorSettings[K]) => void;
  displayThumbnail: string | null | undefined;
  isAnalyzing: boolean;
  analysis: ThumbnailAnalysis | null;
  applyAIPalette: () => void;
  thumbnailInputRef: React.RefObject<HTMLInputElement | null>;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  fractalSpecs?: import("@/engine/presets/types").UniformSpec[];
  fractalUniforms?: import("@/engine/presets/types").UniformValues;
  onFractalUniformChange?: (key: string, value: any) => void;
}) {
  return (
    <div className="fixed inset-0 z-30 pointer-events-none" style={{ top: '52px', bottom: '52px' }}>
      <div className="flex flex-col md:flex-row h-full gap-3 md:gap-0 p-3 md:p-4 overflow-y-auto md:overflow-visible pointer-events-auto md:pointer-events-none">
        {/* Left Panel - Presets */}
        <div className="w-full md:w-[280px] shrink-0 glass-panel rounded-xl settings-panel overflow-y-auto pointer-events-auto" data-ui-root="true" style={{ maxHeight: 'calc(100vh - 130px)' }}>
          <div className="p-4 space-y-4">
            <h2 className="text-sm font-bold font-display uppercase tracking-widest text-white" data-testid="heading-presets">Presets</h2>

            {presetCategories.map((category) => (
              <div key={category.name} className="space-y-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">{category.name}</p>
                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))' }}>
                  {category.presets.map((preset) => {
                    const IconComponent = presetIconMap[preset.icon];
                    const isActive = settings.presetName === preset.name;
                    return (
                      <button
                        key={preset.name}
                        onClick={() => setSettings((prev: typeof settings) => ({ ...prev, presetName: preset.name }))}
                        className={`flex flex-col items-center justify-center rounded-lg transition-all aspect-square ${
                          isActive
                            ? "bg-white/15 ring-1 ring-primary/70 text-white shadow-[0_0_8px_rgba(var(--primary),0.2)]"
                            : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80 active:scale-[0.97]"
                        }`}
                        title={preset.name}
                        data-testid={`button-preset-${preset.shortName.toLowerCase()}`}
                      >
                        {IconComponent && <IconComponent className={`w-4 h-4 shrink-0 mb-1 ${isActive ? 'text-primary' : 'text-white/40'}`} />}
                        <span className="text-[9px] font-medium leading-tight text-center line-clamp-2 px-0.5">{preset.shortName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="h-px bg-white/10" />

            {/* Color Mode Selector */}
            <div className="space-y-3">
              <Label className="text-xs uppercase tracking-widest text-accent font-bold">Color Mode</Label>
              <div className="flex gap-1 flex-wrap">
                {colorModes.filter(m => m.id !== "ai" && m.id !== "custom").map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => updateColorSetting("mode", mode.id)}
                    className={`px-2 py-1 rounded text-[10px] transition-all ${
                      colorSettings.mode === mode.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-white/10 text-white/60 hover:bg-white/20"
                    }`}
                    data-testid={`button-color-mode-${mode.id}`}
                  >
                    {mode.name}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 items-center flex-wrap">
                {(colorSettings.mode === "single" || colorSettings.mode === "gradient" || colorSettings.mode === "triadic") && (
                  <>
                    <input
                      type="color"
                      value={colorSettings.primaryColor}
                      onChange={(e) => updateColorSetting("primaryColor", e.target.value)}
                      className="w-7 h-7 rounded cursor-pointer border-0"
                      data-testid="input-color-primary"
                    />
                    {(colorSettings.mode === "gradient" || colorSettings.mode === "triadic") && (
                      <input
                        type="color"
                        value={colorSettings.secondaryColor}
                        onChange={(e) => updateColorSetting("secondaryColor", e.target.value)}
                        className="w-7 h-7 rounded cursor-pointer border-0"
                        data-testid="input-color-secondary"
                      />
                    )}
                    {colorSettings.mode === "triadic" && (
                      <input
                        type="color"
                        value={colorSettings.tertiaryColor}
                        onChange={(e) => updateColorSetting("tertiaryColor", e.target.value)}
                        className="w-7 h-7 rounded cursor-pointer border-0"
                        data-testid="input-color-tertiary"
                      />
                    )}
                  </>
                )}

                {colorSettings.mode === "mood" && (
                  <div className="flex gap-1 flex-wrap">
                    {moodPresets.map((mood) => (
                      <button
                        key={mood.id}
                        onClick={() => updateColorSetting("moodPreset", mood.id)}
                        className={`px-2 py-1 rounded text-[10px] transition-all ${
                          colorSettings.moodPreset === mood.id
                            ? "ring-1 ring-white"
                            : "opacity-50 hover:opacity-80"
                        }`}
                        style={{ background: `linear-gradient(135deg, ${mood.colors[0]}, ${mood.colors[1]})` }}
                        data-testid={`button-mood-${mood.id}`}
                      >
                        {mood.name}
                      </button>
                    ))}
                  </div>
                )}

                {colorSettings.mode === "spectrum" && (
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">Speed</span>
                    <Slider
                      min={0.1} max={3} step={0.1}
                      value={[colorSettings.spectrumSpeed]}
                      onValueChange={([val]) => updateColorSetting("spectrumSpeed", val)}
                      className="flex-1"
                      data-testid="slider-spectrum-speed"
                    />
                    <span className="text-[10px] font-mono">{colorSettings.spectrumSpeed.toFixed(1)}x</span>
                  </div>
                )}
              </div>

              <div className="flex gap-0.5 h-4 rounded overflow-hidden">
                {settings.colorPalette.map((color, idx) => (
                  <div key={idx} className="flex-1" style={{ backgroundColor: color }} />
                ))}
              </div>
            </div>

            <div className="h-px bg-white/10" />

            {/* Image Filters */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-widest text-purple-400 font-bold">Image Filters</Label>
              <div className="flex gap-1 flex-wrap">
                {imageFilters.filter(f => f.id !== "none").map((filter) => {
                  const isActive = settings.imageFilters.includes(filter.id);
                  return (
                    <button
                      key={filter.id}
                      onClick={() => {
                        const newFilters = isActive
                          ? settings.imageFilters.filter(f => f !== filter.id)
                          : [...settings.imageFilters.filter(f => f !== "none"), filter.id];
                        setSettings((prev: typeof settings) => ({
                          ...prev,
                          imageFilters: newFilters.length === 0 ? ["none"] : newFilters
                        }));
                      }}
                      className={`text-[10px] py-1.5 px-2.5 rounded-md border transition-all ${
                        isActive
                          ? "border-purple-500 bg-purple-500/20 text-purple-300"
                          : "border-white/10 bg-black/30 text-muted-foreground hover:bg-white/5"
                      }`}
                      data-testid={`filter-toggle-${filter.id}`}
                    >
                      {filter.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Psy Overlays */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-widest text-cyan-400 font-bold">Psy Overlays</Label>
              <div className="flex gap-1 flex-wrap">
                {psyOverlays.map((overlay) => {
                  const currentOverlays = settings.psyOverlays || [];
                  const isActive = currentOverlays.includes(overlay.id);
                  return (
                    <button
                      key={overlay.id}
                      onClick={() => {
                        const newOverlays = isActive
                          ? currentOverlays.filter(o => o !== overlay.id)
                          : [...currentOverlays, overlay.id];
                        setSettings((prev: typeof settings) => ({
                          ...prev,
                          psyOverlays: newOverlays
                        }));
                      }}
                      className={`text-[10px] py-1.5 px-2.5 rounded-md border transition-all ${
                        isActive
                          ? "border-cyan-500 bg-cyan-500/20 text-cyan-300"
                          : "border-white/10 bg-black/30 text-muted-foreground hover:bg-white/5"
                      }`}
                      data-testid={`overlay-toggle-${overlay.id}`}
                    >
                      {overlay.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="h-px bg-white/10" />

            {/* Thumbnail / Artwork Upload + AI */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs uppercase tracking-widest text-accent font-bold">Artwork</Label>
                {isAnalyzing && <Loader2 className="w-3 h-3 text-primary animate-spin" />}
              </div>
              <button
                type="button"
                className="relative w-full aspect-video rounded-lg border border-white/10 bg-black/50 overflow-hidden cursor-pointer p-0"
                onClick={() => thumbnailInputRef.current?.click()}
                data-testid="button-thumbnail-upload"
              >
                {displayThumbnail ? (
                  <img src={displayThumbnail} alt="Thumbnail" className="w-full h-full object-cover pointer-events-none" data-testid="img-thumbnail" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center pointer-events-none gap-1">
                    <ImagePlus className="w-6 h-6 opacity-30" />
                    <span className="text-[10px] text-muted-foreground">Upload artwork</span>
                  </div>
                )}
              </button>
              {isAnalyzing ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[10px] h-7 border-accent/50 text-accent/60 w-full"
                  disabled
                  data-testid="button-analyzing-ai-palette"
                >
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Analyzing...
                </Button>
              ) : analysis ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[10px] h-7 border-accent/50 text-accent w-full"
                  onClick={applyAIPalette}
                  data-testid="button-apply-ai-palette"
                >
                  <Sparkles className="mr-1 h-3 w-3" />
                  AI Colors
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Spacer pushes right panel to right on desktop */}
        <div className="hidden md:block flex-1" />

        {/* Right Panel - Controls */}
        <div className="w-full md:w-[280px] shrink-0 glass-panel rounded-xl settings-panel overflow-y-auto pointer-events-auto" data-ui-root="true" style={{ maxHeight: 'calc(100vh - 130px)' }}>
          <div className="p-4 space-y-5">
            <h2 className="text-sm font-bold font-display uppercase tracking-widest text-white" data-testid="heading-controls">Controls</h2>

            {/* Intensity */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="uppercase tracking-widest text-muted-foreground">Intensity</span>
                <span className="font-mono text-primary" data-testid="text-intensity-value">{Math.round(settings.intensity / 3 * 100)}%</span>
              </div>
              <Slider
                min={0} max={3} step={0.1}
                value={[settings.intensity]}
                onValueChange={([val]) => updateSetting('intensity', val)}
                className="w-full"
                data-testid="slider-intensity"
              />
            </div>

            {/* Speed */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="uppercase tracking-widest text-muted-foreground">Speed</span>
                <span className="font-mono text-green-400" data-testid="text-speed-value">{Math.round(settings.speed / 2 * 100)}%</span>
              </div>
              <Slider
                min={0} max={2} step={0.1}
                value={[settings.speed]}
                onValueChange={([val]) => updateSetting('speed', val)}
                className="w-full"
                data-testid="slider-speed"
              />
            </div>

            {/* Glow */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="uppercase tracking-widest text-muted-foreground">Glow</span>
                <span className="font-mono text-blue-400" data-testid="text-glow-value">{Math.round((settings.glowIntensity ?? 1.0) / 2 * 100)}%</span>
              </div>
              <Slider
                min={0.2} max={2.0} step={0.1}
                value={[settings.glowIntensity ?? 1.0]}
                onValueChange={([val]) => {
                  setSettings((prev: typeof settings) => ({ ...prev, glowIntensity: val }));
                }}
                className="w-full"
                data-testid="slider-glow-intensity"
              />
            </div>

            {/* Zoom */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="uppercase tracking-widest text-muted-foreground">Zoom</span>
                <span className="font-mono text-amber-400" data-testid="text-zoom-value">{zoom !== undefined ? Math.round(zoom * 100) : 100}%</span>
              </div>
              <Slider
                min={50} max={300} step={1}
                value={[zoom !== undefined ? zoom * 100 : 100]}
                onValueChange={([val]) => onZoomChange?.(val / 100)}
                className="w-full"
                data-testid="slider-zoom"
              />
            </div>

            <div className="h-px bg-white/10" />

            {/* Dark Overlay Toggle */}
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Dark Overlay</Label>
              <Switch
                checked={settings.trailsOn ?? false}
                onCheckedChange={(checked) => {
                  setSettings((prev: typeof settings) => ({ ...prev, trailsOn: checked }));
                }}
                data-testid="toggle-dark-overlay"
              />
            </div>

            {/* Motion Trails Toggle */}
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Motion Trails</Label>
              <Switch
                checked={(settings.trailsOn ?? false) && (settings.trailsAmount ?? 0) > 0}
                onCheckedChange={(checked) => {
                  setSettings((prev: typeof settings) => ({
                    ...prev,
                    trailsOn: checked,
                    trailsAmount: checked ? 0.75 : 0
                  }));
                }}
                data-testid="toggle-motion-trails"
              />
            </div>

            {/* Glow Enable Toggle */}
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Glow Enable</Label>
              <Switch
                checked={settings.glowEnabled ?? true}
                onCheckedChange={(checked) => {
                  setSettings((prev: typeof settings) => ({ ...prev, glowEnabled: checked }));
                }}
                data-testid="toggle-glow"
              />
            </div>

            {fractalSpecs && fractalSpecs.length > 0 && fractalUniforms && onFractalUniformChange && (
              <>
                <div className="h-px bg-white/10" />
                <h2 className="text-sm font-bold font-display uppercase tracking-widest text-white" data-testid="heading-fractal-controls">Fractal Controls</h2>
                <FractalControlPanel specs={fractalSpecs} uniforms={fractalUniforms} setUniform={onFractalUniformChange} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PerformTabContent({
  settings,
  updateSetting,
  zoom,
  onZoomChange,
  fractalMacros,
  fractalUniforms,
  onFractalUniformChange,
}: {
  settings: UIControlsProps["settings"];
  updateSetting: <K extends keyof UIControlsProps["settings"]>(key: K, value: UIControlsProps["settings"][K]) => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  fractalMacros?: import("@/engine/presets/types").UniformSpec[];
  fractalUniforms?: import("@/engine/presets/types").UniformValues;
  onFractalUniformChange?: (key: string, value: any) => void;
}) {
  const cards = [
    {
      label: "Intensity",
      value: Math.round(settings.intensity / 3 * 100),
      color: "text-primary",
      min: 0,
      max: 3,
      step: 0.1,
      current: settings.intensity,
      onChange: (val: number) => updateSetting('intensity', val),
      testId: "perform-intensity",
    },
    {
      label: "Speed",
      value: Math.round(settings.speed / 2 * 100),
      color: "text-green-400",
      min: 0,
      max: 2,
      step: 0.1,
      current: settings.speed,
      onChange: (val: number) => updateSetting('speed', val),
      testId: "perform-speed",
    },
    {
      label: "Glow",
      value: Math.round((settings.glowIntensity ?? 1.0) / 2 * 100),
      color: "text-blue-400",
      min: 0.2,
      max: 2.0,
      step: 0.1,
      current: settings.glowIntensity ?? 1.0,
      onChange: (val: number) => updateSetting('glowIntensity' as any, val),
      testId: "perform-glow",
    },
    {
      label: "Zoom",
      value: zoom !== undefined ? Math.round(zoom * 100) : 100,
      color: "text-amber-400",
      min: 50,
      max: 300,
      step: 1,
      current: zoom !== undefined ? zoom * 100 : 100,
      onChange: (val: number) => onZoomChange?.(val / 100),
      testId: "perform-zoom",
    },
  ];

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center pointer-events-none" style={{ top: '52px', bottom: '52px' }}>
      <div className="space-y-4 max-w-lg w-full">
        <div className="grid grid-cols-2 gap-3 md:gap-4 p-4 pointer-events-auto w-full" data-ui-root="true">
          {cards.map((card) => (
            <div
              key={card.testId}
              className="glass-panel rounded-xl border border-white/10 p-4 md:p-5 space-y-3"
              data-testid={`card-${card.testId}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">{card.label}</span>
                <span className={`text-lg md:text-xl font-bold font-mono ${card.color}`}>{card.value}%</span>
              </div>
              <Slider
                min={card.min}
                max={card.max}
                step={card.step}
                value={[card.current]}
                onValueChange={([val]) => card.onChange(val)}
                className="w-full"
                data-testid={`slider-${card.testId}`}
              />
            </div>
          ))}
        </div>

        {fractalMacros && fractalMacros.length > 0 && fractalUniforms && onFractalUniformChange && (
          <div className="pointer-events-auto">
            <FractalPerformOverlay macros={fractalMacros} uniforms={fractalUniforms} setUniform={onFractalUniformChange} />
          </div>
        )}
      </div>
    </div>
  );
}

function RecordTabContent({
  isRecording,
  onToggleRecording,
  recordingQuality,
  onRecordingQualityChange,
  onSaveToLibrary,
  isFullscreen,
  onToggleFullscreen,
}: {
  isRecording: boolean;
  onToggleRecording: () => void;
  recordingQuality: "1080p" | "2k" | "4k";
  onRecordingQualityChange?: (quality: "1080p" | "2k" | "4k") => void;
  onSaveToLibrary?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center pointer-events-none" style={{ top: '52px', bottom: '52px' }}>
      <div className="glass-panel rounded-xl border border-white/10 p-6 md:p-8 pointer-events-auto w-[320px] md:w-[360px] space-y-6" data-ui-root="true">
        <h2 className="text-sm font-bold font-display uppercase tracking-widest text-white text-center" data-testid="heading-record">Recording</h2>

        {/* Quality Selector */}
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Quality</Label>
          <div className="flex gap-2">
            {(["1080p", "2k", "4k"] as const).map((q) => (
              <Button
                key={q}
                variant={recordingQuality === q ? "default" : "outline"}
                size="sm"
                className="flex-1 text-xs"
                onClick={() => onRecordingQualityChange?.(q)}
                data-testid={`button-quality-${q}`}
              >
                {q.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>

        {/* Record Button */}
        <div className="flex justify-center">
          <button
            onClick={onToggleRecording}
            className={`w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center transition-all ${
              isRecording
                ? "bg-destructive/30 border-2 border-destructive animate-pulse"
                : "bg-destructive/20 border-2 border-destructive/50 hover:bg-destructive/30"
            }`}
            data-testid="button-record"
          >
            <Disc className={`w-6 h-6 md:w-8 md:h-8 text-destructive ${isRecording ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="text-center text-xs text-muted-foreground">{isRecording ? "Recording... tap to stop" : "Tap to start recording"}</p>

        {/* Save + Fullscreen */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onSaveToLibrary}
            data-testid="button-save-library"
          >
            <FolderPlus className="mr-2 h-4 w-4" />
            Save
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleFullscreen}
            data-testid="button-fullscreen"
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
