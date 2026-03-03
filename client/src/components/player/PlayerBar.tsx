import { useRef } from "react";
import { Slider } from "@/components/ui/slider";
import { Upload, Play, Pause, Volume2, VolumeX, SkipBack, SkipForward } from "lucide-react";

interface PlayerBarProps {
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

export function PlayerBar({
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
}: PlayerBarProps) {
  const audioInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        onChange={(e) => { onFileUpload(e); e.target.value = ''; }}
        className="hidden"
        data-testid="input-audio-upload-bar"
      />

      <div className="glass-panel rounded-xl p-3 flex items-center gap-2" data-testid="player-bar" data-ui-root="true" style={{ pointerEvents: 'auto' }}>
        <button
          onClick={() => audioInputRef.current?.click()}
          className="text-white/50 hover:text-white transition-colors shrink-0"
          data-testid="button-audio-upload"
        >
          <Upload className="w-4 h-4" />
        </button>

        {hasLibraryTracks && (
          <button
            onClick={onPreviousTrack}
            className="text-white/50 hover:text-white transition-colors shrink-0"
          >
            <SkipBack className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={onPlayPause}
          className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0 hover:bg-white/20 transition-colors"
          data-testid="button-play-pause"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        {hasLibraryTracks && (
          <button
            onClick={onNextTrack}
            className="text-white/50 hover:text-white transition-colors shrink-0"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        )}

        <div className="max-w-[120px] truncate text-xs text-white/60 shrink-0">
          {trackName ? trackName.replace(/\.[^/.]+$/, "") : "No Track"}
        </div>

        <span className="text-xs text-muted-foreground font-mono w-10 text-right shrink-0">
          {formatTime(currentTime)}
        </span>

        <div className="flex-1 min-w-0">
          <Slider
            min={0}
            max={duration || 1}
            step={0.1}
            value={[currentTime]}
            onValueChange={([val]) => onSeek?.(val)}
            className="w-full"
          />
        </div>

        <span className="text-xs text-muted-foreground font-mono w-10 shrink-0">
          {formatTime(duration)}
        </span>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onVolumeChange?.(volume > 0 ? 0 : 1)}
            className="text-white/60 hover:text-white transition-colors"
          >
            {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={[volume]}
            onValueChange={([val]) => onVolumeChange?.(val)}
            className="w-20"
          />
        </div>
      </div>
    </>
  );
}
