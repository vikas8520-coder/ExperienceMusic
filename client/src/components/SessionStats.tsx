import { useState } from "react";
import { useSessionStats } from "@/hooks/useSessionStats";
import type { AudioData } from "@/hooks/use-audio-analyzer";
import { Clock, Music, Zap, Activity } from "lucide-react";

interface SessionStatsProps {
  isPlaying: boolean;
  presetName: string;
  getAudioData?: () => AudioData;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function SessionStats({ isPlaying, presetName, getAudioData }: SessionStatsProps) {
  const { stats } = useSessionStats(isPlaying, presetName, getAudioData);
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="fixed bottom-4 right-4 z-40"
      data-testid="session-stats"
    >
      {expanded ? (
        <div
          className="bg-black/80 backdrop-blur-md border border-white/10 rounded-xl p-4 min-w-[220px] text-white cursor-pointer"
          onClick={() => setExpanded(false)}
        >
          <div className="text-xs uppercase tracking-wider text-white/50 mb-2">Session Stats</div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>Listen time: {formatTime(stats.listenTime)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Music className="w-3.5 h-3.5 text-purple-400" />
              <span>Presets: {stats.presetsExplored.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <span>Peak energy: {(stats.peakEnergy * 100).toFixed(0)}%</span>
            </div>
            {stats.bpmRange[1] > 0 && (
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-green-400" />
                <span>BPM: {stats.bpmRange[0]}–{stats.bpmRange[1]}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          className="bg-black/60 backdrop-blur-sm border border-white/10 rounded-full px-3 py-1.5 text-white text-xs cursor-pointer hover:bg-black/80 transition-colors flex items-center gap-1.5"
          onClick={() => setExpanded(true)}
          data-testid="session-stats-pill"
        >
          <Clock className="w-3 h-3" />
          {formatTime(stats.listenTime)}
        </div>
      )}
    </div>
  );
}
