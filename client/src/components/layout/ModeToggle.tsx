import { Monitor, Layers } from "lucide-react";

export type LayoutMode = "zen" | "command";

interface ModeToggleProps {
  mode: LayoutMode;
  onToggle: () => void;
}

export function ModeToggle({ mode, onToggle }: ModeToggleProps) {
  return (
    <button
      onClick={onToggle}
      className="fixed top-4 left-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all text-xs"
      title={mode === "zen" ? "Switch to Command Center" : "Switch to Zen Mode"}
      data-testid="mode-toggle"
      data-ui-root="true"
      style={{ pointerEvents: "auto" }}
    >
      {mode === "zen" ? (
        <><Monitor className="w-3.5 h-3.5" /> Zen</>
      ) : (
        <><Layers className="w-3.5 h-3.5" /> Command</>
      )}
    </button>
  );
}
