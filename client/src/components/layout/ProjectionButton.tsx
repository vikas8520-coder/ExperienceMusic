import { ExternalLink, MonitorPlay } from "lucide-react";

interface ProjectionButtonProps {
  isProjecting: boolean;
  onToggle: () => void;
}

export function ProjectionButton({ isProjecting, onToggle }: ProjectionButtonProps) {
  return (
    <button
      onClick={onToggle}
      className={`fixed top-4 left-[120px] z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-sm border transition-all text-xs ${
        isProjecting
          ? "bg-green-500/20 border-green-500/40 text-green-400"
          : "bg-black/50 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
      }`}
      title={isProjecting ? "Stop Projection" : "Pop Out for Projection"}
      data-testid="projection-button"
      data-ui-root="true"
      style={{ pointerEvents: "auto" }}
    >
      {isProjecting ? (
        <><MonitorPlay className="w-3.5 h-3.5" /> Projecting</>
      ) : (
        <><ExternalLink className="w-3.5 h-3.5" /> Pop Out</>
      )}
    </button>
  );
}
