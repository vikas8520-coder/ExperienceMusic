import { Video, Mic, Library, Maximize, Minimize, MonitorPlay, Settings } from "lucide-react";

interface ActionClusterProps {
  isRecording: boolean;
  onToggleRecording: () => void;
  micStatus: "idle" | "starting" | "running" | "error";
  onToggleMicReactivity: () => void;
  onToggleLibrary: () => void;
  onToggleRadial: () => void;
  showRadial: boolean;
  onSavePreset: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  isProjecting: boolean;
  onToggleProjection: () => void;
}

export function ActionCluster({
  isRecording,
  onToggleRecording,
  micStatus,
  onToggleMicReactivity,
  onToggleLibrary,
  onToggleRadial,
  showRadial,
  isFullscreen,
  onToggleFullscreen,
  isProjecting,
  onToggleProjection,
}: ActionClusterProps) {
  const btnBase =
    "w-9 h-9 rounded-full flex items-center justify-center transition-all";
  const btnDefault =
    "bg-white/[0.04] border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.07]";
  const btnActive =
    "bg-primary/30 border border-primary/60 text-primary shadow-[0_0_12px_rgba(168,85,247,0.3)]";

  return (
    <div
      className="fixed top-4 right-4 z-50 flex items-center gap-1.5 backdrop-blur-xl border border-white/[0.08] rounded-full px-2 py-1.5"
      style={{ pointerEvents: "auto", background: "rgba(255,255,255,0.04)", boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.06), 0 20px 25px -5px rgba(0,0,0,0.1)" }}
      data-testid="action-cluster"
      data-ui-root="true"
    >
      {/* Record */}
      <button
        onClick={onToggleRecording}
        className={`${btnBase} ${isRecording ? "bg-red-500/30 border border-red-500/60 text-red-400" : btnDefault} ${isRecording ? "animate-pulse" : ""}`}
        title={isRecording ? "Stop Recording" : "Start Recording"}
        data-testid="action-record"
      >
        <Video className="w-4 h-4" />
      </button>

      {/* Mic */}
      <button
        onClick={onToggleMicReactivity}
        className={`${btnBase} ${micStatus === "running" ? "bg-green-500/20 border border-green-500/50 text-green-400" : btnDefault} relative`}
        title={micStatus === "running" ? "Disable Mic Reactivity" : "Enable Mic Reactivity"}
        data-testid="action-mic"
      >
        <Mic className="w-4 h-4" />
        {micStatus === "running" && (
          <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-green-400 rounded-full" />
        )}
      </button>

      {/* Library */}
      <button
        onClick={onToggleLibrary}
        className={`${btnBase} ${btnDefault}`}
        title="Track Library"
        data-testid="action-library"
      >
        <Library className="w-4 h-4" />
      </button>

      {/* Fullscreen */}
      <button
        onClick={onToggleFullscreen}
        className={`${btnBase} ${btnDefault}`}
        title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        data-testid="action-fullscreen"
      >
        {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
      </button>

      {/* Projection */}
      <button
        onClick={onToggleProjection}
        className={`${btnBase} ${isProjecting ? btnActive : btnDefault}`}
        title={isProjecting ? "Stop Projection" : "Start Projection"}
        data-testid="action-projection"
      >
        <MonitorPlay className="w-4 h-4" />
      </button>

      {/* Settings (RadialSystem) */}
      <button
        onClick={onToggleRadial}
        className={`${btnBase} ${showRadial ? btnActive : btnDefault}`}
        title="Settings"
        data-testid="action-settings"
      >
        <Settings className="w-4 h-4" />
      </button>
    </div>
  );
}
