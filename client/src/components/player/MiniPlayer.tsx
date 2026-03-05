import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Upload, SkipBack, SkipForward, Volume2, VolumeX, ChevronDown } from "lucide-react";

interface MiniPlayerProps {
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

export function MiniPlayer({
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
}: MiniPlayerProps) {
  const [expanded, setExpanded] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const progress = duration > 0 ? currentTime / duration : 0;
  const circumference = 2 * Math.PI * 22; // radius=22 for a 56px circle
  const strokeDash = circumference * progress;

  const handleCompactClick = useCallback(() => {
    setExpanded(true);
  }, []);

  const handleCollapse = useCallback(() => {
    setExpanded(false);
  }, []);

  return (
    <>
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        onChange={(e) => { onFileUpload(e); e.target.value = ""; }}
        className="hidden"
        data-testid="input-audio-upload-mini"
      />

      <motion.div
        drag
        dragMomentum={false}
        className="fixed bottom-6 left-1/2 z-50 cursor-grab active:cursor-grabbing select-none"
        style={{ pointerEvents: "auto", x: "-50%" }}
        data-testid="mini-player"
        data-ui-root="true"
      >
        <AnimatePresence mode="wait">
          {!expanded ? (
            /* Compact circle */
            <motion.button
              key="compact"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={handleCompactClick}
              className="w-14 h-14 rounded-full backdrop-blur-xl border border-white/[0.08] flex items-center justify-center relative group hover:border-white/20 transition-colors"
              style={{ background: "rgba(255,255,255,0.04)", boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.06), 0 20px 25px -5px rgba(0,0,0,0.1)" }}
              data-testid="mini-player-compact"
            >
              {/* SVG progress ring */}
              <svg className="absolute inset-0 w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                <circle
                  cx="28"
                  cy="28"
                  r="22"
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="3"
                />
                <circle
                  cx="28"
                  cy="28"
                  r="22"
                  fill="none"
                  stroke="rgba(168,85,247,0.8)"
                  strokeWidth="3"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - strokeDash}
                  strokeLinecap="round"
                  className="transition-all duration-300"
                />
              </svg>

              {/* Play/Pause icon */}
              {isPlaying ? (
                <Pause className="w-5 h-5 text-white relative z-10" />
              ) : (
                <Play className="w-5 h-5 text-white relative z-10 ml-0.5" />
              )}
            </motion.button>
          ) : (
            /* Expanded pill */
            <motion.div
              key="expanded"
              initial={{ width: 56, opacity: 0.8 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 56, opacity: 0.8 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="backdrop-blur-xl border border-white/[0.08] rounded-2xl p-3 flex flex-col gap-2"
              style={{ background: "rgba(255,255,255,0.04)", boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.06), 0 20px 25px -5px rgba(0,0,0,0.1)" }}
              data-testid="mini-player-expanded"
            >
              {/* Top row: collapse + track name */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/60 truncate max-w-[200px]">
                  {trackName ? trackName.replace(/\.[^/.]+$/, "") : "No Track"}
                </span>
                <button
                  onClick={handleCollapse}
                  className="text-white/40 hover:text-white transition-colors"
                  data-testid="mini-player-collapse"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              {/* Transport controls */}
              <div className="flex items-center justify-center gap-3">
                {hasLibraryTracks && (
                  <button
                    onClick={onPreviousTrack}
                    className="text-white/50 hover:text-white transition-colors"
                    data-testid="mini-player-prev"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={(e) => { e.stopPropagation(); onPlayPause(); }}
                  className="w-9 h-9 rounded-full bg-white/[0.07] border border-white/[0.12] flex items-center justify-center text-white hover:bg-white/[0.12] transition-colors"
                  data-testid="mini-player-play"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>

                {hasLibraryTracks && (
                  <button
                    onClick={onNextTrack}
                    className="text-white/50 hover:text-white transition-colors"
                    data-testid="mini-player-next"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Seek slider */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/40 font-mono w-7 text-right">
                  {formatTime(currentTime)}
                </span>
                <Slider
                  min={0}
                  max={duration || 1}
                  step={0.1}
                  value={[currentTime]}
                  onValueChange={([val]) => onSeek?.(val)}
                  className="flex-1"
                />
                <span className="text-[10px] text-white/40 font-mono w-7">
                  {formatTime(duration)}
                </span>
              </div>

              {/* Volume + Upload */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onVolumeChange?.(volume > 0 ? 0 : 1)}
                  className="text-white/50 hover:text-white transition-colors"
                >
                  {volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={[volume]}
                  onValueChange={([val]) => onVolumeChange?.(val)}
                  className="w-16"
                />
                <div className="flex-1" />
                <button
                  onClick={() => audioInputRef.current?.click()}
                  className="text-white/40 hover:text-white transition-colors"
                  data-testid="mini-player-upload"
                >
                  <Upload className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
