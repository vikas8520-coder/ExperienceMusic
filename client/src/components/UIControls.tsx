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
import { Upload, Save, Disc as DiscIcon, ImagePlus, Sparkles, Loader2, Library, FolderPlus, ChevronUp, ChevronDown, Settings, Maximize, Minimize, ZoomIn } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
  Sun
} from "lucide-react";

// Map preset icons to Lucide components
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
  };
  setSettings: (s: any) => void;
  colorSettings: ColorSettings;
  setColorSettings: (s: ColorSettings) => void;
  isRecording: boolean;
  onToggleRecording: () => void;
  onSavePreset: () => void;
  onThumbnailAnalysis?: (analysis: ThumbnailAnalysis) => void;
  onThumbnailUpload?: (url: string) => void;
  thumbnailUrl?: string | null;
  onSaveToLibrary?: () => void;
  onToggleLibrary?: () => void;
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
}

export interface ThumbnailAnalysis {
  colorPalette: string[];
  theme: string;
  mood: string;
  visualSuggestions: string[];
}

// Format time in mm:ss format
function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

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
  onSavePreset,
  onThumbnailAnalysis,
  onThumbnailUpload,
  thumbnailUrl,
  onSaveToLibrary,
  onToggleLibrary,
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
}: UIControlsProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ThumbnailAnalysis | null>(null);
  const [localThumbnailUrl, setLocalThumbnailUrl] = useState<string | null>(null);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const [showMobileControls, setShowMobileControls] = useState(true);
  const [isDesktopPanelVisible, setIsDesktopPanelVisible] = useState(true);
  
  // Auto-hide timer ref
  const autoHideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const AUTO_HIDE_DELAY = 5000; // 5 seconds
  
  // Throttle ref to prevent excessive timer resets
  const lastResetTime = useRef<number>(0);
  const THROTTLE_MS = 100;
  
  // Reset auto-hide timer on user interaction (throttled)
  const resetAutoHideTimer = useCallback(() => {
    const now = Date.now();
    if (now - lastResetTime.current < THROTTLE_MS) return;
    lastResetTime.current = now;
    
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
    }
    autoHideTimerRef.current = setTimeout(() => {
      setShowMobileControls(false);
      setIsMobileExpanded(false);
      setIsDesktopPanelVisible(false);
    }, AUTO_HIDE_DELAY);
  }, []);
  
  // Start auto-hide timer when panels are shown
  useEffect(() => {
    if (showMobileControls || isDesktopPanelVisible) {
      resetAutoHideTimer();
    }
    return () => {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
      }
    };
  }, [showMobileControls, isDesktopPanelVisible, resetAutoHideTimer]);
  
  // File input refs for reliable click handling
  const audioInputRef = useRef<HTMLInputElement>(null);
  const audioInputMobileRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputMobileRef = useRef<HTMLInputElement>(null);
  
  const desktopScrollRef = useRef<HTMLDivElement>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const desktopScrollPosition = useRef<number>(0);
  const mobileScrollPosition = useRef<number>(0);
  
  // Save scroll positions before state updates
  const saveScrollPositions = useCallback(() => {
    if (desktopScrollRef.current) {
      desktopScrollPosition.current = desktopScrollRef.current.scrollLeft;
    }
    if (mobileScrollRef.current) {
      mobileScrollPosition.current = mobileScrollRef.current.scrollLeft;
    }
  }, []);
  
  // Restore scroll positions after settings change
  useEffect(() => {
    const desktopEl = desktopScrollRef.current;
    const mobileEl = mobileScrollRef.current;
    
    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => {
      if (desktopEl && desktopScrollPosition.current > 0) {
        desktopEl.scrollLeft = desktopScrollPosition.current;
      }
      if (mobileEl && mobileScrollPosition.current > 0) {
        mobileEl.scrollLeft = mobileScrollPosition.current;
      }
    });
  }, [settings]);
  
  const updateSetting = useCallback(<K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    saveScrollPositions();
    setSettings({ ...settings, [key]: value });
  }, [settings, setSettings, saveScrollPositions]);

  const displayThumbnail = thumbnailUrl || localThumbnailUrl;

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
    saveScrollPositions();
    setColorSettings({ ...colorSettings, [key]: value });
  }, [colorSettings, setColorSettings, saveScrollPositions]);

  const applyAIPalette = () => {
    if (analysis?.colorPalette) {
      saveScrollPositions();
      setColorSettings({ ...colorSettings, mode: "ai", aiColors: analysis.colorPalette });
    }
  };
  
  // Color mode display name
  const currentColorModeName = colorModes.find(m => m.id === colorSettings.mode)?.name || "Gradient";

  // Mobile floating controls (simplified - player controls moved to top drawer)
  const MobileFloatingControls = () => (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 md:hidden" style={{ pointerEvents: 'auto' }}>
      {/* Upload Button */}
      <input
        ref={audioInputMobileRef}
        type="file"
        accept="audio/*"
        onChange={onFileUpload}
        className="hidden"
        data-testid="input-audio-upload-mobile"
      />
      <Button 
        variant="secondary"
        size="icon"
        className="rounded-full shadow-lg"
        onClick={() => audioInputMobileRef.current?.click()}
        data-testid="button-audio-upload-mobile"
      >
        <Upload className="h-5 w-5" />
      </Button>
      
      {/* Settings Toggle */}
      <Button 
        variant="secondary"
        size="icon"
        className="rounded-full shadow-lg"
        onClick={() => {
          setShowMobileControls(!showMobileControls);
          resetAutoHideTimer();
        }}
        data-testid="button-settings-mobile"
      >
        <Settings className="h-5 w-5" />
      </Button>
      
      {/* Library Button */}
      <Button 
        variant="secondary"
        size="icon"
        className="rounded-full shadow-lg"
        onClick={onToggleLibrary}
        data-testid="button-library-mobile"
      >
        <Library className="h-5 w-5" />
      </Button>
      
      {/* Fullscreen Button */}
      <Button 
        variant="secondary"
        size="icon"
        className="rounded-full shadow-lg"
        onClick={onToggleFullscreen}
        data-testid="button-fullscreen-mobile"
      >
        {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
      </Button>
    </div>
  );

  // Mobile bottom sheet - using CSS transitions for stability
  const MobileBottomSheet = () => (
    <div 
      className={`fixed bottom-20 left-0 right-0 z-40 md:hidden transition-transform duration-300 ease-out ${
        showMobileControls 
          ? (isMobileExpanded ? 'translate-y-0' : 'translate-y-[calc(100%-180px)]')
          : 'translate-y-full'
      }`}
      onMouseMove={resetAutoHideTimer}
      onTouchStart={resetAutoHideTimer}
    >
      <div className="glass-panel settings-panel rounded-t-3xl max-h-[70vh] overflow-y-auto scrollbar-thin" style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}>
            {/* Drag Handle */}
            <button
              onClick={() => setIsMobileExpanded(!isMobileExpanded)}
              className="w-full flex flex-col items-center py-3 active:bg-white/5"
              data-testid="button-expand-controls"
            >
              <div className="w-12 h-1 bg-white/30 rounded-full mb-2" />
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="text-xs uppercase tracking-wider">Controls</span>
                {isMobileExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </div>
            </button>
            
            {/* Quick Controls Row */}
            <div className="px-4 pb-4 space-y-4">
              {/* Current Track */}
              {trackName && (
                <div className="p-2 bg-black/30 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Now Playing</p>
                  <p className="text-sm font-medium truncate">{trackName.replace(/\.[^/.]+$/, "")}</p>
                </div>
              )}
              
              {/* Preset Selector - Categorized Buttons */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-widest text-purple-400 font-bold">Preset</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Enable</span>
                    <Switch
                      checked={settings.presetEnabled}
                      onCheckedChange={(checked) => { saveScrollPositions(); setSettings({ ...settings, presetEnabled: checked }); }}
                      data-testid="switch-preset-toggle-mobile"
                    />
                  </div>
                </div>
                
                {presetCategories.map((category) => (
                  <div key={category.name} className={`space-y-2 ${!settings.presetEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{category.name}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {category.presets.map((preset) => {
                        const IconComponent = presetIconMap[preset.icon];
                        const isActive = settings.presetName === preset.name;
                        return (
                          <button
                            key={preset.name}
                            onClick={() => { saveScrollPositions(); setSettings({ ...settings, presetName: preset.name }); }}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                              isActive
                                ? "bg-primary text-primary-foreground ring-2 ring-primary/50"
                                : "bg-white/10 text-white/70 hover:bg-white/20"
                            }`}
                            data-testid={`button-preset-mobile-${preset.shortName.toLowerCase()}`}
                          >
                            {IconComponent && <IconComponent className="w-3.5 h-3.5" />}
                            <span>{preset.shortName}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Color Mode Selector */}
              <div className="space-y-3">
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
                  {colorModes.filter(m => m.id !== "ai" && m.id !== "custom").map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => updateColorSetting("mode", mode.id)}
                      className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs transition-all ${
                        colorSettings.mode === mode.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-white/10 text-white/70"
                      }`}
                      data-testid={`button-color-mode-mobile-${mode.id}`}
                    >
                      {mode.name}
                    </button>
                  ))}
                </div>
                
                {/* Color Pickers based on mode */}
                <div className="flex gap-3 items-center">
                  {(colorSettings.mode === "single" || colorSettings.mode === "gradient" || colorSettings.mode === "triadic") && (
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={colorSettings.primaryColor}
                        onChange={(e) => updateColorSetting("primaryColor", e.target.value)}
                        className="w-10 h-10 rounded-lg cursor-pointer border-0"
                        data-testid="input-color-primary-mobile"
                      />
                      {(colorSettings.mode === "gradient" || colorSettings.mode === "triadic") && (
                        <input
                          type="color"
                          value={colorSettings.secondaryColor}
                          onChange={(e) => updateColorSetting("secondaryColor", e.target.value)}
                          className="w-10 h-10 rounded-lg cursor-pointer border-0"
                          data-testid="input-color-secondary-mobile"
                        />
                      )}
                      {colorSettings.mode === "triadic" && (
                        <input
                          type="color"
                          value={colorSettings.tertiaryColor}
                          onChange={(e) => updateColorSetting("tertiaryColor", e.target.value)}
                          className="w-10 h-10 rounded-lg cursor-pointer border-0"
                          data-testid="input-color-tertiary-mobile"
                        />
                      )}
                    </div>
                  )}
                  
                  {colorSettings.mode === "mood" && (
                    <div className="flex gap-2 overflow-x-auto flex-1">
                      {moodPresets.map((mood) => (
                        <button
                          key={mood.id}
                          onClick={() => updateColorSetting("moodPreset", mood.id)}
                          className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs transition-all ${
                            colorSettings.moodPreset === mood.id
                              ? "ring-2 ring-white"
                              : "opacity-60"
                          }`}
                          style={{ background: `linear-gradient(135deg, ${mood.colors[0]}, ${mood.colors[1]})` }}
                          data-testid={`button-mood-mobile-${mood.id}`}
                        >
                          {mood.name}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {colorSettings.mode === "spectrum" && (
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Speed</span>
                      <Slider
                        min={0.1} max={3} step={0.1}
                        value={[colorSettings.spectrumSpeed]}
                        onValueChange={([val]) => updateColorSetting("spectrumSpeed", val)}
                        className="flex-1"
                        data-testid="slider-spectrum-speed-mobile"
                      />
                    </div>
                  )}
                </div>
                
                {/* Color Preview */}
                <div className="flex gap-1 h-6 rounded-lg overflow-hidden">
                  {settings.colorPalette.map((color, idx) => (
                    <div
                      key={idx}
                      className="flex-1"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
            
            {/* Expanded Controls - CSS transition for stability */}
            <div 
              className={`px-4 pb-6 space-y-6 overflow-y-auto max-h-[40vh] transition-all duration-200 ${
                isMobileExpanded ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden pointer-events-none'
              }`}
              style={{ overscrollBehavior: 'contain' }}
              ref={mobileScrollRef}
            >
              {isMobileExpanded && (
                <>
                  {/* Intensity Slider */}
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label className="text-xs uppercase tracking-widest">Intensity</Label>
                      <span className="text-xs font-mono text-primary">{settings.intensity.toFixed(1)}</span>
                    </div>
                    <Slider
                      min={0} max={3} step={0.1}
                      value={[settings.intensity]}
                      onValueChange={([val]) => updateSetting('intensity', val)}
                      className="[&>.absolute]:bg-primary"
                      data-testid="slider-intensity-mobile"
                    />
                  </div>
                  
                  {/* Speed Slider */}
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label className="text-xs uppercase tracking-widest">Speed</Label>
                      <span className="text-xs font-mono text-secondary">{settings.speed.toFixed(1)}</span>
                    </div>
                    <Slider
                      min={0} max={2} step={0.1}
                      value={[settings.speed]}
                      onValueChange={([val]) => updateSetting('speed', val)}
                      className="[&>.absolute]:bg-secondary"
                      data-testid="slider-speed-mobile"
                    />
                  </div>
                  
                  {/* Thumbnail Upload */}
                  <div className="space-y-3">
                    <Label className="text-xs uppercase tracking-widest text-accent font-bold">Artwork</Label>
                    <div className="relative aspect-video rounded-xl border border-white/10 bg-black/50 overflow-hidden">
                      {displayThumbnail ? (
                        <img 
                          src={displayThumbnail} 
                          alt="Thumbnail" 
                          className="w-full h-full object-cover pointer-events-none"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-2 pointer-events-none">
                          <ImagePlus className="w-8 h-8 opacity-30" />
                          <span className="text-xs opacity-50">Tap to add artwork</span>
                        </div>
                      )}
                      
                      {isAnalyzing && (
                        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2 pointer-events-none z-10">
                          <Loader2 className="w-8 h-8 text-primary animate-spin" />
                          <span className="text-xs text-primary">Analyzing...</span>
                        </div>
                      )}
                      
                      <input
                        ref={thumbnailInputMobileRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => { handleThumbnailUpload(e); e.target.value = ''; }}
                        className="hidden"
                        data-testid="input-thumbnail-upload-mobile"
                      />
                      <button
                        type="button"
                        onClick={() => thumbnailInputMobileRef.current?.click()}
                        className="absolute inset-0 w-full h-full cursor-pointer bg-transparent border-0 z-20"
                        aria-label="Upload thumbnail"
                        data-testid="button-thumbnail-upload-mobile"
                      />
                    </div>
                    
                    {analysis && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full text-xs border-accent/50 text-accent"
                        onClick={applyAIPalette}
                        data-testid="button-apply-ai-palette-mobile"
                      >
                        <Sparkles className="mr-2 h-3 w-3" />
                        Apply AI Palette
                      </Button>
                    )}
                  </div>
                  
                  {/* Image Filter Selector - Multiple */}
                  <div className="space-y-3">
                    <Label className="text-xs uppercase tracking-widest text-purple-400 font-bold">Artwork Filters (Layer Multiple)</Label>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                      {imageFilters.filter(f => f.id !== "none").map((filter) => {
                        const isActive = settings.imageFilters.includes(filter.id);
                        return (
                          <button
                            key={filter.id}
                            onClick={() => {
                              saveScrollPositions();
                              const newFilters = isActive
                                ? settings.imageFilters.filter(f => f !== filter.id)
                                : [...settings.imageFilters.filter(f => f !== "none"), filter.id];
                              setSettings({ 
                                ...settings, 
                                imageFilters: newFilters.length === 0 ? ["none"] : newFilters 
                              });
                            }}
                            className={`text-xs py-2 px-3 rounded-lg border transition-all ${
                              isActive 
                                ? "border-purple-500 bg-purple-500/20 text-purple-300" 
                                : "border-white/10 bg-black/30 text-muted-foreground hover:bg-white/5"
                            }`}
                            data-testid={`filter-toggle-mobile-${filter.id}`}
                          >
                            {filter.name}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-muted-foreground">Tap to toggle multiple filters</p>
                  </div>
                  
                  {/* Psy Overlays - Mobile */}
                  <div className="space-y-3">
                    <Label className="text-xs uppercase tracking-widest text-cyan-400 font-bold">Psy Overlays</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {psyOverlays.map((overlay) => {
                        const isActive = (settings.psyOverlays || []).includes(overlay.id);
                        return (
                          <button
                            key={overlay.id}
                            onClick={() => {
                              saveScrollPositions();
                              const currentOverlays = settings.psyOverlays || [];
                              const newOverlays = isActive
                                ? currentOverlays.filter(o => o !== overlay.id)
                                : [...currentOverlays, overlay.id];
                              setSettings({ 
                                ...settings, 
                                psyOverlays: newOverlays 
                              });
                            }}
                            className={`text-xs py-2 px-3 rounded-lg border transition-all ${
                              isActive 
                                ? "border-cyan-500 bg-cyan-500/20 text-cyan-300" 
                                : "border-white/10 bg-black/30 text-muted-foreground hover:bg-white/5"
                            }`}
                            data-testid={`overlay-toggle-mobile-${overlay.id}`}
                          >
                            {overlay.name}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-muted-foreground">Layer on any preset</p>
                  </div>
                  
                  {/* Glow Enhancement Effect - Mobile */}
                  <div className="space-y-3">
                    <Label className="text-xs uppercase tracking-widest text-purple-400 font-bold">Glow Effect</Label>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Enable Glow</span>
                      <Switch
                        checked={settings.trailsOn ?? false}
                        onCheckedChange={(checked) => {
                          saveScrollPositions();
                          setSettings({ ...settings, trailsOn: checked });
                        }}
                        data-testid="toggle-trails-mobile"
                      />
                    </div>
                    {settings.trailsOn && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Amount</span>
                          <span className="text-xs text-muted-foreground">{Math.round((settings.trailsAmount ?? 0.75) * 100)}%</span>
                        </div>
                        <Slider
                          min={0.3}
                          max={0.95}
                          step={0.05}
                          value={[settings.trailsAmount ?? 0.75]}
                          onValueChange={([val]) => {
                            saveScrollPositions();
                            setSettings({ ...settings, trailsAmount: val });
                          }}
                          className="w-full"
                          data-testid="slider-trails-amount-mobile"
                        />
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground">Brightness enhancement effect</p>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      variant="outline" 
                      className={`border-destructive/50 text-destructive ${isRecording ? 'animate-pulse bg-destructive/20' : ''}`}
                      onClick={onToggleRecording}
                      data-testid="button-record-mobile"
                    >
                      <Disc className={`mr-2 h-4 w-4 ${isRecording ? 'animate-spin' : ''}`} />
                      {isRecording ? "Stop" : "Record"}
                    </Button>
                    
                    <Button 
                      variant="outline"
                      onClick={onSaveToLibrary}
                      data-testid="button-save-library-mobile"
                    >
                      <FolderPlus className="mr-2 h-4 w-4" />
                      Save
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
    </div>
  );

  // Desktop bottom panel - using CSS transitions instead of AnimatePresence
  const DesktopBottomPanel = () => (
    <div className="hidden md:block">
      {/* Toggle button when panel is hidden */}
      <div 
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-200 ${
          isDesktopPanelVisible 
            ? 'opacity-0 pointer-events-none translate-y-4' 
            : 'opacity-100 pointer-events-auto translate-y-0'
        }`}
      >
        <Button
          variant="outline"
          onClick={() => {
            setIsDesktopPanelVisible(true);
            resetAutoHideTimer();
          }}
          className="glass-panel flex items-center gap-2"
          data-testid="button-show-panel"
        >
          <Settings className="w-4 h-4" />
          <span>Show Controls</span>
          <ChevronUp className="w-4 h-4" />
        </Button>
      </div>

      {/* Main bottom panel - CSS transition based */}
      <div 
        className={`fixed bottom-0 left-0 right-0 glass-panel z-50 border-t border-white/10 transition-transform duration-300 ease-out ${
          isDesktopPanelVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ pointerEvents: 'auto' }}
        onMouseMove={resetAutoHideTimer}
        onMouseEnter={resetAutoHideTimer}
      >
            {/* Panel Header with hide button */}
            <div className="flex items-center justify-between gap-4 px-6 py-2 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-4 flex-wrap">
                <h1 className="text-lg font-bold font-display text-primary text-glow tracking-widest">
                  AURAL<span className="text-foreground">VIS</span>
                </h1>
                {trackName && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-black/30 rounded-lg border border-white/5">
                    <span className="text-[10px] text-muted-foreground uppercase">Playing:</span>
                    <span className="text-sm font-medium text-foreground truncate max-w-40" data-testid="text-current-track">
                      {trackName.replace(/\.[^/.]+$/, "")}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleLibrary}
                  data-testid="button-toggle-library"
                >
                  <Library className="w-5 h-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsDesktopPanelVisible(false)}
                  data-testid="button-hide-panel"
                >
                  <ChevronDown className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Reorganized Grid Layout */}
            <div 
              ref={desktopScrollRef} 
              className="settings-panel overflow-y-auto p-4" 
              style={{ 
                maxHeight: 'calc(70vh - 50px)',
                overscrollBehavior: 'contain',
                pointerEvents: 'auto',
                touchAction: 'pan-y',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {/* Row 1: Main Controls */}
              <div className="grid grid-cols-12 gap-4 mb-4">
                
                {/* Preset Selection - Categorized Buttons */}
                <div className="col-span-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs uppercase tracking-widest text-primary font-bold">Preset</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">Enable</span>
                      <Switch
                        checked={settings.presetEnabled}
                        onCheckedChange={(checked) => { saveScrollPositions(); setSettings({ ...settings, presetEnabled: checked }); }}
                        data-testid="switch-preset-toggle"
                      />
                    </div>
                  </div>
                  <div className={`space-y-1.5 ${!settings.presetEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                    {presetCategories.map((category) => (
                      <div key={category.name} className="flex items-center gap-2">
                        <span className="text-[9px] text-muted-foreground uppercase w-14 flex-shrink-0">{category.name}</span>
                        <div className="flex flex-wrap gap-1">
                          {category.presets.map((preset) => {
                            const IconComponent = presetIconMap[preset.icon];
                            const isActive = settings.presetName === preset.name;
                            return (
                              <Tooltip key={preset.name}>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => { saveScrollPositions(); setSettings({ ...settings, presetName: preset.name }); }}
                                    className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-all ${
                                      isActive
                                        ? "bg-primary text-primary-foreground ring-1 ring-primary/50"
                                        : "bg-white/10 text-white/60 hover:bg-white/20"
                                    }`}
                                    data-testid={`button-preset-${preset.shortName.toLowerCase()}`}
                                  >
                                    {IconComponent && <IconComponent className="w-3 h-3" />}
                                    <span>{preset.shortName}</span>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  {preset.name}
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Color Mode */}
                <div className="col-span-3 space-y-2">
                  <Label className="text-xs uppercase tracking-widest text-accent font-bold">Color Mode</Label>
                  
                  {/* Mode Selector */}
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
                        title={mode.description}
                        data-testid={`button-color-mode-${mode.id}`}
                      >
                        {mode.name}
                      </button>
                    ))}
                  </div>
                  
                  {/* Color Pickers / Options based on mode */}
                  <div className="flex gap-2 items-center flex-wrap">
                    {(colorSettings.mode === "single" || colorSettings.mode === "gradient" || colorSettings.mode === "triadic") && (
                      <>
                        <input
                          type="color"
                          value={colorSettings.primaryColor}
                          onChange={(e) => updateColorSetting("primaryColor", e.target.value)}
                          className="w-7 h-7 rounded cursor-pointer border-0"
                          title="Primary Color"
                          data-testid="input-color-primary"
                        />
                        {(colorSettings.mode === "gradient" || colorSettings.mode === "triadic") && (
                          <input
                            type="color"
                            value={colorSettings.secondaryColor}
                            onChange={(e) => updateColorSetting("secondaryColor", e.target.value)}
                            className="w-7 h-7 rounded cursor-pointer border-0"
                            title="Secondary Color"
                            data-testid="input-color-secondary"
                          />
                        )}
                        {colorSettings.mode === "triadic" && (
                          <input
                            type="color"
                            value={colorSettings.tertiaryColor}
                            onChange={(e) => updateColorSetting("tertiaryColor", e.target.value)}
                            className="w-7 h-7 rounded cursor-pointer border-0"
                            title="Tertiary Color"
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
                  
                  {/* Color Preview Bar */}
                  <div className="flex gap-0.5 h-4 rounded overflow-hidden">
                    {settings.colorPalette.map((color, idx) => (
                      <div
                        key={idx}
                        className="flex-1"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Sliders */}
                <div className="col-span-3 space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="uppercase tracking-widest text-muted-foreground">Intensity</span>
                      <span className="font-mono text-primary">{settings.intensity.toFixed(1)}</span>
                    </div>
                    <Slider
                      min={0} max={3} step={0.1}
                      value={[settings.intensity]}
                      onValueChange={([val]) => updateSetting('intensity', val)}
                      className="[&>.absolute]:bg-primary"
                      data-testid="slider-intensity"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="uppercase tracking-widest text-muted-foreground">Speed</span>
                      <span className="font-mono text-secondary">{settings.speed.toFixed(1)}</span>
                    </div>
                    <Slider
                      min={0} max={2} step={0.1}
                      value={[settings.speed]}
                      onValueChange={([val]) => updateSetting('speed', val)}
                      className="[&>.absolute]:bg-secondary"
                      data-testid="slider-speed"
                    />
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="col-span-2 space-y-2">
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Actions</Label>
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={onFileUpload}
                    className="hidden"
                    data-testid="input-audio-upload"
                  />
                  <div className="flex flex-wrap gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-8 w-8 border-primary/50"
                          onClick={() => audioInputRef.current?.click()}
                          data-testid="button-audio-upload"
                        >
                          <Upload className="h-4 w-4 text-primary" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Upload audio</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="icon"
                          className={`h-8 w-8 ${isRecording ? 'animate-pulse bg-destructive/20 border-destructive' : 'border-destructive/50'}`}
                          onClick={onToggleRecording}
                          data-testid="button-record"
                        >
                          <Disc className={`h-4 w-4 text-destructive ${isRecording ? 'animate-spin' : ''}`} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>{isRecording ? "Stop recording" : "Record"}</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="icon"
                          className="h-8 w-8"
                          onClick={onToggleFullscreen}
                          data-testid="button-fullscreen"
                        >
                          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Fullscreen (F)</p></TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="icon"
                          className="h-8 w-8"
                          onClick={onSaveToLibrary}
                          data-testid="button-save-library"
                        >
                          <FolderPlus className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Save to Library</p></TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-white/10 mb-4" />

              {/* Row 2: Effects & Overlays */}
              <div className="grid grid-cols-12 gap-4">
                
                {/* Artwork + AI */}
                <div className="col-span-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs uppercase tracking-widest text-accent font-bold">Artwork</Label>
                    {isAnalyzing && <Loader2 className="w-3 h-3 text-primary animate-spin" />}
                  </div>
                  <input
                    ref={thumbnailInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => { handleThumbnailUpload(e); e.target.value = ''; }}
                    className="hidden"
                    data-testid="input-thumbnail-upload"
                  />
                  <button
                    type="button"
                    className="relative w-16 h-16 rounded-lg border border-white/10 bg-black/50 overflow-hidden cursor-pointer p-0"
                    onClick={() => thumbnailInputRef.current?.click()}
                    data-testid="button-thumbnail-upload"
                  >
                    {displayThumbnail ? (
                      <img src={displayThumbnail} alt="Thumbnail" className="w-full h-full object-cover pointer-events-none" data-testid="img-thumbnail" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center pointer-events-none">
                        <ImagePlus className="w-5 h-5 opacity-30" />
                      </div>
                    )}
                  </button>
                  {analysis && (
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
                  )}
                </div>

                {/* Filters */}
                <div className="col-span-4 space-y-2">
                  <Label className="text-xs uppercase tracking-widest text-purple-400 font-bold">Image Filters</Label>
                  <div className="flex gap-1 flex-wrap">
                    {imageFilters.filter(f => f.id !== "none").map((filter) => {
                      const isActive = settings.imageFilters.includes(filter.id);
                      return (
                        <button
                          key={filter.id}
                          onClick={() => {
                            saveScrollPositions();
                            const newFilters = isActive
                              ? settings.imageFilters.filter(f => f !== filter.id)
                              : [...settings.imageFilters.filter(f => f !== "none"), filter.id];
                            setSettings({ 
                              ...settings, 
                              imageFilters: newFilters.length === 0 ? ["none"] : newFilters 
                            });
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
                <div className="col-span-4 space-y-2">
                  <Label className="text-xs uppercase tracking-widest text-cyan-400 font-bold">Psy Overlays</Label>
                  <div className="flex gap-1 flex-wrap">
                    {psyOverlays.map((overlay) => {
                      const currentOverlays = settings.psyOverlays || [];
                      const isActive = currentOverlays.includes(overlay.id);
                      return (
                        <button
                          key={overlay.id}
                          onClick={() => {
                            saveScrollPositions();
                            const newOverlays = isActive
                              ? currentOverlays.filter(o => o !== overlay.id)
                              : [...currentOverlays, overlay.id];
                            setSettings({ 
                              ...settings, 
                              psyOverlays: newOverlays 
                            });
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
                  <p className="text-[10px] text-muted-foreground">Layer effects on top of presets</p>
                </div>

                {/* Glow Effect - Desktop */}
                <div className="col-span-2 space-y-2">
                  <Label className="text-xs uppercase tracking-widest text-purple-400 font-bold">Glow</Label>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">Enable</span>
                    <Switch
                      checked={settings.trailsOn ?? false}
                      onCheckedChange={(checked) => {
                        saveScrollPositions();
                        setSettings({ ...settings, trailsOn: checked });
                      }}
                      className="scale-75"
                      data-testid="toggle-trails"
                    />
                  </div>
                  {settings.trailsOn && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">Amount</span>
                        <span className="text-[10px] text-muted-foreground">{Math.round((settings.trailsAmount ?? 0.75) * 100)}%</span>
                      </div>
                      <Slider
                        min={0.3}
                        max={0.95}
                        step={0.05}
                        value={[settings.trailsAmount ?? 0.75]}
                        onValueChange={([val]) => {
                          saveScrollPositions();
                          setSettings({ ...settings, trailsAmount: val });
                        }}
                        className="w-full"
                        data-testid="slider-trails-amount"
                      />
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground">Brightness boost</p>
                </div>

                {/* Save Options */}
                <div className="col-span-2 space-y-2">
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Save</Label>
                  <div className="space-y-1">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="w-full justify-start text-xs h-8"
                      onClick={onSavePreset}
                      data-testid="button-save-preset"
                    >
                      <Save className="mr-2 h-3 w-3" /> Preset
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="w-full justify-start text-xs h-8"
                      onClick={onSaveToLibrary}
                      data-testid="button-save-library-alt"
                    >
                      <FolderPlus className="mr-2 h-3 w-3" /> Library
                    </Button>
                  </div>
                  {zoom !== undefined && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <ZoomIn className="h-3 w-3" />
                      <span>{(zoom * 100).toFixed(0)}%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
    </div>
  );

  return (
    <>
      <DesktopBottomPanel />
      <MobileBottomSheet />
      <MobileFloatingControls />
    </>
  );
}
