import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { UniformSpec, UniformValues } from "./types";

interface ControlPanelProps {
  specs: UniformSpec[];
  uniforms: UniformValues;
  setUniform: (key: string, value: any) => void;
}

function groupSpecs(specs: UniformSpec[]): Record<string, UniformSpec[]> {
  const groups: Record<string, UniformSpec[]> = {};
  for (const s of specs) {
    const g = s.group || "General";
    if (!groups[g]) groups[g] = [];
    groups[g].push(s);
  }
  return groups;
}

function FloatControl({ spec, value, onChange }: { spec: UniformSpec; value: number; onChange: (v: number) => void }) {
  const pct = spec.max !== undefined && spec.min !== undefined
    ? Math.round(((value - spec.min) / (spec.max - spec.min)) * 100)
    : 0;

  return (
    <div className="space-y-1.5" data-testid={`control-${spec.key}`}>
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{spec.label}</Label>
        <span className="text-xs font-mono text-white/60">{value.toFixed(2)}</span>
      </div>
      <Slider
        min={spec.min ?? 0}
        max={spec.max ?? 1}
        step={spec.step ?? 0.01}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        data-testid={`slider-${spec.key}`}
      />
    </div>
  );
}

function IntControl({ spec, value, onChange }: { spec: UniformSpec; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5" data-testid={`control-${spec.key}`}>
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{spec.label}</Label>
        <span className="text-xs font-mono text-white/60">{value}</span>
      </div>
      <Slider
        min={spec.min ?? 1}
        max={spec.max ?? 1000}
        step={spec.step ?? 1}
        value={[value]}
        onValueChange={([v]) => onChange(Math.round(v))}
        data-testid={`slider-${spec.key}`}
      />
    </div>
  );
}

function ColorControl({ spec, value, onChange }: { spec: UniformSpec; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3" data-testid={`control-${spec.key}`}>
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex-1">{spec.label}</Label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-7 h-7 rounded cursor-pointer border-0"
        data-testid={`color-${spec.key}`}
      />
    </div>
  );
}

function BoolControl({ spec, value, onChange }: { spec: UniformSpec; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2" data-testid={`control-${spec.key}`}>
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{spec.label}</Label>
      <Switch
        checked={value}
        onCheckedChange={onChange}
        data-testid={`switch-${spec.key}`}
      />
    </div>
  );
}

function Vec2Control({ spec, value, onChange }: { spec: UniformSpec; value: [number, number]; onChange: (v: [number, number]) => void }) {
  return (
    <div className="space-y-1.5" data-testid={`control-${spec.key}`}>
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{spec.label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="text-[9px] text-white/40">X</span>
          <Slider
            min={spec.min ?? -2}
            max={spec.max ?? 2}
            step={spec.step ?? 0.01}
            value={[value[0]]}
            onValueChange={([v]) => onChange([v, value[1]])}
            data-testid={`slider-${spec.key}-x`}
          />
        </div>
        <div>
          <span className="text-[9px] text-white/40">Y</span>
          <Slider
            min={spec.min ?? -2}
            max={spec.max ?? 2}
            step={spec.step ?? 0.01}
            value={[value[1]]}
            onValueChange={([v]) => onChange([value[0], v])}
            data-testid={`slider-${spec.key}-y`}
          />
        </div>
      </div>
    </div>
  );
}

function ControlForSpec({ spec, value, onChange }: { spec: UniformSpec; value: any; onChange: (v: any) => void }) {
  switch (spec.type) {
    case "float": return <FloatControl spec={spec} value={value} onChange={onChange} />;
    case "int": return <IntControl spec={spec} value={value} onChange={onChange} />;
    case "bool": return <BoolControl spec={spec} value={value} onChange={onChange} />;
    case "color": return <ColorControl spec={spec} value={value} onChange={onChange} />;
    case "vec2": return <Vec2Control spec={spec} value={value} onChange={onChange} />;
    default: return null;
  }
}

export function ControlPanel({ specs, uniforms, setUniform }: ControlPanelProps) {
  const groups = groupSpecs(specs);

  const handleChange = (spec: UniformSpec, rawValue: any) => {
    const value = spec.transform ? spec.transform(rawValue) : rawValue;
    setUniform(spec.key, value);
  };

  return (
    <div className="space-y-4" data-testid="panel-fractal-controls">
      {Object.entries(groups).map(([groupName, groupSpecs]) => {
        const visible = groupSpecs.filter(
          (s) => !s.visibleIf || s.visibleIf(uniforms)
        );
        if (visible.length === 0) return null;

        return (
          <div key={groupName} className="space-y-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">{groupName}</p>
            <div className="space-y-3">
              {visible.map((spec) => (
                <ControlForSpec
                  key={spec.key}
                  spec={spec}
                  value={uniforms[spec.key]}
                  onChange={(v) => handleChange(spec, v)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
