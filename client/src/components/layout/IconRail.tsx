import { Palette, Music, Sparkles, Sliders, BarChart3, Video, Library } from "lucide-react";

export type PanelId = "presets" | "colors" | "effects" | "perform" | "audio" | "record" | "library";

const panelIcons: { id: PanelId; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { id: "presets", icon: Palette, label: "Presets" },
  { id: "colors", icon: Music, label: "Colors" },
  { id: "effects", icon: Sparkles, label: "Effects" },
  { id: "perform", icon: Sliders, label: "Perform" },
  { id: "audio", icon: BarChart3, label: "Audio" },
  { id: "record", icon: Video, label: "Record" },
  { id: "library", icon: Library, label: "Library" },
];

interface IconRailProps {
  activePanel: PanelId | null;
  onPanelToggle: (panel: PanelId) => void;
}

export function IconRail({ activePanel, onPanelToggle }: IconRailProps) {
  return (
    <div
      className="fixed right-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2"
      data-testid="icon-rail"
      data-ui-root="true"
      style={{ pointerEvents: "auto" }}
    >
      {panelIcons.map(({ id, icon: Icon, label }) => {
        const isActive = activePanel === id;
        return (
          <button
            key={id}
            onClick={() => onPanelToggle(id)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              isActive
                ? "bg-primary/30 border border-primary/60 text-primary shadow-[0_0_12px_rgba(var(--primary),0.3)]"
                : "bg-black/50 backdrop-blur-sm border border-white/10 text-white/60 hover:text-white hover:bg-white/10"
            }`}
            title={label}
            data-testid={`icon-rail-${id}`}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
}
