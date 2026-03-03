import { useState } from "react";
import { TrackLibrary } from "@/components/TrackLibrary";
import { SoundCloudPanel } from "@/components/SoundCloudPanel";
import type { SavedTrack } from "@/pages/Home";

interface LibraryPanelProps {
  savedTracks: SavedTrack[];
  onLoadTrack: (track: SavedTrack) => void;
  onDeleteTrack: (trackId: string) => void;
  showSoundCloud: boolean;
  onToggleSoundCloud: () => void;
  onPlaySoundCloudTrack: (streamUrl: string, title: string, artworkUrl?: string) => void;
}

export function LibraryPanel({
  savedTracks,
  onLoadTrack,
  onDeleteTrack,
  showSoundCloud,
  onToggleSoundCloud,
  onPlaySoundCloudTrack,
}: LibraryPanelProps) {
  const [tab, setTab] = useState<"library" | "soundcloud">("library");

  return (
    <div className="space-y-3" data-testid="panel-library-settings">
      <div className="flex gap-1">
        <button
          onClick={() => setTab("library")}
          className={`px-3 py-1.5 rounded text-xs transition-all ${
            tab === "library" ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80"
          }`}
        >
          My Library ({savedTracks.length})
        </button>
        <button
          onClick={() => setTab("soundcloud")}
          className={`px-3 py-1.5 rounded text-xs transition-all ${
            tab === "soundcloud" ? "bg-orange-500/20 text-orange-300" : "text-white/50 hover:text-white/80"
          }`}
        >
          SoundCloud
        </button>
      </div>

      {tab === "library" && (
        <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
          {savedTracks.length === 0 ? (
            <p className="text-xs text-white/40 text-center py-8">No tracks saved yet</p>
          ) : (
            savedTracks.map((track) => (
              <button
                key={track.id}
                onClick={() => onLoadTrack(track)}
                className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors flex items-center gap-3"
              >
                {track.thumbnailUrl && (
                  <img src={track.thumbnailUrl} alt="" className="w-8 h-8 rounded object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white truncate">{track.name}</div>
                  <div className="text-[10px] text-white/40">{track.theme || "custom"}</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteTrack(track.id); }}
                  className="text-white/30 hover:text-red-400 transition-colors shrink-0 text-[10px]"
                >
                  Remove
                </button>
              </button>
            ))
          )}
        </div>
      )}

      {tab === "soundcloud" && (
        <div className="text-xs text-white/50 text-center py-4">
          <button
            onClick={onToggleSoundCloud}
            className="px-4 py-2 rounded-lg bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 transition-colors"
          >
            Open SoundCloud Panel
          </button>
        </div>
      )}
    </div>
  );
}
