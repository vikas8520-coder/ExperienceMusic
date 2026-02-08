import { useState, useRef, useCallback, useEffect } from "react";
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
    try {
      localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(savedTracks));
    } catch (e) {
      console.error("Failed to save tracks:", e);
    }
  }, [savedTracks]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const { toast } = useToast();
  const createPreset = useCreatePreset();

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

  useEffect(() => {
    let lastTouchY = 0;
    let isZooming = false;
    
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const target = e.target as HTMLElement;
        const isOnCanvas = target.tagName === 'CANVAS' || target.closest('canvas');
        const isOnUI = target.closest('.glass-panel') || target.closest('button') || target.closest('input');
        
        if (isOnCanvas && !isOnUI) {
          isZooming = true;
          const touch1 = e.touches[0];
          const touch2 = e.touches[1];
          lastTouchY = (touch1.clientY + touch2.clientY) / 2;
        }
      }
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && isZooming) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentY = (touch1.clientY + touch2.clientY) / 2;
        const deltaY = lastTouchY - currentY;
        
        setVisualizationZoom(prev => {
          const newZoom = prev + deltaY * 0.008;
          return Math.max(0.5, Math.min(3, newZoom));
        });
        
        lastTouchY = currentY;
      }
    };
    
    const handleTouchEnd = () => {
      isZooming = false;
    };
    
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  const { getAudioData, destNode } = useAudioAnalyzer(audioRef.current, audioFile);

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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [audioFile, isPlaying, duration, toggleFullscreen]);

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
      
      // Try to extract embedded artwork from audio file
      try {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64 = (event.target?.result as string).split(',')[1];
          const response = await fetch('/api/extract-artwork', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioBase64: base64 })
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.artwork && data.mimeType) {
              const artworkUrl = `data:${data.mimeType};base64,${data.artwork}`;
              setThumbnailUrl(artworkUrl);
              toast({
                title: "Artwork Found",
                description: "Extracted embedded artwork from audio file.",
              });
            }
          }
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.log('No embedded artwork found or extraction failed');
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

  const toggleRecording = () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      toast({ title: "Processing Video", description: "Your recording is being prepared..." });
    } else {
      const canvas = document.querySelector('canvas');
      if (!canvas || !destNode) return;

      const qualitySettings = {
        "1080p": { bitrate: 15_000_000, label: "1080p" },
        "2k": { bitrate: 35_000_000, label: "2K" },
        "4k": { bitrate: 80_000_000, label: "4K" }
      };
      
      const settings = qualitySettings[recordingQuality];

      const stream = canvas.captureStream(60);
      const audioTrack = destNode.stream.getAudioTracks()[0];
      if (audioTrack) stream.addTrack(audioTrack);

      const mimeTypes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm'
      ];
      
      let selectedMimeType = 'video/webm';
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          selectedMimeType = type;
          break;
        }
      }

      const recorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
        videoBitsPerSecond: settings.bitrate
      });

      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `experience-${settings.label}-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "Download Started", description: `Your ${settings.label} video has been saved.` });
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      toast({ title: `Recording ${settings.label}`, description: "High quality recording started at 60fps" });
      
      if (!isPlaying) togglePlay();
    }
  };

  return (
    <div className="w-full h-screen relative bg-background overflow-hidden selection:bg-primary/30">
      
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
        getAudioData={getAudioData}
        settings={settings}
        backgroundImage={thumbnailUrl}
        zoom={visualizationZoom}
        fractalUniforms={fractalUniforms}
      />

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
  );
}
