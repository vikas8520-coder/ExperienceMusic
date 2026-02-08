import { Slider } from "@/components/ui/slider";
import type { UniformSpec, UniformValues } from "./types";

interface PerformOverlayProps {
  macros: UniformSpec[];
  uniforms: UniformValues;
  setUniform: (key: string, value: any) => void;
}

const macroColors = [
  "text-primary",
  "text-green-400",
  "text-blue-400",
  "text-amber-400",
  "text-purple-400",
  "text-rose-400",
  "text-cyan-400",
  "text-orange-400",
];

export function PerformOverlay({ macros, uniforms, setUniform }: PerformOverlayProps) {
  if (macros.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 p-4 max-w-lg w-full" data-testid="panel-fractal-perform">
      {macros.map((spec, i) => {
        const value = uniforms[spec.key];
        const min = spec.min ?? 0;
        const max = spec.max ?? 1;
        const pct = Math.round(((value - min) / (max - min)) * 100);
        const color = macroColors[i % macroColors.length];

        return (
          <div
            key={spec.key}
            className="glass-panel rounded-xl border border-white/10 p-4 md:p-5 space-y-3"
            data-testid={`card-macro-${spec.key}`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">{spec.label}</span>
              <span className={`text-lg md:text-xl font-bold font-mono ${color}`}>{pct}%</span>
            </div>
            <Slider
              min={min}
              max={max}
              step={spec.step ?? 0.01}
              value={[value]}
              onValueChange={([v]) => {
                const val = spec.transform ? spec.transform(v) : v;
                setUniform(spec.key, val);
              }}
              className="w-full"
              data-testid={`slider-macro-${spec.key}`}
            />
          </div>
        );
      })}
    </div>
  );
}
