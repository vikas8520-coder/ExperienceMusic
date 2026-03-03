import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  imageFilters,
  psyOverlays,
  type ImageFilterId,
  type PsyOverlayId,
} from "@/lib/visualizer-presets";

interface EffectsPanelProps {
  settings: {
    imageFilters: ImageFilterId[];
    psyOverlays?: PsyOverlayId[];
    trailsOn?: boolean;
    darkOverlay?: boolean;
    [key: string]: any;
  };
  setSettings: (s: any) => void;
}

export function EffectsPanel({ settings, setSettings }: EffectsPanelProps) {
  return (
    <div className="space-y-4" data-testid="panel-effects">
      {/* Image Filters */}
      <div className="space-y-2">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Image Filters</p>
        <div className="flex gap-1 flex-wrap">
          {imageFilters.filter(f => f.id !== "none").map((filter) => {
            const isActive = settings.imageFilters.includes(filter.id);
            return (
              <button
                key={filter.id}
                onClick={() => {
                  const newFilters = isActive
                    ? settings.imageFilters.filter(f => f !== filter.id)
                    : [...settings.imageFilters.filter(f => f !== "none"), filter.id];
                  setSettings((prev: any) => ({
                    ...prev,
                    imageFilters: newFilters.length === 0 ? ["none"] : newFilters
                  }));
                }}
                className={`text-[10px] py-1.5 px-2.5 rounded-md border transition-all ${
                  isActive
                    ? "border-purple-500 bg-purple-500/20 text-purple-300"
                    : "border-white/10 bg-black/30 text-muted-foreground hover:bg-white/5"
                }`}
                data-testid={`filter-toggle-${filter.id}`}
              >
                {filter.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Psy Overlays */}
      <div className="space-y-2">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Psy Overlays</p>
        <div className="flex gap-1 flex-wrap">
          {psyOverlays.map((overlay) => {
            const currentOverlays = settings.psyOverlays || [];
            const isActive = currentOverlays.includes(overlay.id);
            return (
              <button
                key={overlay.id}
                onClick={() => {
                  const newOverlays = isActive
                    ? currentOverlays.filter(o => o !== overlay.id)
                    : [...currentOverlays, overlay.id];
                  setSettings((prev: any) => ({
                    ...prev,
                    psyOverlays: newOverlays
                  }));
                }}
                className={`text-[10px] py-1.5 px-2.5 rounded-md border transition-all ${
                  isActive
                    ? "border-cyan-500 bg-cyan-500/20 text-cyan-300"
                    : "border-white/10 bg-black/30 text-muted-foreground hover:bg-white/5"
                }`}
                data-testid={`overlay-toggle-${overlay.id}`}
              >
                {overlay.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/25 px-3 py-2">
          <Label className="text-xs text-muted-foreground">Motion Trails</Label>
          <Switch
            checked={settings.trailsOn ?? false}
            onCheckedChange={(checked) => setSettings((prev: any) => ({ ...prev, trailsOn: checked }))}
            data-testid="toggle-trails"
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/25 px-3 py-2">
          <Label className="text-xs text-muted-foreground">Dark Overlay</Label>
          <Switch
            checked={settings.darkOverlay ?? false}
            onCheckedChange={(checked) => setSettings((prev: any) => ({ ...prev, darkOverlay: checked }))}
            data-testid="toggle-dark-overlay"
          />
        </div>
      </div>
    </div>
  );
}
