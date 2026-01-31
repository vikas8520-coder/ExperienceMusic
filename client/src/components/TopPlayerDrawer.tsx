import { useMemo, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, ChevronDown, ChevronUp, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  isOpen: boolean;
  onToggle: () => void;
  isPlaying: boolean;
  onPlayPause: () => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  volume: number;
  onVolume: (v: number) => void;
  onPreviousTrack: () => void;
  onNextTrack: () => void;
  title?: string;
  hasLibraryTracks: boolean;
};

function formatTime(sec: number) {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const KeyboardShortcutsHint = () => (
  <div className="flex flex-wrap gap-3 text-xs text-white/50 justify-center">
    <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/70">Space</kbd> Play/Pause</span>
    <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/70">←/→</kbd> Seek</span>
    <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/70">↑/↓</kbd> Volume</span>
    <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/70">F</kbd> Fullscreen</span>
    <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/70">M</kbd> Mute</span>
  </div>
);

export function TopPlayerDrawer({
  isOpen,
  onToggle,
  isPlaying,
  onPlayPause,
  currentTime,
  duration,
  onSeek,
  volume,
  onVolume,
  onPreviousTrack,
  onNextTrack,
  title = "Now Playing",
  hasLibraryTracks,
}: Props) {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(1);
  
  const progressPercent = useMemo(() => {
    if (!duration || !isFinite(duration)) return 0;
    return Math.min(100, Math.max(0, (currentTime / duration) * 100));
  }, [currentTime, duration]);
  
  const isMuted = volume === 0;
  
  const handleMuteToggle = () => {
    if (isMuted) {
      onVolume(previousVolume > 0 ? previousVolume : 1);
    } else {
      setPreviousVolume(volume);
      onVolume(0);
    }
  };

  return (
    <div
      data-testid="top-player-drawer"
      className="fixed top-0 left-0 right-0 z-[9999] transition-transform duration-200 ease-out"
      style={{
        transform: isOpen ? "translateY(0)" : "translateY(calc(-100% + 48px))",
      }}
    >
      <div className="bg-black/90 backdrop-blur-xl border-b border-white/10">
        <div
          onClick={onToggle}
          className="h-12 flex items-center justify-between px-4 cursor-pointer select-none hover-elevate"
          data-testid="player-toggle"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-1.5 rounded-full bg-white/25" />
            <span className="font-semibold text-white/90 text-sm truncate max-w-[200px] md:max-w-none">
              {title}
            </span>
            {isPlaying && (
              <div className="flex gap-0.5 items-end h-3">
                <div className="w-0.5 bg-primary animate-pulse" style={{ height: "60%" }} />
                <div className="w-0.5 bg-primary animate-pulse" style={{ height: "100%", animationDelay: "0.1s" }} />
                <div className="w-0.5 bg-primary animate-pulse" style={{ height: "40%", animationDelay: "0.2s" }} />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-white/60 text-xs hidden sm:block">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            {isOpen ? (
              <ChevronUp className="w-4 h-4 text-white/70" />
            ) : (
              <ChevronDown className="w-4 h-4 text-white/70" />
            )}
          </div>
        </div>

        {isOpen && (
          <div className="px-4 pb-4 pt-2 space-y-4">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => { e.stopPropagation(); onPreviousTrack(); }}
                  disabled={!hasLibraryTracks}
                  className="text-white/80 hover:text-white"
                  data-testid="button-previous-track"
                >
                  <SkipBack className="w-5 h-5" />
                </Button>

                <Button
                  size="icon"
                  variant="outline"
                  onClick={(e) => { e.stopPropagation(); onPlayPause(); }}
                  className="w-12 h-12 rounded-full bg-white/10 border-white/20 text-white hover:bg-white/20"
                  data-testid="button-play-pause"
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => { e.stopPropagation(); onNextTrack(); }}
                  disabled={!hasLibraryTracks}
                  className="text-white/80 hover:text-white"
                  data-testid="button-next-track"
                >
                  <SkipForward className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex-1 w-full sm:w-auto min-w-0">
                <div className="flex justify-between text-xs text-white/60 mb-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
                <Slider
                  value={[Math.min(currentTime, duration || currentTime)]}
                  min={0}
                  max={duration || 100}
                  step={0.1}
                  onValueChange={([val]) => onSeek(val)}
                  className="w-full"
                  data-testid="slider-seek"
                />
              </div>

              <div className="flex items-center gap-2 w-32">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); handleMuteToggle(); }}
                      className="w-8 h-8 text-white/60 hover:text-white shrink-0"
                      data-testid="button-mute"
                    >
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>{isMuted ? "Unmute" : "Mute"} (M)</p>
                  </TooltipContent>
                </Tooltip>
                <Slider
                  value={[volume]}
                  min={0}
                  max={1}
                  step={0.01}
                  onValueChange={([val]) => onVolume(val)}
                  className="w-full"
                  data-testid="slider-volume"
                />
              </div>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); setShowShortcuts(!showShortcuts); }}
                    className="w-8 h-8 text-white/50 hover:text-white hidden md:flex"
                    data-testid="button-shortcuts"
                  >
                    <Keyboard className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Keyboard shortcuts</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary/80 via-primary to-primary/80 rounded-full transition-[width] duration-100 ease-linear"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            
            {showShortcuts && (
              <div className="pt-2 border-t border-white/10">
                <KeyboardShortcutsHint />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
