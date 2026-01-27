import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Trash2, Music, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SavedTrack } from "@/pages/Home";

interface TrackLibraryProps {
  tracks: SavedTrack[];
  onLoadTrack: (track: SavedTrack) => void;
  onDeleteTrack: (trackId: string) => void;
  onClose: () => void;
}

export function TrackLibrary({ tracks, onLoadTrack, onDeleteTrack, onClose }: TrackLibraryProps) {
  return (
    <motion.div
      initial={{ x: -400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -400, opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="absolute top-0 left-0 h-full w-full max-w-96 glass-panel z-30 flex flex-col"
    >
      <div className="flex items-center justify-between p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Music className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold tracking-wider text-foreground">LIBRARY</h2>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
          data-testid="button-close-library"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        {tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Music className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground text-sm">No tracks saved yet</p>
            <p className="text-muted-foreground/60 text-xs mt-2">
              Upload a track and click "Save to Library"
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {tracks.map((track, index) => (
                <motion.div
                  key={track.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.05 }}
                  className="group relative bg-black/30 rounded-lg border border-white/10 overflow-hidden hover:border-primary/50 transition-all"
                  data-testid={`track-item-${track.id}`}
                >
                  <div className="flex items-stretch">
                    {/* Thumbnail */}
                    <div className="w-20 h-20 bg-black/50 flex-shrink-0 relative overflow-hidden">
                      {track.thumbnailUrl ? (
                        <img 
                          src={track.thumbnailUrl} 
                          alt={track.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music className="w-8 h-8 text-muted-foreground/30" />
                        </div>
                      )}
                      
                      {/* Color palette strip */}
                      {track.colorPalette && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 flex">
                          {track.colorPalette.slice(0, 4).map((color, i) => (
                            <div 
                              key={i} 
                              className="flex-1" 
                              style={{ backgroundColor: color }} 
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Track Info */}
                    <div className="flex-1 p-3 flex flex-col justify-center min-w-0">
                      <h3 className="font-semibold text-sm text-foreground truncate" title={track.name}>
                        {track.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>{track.createdAt.toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 p-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-primary hover:bg-primary/20"
                        onClick={() => onLoadTrack(track)}
                        data-testid={`button-load-track-${track.id}`}
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/20"
                        onClick={() => onDeleteTrack(track.id)}
                        data-testid={`button-delete-track-${track.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t border-white/10">
        <p className="text-xs text-muted-foreground text-center">
          {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'} in library
        </p>
      </div>
    </motion.div>
  );
}
