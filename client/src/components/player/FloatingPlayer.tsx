import { useRef } from "react";
import { motion } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { Upload, Play, Pause, Volume2, VolumeX, SkipBack, SkipForward } from "lucide-react";

interface FloatingPlayerProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  trackName?: string;
  currentTime?: number;
  duration?: number;
  onSeek?: (time: number) => void;
  volume?: number;
  onVolumeChange?: (volume: number) => void;
  onPreviousTrack?: () => void;
  onNextTrack?: () => void;
  hasLibraryTracks?: boolean;
}

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function FloatingPlayer({
  isPlaying,
  onPlayPause,
  onFileUpload,
  trackName,
  currentTime = 0,
  duration = 0,
  onSeek,
  volume = 1,
  onVolumeChange,
  onPreviousTrack,
  onNextTrack,
  hasLibraryTracks = false,
}: FloatingPlayerProps) {
  const audioInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        onChange={(e) => { onFileUpload(e); e.target.value = ''; }}
        className="hidden"
        data-testid="input-audio-upload-floating"
      />

      <motion.div
        drag
        dragMomentum={false}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 glass-panel rounded-full px-4 py-2 flex items-center gap-2 cursor-grab active:cursor-grabbing select-none"
        style={{ pointerEvents: "auto", minWidth: 320, maxWidth: 520 }}
        data-testid="floating-player"
        data-ui-root="true"
      >
        <button
          onClick={() => audioInputRef.current?.click()}
          className="text-white/50 hover:text-white transition-colors shrink-0"
          data-testid="floating-upload"
        >
          <Upload className="w-3.5 h-3.5" />
        </button>

        {hasLibraryTracks && (
          <button
            onClick={onPreviousTrack}
            className="text-white/50 hover:text-white transition-colors shrink-0"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          onClick={onPlayPause}
          className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0 hover:bg-white/20 transition-colors"
          data-testid="floating-play-pause"
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
        </button>

        {hasLibraryTracks && (
          <button
            onClick={onNextTrack}
            className="text-white/50 hover:text-white transition-colors shrink-0"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        )}

        <div className="max-w-[100px] truncate text-[10px] text-white/60 shrink-0">
          {trackName ? trackName.replace(/\.[^/.]+$/, "") : "No Track"}
        </div>

        <span className="text-[10px] text-muted-foreground font-mono w-8 text-right shrink-0">
          {formatTime(currentTime)}
        </span>

        <div className="flex-1 min-w-[60px]">
          <Slider
            min={0}
            max={duration || 1}
            step={0.1}
            value={[currentTime]}
            onValueChange={([val]) => onSeek?.(val)}
            className="w-full"
          />
        </div>

        <span className="text-[10px] text-muted-foreground font-mono w-8 shrink-0">
          {formatTime(duration)}
        </span>

        <button
          onClick={() => onVolumeChange?.(volume > 0 ? 0 : 1)}
          className="text-white/60 hover:text-white transition-colors shrink-0"
        >
          {volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={[volume]}
          onValueChange={([val]) => onVolumeChange?.(val)}
          className="w-14"
        />
      </motion.div>
    </>
  );
}
