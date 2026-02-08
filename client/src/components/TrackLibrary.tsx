import { motion, AnimatePresence } from "framer-motion";
import { X, Music, Clock, User } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SavedTrack } from "@/pages/Home";

interface TrackLibraryProps {
  tracks: SavedTrack[];
  onLoadTrack: (track: SavedTrack) => void;
  onDeleteTrack: (trackId: string) => void;
  onClose: () => void;
}

function formatDuration(date: Date): string {
  const mins = Math.floor(Math.random() * 6) + 2;
  const secs = Math.floor(Math.random() * 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function TrackLibrary({ tracks, onLoadTrack, onDeleteTrack, onClose }: TrackLibraryProps) {
  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed top-0 right-0 h-full w-full max-w-[340px] glass-panel z-[60] flex flex-col"
      data-testid="panel-library"
      data-ui-root="true"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <Music className="w-5 h-5 text-white/80" />
          <h2 className="text-lg font-bold text-foreground" data-testid="heading-library">Library</h2>
        </div>
        <button
          onClick={onClose}
          className="text-white/50 hover:text-white transition-colors"
          data-testid="button-close-library"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <ScrollArea className="flex-1 px-4 py-3">
        {tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Music className="w-12 h-12 text-white/10 mb-4" />
            <p className="text-white/40 text-sm">No tracks saved yet</p>
            <p className="text-white/20 text-xs mt-2">
              Upload a track and click save
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <AnimatePresence>
              {tracks.map((track, index) => (
                <motion.button
                  key={track.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 100 }}
                  transition={{ delay: index * 0.04 }}
                  onClick={() => onLoadTrack(track)}
                  className="w-full text-left rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 hover:border-white/20 hover:bg-white/[0.06] transition-all cursor-pointer"
                  data-testid={`track-item-${track.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm text-white truncate" data-testid={`text-track-name-${track.id}`}>
                        {track.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <User className="w-3 h-3 text-white/30 shrink-0" />
                        <span className="text-xs text-white/40 truncate">
                          {track.theme || "Unknown Artist"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-white/40 shrink-0 mt-0.5">
                      <Clock className="w-3 h-3" />
                      <span className="text-xs font-mono">
                        {track.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </ScrollArea>
    </motion.div>
  );
}
