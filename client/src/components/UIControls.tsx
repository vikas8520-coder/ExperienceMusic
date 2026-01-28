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
import { Play, Pause, Upload, Save, Disc, Activity, ImagePlus, Sparkles, Loader2, Library, FolderPlus, ChevronUp, ChevronDown, X, Settings, Maximize, Minimize, ZoomIn, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { colorPalettes, presets, imageFilters, psyOverlays, type PresetName, type ImageFilterId, type PsyOverlayId } from "@/lib/visualizer-presets";
import { motion, AnimatePresence } from "framer-motion";

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
  };
  setSettings: (s: any) => void;
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

  const applyAIPalette = () => {
    if (analysis?.colorPalette) {
      saveScrollPositions();
      setSettings({ ...settings, colorPalette: analysis.colorPalette });
    }
  };

  // Mobile floating controls (always visible)
  const MobileFloatingControls = () => (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 md:hidden" style={{ pointerEvents: 'auto' }}>
      {/* Mini Timeline for Mobile */}
      {duration > 0 && (
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
          <span className="text-[10px] text-white/70 font-mono w-8 text-right">
            {formatTime(currentTime)}
          </span>
          <div 
            className="w-32 h-1.5 bg-white/20 rounded-full overflow-hidden cursor-pointer"
            onClick={(e) => {
              if (onSeek && duration > 0) {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const percent = x / rect.width;
                onSeek(percent * duration);
              }
            }}
          >
            <div 
              className="h-full bg-primary transition-all duration-100"
              style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%" }}
            />
          </div>
          <span className="text-[10px] text-white/70 font-mono w-8">
            {formatTime(duration)}
          </span>
        </div>
      )}
      
      {/* Transport Controls */}
      <div className="flex items-center gap-2">
        {/* Previous Track */}
        <Button 
          variant="secondary"
          size="icon"
          className="rounded-full shadow-lg h-10 w-10"
          onClick={onPreviousTrack}
          disabled={!hasLibraryTracks}
          data-testid="button-previous-mobile"
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        
        {/* Play/Pause Button */}
        <Button 
          onClick={onPlayPause} 
          size="lg"
          className="rounded-full shadow-lg shadow-primary/30 h-14 w-14"
          data-testid="button-play-mobile"
        >
          {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
        </Button>
        
        {/* Next Track */}
        <Button 
          variant="secondary"
          size="icon"
          className="rounded-full shadow-lg h-10 w-10"
          onClick={onNextTrack}
          disabled={!hasLibraryTracks}
          data-testid="button-next-mobile"
        >
          <SkipForward className="h-4 w-4" />
        </Button>
        
        {/* Upload Button */}
        <div className="relative">
          <input
            type="file"
            accept="audio/*"
            onChange={onFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            data-testid="input-audio-upload-mobile"
          />
          <Button 
            variant="secondary"
            size="icon"
            className="rounded-full shadow-lg"
          >
            <Upload className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Settings Toggle */}
        <Button 
          variant="secondary"
          size="icon"
          className="rounded-full shadow-lg"
          onClick={() => setShowMobileControls(!showMobileControls)}
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
      </div>
      
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
      style={{ pointerEvents: 'auto' }}
    >
      <div className="glass-panel rounded-t-3xl max-h-[70vh] overflow-hidden">
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
              
              {/* Preset Selector with Toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  checked={settings.presetEnabled}
                  onCheckedChange={(checked) => { saveScrollPositions(); setSettings({ ...settings, presetEnabled: checked }); }}
                  data-testid="switch-preset-toggle-mobile"
                />
                <Select
                  value={settings.presetName}
                  onValueChange={(val) => { saveScrollPositions(); setSettings({ ...settings, presetName: val as PresetName }); }}
                  disabled={!settings.presetEnabled}
                >
                  <SelectTrigger className={`flex-1 bg-black/50 border-white/10 font-mono h-12 text-base ${!settings.presetEnabled ? 'opacity-50' : ''}`} data-testid="select-preset-mobile">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border-white/10">
                    {presets.map((preset) => (
                      <SelectItem key={preset} value={preset} className="font-mono focus:bg-primary/20 py-3">
                        {preset}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Color Palette Row */}
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
                {colorPalettes.map((palette) => (
                  <button
                    key={palette.name}
                    onClick={() => { saveScrollPositions(); setSettings({ ...settings, colorPalette: palette.colors }); }}
                    className={`flex-shrink-0 w-10 h-10 rounded-full border-2 transition-all ${
                      JSON.stringify(settings.colorPalette) === JSON.stringify(palette.colors)
                        ? "border-white ring-2 ring-primary/50 scale-110"
                        : "border-transparent opacity-60"
                    }`}
                    style={{ background: `linear-gradient(135deg, ${palette.colors[0]}, ${palette.colors[1]})` }}
                    title={palette.name}
                    data-testid={`button-palette-mobile-${palette.name.toLowerCase().replace(/\s/g, '-')}`}
                  />
                ))}
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
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                          <ImagePlus className="w-8 h-8 opacity-30" />
                          <span className="text-xs opacity-50">Tap to add artwork</span>
                        </div>
                      )}
                      
                      {isAnalyzing && (
                        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
                          <Loader2 className="w-8 h-8 text-primary animate-spin" />
                          <span className="text-xs text-primary">Analyzing...</span>
                        </div>
                      )}
                      
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleThumbnailUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        data-testid="input-thumbnail-upload-mobile"
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
          onClick={() => setIsDesktopPanelVisible(true)}
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
      >
            {/* Panel Header with hide button */}
            <div className="flex items-center justify-between gap-4 px-6 py-2 border-b border-white/10">
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

            {/* Scrollable horizontal content */}
            <div ref={desktopScrollRef} className="overflow-x-auto p-4" style={{ overscrollBehavior: 'contain' }}>
              <div className="flex gap-6 min-w-max">
                
                {/* Audio Controls Section - Enhanced Player */}
                <div className="flex flex-col gap-3 min-w-[320px]">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Now Playing</Label>
                    <span className="text-xs text-muted-foreground truncate max-w-[180px]" title={trackName}>
                      {trackName || "No track loaded"}
                    </span>
                  </div>
                  
                  {/* Timeline / Progress Bar */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-10 text-right font-mono">
                      {formatTime(currentTime)}
                    </span>
                    <div className="flex-1 relative h-2 group">
                      <div 
                        className="absolute inset-0 bg-white/10 rounded-full overflow-hidden cursor-pointer"
                        onClick={(e) => {
                          if (onSeek && duration > 0) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = e.clientX - rect.left;
                            const percent = x / rect.width;
                            onSeek(percent * duration);
                          }
                        }}
                        data-testid="timeline-progress"
                      >
                        <div 
                          className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-100"
                          style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%" }}
                        />
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={duration || 100}
                        value={currentTime}
                        onChange={(e) => onSeek?.(parseFloat(e.target.value))}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        data-testid="timeline-slider"
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-10 font-mono">
                      {formatTime(duration)}
                    </span>
                  </div>
                  
                  {/* Transport Controls */}
                  <div className="flex items-center justify-center gap-2">
                    {/* Previous Track */}
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={onPreviousTrack}
                      disabled={!hasLibraryTracks}
                      className="h-9 w-9"
                      data-testid="button-previous"
                      title="Previous track / Restart"
                    >
                      <SkipBack className="h-4 w-4" />
                    </Button>
                    
                    {/* Play/Pause */}
                    <Button 
                      onClick={onPlayPause} 
                      size="icon"
                      className="h-12 w-12 rounded-full"
                      data-testid="button-play"
                    >
                      {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                    </Button>
                    
                    {/* Next Track */}
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={onNextTrack}
                      disabled={!hasLibraryTracks}
                      className="h-9 w-9"
                      data-testid="button-next"
                      title="Next track"
                    >
                      <SkipForward className="h-4 w-4" />
                    </Button>
                    
                    {/* Upload */}
                    <div className="relative ml-2">
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={onFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        data-testid="input-audio-upload"
                      />
                      <Button variant="outline" size="icon" className="h-9 w-9 border-primary/50 text-primary">
                        <Upload className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {/* Volume */}
                    <div className="flex items-center gap-1 ml-2">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onVolumeChange?.(volume > 0 ? 0 : 1)}
                        data-testid="button-mute"
                      >
                        {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                      </Button>
                      <Slider
                        value={[volume * 100]}
                        min={0}
                        max={100}
                        step={1}
                        onValueChange={(v) => onVolumeChange?.(v[0] / 100)}
                        className="w-16"
                        data-testid="slider-volume"
                      />
                    </div>
                  </div>
                  
                  {/* Secondary Controls */}
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className={`flex-1 text-xs border-destructive/50 text-destructive ${isRecording ? 'animate-pulse bg-destructive/20' : ''}`}
                      onClick={onToggleRecording}
                      data-testid="button-record"
                    >
                      <Disc className={`mr-1 h-3 w-3 ${isRecording ? 'animate-spin' : ''}`} />
                      {isRecording ? "Stop" : "Record"}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={onToggleFullscreen}
                      data-testid="button-fullscreen"
                    >
                      {isFullscreen ? <Minimize className="mr-1 h-3 w-3" /> : <Maximize className="mr-1 h-3 w-3" />}
                      {isFullscreen ? "Exit" : "Full"}
                    </Button>
                  </div>
                </div>

                <div className="w-px bg-white/10 self-stretch" />

                {/* Artwork Section */}
                <div className="flex flex-col gap-2 min-w-40">
                  <div className="flex justify-between items-center gap-2">
                    <Label className="text-xs uppercase tracking-widest text-accent font-bold">Artwork</Label>
                    {isAnalyzing && <Loader2 className="w-3 h-3 text-primary animate-spin" />}
                  </div>
                  <div className="relative w-24 h-24 rounded-lg border border-white/10 bg-black/50 overflow-hidden group cursor-pointer">
                    {displayThumbnail ? (
                      <img src={displayThumbnail} alt="Thumbnail" className="w-full h-full object-cover" data-testid="img-thumbnail" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <ImagePlus className="w-6 h-6 opacity-30" />
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleThumbnailUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      data-testid="input-thumbnail-upload"
                    />
                  </div>
                  {analysis && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-xs border-accent/50 text-accent"
                      onClick={applyAIPalette}
                      data-testid="button-apply-ai-palette"
                    >
                      <Sparkles className="mr-1 h-3 w-3" />
                      Apply AI
                    </Button>
                  )}
                </div>

                <div className="w-px bg-white/10 self-stretch" />

                {/* Preset & Visual Settings */}
                <div className="flex flex-col gap-3 min-w-48">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs uppercase tracking-widest text-primary font-bold">Preset</Label>
                    <Switch
                      checked={settings.presetEnabled}
                      onCheckedChange={(checked) => { saveScrollPositions(); setSettings({ ...settings, presetEnabled: checked }); }}
                      data-testid="switch-preset-toggle"
                    />
                  </div>
                  <Select
                    value={settings.presetName}
                    onValueChange={(val) => { saveScrollPositions(); setSettings({ ...settings, presetName: val as PresetName }); }}
                    disabled={!settings.presetEnabled}
                  >
                    <SelectTrigger className={`bg-black/50 border-white/10 font-mono h-9 text-sm ${!settings.presetEnabled ? 'opacity-50' : ''}`} data-testid="select-preset">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border-white/10">
                      {presets.map((preset) => (
                        <SelectItem key={preset} value={preset} className="font-mono focus:bg-primary/20">
                          {preset}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="uppercase tracking-widest">Intensity</span>
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
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="uppercase tracking-widest">Speed</span>
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

                <div className="w-px bg-white/10 self-stretch" />

                {/* Color Palette */}
                <div className="flex flex-col gap-2 min-w-48">
                  <Label className="text-xs uppercase tracking-widest text-accent font-bold">Palette</Label>
                  <div className="flex gap-2 flex-wrap">
                    {colorPalettes.map((palette) => (
                      <button
                        key={palette.name}
                        onClick={() => { saveScrollPositions(); setSettings({ ...settings, colorPalette: palette.colors }); }}
                        className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                          JSON.stringify(settings.colorPalette) === JSON.stringify(palette.colors)
                            ? "border-white ring-2 ring-primary/50 scale-110"
                            : "border-transparent opacity-60 hover:opacity-100"
                        }`}
                        style={{ background: `linear-gradient(135deg, ${palette.colors[0]}, ${palette.colors[1]})` }}
                        title={palette.name}
                        data-testid={`button-palette-${palette.name.toLowerCase().replace(/\s/g, '-')}`}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground" data-testid="text-palette-name">{currentPaletteName}</p>
                </div>

                <div className="w-px bg-white/10 self-stretch" />

                {/* Artwork Filters */}
                <div className="flex flex-col gap-2 min-w-56">
                  <Label className="text-xs uppercase tracking-widest text-purple-400 font-bold">Filters</Label>
                  <div className="flex gap-1 flex-wrap max-w-56">
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
                          className={`text-[10px] py-1 px-2 rounded border transition-all ${
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

                <div className="w-px bg-white/10 self-stretch" />

                {/* Psy Overlays */}
                <div className="flex flex-col gap-2 min-w-44">
                  <Label className="text-xs uppercase tracking-widest text-cyan-400 font-bold">Psy Overlays</Label>
                  <div className="flex gap-1 flex-wrap max-w-44">
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
                          className={`text-[10px] py-1 px-2 rounded border transition-all ${
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
                  <p className="text-[10px] text-muted-foreground">Layer on top of any preset</p>
                </div>

                <div className="w-px bg-white/10 self-stretch" />

                {/* Save Actions */}
                <div className="flex flex-col gap-2 min-w-32">
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Save</Label>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="justify-start text-xs"
                    onClick={onSavePreset}
                    data-testid="button-save-preset"
                  >
                    <Save className="mr-2 h-3 w-3" /> Save Preset
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="justify-start text-xs"
                    onClick={onSaveToLibrary}
                    data-testid="button-save-library"
                  >
                    <FolderPlus className="mr-2 h-3 w-3" /> Save to Library
                  </Button>
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
