import { useState, useRef, useCallback, useEffect } from "react";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { UIControls, type ThumbnailAnalysis } from "@/components/UIControls";
import { TrackLibrary } from "@/components/TrackLibrary";
import { TopPlayerDrawer } from "@/components/TopPlayerDrawer";
import { useAudioAnalyzer } from "@/hooks/use-audio-analyzer";
import { colorPalettes, type PresetName, type ImageFilterId, type PsyOverlayId } from "@/lib/visualizer-presets";
import { useCreatePreset } from "@/hooks/use-presets";
import { useToast } from "@/hooks/use-toast";

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
  const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
  const [isRecording, setIsRecording] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [visualizationZoom, setVisualizationZoom] = useState(1);
  const [playerDrawerOpen, setPlayerDrawerOpen] = useState(false);
  
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

  const [settings, setSettings] = useState({
    intensity: 1.0,
    speed: 0.5,
    colorPalette: colorPalettes[0].colors,
    presetName: "Energy Rings" as PresetName,
    presetEnabled: true,
    imageFilters: ["none"] as ImageFilterId[],
    psyOverlays: [] as PsyOverlayId[],
  });

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

      const stream = canvas.captureStream(60);
      const audioTrack = destNode.stream.getAudioTracks()[0];
      if (audioTrack) stream.addTrack(audioTrack);

      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm; codecs=vp9'
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
        a.download = `auralvis-recording-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "Download Started", description: "Your video has been saved." });
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      
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
      />

      {/* Top Player Drawer - Separate from settings panel */}
      <TopPlayerDrawer
        isOpen={playerDrawerOpen}
        onToggle={() => setPlayerDrawerOpen(!playerDrawerOpen)}
        isPlaying={isPlaying}
        onPlayPause={togglePlay}
        currentTime={currentTime}
        duration={duration}
        onSeek={handleSeek}
        volume={volume}
        onVolume={handleVolumeChange}
        onPreviousTrack={handlePreviousTrack}
        onNextTrack={handleNextTrack}
        title={audioFileName ? audioFileName.replace(/\.[^/.]+$/, "") : "No Track Loaded"}
        hasLibraryTracks={savedTracks.length > 0}
      />

      {/* UI Overlay */}
      <UIControls 
        isPlaying={isPlaying}
        onPlayPause={togglePlay}
        onFileUpload={handleFileUpload}
        settings={settings}
        setSettings={setSettings}
        isRecording={isRecording}
        onToggleRecording={toggleRecording}
        onSavePreset={handleSavePreset}
        onThumbnailAnalysis={handleThumbnailAnalysis}
        onThumbnailUpload={handleThumbnailUpload}
        thumbnailUrl={thumbnailUrl}
        onSaveToLibrary={handleSaveToLibrary}
        onToggleLibrary={() => setShowLibrary(!showLibrary)}
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
      />
      
      {/* Track Library Panel */}
      {showLibrary && (
        <TrackLibrary 
          tracks={savedTracks}
          onLoadTrack={handleLoadTrack}
          onDeleteTrack={handleDeleteTrack}
          onClose={() => setShowLibrary(false)}
        />
      )}
      
    </div>
  );
}
