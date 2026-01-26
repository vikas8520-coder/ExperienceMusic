import { useState, useRef, useCallback } from "react";
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
  const [mobileActiveSlide, setMobileActiveSlide] = useState(0);
  
  const desktopScrollRef = useRef<HTMLDivElement>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  
  const updateSetting = useCallback(<K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    setSettings({ ...settings, [key]: value });
  }, [settings, setSettings]);

  // Helper functions to generate CSS filter strings
  const getFilterCssString = (filters: ImageFilterId[]): string => {
    const cssFilters: string[] = [];
    const safeFilters = filters || ["none"];
    
    safeFilters.forEach(filterId => {
      switch (filterId) {
        case 'kaleidoscope':
          cssFilters.push('hue-rotate(30deg)', 'saturate(1.5)');
          break;
        case 'colorshift':
          cssFilters.push('hue-rotate(60deg)');
          break;
        case 'invert':
          cssFilters.push('invert(1)');
          break;
        case 'pixelate':
          cssFilters.push('contrast(1.2)', 'saturate(0.8)');
          break;
        case 'rgbsplit':
          cssFilters.push('saturate(1.3)', 'contrast(1.1)');
          break;
        case 'wave':
          cssFilters.push('blur(1px)', 'saturate(1.2)');
          break;
      }
    });
    
    return cssFilters.length > 0 ? cssFilters.join(' ') : 'none';
  };

  const getFilterTransformString = (filters: ImageFilterId[]): string => {
    const transforms: string[] = [];
    const safeFilters = filters || ["none"];
    
    safeFilters.forEach(filterId => {
      switch (filterId) {
        case 'mirror':
          transforms.push('scaleX(-1)');
          break;
        case 'zoompulse':
          transforms.push('scale(1.05)');
          break;
      }
    });
    
    return transforms.length > 0 ? transforms.join(' ') : 'none';
  };

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

  // Mobile floating controls (always visible at bottom)
  const MobileFloatingControls = () => (
    <div className="fixed bottom-0 left-0 right-0 z-30 md:hidden">
      <div className="glass-panel border-t border-white/10 px-4 py-3 flex items-center justify-around gap-2">
        {/* Upload Button */}
        <label className="relative cursor-pointer touch-manipulation">
          <input
            type="file"
            accept="*/*"
            onChange={onFileUpload}
            className="sr-only"
            data-testid="input-audio-upload-mobile"
          />
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/20 active:bg-primary/40 transition-colors">
            <Upload className="h-5 w-5 text-primary" />
          </div>
        </label>
        
        {/* Library Button */}
        <Button 
          variant="ghost"
          size="icon"
          onClick={onToggleLibrary}
          data-testid="button-library-mobile"
        >
          <Library className="h-5 w-5" />
        </Button>
        
        {/* Play/Pause Button - Center and Larger */}
        <Button 
          onClick={onPlayPause} 
          size="lg"
          className="rounded-full shadow-lg shadow-primary/30"
          data-testid="button-play-mobile"
        >
          {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-0.5" />}
        </Button>
        
        {/* Settings Toggle */}
        <Button 
          variant={showMobileControls ? "default" : "ghost"}
          size="icon"
          onClick={() => setShowMobileControls(!showMobileControls)}
          data-testid="button-settings-mobile"
        >
          <Settings className="h-5 w-5" />
        </Button>
        
        {/* Fullscreen Button */}
        <Button 
          variant="ghost"
          size="icon"
          onClick={onToggleFullscreen}
          data-testid="button-fullscreen-mobile"
        >
          {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
        </Button>
      </div>
    </div>
  );

  // Swipeable carousel settings panel with 6 slides
  const MobileSettingsModal = () => {
    const [touchStartX, setTouchStartX] = useState(0);
    const [touchDeltaX, setTouchDeltaX] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    
    // Use parent-level state to prevent reset on re-render
    const activeSlide = mobileActiveSlide;
    const setActiveSlide = setMobileActiveSlide;
    
    const slides = [
      { id: 'audio', title: 'Audio', icon: Upload },
      { id: 'artwork', title: 'Artwork', icon: ImagePlus },
      { id: 'preset', title: 'Preset', icon: Activity },
      { id: 'palette', title: 'Colors', icon: Sparkles },
      { id: 'filters', title: 'Filters', icon: Disc },
      { id: 'save', title: 'Save', icon: FolderPlus },
    ];

    const handleTouchStart = (e: React.TouchEvent) => {
      setTouchStartX(e.touches[0].clientX);
      setIsSwiping(true);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
      if (!isSwiping) return;
      const delta = e.touches[0].clientX - touchStartX;
      setTouchDeltaX(delta);
    };

    const handleTouchEnd = () => {
      if (Math.abs(touchDeltaX) > 50) {
        if (touchDeltaX > 0 && activeSlide > 0) {
          setActiveSlide(activeSlide - 1);
        } else if (touchDeltaX < 0 && activeSlide < slides.length - 1) {
          setActiveSlide(activeSlide + 1);
        }
      }
      setTouchDeltaX(0);
      setIsSwiping(false);
    };

    const goToSlide = (index: number) => {
      setActiveSlide(index);
    };

    return (
      <AnimatePresence>
        {showMobileControls && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 z-40 md:hidden"
              onClick={() => setShowMobileControls(false)}
            />
            
            {/* Modal */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 400 }}
              className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/98 backdrop-blur-xl rounded-t-3xl"
              style={{ height: '70vh' }}
            >
              {/* Drag Handle */}
              <div className="flex justify-center py-3">
                <div className="w-10 h-1 bg-white/20 rounded-full" />
              </div>
              
              {/* Slide Indicators */}
              <div className="flex justify-center gap-2 px-4 pb-3">
                {slides.map((slide, index) => (
                  <button
                    key={slide.id}
                    onClick={() => goToSlide(index)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      activeSlide === index
                        ? "bg-primary text-primary-foreground"
                        : "bg-white/5 text-foreground/50"
                    }`}
                    data-testid={`slide-tab-${slide.id}`}
                  >
                    <slide.icon className="w-3 h-3" />
                    <span className={activeSlide === index ? "" : "hidden"}>{slide.title}</span>
                  </button>
                ))}
              </div>
              
              {/* Swipeable Content Area */}
              <div 
                className="relative overflow-hidden flex-1"
                style={{ height: 'calc(70vh - 100px)' }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <motion.div
                  className="flex h-full"
                  animate={{ x: `calc(-${activeSlide * 100}% + ${touchDeltaX}px)` }}
                  transition={{ type: "spring", damping: 30, stiffness: 300 }}
                >
                  {/* Slide 1: Audio Upload */}
                  <div className="w-full flex-shrink-0 px-6 py-4 overflow-y-auto">
                    <div className="flex flex-col items-center justify-center h-full gap-6">
                      <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Upload className="w-10 h-10 text-primary" />
                      </div>
                      <div className="text-center space-y-2">
                        <h3 className="text-xl font-semibold">Upload Audio</h3>
                        <p className="text-sm text-muted-foreground">Select an audio file to visualize</p>
                      </div>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="*/*"
                          onChange={onFileUpload}
                          className="sr-only"
                          data-testid="input-audio-slide"
                        />
                        <div className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-medium">
                          Choose File
                        </div>
                      </label>
                      {trackName && (
                        <div className="px-4 py-2 bg-white/5 rounded-xl">
                          <p className="text-sm text-center truncate max-w-[200px]">{trackName}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Slide 2: Artwork Upload */}
                  <div className="w-full flex-shrink-0 px-6 py-4 overflow-y-auto">
                    <div className="flex flex-col items-center justify-center h-full gap-6">
                      <div className="relative w-32 h-32 rounded-2xl border-2 border-dashed border-white/20 overflow-hidden">
                        {displayThumbnail ? (
                          <img src={displayThumbnail} alt="Artwork" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-white/5">
                            <ImagePlus className="w-10 h-10 text-muted-foreground/30" />
                          </div>
                        )}
                        {isAnalyzing && (
                          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                          </div>
                        )}
                        <input
                          type="file"
                          accept="*/*"
                          onChange={handleThumbnailUpload}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          data-testid="input-thumbnail-slide"
                        />
                      </div>
                      <div className="text-center space-y-2">
                        <h3 className="text-xl font-semibold">Artwork</h3>
                        <p className="text-sm text-muted-foreground">Tap to upload background image</p>
                      </div>
                      {analysis && (
                        <Button onClick={applyAIPalette} className="gap-2" data-testid="button-apply-ai-slide">
                          <Sparkles className="w-4 h-4" />
                          Apply AI Colors
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Slide 3: Preset Selection */}
                  <div className="w-full flex-shrink-0 px-6 py-4 overflow-y-auto">
                    <div className="space-y-4">
                      <div className="text-center pb-2">
                        <h3 className="text-xl font-semibold">Visualization</h3>
                        <p className="text-sm text-muted-foreground">Choose a preset style</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {presets.map((preset) => (
                          <button
                            key={preset}
                            onClick={() => setSettings({ ...settings, presetName: preset })}
                            className={`py-4 px-3 rounded-2xl text-sm font-medium transition-all ${
                              settings.presetName === preset
                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                                : "bg-white/5 text-foreground/70"
                            }`}
                            data-testid={`preset-slide-${preset.toLowerCase().replace(/\s/g, '-')}`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Slide 4: Color Palette */}
                  <div className="w-full flex-shrink-0 px-6 py-4 overflow-y-auto">
                    <div className="space-y-4">
                      <div className="text-center pb-2">
                        <h3 className="text-xl font-semibold">Colors</h3>
                        <p className="text-sm text-muted-foreground">Select a color palette</p>
                      </div>
                      <div className="grid grid-cols-5 gap-3">
                        {colorPalettes.map((palette) => (
                          <button
                            key={palette.name}
                            onClick={() => setSettings({ ...settings, colorPalette: palette.colors })}
                            className={`aspect-square rounded-2xl transition-all ${
                              JSON.stringify(settings.colorPalette) === JSON.stringify(palette.colors)
                                ? "ring-3 ring-white scale-110 shadow-lg"
                                : "opacity-60"
                            }`}
                            style={{ background: `linear-gradient(135deg, ${palette.colors[0]}, ${palette.colors[1]}, ${palette.colors[2]})` }}
                            title={palette.name}
                            data-testid={`palette-slide-${palette.name.toLowerCase().replace(/\s/g, '-')}`}
                          />
                        ))}
                      </div>
                      <div className="text-center pt-4">
                        <p className="text-sm text-muted-foreground">
                          Selected: <span className="text-foreground font-medium">{currentPaletteName}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Slide 5: Filters */}
                  <div className="w-full flex-shrink-0 px-6 py-4 overflow-y-auto">
                    <div className="space-y-4">
                      <div className="text-center pb-2">
                        <h3 className="text-xl font-semibold">Filters</h3>
                        <p className="text-sm text-muted-foreground">Apply effects to artwork</p>
                      </div>
                      
                      {/* Live Preview with Filters */}
                      {displayThumbnail && (
                        <div className="flex justify-center pb-2">
                          <div 
                            className="w-24 h-24 rounded-xl overflow-hidden border border-white/10"
                            style={{
                              backgroundImage: `url(${displayThumbnail})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              filter: getFilterCssString(settings.imageFilters),
                              transform: getFilterTransformString(settings.imageFilters),
                            }}
                          />
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-3">
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
                              className={`py-4 px-3 rounded-2xl text-sm font-medium transition-all ${
                                isActive 
                                  ? "bg-purple-500/30 text-purple-300 ring-2 ring-purple-500 shadow-lg shadow-purple-500/20" 
                                  : "bg-white/5 text-foreground/60"
                              }`}
                              data-testid={`filter-slide-${filter.id}`}
                            >
                              {filter.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Slide 6: Save */}
                  <div className="w-full flex-shrink-0 px-6 py-4 overflow-y-auto">
                    <div className="flex flex-col items-center justify-center h-full gap-6">
                      <div className="w-24 h-24 rounded-2xl bg-green-500/10 flex items-center justify-center">
                        <FolderPlus className="w-10 h-10 text-green-500" />
                      </div>
                      <div className="text-center space-y-2">
                        <h3 className="text-xl font-semibold">Save Track</h3>
                        <p className="text-sm text-muted-foreground">Save to your library for later</p>
                      </div>
                      <Button 
                        size="lg"
                        className="px-8 py-6 text-lg rounded-2xl"
                        onClick={() => {
                          onSaveToLibrary?.();
                          setShowMobileControls(false);
                        }}
                        data-testid="button-save-slide"
                      >
                        <FolderPlus className="mr-2 h-5 w-5" />
                        Save to Library
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={onToggleLibrary}
                        className="gap-2"
                        data-testid="button-open-library-slide"
                      >
                        <Library className="w-4 h-4" />
                        View Library
                      </Button>
                    </div>
                  </div>
                </motion.div>
              </div>
              
              {/* Navigation Arrows */}
              <div className="absolute bottom-6 left-0 right-0 flex justify-between px-6">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => activeSlide > 0 && setActiveSlide(activeSlide - 1)}
                  className={activeSlide === 0 ? "opacity-30" : ""}
                  disabled={activeSlide === 0}
                  data-testid="button-prev-slide"
                >
                  <ChevronDown className="w-6 h-6 rotate-90" />
                </Button>
                <div className="flex gap-1.5">
                  {slides.map((_, index) => (
                    <div
                      key={index}
                      className={`w-2 h-2 rounded-full transition-all ${
                        activeSlide === index ? "bg-primary w-6" : "bg-white/20"
                      }`}
                    />
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => activeSlide < slides.length - 1 && setActiveSlide(activeSlide + 1)}
                  className={activeSlide === slides.length - 1 ? "opacity-30" : ""}
                  disabled={activeSlide === slides.length - 1}
                  data-testid="button-next-slide"
                >
                  <ChevronDown className="w-6 h-6 -rotate-90" />
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  };

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
                        accept="*/*"
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
                      accept="*/*"
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
                    onValueChange={(val) => setSettings({ ...settings, presetName: val as PresetName })}
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
                        onClick={() => setSettings({ ...settings, colorPalette: palette.colors })}
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
      <MobileSettingsModal />
      <MobileFloatingControls />
    </>
  );
}
