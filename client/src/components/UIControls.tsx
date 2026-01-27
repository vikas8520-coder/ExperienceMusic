import { useState, useRef, useCallback, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Play, Pause, Upload, Save, Disc, Activity, ImagePlus, Sparkles, Loader2, Library, FolderPlus, ChevronUp, ChevronDown, X, Settings, Maximize, Minimize, ZoomIn } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { colorPalettes, presets, imageFilters, type PresetName, type ImageFilterId } from "@/lib/visualizer-presets";
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
    imageFilters: ImageFilterId[];
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
}

export interface ThumbnailAnalysis {
  colorPalette: string[];
  theme: string;
  mood: string;
  visualSuggestions: string[];
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
  
  // Restore scroll positions after render
  useEffect(() => {
    if (desktopScrollRef.current && desktopScrollPosition.current > 0) {
      desktopScrollRef.current.scrollLeft = desktopScrollPosition.current;
    }
    if (mobileScrollRef.current && mobileScrollPosition.current > 0) {
      mobileScrollRef.current.scrollLeft = mobileScrollPosition.current;
    }
  });
  
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
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 md:hidden">
      {/* Play/Pause Button */}
      <Button 
        onClick={onPlayPause} 
        size="lg"
        className="rounded-full shadow-lg shadow-primary/30"
        data-testid="button-play-mobile"
      >
        {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
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

  // Mobile bottom sheet
  const MobileBottomSheet = () => (
    <AnimatePresence>
      {showMobileControls && (
        <motion.div 
          initial={{ y: "100%" }}
          animate={{ y: isMobileExpanded ? 0 : "calc(100% - 180px)" }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-20 left-0 right-0 z-20 md:hidden"
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
              
              {/* Preset Selector */}
              <Select
                value={settings.presetName}
                onValueChange={(val) => { saveScrollPositions(); setSettings({ ...settings, presetName: val as PresetName }); }}
              >
                <SelectTrigger className="bg-black/50 border-white/10 font-mono h-12 text-base" data-testid="select-preset-mobile">
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
            
            {/* Expanded Controls */}
            <AnimatePresence>
              {isMobileExpanded && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-4 pb-6 space-y-6 overflow-y-auto max-h-[40vh]"
                  style={{ overscrollBehavior: 'contain' }}
                  ref={mobileScrollRef}
                >
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
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Desktop bottom panel
  const DesktopBottomPanel = () => (
    <div className="hidden md:block">
      {/* Toggle button when panel is hidden */}
      <AnimatePresence>
        {!isDesktopPanelVisible && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20"
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main bottom panel */}
      <AnimatePresence>
        {isDesktopPanelVisible && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 glass-panel z-10 border-t border-white/10"
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
                
                {/* Audio Controls Section */}
                <div className="flex flex-col gap-3 min-w-48">
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Audio</Label>
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      onClick={onPlayPause} 
                      className="flex-1 font-bold tracking-wider"
                      data-testid="button-play"
                    >
                      {isPlaying ? <><Pause className="mr-2 h-4 w-4" /> PAUSE</> : <><Play className="mr-2 h-4 w-4" /> PLAY</>}
                    </Button>
                    <div className="relative">
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={onFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        data-testid="input-audio-upload"
                      />
                      <Button variant="outline" size="icon" className="border-primary/50 text-primary">
                        <Upload className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
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
                  <Label className="text-xs uppercase tracking-widest text-primary font-bold">Preset</Label>
                  <Select
                    value={settings.presetName}
                    onValueChange={(val) => { saveScrollPositions(); setSettings({ ...settings, presetName: val as PresetName }); }}
                  >
                    <SelectTrigger className="bg-black/50 border-white/10 font-mono h-9 text-sm" data-testid="select-preset">
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
          </motion.div>
        )}
      </AnimatePresence>
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
