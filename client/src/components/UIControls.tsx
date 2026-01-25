import { useState } from "react";
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
        className="h-14 w-14 rounded-full bg-primary hover:bg-primary/80 shadow-lg shadow-primary/30"
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
          size="lg"
          className="h-12 w-12 rounded-full shadow-lg"
        >
          <Upload className="h-5 w-5" />
        </Button>
      </div>
      
      {/* Settings Toggle */}
      <Button 
        variant="secondary"
        size="lg"
        className="h-12 w-12 rounded-full shadow-lg"
        onClick={() => setShowMobileControls(!showMobileControls)}
        data-testid="button-settings-mobile"
      >
        <Settings className="h-5 w-5" />
      </Button>
      
      {/* Library Button */}
      <Button 
        variant="secondary"
        size="lg"
        className="h-12 w-12 rounded-full shadow-lg"
        onClick={onToggleLibrary}
        data-testid="button-library-mobile"
      >
        <Library className="h-5 w-5" />
      </Button>
      
      {/* Fullscreen Button */}
      <Button 
        variant="secondary"
        size="lg"
        className="h-12 w-12 rounded-full shadow-lg"
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
                onValueChange={(val) => setSettings({ ...settings, presetName: val as PresetName })}
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
                    onClick={() => setSettings({ ...settings, colorPalette: palette.colors })}
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
                      onValueChange={([val]) => setSettings({ ...settings, intensity: val })}
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
                      onValueChange={([val]) => setSettings({ ...settings, speed: val })}
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
                      className={`border-destructive/50 text-destructive h-12 ${isRecording ? 'animate-pulse bg-destructive/20' : ''}`}
                      onClick={onToggleRecording}
                      data-testid="button-record-mobile"
                    >
                      <Disc className={`mr-2 h-4 w-4 ${isRecording ? 'animate-spin' : ''}`} />
                      {isRecording ? "Stop" : "Record"}
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="h-12"
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

  // Desktop sidebar (existing)
  const DesktopSidebar = () => (
    <motion.div 
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="absolute top-0 right-0 h-full w-80 glass-panel z-10 flex-col overflow-hidden hidden md:flex"
    >
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display text-primary text-glow tracking-widest">
              AURAL<span className="text-foreground">VIS</span>
            </h1>
            <p className="text-[10px] text-muted-foreground font-mono mt-1">
              AUDIO REACTIVE ENGINE V2.0
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleLibrary}
            className="text-muted-foreground hover:text-primary"
            data-testid="button-toggle-library"
          >
            <Library className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Current Track Display */}
        {trackName && (
          <div className="mt-4 p-3 bg-black/30 rounded-lg border border-white/5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Now Playing</p>
            <p className="text-sm font-medium text-foreground truncate" data-testid="text-current-track">
              {trackName.replace(/\.[^/.]+$/, "")}
            </p>
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Audio Controls */}
        <div className="space-y-3">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Audio</Label>
          <div className="flex gap-2">
            <Button 
              onClick={onPlayPause} 
              className="flex-1 bg-primary hover:bg-primary/80 font-bold tracking-wider h-12"
              data-testid="button-play"
            >
              {isPlaying ? <><Pause className="mr-2 h-5 w-5" /> PAUSE</> : <><Play className="mr-2 h-5 w-5" /> PLAY</>}
            </Button>
            <div className="relative">
              <input
                type="file"
                accept="audio/*"
                onChange={onFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                data-testid="input-audio-upload"
              />
              <Button variant="outline" size="icon" className="border-primary/50 text-primary hover:bg-primary/10 h-12 w-12">
                <Upload className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Thumbnail Upload Section */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label className="text-xs uppercase tracking-widest text-accent font-bold">Artwork</Label>
            <Sparkles className="w-3 h-3 text-accent/50" />
          </div>
          
          <div className="relative aspect-video rounded-xl border border-white/10 bg-black/50 overflow-hidden group cursor-pointer">
            {displayThumbnail ? (
              <img 
                src={displayThumbnail} 
                alt="Thumbnail" 
                className="w-full h-full object-cover"
                data-testid="img-thumbnail"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                <ImagePlus className="w-10 h-10 opacity-30" />
                <span className="text-xs opacity-50">Drop artwork here</span>
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
              data-testid="input-thumbnail-upload"
            />
            
            <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <p className="text-xs text-white font-medium">Click to upload</p>
            </div>
          </div>

          {analysis && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3 p-3 bg-black/30 rounded-lg border border-white/5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">AI Theme</span>
                <span className="text-xs font-mono text-accent" data-testid="text-ai-theme">{analysis.theme}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Mood</span>
                <span className="text-xs font-mono text-secondary" data-testid="text-ai-mood">{analysis.mood}</span>
              </div>
              <div className="flex gap-1">
                {analysis.colorPalette.slice(0, 7).map((color, i) => (
                  <div
                    key={i}
                    className="flex-1 aspect-square rounded"
                    style={{ backgroundColor: color }}
                    title={color}
                    data-testid={`color-swatch-${i}`}
                  />
                ))}
              </div>
              <Button 
                variant="outline" 
                size="sm"
                className="w-full text-xs border-accent/50 text-accent hover:bg-accent/10"
                onClick={applyAIPalette}
                data-testid="button-apply-ai-palette"
              >
                <Sparkles className="mr-2 h-3 w-3" />
                Apply AI Palette
              </Button>
            </motion.div>
          )}
          
          {/* Image Filter Selector - Multiple */}
          <div className="space-y-2 pt-4">
            <Label className="text-xs uppercase tracking-widest text-purple-400 font-bold">Artwork Filters</Label>
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
              {imageFilters.filter(f => f.id !== "none").map((filter) => {
                const isActive = settings.imageFilters.includes(filter.id);
                return (
                  <button
                    key={filter.id}
                    onClick={() => {
                      const newFilters = isActive
                        ? settings.imageFilters.filter(f => f !== filter.id)
                        : [...settings.imageFilters.filter(f => f !== "none"), filter.id];
                      setSettings({ 
                        ...settings, 
                        imageFilters: newFilters.length === 0 ? ["none"] : newFilters 
                      });
                    }}
                    className={`text-xs py-2 px-2 rounded-lg border transition-all ${
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
            <p className="text-[10px] text-muted-foreground">Click to layer multiple psy effects</p>
          </div>
        </div>

        <div className="h-px bg-white/10" />

        {/* Visual Settings */}
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs uppercase tracking-widest text-primary font-bold">Preset</Label>
              <Activity className="w-3 h-3 text-primary/50" />
            </div>
            <Select
              value={settings.presetName}
              onValueChange={(val) => setSettings({ ...settings, presetName: val as PresetName })}
            >
              <SelectTrigger className="bg-black/50 border-white/10 font-mono h-11" data-testid="select-preset">
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
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <Label className="text-xs uppercase tracking-widest">Intensity</Label>
              <span className="text-xs font-mono text-primary">{settings.intensity.toFixed(1)}</span>
            </div>
            <Slider
              min={0} max={3} step={0.1}
              value={[settings.intensity]}
              onValueChange={([val]) => setSettings({ ...settings, intensity: val })}
              className="[&>.absolute]:bg-primary"
              data-testid="slider-intensity"
            />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <Label className="text-xs uppercase tracking-widest">Speed</Label>
              <span className="text-xs font-mono text-secondary">{settings.speed.toFixed(1)}</span>
            </div>
            <Slider
              min={0} max={2} step={0.1}
              value={[settings.speed]}
              onValueChange={([val]) => setSettings({ ...settings, speed: val })}
              className="[&>.absolute]:bg-secondary"
              data-testid="slider-speed"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest text-accent font-bold">Palette</Label>
            <div className="grid grid-cols-5 gap-2 mt-2">
              {colorPalettes.map((palette) => (
                <button
                  key={palette.name}
                  onClick={() => setSettings({ ...settings, colorPalette: palette.colors })}
                  className={`w-full aspect-square rounded-full border-2 transition-all hover:scale-110 ${
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
            <p className="text-[10px] text-right text-muted-foreground pt-1" data-testid="text-palette-name">{currentPaletteName}</p>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-6 border-t border-white/10 space-y-3">
        <Button 
          variant="outline" 
          className={`w-full border-destructive/50 hover:bg-destructive/10 text-destructive h-11 ${isRecording ? 'animate-pulse bg-destructive/20' : ''}`}
          onClick={onToggleRecording}
          data-testid="button-record"
        >
          <Disc className={`mr-2 h-4 w-4 ${isRecording ? 'animate-spin' : ''}`} />
          {isRecording ? "STOP RECORDING" : "RECORD SESSION"}
        </Button>
        
        <div className="flex gap-2">
          <Button 
            variant="ghost" 
            className="flex-1 text-xs text-muted-foreground hover:text-white"
            onClick={onSavePreset}
            data-testid="button-save-preset"
          >
            <Save className="mr-2 h-3 w-3" /> Save Preset
          </Button>
          <Button 
            variant="ghost" 
            className="flex-1 text-xs text-muted-foreground hover:text-white"
            onClick={onSaveToLibrary}
            data-testid="button-save-library"
          >
            <FolderPlus className="mr-2 h-3 w-3" /> Save to Library
          </Button>
        </div>
        
        <Button 
          variant="outline" 
          className="w-full h-11 border-white/20"
          onClick={onToggleFullscreen}
          data-testid="button-fullscreen"
        >
          {isFullscreen ? <Minimize className="mr-2 h-4 w-4" /> : <Maximize className="mr-2 h-4 w-4" />}
          {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        </Button>
        
        {zoom !== undefined && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ZoomIn className="h-3 w-3" />
            <span>Zoom: {(zoom * 100).toFixed(0)}%</span>
            <span className="text-[10px]">(2-finger swipe)</span>
          </div>
        )}
      </div>
    </motion.div>
  );

  return (
    <>
      <DesktopSidebar />
      <MobileBottomSheet />
      <MobileFloatingControls />
    </>
  );
}
