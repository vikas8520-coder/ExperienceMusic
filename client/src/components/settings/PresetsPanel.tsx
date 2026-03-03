import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, ChevronUp, ChevronDown, Circle, Disc, Sparkles, Globe, BarChart3, Hexagon, Network, Waves, Droplet, Triangle, Magnet } from "lucide-react";
import {
  presetCategories,
  type PresetName,
} from "@/lib/visualizer-presets";

const presetIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  rings: Circle,
  tunnel: Disc,
  particles: Sparkles,
  sphere: Globe,
  bars: BarChart3,
  kaleidoscope: Hexagon,
  web: Network,
  sand: Waves,
  water: Droplet,
  geometry: Triangle,
  field: Magnet,
  mandelbrot: Hexagon,
  juliaorbittrap: Hexagon,
};

interface PresetsPanelProps {
  settings: {
    presetName: PresetName;
    presetEnabled: boolean;
    [key: string]: any;
  };
  setSettings: (s: any) => void;
  onSavePreset: () => void;
}

export function PresetsPanel({ settings, setSettings, onSavePreset }: PresetsPanelProps) {
  return (
    <div className="space-y-3" data-testid="panel-presets">
      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/25 px-3 py-2">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Preset Output</Label>
        <Switch
          checked={settings.presetEnabled !== false}
          onCheckedChange={(checked) => setSettings((prev: any) => ({ ...prev, presetEnabled: checked }))}
          data-testid="toggle-preset-enabled"
        />
      </div>

      {presetCategories.map((category) => (
        <div key={category.name} className="space-y-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">{category.name}</p>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))' }}>
            {category.presets.map((preset) => {
              const IconComponent = presetIconMap[preset.icon];
              const isActive = settings.presetName === preset.name;
              return (
                <button
                  key={preset.name}
                  onClick={() => setSettings((prev: any) => ({ ...prev, presetName: preset.name, presetEnabled: true }))}
                  className={`flex flex-col items-center justify-center rounded-lg transition-all aspect-square ${
                    isActive
                      ? "bg-white/15 ring-1 ring-primary/70 text-white shadow-[0_0_8px_rgba(var(--primary),0.2)]"
                      : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80 active:scale-[0.97]"
                  }`}
                  title={preset.name}
                  data-testid={`button-preset-${preset.shortName.toLowerCase()}`}
                >
                  {IconComponent && <IconComponent className={`w-4 h-4 shrink-0 mb-1 ${isActive ? 'text-primary' : 'text-white/40'}`} />}
                  <span className="text-[9px] font-medium leading-tight text-center line-clamp-2 px-0.5">{preset.shortName}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        className="w-full text-[10px] h-8 border-primary/50 text-primary"
        onClick={onSavePreset}
        data-testid="button-save-preset"
      >
        <Save className="mr-1.5 h-3 w-3" />
        Save Preset
      </Button>
    </div>
  );
}
