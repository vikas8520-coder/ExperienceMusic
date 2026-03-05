import { useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import {
  colorModes,
  moodPresets,
  type ColorSettings,
} from "@/lib/visualizer-presets";

interface ColorsPanelProps {
  colorSettings: ColorSettings;
  setColorSettings: (s: ColorSettings | ((prev: ColorSettings) => ColorSettings)) => void;
  colorPalette: string[];
}

export function ColorsPanel({ colorSettings, setColorSettings, colorPalette }: ColorsPanelProps) {
  const updateColorSetting = useCallback(<K extends keyof ColorSettings>(key: K, value: ColorSettings[K]) => {
    setColorSettings(prev => ({ ...prev, [key]: value }));
  }, [setColorSettings]);

  return (
    <div className="space-y-3" data-testid="panel-colors">
      <div className="flex gap-1 flex-wrap">
        {colorModes.filter(m => m.id !== "ai" && m.id !== "custom").map((mode) => (
          <button
            key={mode.id}
            onClick={() => updateColorSetting("mode", mode.id)}
            className={`px-2 py-1 rounded text-[10px] transition-all ${
              colorSettings.mode === mode.id
                ? "bg-primary text-primary-foreground"
                : "bg-white/10 text-white/60 hover:bg-white/20"
            }`}
            data-testid={`button-color-mode-${mode.id}`}
          >
            {mode.name}
          </button>
        ))}
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        {(colorSettings.mode === "single" || colorSettings.mode === "gradient" || colorSettings.mode === "triadic") && (
          <>
            <input
              type="color"
              value={colorSettings.primaryColor}
              onChange={(e) => updateColorSetting("primaryColor", e.target.value)}
              className="w-7 h-7 rounded cursor-pointer border-0"
              data-testid="input-color-primary"
            />
            {(colorSettings.mode === "gradient" || colorSettings.mode === "triadic") && (
              <input
                type="color"
                value={colorSettings.secondaryColor}
                onChange={(e) => updateColorSetting("secondaryColor", e.target.value)}
                className="w-7 h-7 rounded cursor-pointer border-0"
                data-testid="input-color-secondary"
              />
            )}
            {colorSettings.mode === "triadic" && (
              <input
                type="color"
                value={colorSettings.tertiaryColor}
                onChange={(e) => updateColorSetting("tertiaryColor", e.target.value)}
                className="w-7 h-7 rounded cursor-pointer border-0"
                data-testid="input-color-tertiary"
              />
            )}
          </>
        )}

        {colorSettings.mode === "mood" && (
          <div className="flex gap-1 flex-wrap">
            {moodPresets.map((mood) => (
              <button
                key={mood.id}
                onClick={() => updateColorSetting("moodPreset", mood.id)}
                className={`px-2 py-1 rounded text-[10px] transition-all ${
                  colorSettings.moodPreset === mood.id
                    ? "ring-1 ring-white"
                    : "opacity-50 hover:opacity-80"
                }`}
                style={{ background: `linear-gradient(135deg, ${mood.colors[0]}, ${mood.colors[1]})` }}
                data-testid={`button-mood-${mood.id}`}
              >
                {mood.name}
              </button>
            ))}
          </div>
        )}

        {colorSettings.mode === "spectrum" && (
          <div className="flex-1 flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Speed</span>
            <Slider
              min={0.1} max={3} step={0.1}
              value={[colorSettings.spectrumSpeed]}
              onValueChange={([val]) => updateColorSetting("spectrumSpeed", val)}
              className="flex-1"
              data-testid="slider-spectrum-speed"
            />
            <span className="text-[10px] font-mono">{colorSettings.spectrumSpeed.toFixed(1)}x</span>
          </div>
        )}
      </div>

      <div className="flex gap-0.5 h-4 rounded overflow-hidden">
        {colorPalette.map((color, idx) => (
          <div key={idx} className="flex-1" style={{ backgroundColor: color }} />
        ))}
      </div>
    </div>
  );
}
