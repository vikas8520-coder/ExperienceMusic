import { Slider } from "@/components/ui/slider";
import { PerformOverlay as FractalPerformOverlay } from "@/engine/presets/PerformOverlay";
import type { UniformSpec, UniformValues } from "@/engine/presets/types";

interface PerformPanelProps {
  settings: {
    intensity: number;
    speed: number;
    glowIntensity?: number;
    [key: string]: any;
  };
  setSettings: (s: any) => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  fractalMacros?: UniformSpec[];
  fractalUniforms?: UniformValues;
  onFractalUniformChange?: (key: string, value: any) => void;
}

export function PerformPanel({
  settings,
  setSettings,
  zoom,
  onZoomChange,
  fractalMacros,
  fractalUniforms,
  onFractalUniformChange,
}: PerformPanelProps) {
  const cards = [
    {
      label: "Intensity",
      value: Math.round(settings.intensity / 3 * 100),
      color: "text-primary",
      min: 0,
      max: 3,
      step: 0.1,
      current: settings.intensity,
      onChange: (val: number) => setSettings((prev: any) => ({ ...prev, intensity: val })),
      testId: "perform-intensity",
    },
    {
      label: "Speed",
      value: Math.round(settings.speed / 2 * 100),
      color: "text-green-400",
      min: 0,
      max: 2,
      step: 0.1,
      current: settings.speed,
      onChange: (val: number) => setSettings((prev: any) => ({ ...prev, speed: val })),
      testId: "perform-speed",
    },
    {
      label: "Glow",
      value: Math.round((settings.glowIntensity ?? 1.0) / 2 * 100),
      color: "text-blue-400",
      min: 0.2,
      max: 2.0,
      step: 0.1,
      current: settings.glowIntensity ?? 1.0,
      onChange: (val: number) => setSettings((prev: any) => ({ ...prev, glowIntensity: val })),
      testId: "perform-glow",
    },
    {
      label: "Scene Zoom",
      value: zoom !== undefined ? Math.round(zoom * 100) : 100,
      color: "text-amber-400",
      min: 50,
      max: 300,
      step: 1,
      current: zoom !== undefined ? zoom * 100 : 100,
      onChange: (val: number) => onZoomChange?.(val / 100),
      testId: "perform-zoom",
    },
  ];

  return (
    <div className="space-y-4" data-testid="panel-perform">
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <div
            key={card.testId}
            className="glass-panel rounded-xl border border-white/10 p-4 space-y-3"
            data-testid={`card-${card.testId}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">{card.label}</span>
              <span className={`text-lg font-bold font-mono ${card.color}`}>{card.value}%</span>
            </div>
            <Slider
              min={card.min}
              max={card.max}
              step={card.step}
              value={[card.current]}
              onValueChange={([val]) => card.onChange(val)}
              className="w-full"
              data-testid={`slider-${card.testId}`}
            />
          </div>
        ))}
      </div>

      {fractalMacros && fractalMacros.length > 0 && fractalUniforms && onFractalUniformChange && (
        <FractalPerformOverlay macros={fractalMacros} uniforms={fractalUniforms} setUniform={onFractalUniformChange} />
      )}
    </div>
  );
}
