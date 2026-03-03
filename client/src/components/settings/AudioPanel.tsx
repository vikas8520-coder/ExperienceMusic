import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Activity } from "lucide-react";
import type { AudioData } from "@/hooks/use-audio-analyzer";

interface AudioPanelProps {
  getAudioData?: () => AudioData;
  micStatus?: "idle" | "starting" | "running" | "error";
  onToggleMicReactivity?: () => void;
}

function EnergyBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className="text-[10px] font-mono text-white/60">{Math.round(value * 100)}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-75"
          style={{ width: `${Math.min(100, value * 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function AudioPanel({ getAudioData, micStatus = "idle", onToggleMicReactivity }: AudioPanelProps) {
  const [audioSnapshot, setAudioSnapshot] = useState<AudioData | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!getAudioData) return;
    let running = true;
    const tick = () => {
      if (!running) return;
      setAudioSnapshot(getAudioData());
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [getAudioData]);

  const data = audioSnapshot || { sub: 0, bass: 0, mid: 0, high: 0, energy: 0, bpm: 0, beatPhase: 0 };

  return (
    <div className="space-y-4" data-testid="panel-audio">
      {/* BPM + Beat Phase */}
      <div className="flex items-center gap-4">
        <div className="glass-panel rounded-lg px-4 py-2 text-center">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">BPM</div>
          <div className="text-2xl font-bold font-mono text-primary">
            {(data as any).bpm > 0 ? Math.round((data as any).bpm) : "--"}
          </div>
        </div>
        <div className="glass-panel rounded-lg px-4 py-2 text-center flex-1">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Energy</div>
          <div className="text-2xl font-bold font-mono text-green-400">
            {Math.round(data.energy * 100)}%
          </div>
        </div>
      </div>

      {/* Frequency Bands */}
      <div className="space-y-2">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Frequency Bands</p>
        <EnergyBar label="Sub" value={data.sub} color="#ef4444" />
        <EnergyBar label="Bass" value={data.bass} color="#f97316" />
        <EnergyBar label="Mid" value={data.mid} color="#eab308" />
        <EnergyBar label="High" value={data.high} color="#22d3ee" />
      </div>

      {/* Mic Toggle */}
      <button
        onClick={onToggleMicReactivity}
        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-all text-xs ${
          micStatus === "running"
            ? "border-green-500/50 bg-green-500/10 text-green-400"
            : micStatus === "error"
              ? "border-red-500/50 bg-red-500/10 text-red-400"
              : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
        }`}
        data-testid="button-mic-toggle"
      >
        {micStatus === "running" ? (
          <><MicOff className="w-4 h-4" /> Stop Mic Reactivity</>
        ) : micStatus === "starting" ? (
          <><Activity className="w-4 h-4 animate-pulse" /> Starting...</>
        ) : (
          <><Mic className="w-4 h-4" /> Enable Mic Reactivity</>
        )}
      </button>
    </div>
  );
}
