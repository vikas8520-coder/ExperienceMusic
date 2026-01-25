import { useState, useRef, useEffect } from "react";
import { AudioVisualizer } from "@/components/AudioVisualizer";
import { UIControls } from "@/components/UIControls";
import { useAudioAnalyzer } from "@/hooks/use-audio-analyzer";
import { colorPalettes, type PresetName } from "@/lib/visualizer-presets";
import { useCreatePreset } from "@/hooks/use-presets";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [audioFile, setAudioFile] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  // Media Recorder refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const { toast } = useToast();
  const createPreset = useCreatePreset();

  const [settings, setSettings] = useState({
    intensity: 1.0,
    speed: 0.5,
    colorPalette: colorPalettes[0].colors,
    presetName: "Energy Rings" as PresetName,
  });

  const { getAudioData, destNode } = useAudioAnalyzer(audioRef.current);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAudioFile(url);
      audioRef.current.src = url;
      setIsPlaying(false);
      toast({
        title: "Track Loaded",
        description: `Ready to play: ${file.name}`,
      });
    }
  };

  const togglePlay = () => {
    if (!audioFile && !audioRef.current.src) {
      toast({
        title: "No Audio",
        description: "Please upload an audio file first.",
        variant: "destructive",
      });
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.error("Play error:", e));
    }
    setIsPlaying(!isPlaying);
  };

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

  // Recording Logic
  const toggleRecording = () => {
    if (isRecording) {
      // Stop
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      toast({ title: "Processing Video", description: "Your recording is being prepared..." });
    } else {
      // Start
      const canvas = document.querySelector('canvas');
      if (!canvas || !destNode) return;

      const stream = canvas.captureStream(60); // 60 FPS
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
      
      // Auto-play if not playing
      if (!isPlaying) togglePlay();
    }
  };

  return (
    <div className="w-full h-screen relative bg-background overflow-hidden selection:bg-primary/30">
      
      {/* 3D Visualizer Layer */}
      <AudioVisualizer 
        getAudioData={getAudioData}
        settings={settings}
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
      />
      
      {/* Playback Progress Indicator (minimal) */}
      {isPlaying && (
        <div className="absolute bottom-0 left-0 w-full h-1 bg-white/10 z-20">
          <div className="h-full bg-primary animate-pulse w-full origin-left transform scale-x-100 transition-transform duration-1000 ease-linear" />
        </div>
      )}
    </div>
  );
}
