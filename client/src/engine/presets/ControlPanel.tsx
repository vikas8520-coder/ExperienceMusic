import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FractalCenterPad } from "@/components/FractalCenterPad";
import { useEffect, useMemo, useState } from "react";
import type { UniformSpec, UniformValues } from "./types";

interface ControlPanelProps {
  specs: UniformSpec[];
  uniforms: UniformValues;
  setUniform: (key: string, value: any) => void;
  compact?: boolean;
  fillAvailableWidth?: boolean;
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

function compactGroupSpan(groupName: string): string {
  switch (groupName) {
    case "Fractal":
      return "col-span-12 xl:col-span-6 xl:row-span-2";
    case "Fractal Zoom":
      return "col-span-12 md:col-span-6 xl:col-span-3";
    case "Julia":
      return "col-span-12 md:col-span-6 xl:col-span-3";
    case "Color":
      return "col-span-12 md:col-span-6 xl:col-span-4";
    case "Audio":
      return "col-span-12 md:col-span-6 xl:col-span-4";
    case "Effects":
      return "col-span-12 md:col-span-6 xl:col-span-4";
    case "Quality":
      return "col-span-12 md:col-span-6 xl:col-span-4";
    default:
      return "col-span-12 md:col-span-6 xl:col-span-4";
  }
}

type PaletteRoleKey = "u_paletteA" | "u_paletteB" | "u_paletteC" | "u_paletteD";

const PALETTE_ROLE_ORDER: PaletteRoleKey[] = ["u_paletteA", "u_paletteB", "u_paletteC", "u_paletteD"];
const PALETTE_ROLE_LABEL: Record<PaletteRoleKey, string> = {
  u_paletteA: "Base",
  u_paletteB: "Primary",
  u_paletteC: "Accent",
  u_paletteD: "Shadow",
};

type SmartPalette = {
  id: string;
  label: string;
  colors: Record<PaletteRoleKey, string>;
  cycle?: number;
  speed?: number;
  saturation?: number;
  contrast?: number;
};

const SMART_COLOR_PALETTES: SmartPalette[] = [
  {
    id: "organic-tunnel",
    label: "Organic Tunnel",
    colors: { u_paletteA: "#0a1222", u_paletteB: "#3554b3", u_paletteC: "#10b0d6", u_paletteD: "#f16ad8" },
    cycle: 0.12,
    speed: 0.55,
    saturation: 0.82,
    contrast: 0.55,
  },
  {
    id: "neon-plasma",
    label: "Neon Plasma",
    colors: { u_paletteA: "#19021f", u_paletteB: "#7a1fff", u_paletteC: "#14d8ff", u_paletteD: "#ff5dcc" },
    cycle: 0.2,
    speed: 0.8,
    saturation: 0.92,
    contrast: 0.62,
  },
  {
    id: "ice-crystal",
    label: "Ice Crystal",
    colors: { u_paletteA: "#081224", u_paletteB: "#3e6cae", u_paletteC: "#78d9ff", u_paletteD: "#bfd9ff" },
    cycle: 0.08,
    speed: 0.45,
    saturation: 0.74,
    contrast: 0.58,
  },
  {
    id: "sunset-warp",
    label: "Sunset Warp",
    colors: { u_paletteA: "#220d16", u_paletteB: "#9f2d59", u_paletteC: "#f47f42", u_paletteD: "#ffd076" },
    cycle: 0.16,
    speed: 0.62,
    saturation: 0.88,
    contrast: 0.61,
  },
  {
    id: "deep-space",
    label: "Deep Space",
    colors: { u_paletteA: "#070711", u_paletteB: "#27366b", u_paletteC: "#4bb7d6", u_paletteD: "#a56aff" },
    cycle: 0.1,
    speed: 0.5,
    saturation: 0.78,
    contrast: 0.56,
  },
  {
    id: "acid-bloom",
    label: "Acid Bloom",
    colors: { u_paletteA: "#0b1b11", u_paletteB: "#1eb04f", u_paletteC: "#d4ff3e", u_paletteD: "#ff73d1" },
    cycle: 0.23,
    speed: 0.76,
    saturation: 0.95,
    contrast: 0.64,
  },
];

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const light = Math.max(0, Math.min(100, l)) / 100;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = light - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return clampByte(color * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function normalizeHexColor(value: unknown, fallback = "#808080"): string {
  if (typeof value !== "string") return fallback;
  const match = value.trim().match(/^#([0-9a-fA-F]{6})$/);
  return match ? `#${match[1].toUpperCase()}` : fallback;
}

function shuffleList<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function buildRandomPalette(style: "organic" | "crystal"): Record<PaletteRoleKey, string> {
  const baseHue = Math.random() * 360;
  if (style === "crystal") {
    return {
      u_paletteA: hslToHex(baseHue, 55, 14),
      u_paletteB: hslToHex(baseHue + 42, 78, 40),
      u_paletteC: hslToHex(baseHue + 158, 92, 58),
      u_paletteD: hslToHex(baseHue + 248, 76, 66),
    };
  }
  return {
    u_paletteA: hslToHex(baseHue, 45, 12),
    u_paletteB: hslToHex(baseHue + 28, 62, 34),
    u_paletteC: hslToHex(baseHue + 132, 68, 52),
    u_paletteD: hslToHex(baseHue + 212, 58, 62),
  };
}

function PremiumColorSection({
  specs,
  uniforms,
  onSpecChange,
  compact,
}: {
  specs: UniformSpec[];
  uniforms: UniformValues;
  onSpecChange: (spec: UniformSpec, value: any) => void;
  compact: boolean;
}) {
  const specByKey = useMemo(() => new Map(specs.map((spec) => [spec.key, spec])), [specs]);
  const paletteSpecs = useMemo(
    () => PALETTE_ROLE_ORDER.filter((key) => specByKey.has(key)).map((key) => specByKey.get(key) as UniformSpec),
    [specByKey],
  );
  const [activeRole, setActiveRole] = useState<PaletteRoleKey>("u_paletteA");
  const [lockedRoles, setLockedRoles] = useState<Record<PaletteRoleKey, boolean>>({
    u_paletteA: false,
    u_paletteB: false,
    u_paletteC: false,
    u_paletteD: false,
  });

  useEffect(() => {
    if (paletteSpecs.length === 0) return;
    const hasActive = paletteSpecs.some((spec) => spec.key === activeRole);
    if (!hasActive) setActiveRole(paletteSpecs[0].key as PaletteRoleKey);
  }, [activeRole, paletteSpecs]);

  const activeSpec = specByKey.get(activeRole);
  const activeColor = normalizeHexColor(uniforms[activeRole], "#808080");
  const paletteValues = useMemo(
    () =>
      PALETTE_ROLE_ORDER.reduce<Record<PaletteRoleKey, string>>((acc, key) => {
        acc[key] = normalizeHexColor(uniforms[key], "#808080");
        return acc;
      }, {
        u_paletteA: "#808080",
        u_paletteB: "#808080",
        u_paletteC: "#808080",
        u_paletteD: "#808080",
      }),
    [uniforms],
  );

  const motionSpecs = useMemo(() => {
    const order = ["u_colorCycle", "u_colorSpeed", "u_saturation", "u_contrast"];
    return order
      .map((key) => specByKey.get(key))
      .filter((spec): spec is UniformSpec => Boolean(spec));
  }, [specByKey]);

  const extraSpecs = useMemo(() => {
    const excluded = new Set<string>([...PALETTE_ROLE_ORDER, "u_colorCycle", "u_colorSpeed", "u_saturation", "u_contrast"]);
    return specs.filter((spec) => !excluded.has(spec.key));
  }, [specs]);

  const applyPalette = (palette: Partial<Record<PaletteRoleKey, string>>, motion?: Partial<Pick<SmartPalette, "cycle" | "speed" | "saturation" | "contrast">>) => {
    for (const key of PALETTE_ROLE_ORDER) {
      if (lockedRoles[key]) continue;
      const spec = specByKey.get(key);
      const color = palette[key];
      if (!spec || spec.type !== "color" || !color) continue;
      onSpecChange(spec, normalizeHexColor(color, "#808080"));
    }
    if (motion) {
      const map: Array<{ key: string; value: number | undefined }> = [
        { key: "u_colorCycle", value: motion.cycle },
        { key: "u_colorSpeed", value: motion.speed },
        { key: "u_saturation", value: motion.saturation },
        { key: "u_contrast", value: motion.contrast },
      ];
      for (const entry of map) {
        if (typeof entry.value !== "number") continue;
        const spec = specByKey.get(entry.key);
        if (!spec) continue;
        onSpecChange(spec, entry.value);
      }
    }
  };

  const onShuffle = () => {
    const unlockedKeys = PALETTE_ROLE_ORDER.filter((key) => !lockedRoles[key] && specByKey.has(key));
    if (unlockedKeys.length < 2) return;
    const shuffled = shuffleList(unlockedKeys.map((key) => paletteValues[key]));
    unlockedKeys.forEach((key, idx) => {
      const spec = specByKey.get(key);
      if (!spec || spec.type !== "color") return;
      onSpecChange(spec, shuffled[idx]);
    });
  };

  const onRandomize = () => {
    const crystalBoost = typeof uniforms.u_crystalBoost === "number" ? uniforms.u_crystalBoost : 0.7;
    const style = crystalBoost > 0.85 ? "crystal" : "organic";
    applyPalette(buildRandomPalette(style));
  };

  if (paletteSpecs.length === 0) {
    return (
      <div className="space-y-3">
        {specs.map((spec) => (
          <ControlForSpec
            key={spec.key}
            spec={spec}
            value={uniforms[spec.key]}
            onChange={(v) => onSpecChange(spec, v)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {PALETTE_ROLE_ORDER.map((key) => {
          const spec = specByKey.get(key);
          if (!spec || spec.type !== "color") return null;
          const active = activeRole === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveRole(key)}
              className={`rounded border px-2 py-2 text-left transition ${
                active
                  ? "border-cyan-300/60 bg-gradient-to-r from-fuchsia-500/20 to-cyan-400/20"
                  : "border-white/15 bg-white/5 hover:bg-white/10"
              }`}
              data-testid={`button-palette-role-${key}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-[0.12em] text-white/80">{PALETTE_ROLE_LABEL[key]}</span>
                <span
                  role="button"
                  tabIndex={0}
                  className={`rounded px-1 py-0.5 text-[9px] uppercase tracking-[0.1em] ${
                    lockedRoles[key] ? "bg-white/20 text-white" : "bg-white/10 text-white/60"
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setLockedRoles((prev) => ({ ...prev, [key]: !prev[key] }));
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    event.stopPropagation();
                    setLockedRoles((prev) => ({ ...prev, [key]: !prev[key] }));
                  }}
                  data-testid={`button-palette-lock-${key}`}
                >
                  {lockedRoles[key] ? "Lock" : "Free"}
                </span>
              </div>
              <div className="mt-2 h-7 rounded border border-white/10" style={{ backgroundColor: paletteValues[key] }} />
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-white/10 bg-black/25 p-2.5">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-[0.12em] text-white/65">Live Palette Preview</span>
          <span className="text-[10px] font-mono text-white/55">
            {paletteValues.u_paletteA} · {paletteValues.u_paletteD}
          </span>
        </div>
        <div
          className="h-8 rounded border border-white/10"
          style={{
            background: `linear-gradient(90deg, ${paletteValues.u_paletteA} 0%, ${paletteValues.u_paletteB} 33%, ${paletteValues.u_paletteC} 66%, ${paletteValues.u_paletteD} 100%)`,
          }}
        />
      </div>

      <div className={compact ? "grid gap-3 md:grid-cols-[1.2fr,1fr]" : "grid gap-3 md:grid-cols-2"}>
        <div className="space-y-2 rounded-lg border border-white/10 bg-black/25 p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.12em] text-white/65">Smart Palettes</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onShuffle}
                className="rounded border border-white/15 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-white/80 hover:bg-white/10"
                data-testid="button-palette-shuffle"
              >
                Shuffle
              </button>
              <button
                type="button"
                onClick={onRandomize}
                className="rounded border border-white/15 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-white/80 hover:bg-white/10"
                data-testid="button-palette-randomize"
              >
                Randomize
              </button>
            </div>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {SMART_COLOR_PALETTES.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPalette(preset.colors, {
                  cycle: preset.cycle,
                  speed: preset.speed,
                  saturation: preset.saturation,
                  contrast: preset.contrast,
                })}
                className="rounded border border-white/15 bg-white/5 px-2 py-1.5 text-left text-[10px] uppercase tracking-[0.11em] text-white/75 hover:bg-white/10"
                data-testid={`button-palette-preset-${preset.id}`}
              >
                <span className="block">{preset.label}</span>
                <span
                  className="mt-1 block h-2 rounded border border-white/10"
                  style={{
                    background: `linear-gradient(90deg, ${preset.colors.u_paletteA} 0%, ${preset.colors.u_paletteB} 33%, ${preset.colors.u_paletteC} 66%, ${preset.colors.u_paletteD} 100%)`,
                  }}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 rounded-lg border border-white/10 bg-black/25 p-2.5">
          <span className="text-[10px] uppercase tracking-[0.12em] text-white/65">Active Role Editor</span>
          <div className="rounded border border-white/10 bg-white/5 p-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.11em] text-white/80">{PALETTE_ROLE_LABEL[activeRole]}</span>
              <span className="text-[10px] font-mono text-white/60">{activeColor}</span>
            </div>
            <div className="mb-2 h-12 rounded border border-white/10" style={{ backgroundColor: activeColor }} />
            {activeSpec && activeSpec.type === "color" && (
              <input
                type="color"
                value={activeColor}
                onChange={(event) => onSpecChange(activeSpec, event.target.value)}
                className="h-9 w-full cursor-pointer rounded border border-white/15 bg-transparent"
                data-testid={`color-${activeRole}`}
              />
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-white/10 bg-black/25 p-2.5">
        <span className="text-[10px] uppercase tracking-[0.12em] text-white/65">Color Motion</span>
        <div className="grid gap-3 md:grid-cols-2">
          {motionSpecs.map((spec) => (
            <ControlForSpec
              key={spec.key}
              spec={spec}
              value={uniforms[spec.key]}
              onChange={(v) => onSpecChange(spec, v)}
            />
          ))}
        </div>
      </div>

      {extraSpecs.length > 0 && (
        <div className="space-y-2">
          {extraSpecs.map((spec) => (
            <ControlForSpec
              key={spec.key}
              spec={spec}
              value={uniforms[spec.key]}
              onChange={(v) => onSpecChange(spec, v)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FloatControl({
  spec,
  value,
  onChange,
  onReset,
}: {
  spec: UniformSpec;
  value: number;
  onChange: (v: number) => void;
  onReset?: () => void;
}) {
  return (
    <div className="space-y-1.5" data-testid={`control-${spec.key}`}>
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{spec.label}</Label>
        <div className="flex items-center gap-2">
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-white/70 hover:bg-white/10"
              data-testid={`button-reset-${spec.key}`}
            >
              Reset
            </button>
          )}
          <span className="text-xs font-mono text-white/60">{value.toFixed(2)}</span>
        </div>
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

function Vec2Control({
  spec,
  value,
  onChange,
  zoom,
  onZoomChange,
  minZoom,
  maxZoom,
}: {
  spec: UniformSpec;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  zoom?: number;
  onZoomChange?: (v: number) => void;
  minZoom?: number;
  maxZoom?: number;
}) {
  if (spec.key === "u_center") {
    const resetValue = Array.isArray(spec.default) && spec.default.length === 2
      ? [spec.default[0] as number, spec.default[1] as number] as [number, number]
      : [0, 0] as [number, number];

    return (
      <div className="space-y-1.5" data-testid={`control-${spec.key}`}>
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{spec.label}</Label>
        <FractalCenterPad
          value={{ x: value[0], y: value[1] }}
          range={spec.max ?? 2}
          zoom={zoom ?? 1}
          onZoomChange={(next) => onZoomChange?.(next)}
          onChange={({ x, y }) => onChange([x, y])}
          onReset={() => onChange(resetValue)}
          minZoom={minZoom}
          maxZoom={maxZoom}
        />
      </div>
    );
  }

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

function Vec3Control({ spec, value, onChange }: { spec: UniformSpec; value: [number, number, number]; onChange: (v: [number, number, number]) => void }) {
  const labels = ["X", "Y", "Z"];
  return (
    <div className="space-y-1.5" data-testid={`control-${spec.key}`}>
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{spec.label}</Label>
      <div className="grid grid-cols-3 gap-2">
        {labels.map((lbl, i) => (
          <div key={lbl}>
            <span className="text-[9px] text-white/40">{lbl}</span>
            <Slider
              min={spec.min ?? -2}
              max={spec.max ?? 2}
              step={spec.step ?? 0.01}
              value={[value[i]]}
              onValueChange={([v]) => {
                const next = [...value] as [number, number, number];
                next[i] = v;
                onChange(next);
              }}
              data-testid={`slider-${spec.key}-${lbl.toLowerCase()}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ControlForSpec({
  spec,
  value,
  onChange,
  zoom,
  onZoomChange,
  minZoom,
  maxZoom,
}: {
  spec: UniformSpec;
  value: any;
  onChange: (v: any) => void;
  zoom?: number;
  onZoomChange?: (v: number) => void;
  minZoom?: number;
  maxZoom?: number;
}) {
  switch (spec.type) {
    case "float":
      return (
        <FloatControl
          spec={spec}
          value={value}
          onChange={onChange}
          onReset={spec.key === "u_rotation" ? () => onChange((spec.default as number) ?? 0) : undefined}
        />
      );
    case "int": return <IntControl spec={spec} value={value} onChange={onChange} />;
    case "bool": return <BoolControl spec={spec} value={value} onChange={onChange} />;
    case "color": return <ColorControl spec={spec} value={value} onChange={onChange} />;
    case "vec2":
      return (
        <Vec2Control
          spec={spec}
          value={value}
          onChange={onChange}
          zoom={zoom}
          onZoomChange={onZoomChange}
          minZoom={minZoom}
          maxZoom={maxZoom}
        />
      );
    case "vec3": return <Vec3Control spec={spec} value={value} onChange={onChange} />;
    default: return null;
  }
}

export function ControlPanel({
  specs,
  uniforms,
  setUniform,
  compact = false,
  fillAvailableWidth = false,
}: ControlPanelProps) {
  const groups = groupSpecs(specs);
  const visibleGroups = Object.entries(groups).filter(([, groupSpecs]) =>
    groupSpecs.some((s) => !s.visibleIf || s.visibleIf(uniforms)),
  );
  const stretchCompactGroups = compact && (fillAvailableWidth || visibleGroups.length <= 1);
  const zoomSpec = specs.find((s) => s.key === "u_zoom" && s.type === "float");
  const infiniteZoom = !!uniforms.u_infiniteZoom;
  const zoomExpValue = typeof uniforms.u_zoomExp === "number" ? (uniforms.u_zoomExp as number) : 0;
  const linearZoomValue = typeof uniforms.u_zoom === "number" ? (uniforms.u_zoom as number) : 1;
  const zoomValue = infiniteZoom ? Math.pow(2, zoomExpValue) : linearZoomValue;
  const minZoom = infiniteZoom ? 1e-12 : zoomSpec?.min;
  const maxZoom = infiniteZoom ? 50 : zoomSpec?.max;

  const handleChange = (spec: UniformSpec, rawValue: any) => {
    const value = spec.transform ? spec.transform(rawValue) : rawValue;
    setUniform(spec.key, value);
    if (spec.key === "u_infiniteZoom") {
      const nextInfinite = !!value;
      if (nextInfinite) {
        const z = typeof uniforms.u_zoom === "number" ? (uniforms.u_zoom as number) : 1;
        setUniform("u_zoomExp", Math.log2(Math.max(1e-12, z)));
      } else {
        const exp = typeof uniforms.u_zoomExp === "number" ? (uniforms.u_zoomExp as number) : 0;
        setUniform("u_zoom", Math.max(1e-6, Math.pow(2, exp)));
      }
    }
  };

  return (
    <div
      className={
        compact
          ? "grid auto-rows-min grid-cols-12 grid-flow-row-dense items-start gap-2.5"
          : "space-y-4"
      }
      data-testid="panel-fractal-controls"
    >
      {visibleGroups.map(([groupName, allGroupSpecs]) => {
        const visible = allGroupSpecs.filter(
          (s) => !s.visibleIf || s.visibleIf(uniforms)
        );
        if (groupName === "Color") {
          return (
            <div
              key={groupName}
              className={
                compact
                  ? `self-start space-y-2 rounded-lg border border-white/10 bg-black/20 p-2 ${
                      stretchCompactGroups ? "col-span-12" : compactGroupSpan(groupName)
                    }`
                  : "space-y-3"
              }
            >
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">{groupName}</p>
              <PremiumColorSection
                specs={visible}
                uniforms={uniforms}
                onSpecChange={handleChange}
                compact={compact}
              />
            </div>
          );
        }

        return (
          <div
            key={groupName}
            className={
              compact
                ? `self-start space-y-2 rounded-lg border border-white/10 bg-black/20 p-2 ${
                    stretchCompactGroups ? "col-span-12" : compactGroupSpan(groupName)
                  }`
                : "space-y-3"
            }
          >
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">{groupName}</p>
            <div
              className={
                compact
                  ? stretchCompactGroups
                    ? "grid auto-rows-min grid-flow-row-dense items-start gap-3 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]"
                    : "grid auto-rows-min grid-cols-1 grid-flow-row-dense items-start gap-2 lg:grid-cols-2"
                  : "space-y-3"
              }
            >
              {visible.map((spec) => (
                <div
                  key={spec.key}
                  className={
                    compact && spec.key === "u_center"
                      ? "col-[1/-1]"
                      : undefined
                  }
                >
                  <ControlForSpec
                    spec={spec}
                    value={uniforms[spec.key]}
                    onChange={(v) => handleChange(spec, v)}
                    zoom={zoomValue}
                    onZoomChange={(v) => {
                      if (infiniteZoom) {
                        const nextExp = Math.log2(Math.max(1e-12, v));
                        setUniform("u_zoomExp", nextExp);
                        return;
                      }
                      setUniform("u_zoom", v);
                    }}
                    minZoom={minZoom}
                    maxZoom={maxZoom}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
