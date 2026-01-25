import { useState, useRef, useCallback } from "react";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { UIControls, type ThumbnailAnalysis } from "@/components/UIControls";
import { TrackLibrary } from "@/components/TrackLibrary";
import { useAudioAnalyzer } from "@/hooks/use-audio-analyzer";
import { colorPalettes, type PresetName, type ImageFilterId } from "@/lib/visualizer-presets";
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

export default function Home() {
  const [audioFile, setAudioFile] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string>("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [savedTracks, setSavedTracks] = useState<SavedTrack[]>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const { toast } = useToast();
  const createPreset = useCreatePreset();

  const [settings, setSettings] = useState({
    intensity: 1.0,
    speed: 0.5,
    colorPalette: colorPalettes[0].colors,
    presetName: "Energy Rings" as PresetName,
    imageFilter: "none" as ImageFilterId,
  });

  const { getAudioData, destNode } = useAudioAnalyzer(audioRef.current, audioFile);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
      
      {/* Playback Progress Indicator */}
      {isPlaying && (
        <div className="absolute bottom-0 left-0 w-full h-1 bg-white/10 z-20">
          <div className="h-full bg-primary animate-pulse w-full origin-left transform scale-x-100 transition-transform duration-1000 ease-linear" />
        </div>
      )}
    </div>
  );
}
