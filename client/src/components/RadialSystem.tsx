import { useCallback, useEffect, useMemo, useRef, useState, useId } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pin, SlidersHorizontal, TriangleAlert, Sparkles, X, ChevronRight } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ResizablePanel } from "@/components/ResizablePanel";
import { ControlPanel as FractalControlPanel } from "@/engine/presets/ControlPanel";
import {
  colorModes,
  moodPresets,
  type ColorSettings,
  type ImageFilterId,
  type PresetName,
  type PsyOverlayId,
} from "@/lib/visualizer-presets";
import { isFractalPreset } from "@/engine/presets/registry";
import type { UniformSpec, UniformValues } from "@/engine/presets/types";
import type { AutoEvolveConfig, AutoEvolveOutput } from "@/engine/autoevolve/moodPresetMap";
import { presets as allPresetNames } from "@/lib/visualizer-presets";
import { describeRingSlice } from "@/ui/radial/radialPaths";
import { RadialTooltip } from "@/ui/radial/RadialTooltip";
import { useFps } from "@/ui/radial/useFps";

const VIEW_SIZE = 620;
const CENTER = VIEW_SIZE / 2;
const MASTER_INNER = 110;
const MASTER_OUTER = 180;
const SECONDARY_INNER = 225;
const SECONDARY_OUTER = 295;
const ENERGY_RING_RADIUS = 92;
const ENERGY_RING_STROKE = 10;
const RADIAL_TOP_INSET = 56;
const RADIAL_BOTTOM_INSET = 124;
const RENDER_HEAVY_DIAL_IDS = new Set([
  "resScale",
  "maxSteps",
  "ao",
  "shadows",
  "aa",
  "render-resolution",
  "render-steps",
  "render-ao",
  "render-shadows",
  "render-aa",
]);

type TabId = "listen" | "create" | "perform" | "record";

type UISettings = {
  intensity: number;
  speed: number;
  fieldRotation?: number;
  evolutionEnabled?: boolean;
  aiEvolutionStrength?: number;
  aiEvolutionMode?: "subtle" | "musical" | "aggressive";
  aiReactivityBias?: "structure" | "motion" | "color" | "audio";
  aiEvolutionSpeed?: number;
  aiDropBoost?: boolean;
  colorPalette: string[];
  presetName: PresetName;
  presetEnabled: boolean;
  imageFilters: ImageFilterId[];
  psyOverlays?: PsyOverlayId[];
  trailsOn?: boolean;
  trailsAmount?: number;
  glowEnabled?: boolean;
  glowIntensity?: number;
};

type RadialVariant = "base" | "fractal" | "performance";
type FractalPrecisionTab = "structure" | "motion" | "color" | "audio" | "julia" | "effects";
type FractalSettingsTileOrder = "ai-first" | "precision-first";

type DialSpec = {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  logScale?: boolean;
  formatter?: (value: number) => string;
  onChange: (value: number) => void;
};

type ActionItem = {
  id: string;
  kind: "action";
  label: string;
  active?: boolean;
  warning?: boolean;
  critical?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

type DialItem = {
  id: string;
  kind: "dial";
  label: string;
  dial: DialSpec;
  active?: boolean;
  warning?: boolean;
  critical?: boolean;
  disabled?: boolean;
};

type RingItem = ActionItem | DialItem;

type PrimaryWedge = {
  id: string;
  label: string;
  warning?: boolean;
  critical?: boolean;
  items?: RingItem[];
  directDial?: DialSpec;
};

type RadialSystemProps = {
  activeTab: TabId;
  settings: UISettings;
  setSettings: (next: any) => void;
  colorSettings: ColorSettings;
  setColorSettings: (next: ColorSettings) => void;
  leftDockCollapsed?: boolean;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  fractalSpecs?: UniformSpec[];
  fractalMacros?: UniformSpec[];
  fractalUniforms?: UniformValues;
  onFractalUniformChange?: (key: string, value: any) => void;
  adaptiveQualityTier?: 0 | 1 | 2;
  micStatus?: "idle" | "starting" | "running" | "error";
  onToggleMicReactivity?: () => void;
  onVisibilityStateChange?: (state: { radialMounted: boolean; settingsPanelOpen: boolean; isPinned: boolean }) => void;
  openRequestToken?: number;
  closeRequestToken?: number;
  onDismiss?: () => void;
  autoEvolveConfig?: AutoEvolveConfig;
  setAutoEvolveConfig?: (next: AutoEvolveConfig | ((prev: AutoEvolveConfig) => AutoEvolveConfig)) => void;
  autoEvolveOutput?: AutoEvolveOutput;
};

const FRACTAL_PRECISION_TABS: { id: FractalPrecisionTab; label: string }[] = [
  { id: "structure", label: "Structure" },
  { id: "motion", label: "Motion" },
  { id: "color", label: "Color" },
  { id: "audio", label: "Audio" },
  { id: "julia", label: "Julia" },
  { id: "effects", label: "Effects" },
];
const FRACTAL_SETTINGS_TILE_ORDER_KEY = "fractalSettingsTileOrder_v1";

const AI_MODE_OPTIONS: Array<{ id: NonNullable<UISettings["aiEvolutionMode"]>; label: string }> = [
  { id: "subtle", label: "Subtle" },
  { id: "musical", label: "Musical" },
  { id: "aggressive", label: "Aggressive" },
];

const CHAOS_LEVEL_OPTIONS: Array<{ id: "subtle" | "medium" | "aggressive"; label: string; desc: string }> = [
  { id: "subtle", label: "Subtle", desc: "Live VJ — phrase boundaries only" },
  { id: "medium", label: "Medium", desc: "Alive — responds to drops & tension" },
  { id: "aggressive", label: "Aggressive", desc: "Psychedelic — rapid & wild" },
];

const MOOD_LABELS: Record<string, string> = {
  calm: "Calm",
  groove: "Groove",
  lift: "Lift",
  hype: "Hype",
  spark: "Spark",
};

const AI_BIAS_OPTIONS: Array<{ id: NonNullable<UISettings["aiReactivityBias"]>; label: string }> = [
  { id: "structure", label: "Structure" },
  { id: "motion", label: "Motion" },
  { id: "color", label: "Color" },
  { id: "audio", label: "Audio" },
];

const FRACTAL_MOTION_KEYS = new Set([
  "u_zoom",
  "u_opacity",
  "u_infiniteZoom",
  "u_zoomExp",
  "u_zoomPulseEnabled",
  "u_zoomPulseStrength",
  "u_rotation",
]);

function mapSpecToPrecisionTab(spec: UniformSpec): FractalPrecisionTab {
  if (spec.group === "Color") return "color";
  if (spec.group === "Audio") return "audio";
  if (spec.group === "Julia") return "julia";
  if (spec.group === "Effects" || spec.group === "Quality") return "effects";
  if (spec.group === "Fractal Zoom") return "motion";

  if (spec.group === "Fractal") {
    return FRACTAL_MOTION_KEYS.has(spec.key) ? "motion" : "structure";
  }

  return "structure";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toRadians(angle: number): number {
  return ((angle - 90) * Math.PI) / 180;
}

function polarPoint(cx: number, cy: number, r: number, angle: number): { x: number; y: number } {
  const t = toRadians(angle);
  return {
    x: cx + r * Math.cos(t),
    y: cy + r * Math.sin(t),
  };
}

function arcPath(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
): string {
  return describeRingSlice(cx, cy, outerRadius, innerRadius, startAngle, endAngle);
}

function snapToStep(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

function angleFromPointer(cx: number, cy: number, px: number, py: number): number {
  const dx = px - cx;
  const dy = py - cy;
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  return (deg + 360) % 360;
}

function shouldIgnoreKeyboardEvent(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.tagName === "BUTTON") return true;
  if (el.isContentEditable) return true;
  return Boolean(
    el.closest("[role='dialog']") ||
      el.closest("[role='listbox']") ||
      el.closest("[role='menu']") ||
      el.closest("[data-radix-popper-content-wrapper]"),
  );
}

function shortPresetName(name: string): string {
  if (name.includes("Mandelbrot")) return "Mandelbrot";
  if (name.includes("Orbit Trap")) return "Orbit Trap";
  if (name.includes("Cymatic")) return "Cymatic";
  if (name.includes("Geometry")) return "Geometry";
  return name.length > 11 ? `${name.slice(0, 11)}.` : name;
}

function RingLayer({
  items,
  innerRadius,
  outerRadius,
  activeId,
  hoverId,
  onHover,
  onLeave,
  onSelect,
  gradientId,
  textClassName,
}: {
  items: { id: string; label: string; active?: boolean; warning?: boolean; critical?: boolean; disabled?: boolean }[];
  innerRadius: number;
  outerRadius: number;
  activeId: string | null;
  hoverId: string | null;
  onHover: (id: string) => void;
  onLeave: () => void;
  onSelect: (id: string) => void;
  gradientId: string;
  textClassName?: string;
}) {
  const angle = items.length > 0 ? 360 / items.length : 360;
  const gap = items.length >= 6 ? 2 : 3;

  return (
    <g data-radial-node="true">
      {items.map((item, index) => {
        const start = index * angle + gap * 0.5;
        const end = (index + 1) * angle - gap * 0.5;
        const mid = (start + end) * 0.5;
        const d = arcPath(CENTER, CENTER, innerRadius, outerRadius, start, end);
        const labelPos = polarPoint(CENTER, CENTER, (innerRadius + outerRadius) * 0.5, mid);
        const isActive = activeId === item.id || Boolean(item.active);
        const isHover = hoverId === item.id;
        const fill = item.critical
          ? "rgba(239,68,68,0.22)"
          : item.warning
            ? "rgba(245,158,11,0.2)"
            : isActive
              ? "rgba(217,70,239,0.22)"
              : "rgba(12,12,18,0.72)";
        const stroke = isActive
          ? `url(#${gradientId})`
          : item.critical
            ? "rgba(239,68,68,0.9)"
            : item.warning
              ? "rgba(245,158,11,0.85)"
              : "rgba(255,255,255,0.15)";
        const opacity = item.disabled ? 0.4 : 1;

        return (
          <g key={item.id} data-radial-node="true" style={{ opacity }}>
            {(isHover || isActive) && (
              <path
                d={d}
                fill="none"
                stroke={`url(#${gradientId})`}
                strokeWidth={isActive ? 8 : 7}
                opacity={isActive ? 0.32 : 0.22}
                pointerEvents="none"
              />
            )}
            <path
              d={d}
              fill={fill}
              stroke={stroke}
              strokeWidth={isActive ? 2.2 : 1}
              style={{
                transition: "transform 0.14s cubic-bezier(0.22, 1, 0.36, 1), fill 0.2s ease, stroke 0.2s ease",
                transformBox: "fill-box",
                transformOrigin: "center",
                transform: isHover && !item.disabled ? "scale(1.02)" : isActive ? "scale(1.01)" : "scale(1)",
                cursor: item.disabled ? "not-allowed" : "pointer",
              }}
              onMouseEnter={() => !item.disabled && onHover(item.id)}
              onMouseLeave={onLeave}
              onClick={() => !item.disabled && onSelect(item.id)}
              data-radial-node="true"
            />
            <text
              x={labelPos.x}
              y={labelPos.y + 3}
              textAnchor="middle"
              className={textClassName ?? "fill-white/85 text-[13px] font-medium tracking-[0.08em] uppercase"}
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {item.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function ContextualSecondaryLayer({
  items,
  parentIndex,
  parentCount,
  innerRadius,
  outerRadius,
  activeId,
  hoverId,
  onHover,
  onLeave,
  onSelect,
  gradientId,
  textClassName,
}: {
  items: { id: string; label: string; active?: boolean; warning?: boolean; critical?: boolean; disabled?: boolean }[];
  parentIndex: number;
  parentCount: number;
  innerRadius: number;
  outerRadius: number;
  activeId: string | null;
  hoverId: string | null;
  onHover: (id: string) => void;
  onLeave: () => void;
  onSelect: (id: string) => void;
  gradientId: string;
  textClassName?: string;
}) {
  if (items.length === 0 || parentCount <= 0 || parentIndex < 0) return null;

  const parentStep = 360 / parentCount;
  const parentMid = parentIndex * parentStep + parentStep * 0.5;
  const arcSpan = clamp(28 * items.length + 40, 88, 150);
  const step = arcSpan / items.length;
  const baseStart = parentMid - arcSpan * 0.5;
  const gap = items.length >= 5 ? 1.6 : 2;

  return (
    <g data-radial-node="true">
      {items.map((item, index) => {
        const start = baseStart + index * step + gap * 0.5;
        const end = baseStart + (index + 1) * step - gap * 0.5;
        const mid = (start + end) * 0.5;
        const d = arcPath(CENTER, CENTER, innerRadius, outerRadius, start, end);
        const labelPos = polarPoint(CENTER, CENTER, (innerRadius + outerRadius) * 0.5, mid);
        const isActive = activeId === item.id || Boolean(item.active);
        const isHover = hoverId === item.id;
        const fill = item.critical
          ? "rgba(239,68,68,0.24)"
          : item.warning
            ? "rgba(245,158,11,0.22)"
            : isActive
              ? "rgba(217,70,239,0.2)"
              : "rgba(12,12,18,0.76)";
        const stroke = isActive
          ? `url(#${gradientId})`
          : item.critical
            ? "rgba(239,68,68,0.9)"
            : item.warning
              ? "rgba(245,158,11,0.85)"
              : "rgba(255,255,255,0.14)";
        const opacity = item.disabled ? 0.4 : 1;

        return (
          <g key={item.id} data-radial-node="true" style={{ opacity }}>
            {(isHover || isActive) && (
              <path
                d={d}
                fill="none"
                stroke={`url(#${gradientId})`}
                strokeWidth={isActive ? 8 : 7}
                opacity={isActive ? 0.28 : 0.2}
                pointerEvents="none"
              />
            )}
            <path
              d={d}
              fill={fill}
              stroke={stroke}
              strokeWidth={isActive ? 2.1 : 1}
              style={{
                transition: "transform 0.14s cubic-bezier(0.22, 1, 0.36, 1), fill 0.2s ease, stroke 0.2s ease",
                transformBox: "fill-box",
                transformOrigin: "center",
                transform: isHover && !item.disabled ? "scale(1.02)" : "scale(1)",
                cursor: item.disabled ? "not-allowed" : "pointer",
              }}
              onMouseEnter={() => !item.disabled && onHover(item.id)}
              onMouseLeave={onLeave}
              onClick={() => !item.disabled && onSelect(item.id)}
              data-radial-node="true"
            />
            <text
              x={labelPos.x}
              y={labelPos.y + 2.5}
              textAnchor="middle"
              className={textClassName ?? "fill-white/82 text-[12px] font-medium tracking-[0.08em] uppercase"}
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {item.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function MoodPresetEditor({
  moodMap,
  onChange,
}: {
  moodMap: Record<string, string[]>;
  onChange: (map: Record<string, string[]>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const moods = ["calm", "groove", "lift", "hype", "spark"] as const;

  const removePreset = (mood: string, preset: string) => {
    const updated = { ...moodMap, [mood]: moodMap[mood].filter((p) => p !== preset) };
    onChange(updated);
  };

  const addPreset = (mood: string, preset: string) => {
    if (moodMap[mood].includes(preset)) return;
    onChange({ ...moodMap, [mood]: [...moodMap[mood], preset] });
  };

  // Available presets not assigned to this mood
  const getAvailable = (mood: string) =>
    allPresetNames.filter(
      (p) => !p.includes("(Babylon)") && !moodMap[mood].includes(p),
    );

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between text-[10px] uppercase tracking-widest text-white/55 transition hover:text-white/75"
        data-radial-node="true"
      >
        <span>Mood Preset Map</span>
        <span className="text-[9px]">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="space-y-2 pt-1">
          {moods.map((mood) => (
            <div key={mood} className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
                {MOOD_LABELS[mood]}
              </span>
              <div className="flex flex-wrap gap-1">
                {moodMap[mood]?.map((preset) => (
                  <span
                    key={preset}
                    className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[9px] text-white/70"
                  >
                    {preset}
                    <button
                      type="button"
                      onClick={() => removePreset(mood, preset)}
                      className="ml-0.5 text-white/40 hover:text-red-400"
                      data-radial-node="true"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {/* Add preset dropdown */}
                <select
                  className="h-5 rounded border border-white/15 bg-white/5 px-1 text-[9px] text-white/60"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) addPreset(mood, e.target.value);
                    e.target.value = "";
                  }}
                  data-radial-node="true"
                >
                  <option value="">+ Add</option>
                  {getAvailable(mood).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DialPanel({
  dial,
  onClose,
  fps,
  showDepthTicks = false,
}: {
  dial: DialSpec;
  onClose: () => void;
  fps?: number;
  showDepthTicks?: boolean;
}) {
  const gradientId = useId().replace(/:/g, "");
  const glowId = `${gradientId}-glow`;
  const draggingRef = useRef(false);
  const shiftDownRef = useRef(false);
  const velocityRef = useRef(0);
  const lastTimeRef = useRef(typeof performance !== "undefined" ? performance.now() : 0);
  const inertiaRafRef = useRef<number | null>(null);

  const min = dial.min;
  const max = dial.max;
  const safeMax = max <= min ? min + 0.0001 : max;
  const usesLog = Boolean(dial.logScale && min > 0 && safeMax > min);
  const ringRadius = 72;
  const interactionRadius = ringRadius + 16;

  const valueToAngle = useCallback(
    (nextValue: number) => {
      const ratio = usesLog
        ? clamp(Math.log(nextValue / min) / Math.log(safeMax / min), 0, 1)
        : clamp((nextValue - min) / (safeMax - min), 0, 1);
      return ratio * 360;
    },
    [usesLog, min, safeMax],
  );

  const angleToValue = useCallback(
    (angle: number) => {
      const ratio = clamp(angle / 360, 0, 1);
      const rawValue = usesLog ? min * Math.pow(safeMax / min, ratio) : min + ratio * (safeMax - min);
      return snapToStep(rawValue, dial.step);
    },
    [usesLog, min, safeMax, dial.step],
  );

  const [angleState, setAngleState] = useState(() => valueToAngle(dial.value));
  const lastAngleRef = useRef(angleState);

  const halo = useMemo(() => {
    if (!Number.isFinite(fps ?? NaN)) {
      return { stroke: "rgba(255,255,255,0.14)", glow: 0.22, state: "Idle" };
    }
    if ((fps ?? 60) >= 55) {
      return { stroke: "rgba(34,197,94,0.42)", glow: 0.34, state: "Stable" };
    }
    if ((fps ?? 60) >= 42) {
      return { stroke: "rgba(251,191,36,0.46)", glow: 0.5, state: "Watch" };
    }
    return { stroke: "rgba(244,63,94,0.52)", glow: 0.72, state: "Load" };
  }, [fps]);

  const showRenderTooltip = Boolean(Number.isFinite(fps ?? NaN) && (fps ?? 0) < 50 && RENDER_HEAVY_DIAL_IDS.has(dial.id));

  const stopInertia = useCallback(() => {
    if (inertiaRafRef.current !== null) {
      cancelAnimationFrame(inertiaRafRef.current);
      inertiaRafRef.current = null;
    }
  }, []);

  const commitAngle = useCallback(
    (nextAngle: number) => {
      const normalized = (nextAngle + 360) % 360;
      lastAngleRef.current = normalized;
      setAngleState(normalized);
      const nextValue = clamp(angleToValue(normalized), min, safeMax);
      dial.onChange(nextValue);
    },
    [angleToValue, dial, min, safeMax],
  );

  const startInertia = useCallback(() => {
    stopInertia();
    const friction = 0.92;
    const minVelocity = 8;

    const tick = () => {
      velocityRef.current *= friction;
      if (Math.abs(velocityRef.current) < minVelocity) {
        stopInertia();
        return;
      }

      const next = (lastAngleRef.current + velocityRef.current * (1 / 60) + 360) % 360;
      commitAngle(next);
      inertiaRafRef.current = requestAnimationFrame(tick);
    };

    inertiaRafRef.current = requestAnimationFrame(tick);
  }, [commitAngle, stopInertia]);

  const updateFromPointer = useCallback(
    (event: React.PointerEvent<SVGCircleElement>) => {
      const svg = event.currentTarget.ownerSVGElement;
      const rect = svg?.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return;

      const px = ((event.clientX - rect.left) / rect.width) * 180;
      const py = ((event.clientY - rect.top) / rect.height) * 180;
      const angle = angleFromPointer(90, 90, px, py);
      const sensitivity = shiftDownRef.current ? 0.25 : 1;

      let delta = angle - lastAngleRef.current;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;

      const appliedDelta = delta * sensitivity;
      const next = (lastAngleRef.current + appliedDelta + 360) % 360;

      const now = performance.now();
      const dt = Math.max(0.001, (now - lastTimeRef.current) / 1000);
      velocityRef.current = appliedDelta / dt;
      lastTimeRef.current = now;

      commitAngle(next);
    },
    [commitAngle],
  );

  const handleWheel = useCallback(
    (event: React.WheelEvent<SVGSVGElement>) => {
      event.preventDefault();
      stopInertia();

      const baseStep = dial.step > 0 ? dial.step : (safeMax - min) / 200;
      const microStep = shiftDownRef.current ? baseStep * 0.1 : baseStep * 0.25;
      const direction = event.deltaY > 0 ? -1 : 1;
      const nextValue = clamp(snapToStep(dial.value + direction * microStep, dial.step), min, safeMax);
      dial.onChange(nextValue);

      const nextAngle = valueToAngle(nextValue);
      lastAngleRef.current = nextAngle;
      setAngleState(nextAngle);
      velocityRef.current = 0;
    },
    [dial, min, safeMax, stopInertia, valueToAngle],
  );

  useEffect(() => {
    const syncFromValue = valueToAngle(dial.value);
    setAngleState(syncFromValue);
    if (!draggingRef.current && inertiaRafRef.current === null) {
      lastAngleRef.current = syncFromValue;
    }
  }, [dial.value, valueToAngle]);

  useEffect(() => {
    const onPointerUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      startInertia();
    };
    window.addEventListener("pointerup", onPointerUp);
    return () => window.removeEventListener("pointerup", onPointerUp);
  }, [startInertia]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Shift") shiftDownRef.current = true;
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Shift") shiftDownRef.current = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => () => stopInertia(), [stopInertia]);

  const ratio = clamp(angleState / 360, 0, 1);
  const circumference = 2 * Math.PI * ringRadius;
  const knobAngle = -90 + angleState;
  const knob = polarPoint(90, 90, ringRadius, knobAngle);
  const formattedValue =
    dial.formatter?.(dial.value) ??
    (dial.step >= 1 ? `${Math.round(dial.value)}` : dial.value.toFixed(dial.step < 0.01 ? 3 : 2));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      data-radial-node="true"
    >
      <div
        className="radial-dial-card pointer-events-auto rounded-2xl border border-white/20 bg-[rgba(10,10,16,0.92)] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.48)]"
        style={{ width: 248 }}
        data-radial-node="true"
      >
        <svg
          width="180"
          height="180"
          viewBox="0 0 180 180"
          className="mx-auto block"
          onWheel={handleWheel}
          data-radial-node="true"
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--radial-accent-start)" />
              <stop offset="100%" stopColor="var(--radial-accent-end)" />
            </linearGradient>
            <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation={4 + halo.glow * 2.4} result="blur" />
              <feColorMatrix
                in="blur"
                type="matrix"
                values="
                  1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  0 0 0 0.55 0"
                result="glow"
              />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {showRenderTooltip && <RadialTooltip x={90} y={52} text="Low FPS - Lower Res / Steps?" />}

          <circle cx="90" cy="90" r={ringRadius + 18} stroke={halo.stroke} strokeWidth="10" fill="none" filter={`url(#${glowId})`} />

          {showDepthTicks && (
            <g opacity={0.52}>
              {Array.from({ length: 48 }).map((_, index) => {
                const angle = (index / 48) * 360;
                const inner = ringRadius + 10;
                const outer = index % 6 === 0 ? ringRadius + 18 : ringRadius + 14;
                const p1 = polarPoint(90, 90, inner, angle);
                const p2 = polarPoint(90, 90, outer, angle);
                return (
                  <line
                    key={`tick-${index}`}
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke="rgba(255,255,255,0.24)"
                    strokeWidth={index % 6 === 0 ? 2 : 1}
                    strokeLinecap="round"
                  />
                );
              })}
            </g>
          )}

          <circle cx="90" cy="90" r={ringRadius} stroke="rgba(255,255,255,0.16)" strokeWidth="8" fill="none" />
          <circle
            cx="90"
            cy="90"
            r={ringRadius}
            stroke={`url(#${gradientId})`}
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - ratio)}
            transform="rotate(-90 90 90)"
            filter={`url(#${glowId})`}
            style={{ transition: "stroke-dashoffset 0.1s linear" }}
          />

          <circle
            cx="90"
            cy="90"
            r={interactionRadius}
            fill="transparent"
            style={{ cursor: "grab" }}
            onPointerDown={(event) => {
              draggingRef.current = true;
              stopInertia();
              event.currentTarget.setPointerCapture(event.pointerId);
              lastTimeRef.current = performance.now();
              updateFromPointer(event);
            }}
            onPointerMove={(event) => {
              if (!draggingRef.current) return;
              updateFromPointer(event);
            }}
            onPointerUp={() => {
              draggingRef.current = false;
              startInertia();
            }}
            data-radial-node="true"
          />

          <circle
            cx={knob.x}
            cy={knob.y}
            r="6.5"
            fill="rgba(255,255,255,0.92)"
            stroke="rgba(0,0,0,0.35)"
            strokeWidth="2"
            style={{ cursor: "grab" }}
            onPointerDown={(event) => {
              draggingRef.current = true;
              stopInertia();
              event.currentTarget.setPointerCapture(event.pointerId);
              lastTimeRef.current = performance.now();
              updateFromPointer(event);
            }}
            onPointerMove={(event) => {
              if (!draggingRef.current) return;
              updateFromPointer(event);
            }}
            onPointerUp={() => {
              draggingRef.current = false;
              startInertia();
            }}
            data-radial-node="true"
          />

          <circle cx="90" cy="90" r="54" fill="rgba(12,12,18,0.88)" />
          <text x="90" y="82" textAnchor="middle" className="fill-white text-[20px] font-bold">
            {formattedValue}
          </text>
          <text x="90" y="106" textAnchor="middle" className="fill-white/70 text-[12px] font-normal uppercase tracking-[0.12em]">
            {dial.label}
          </text>
          <text x="90" y="124" textAnchor="middle" className="fill-white/55 text-[10px] font-normal uppercase tracking-[0.1em]">
            {Number.isFinite(fps ?? NaN) ? `${Math.round(fps ?? 60)} FPS ${halo.state}` : "Dial"}
          </text>
        </svg>

        <div className="mt-2 space-y-2" data-radial-node="true">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-md border border-white/15 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-white/80 transition hover:bg-white/10"
            data-radial-node="true"
          >
            Back
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function RadialSystem({
  activeTab,
  settings,
  setSettings,
  colorSettings,
  setColorSettings,
  leftDockCollapsed = false,
  zoom = 1,
  onZoomChange,
  fractalSpecs = [],
  fractalUniforms = {},
  onFractalUniformChange,
  adaptiveQualityTier = 1,
  micStatus = "idle",
  onToggleMicReactivity,
  onVisibilityStateChange,
  openRequestToken = 0,
  closeRequestToken = 0,
  onDismiss,
  autoEvolveConfig,
  setAutoEvolveConfig,
  autoEvolveOutput,
}: RadialSystemProps) {
  const isCreateOrPerform = activeTab === "create" || activeTab === "perform";
  const isFractal = isFractalPreset(settings.presetName);
  const variant: RadialVariant = activeTab === "perform" ? "performance" : isFractal ? "fractal" : "base";
  const fps = useFps(500);

  const [isPinned, setIsPinned] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [shiftHeld, setShiftHeld] = useState(false);
  const [hoverPrimaryId, setHoverPrimaryId] = useState<string | null>(null);
  const [selectedPrimaryId, setSelectedPrimaryId] = useState<string | null>(null);
  const [hoverSecondaryId, setHoverSecondaryId] = useState<string | null>(null);
  const [activeDialId, setActiveDialId] = useState<string | null>(null);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const [precisionTab, setPrecisionTab] = useState<FractalPrecisionTab>("structure");
  const [fractalSettingsTileOrder, setFractalSettingsTileOrder] = useState<FractalSettingsTileOrder>(() => {
    if (typeof window === "undefined") return "ai-first";
    try {
      const saved = window.localStorage.getItem(FRACTAL_SETTINGS_TILE_ORDER_KEY);
      return saved === "precision-first" ? "precision-first" : "ai-first";
    } catch {
      return "ai-first";
    }
  });
  const [isDocked, setIsDocked] = useState(false);
  const [isDocking, setIsDocking] = useState(false);
  const [anchor, setAnchor] = useState(() => ({
    x: typeof window === "undefined" ? 720 : window.innerWidth * 0.5,
    y: typeof window === "undefined" ? 440 : window.innerHeight * 0.5,
  }));
  const dragStateRef = useRef({ active: false, offsetX: 0, offsetY: 0 });
  const dockTimerRef = useRef<number | null>(null);
  const enabled = isCreateOrPerform || isPinned;

  const clampAnchor = useCallback((rawX: number, rawY: number, expanded: boolean) => {
    const safe = expanded ? SECONDARY_OUTER + 50 : MASTER_OUTER + 34;
    const topInset = RADIAL_TOP_INSET;
    const bottomInset = RADIAL_BOTTOM_INSET;
    const availableWidth = window.innerWidth;
    const availableHeight = window.innerHeight - topInset - bottomInset;
    const adjustedSafe = Math.min(safe, Math.max(128, availableHeight * 0.5 - 8));
    const minX = adjustedSafe;
    const maxX = Math.max(adjustedSafe, availableWidth - adjustedSafe);
    const minY = topInset + adjustedSafe;
    const maxY = Math.max(minY, window.innerHeight - bottomInset - adjustedSafe);
    return {
      x: clamp(rawX, minX, maxX),
      y: clamp(rawY, minY, maxY),
    };
  }, []);

  const clampAnchorLoose = useCallback((rawX: number, rawY: number) => {
    const margin = 24;
    const minX = margin;
    const maxX = Math.max(minX, window.innerWidth - margin);
    const minY = RADIAL_TOP_INSET + margin;
    const maxY = Math.max(minY, window.innerHeight - RADIAL_BOTTOM_INSET - margin);
    return {
      x: clamp(rawX, minX, maxX),
      y: clamp(rawY, minY, maxY),
    };
  }, []);

  useEffect(() => {
    setHoverPrimaryId(null);
    setSelectedPrimaryId(null);
    setHoverSecondaryId(null);
    setActiveDialId(null);
    setSettingsPanelOpen(false);
    setPrecisionTab("structure");
  }, [activeTab]);

  useEffect(() => {
    if (!isFractal) return;
    setPrecisionTab("structure");
  }, [isFractal, settings.presetName]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(FRACTAL_SETTINGS_TILE_ORDER_KEY, fractalSettingsTileOrder);
    } catch {
      // ignore storage failures
    }
  }, [fractalSettingsTileOrder]);

  useEffect(() => {
    return () => {
      if (dockTimerRef.current !== null) {
        window.clearTimeout(dockTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const onResize = () => setAnchor((prev) => clampAnchorLoose(prev.x, prev.y));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [enabled, clampAnchorLoose]);

  useEffect(() => {
    if (!enabled) return;
    const onPointerMove = (event: PointerEvent) => {
      if (!dragStateRef.current.active) return;
      const nextX = event.clientX - dragStateRef.current.offsetX;
      const nextY = event.clientY - dragStateRef.current.offsetY;
      setAnchor(clampAnchorLoose(nextX, nextY));
    };
    const onPointerUp = () => {
      dragStateRef.current.active = false;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [enabled, clampAnchorLoose]);

  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreKeyboardEvent(event.target)) return;
      if (event.code === "Space") {
        setSpaceHeld(true);
      } else if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
        setShiftHeld(true);
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        setSpaceHeld(false);
        if (!isPinned) {
          setSelectedPrimaryId(null);
          setHoverPrimaryId(null);
          setHoverSecondaryId(null);
          setActiveDialId(null);
        }
      } else if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
        setShiftHeld(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [enabled, isPinned]);

  const updateSetting = useCallback(
    (key: keyof UISettings, value: any) => {
      setSettings((prev: UISettings) => ({ ...prev, [key]: value }));
    },
    [setSettings],
  );

  const updateColorSetting = useCallback(
    <K extends keyof ColorSettings>(key: K, value: ColorSettings[K]) => {
      setColorSettings({ ...colorSettings, [key]: value });
    },
    [colorSettings, setColorSettings],
  );
  const toggleFractalSettingsTileOrder = useCallback(() => {
    setFractalSettingsTileOrder((prev) => (prev === "ai-first" ? "precision-first" : "ai-first"));
  }, []);

  const dialFromSetting = useCallback(
    (
      id: string,
      label: string,
      value: number,
      min: number,
      max: number,
      step: number,
      onChange: (value: number) => void,
      formatter?: (value: number) => string,
      logScale?: boolean,
    ): DialSpec => ({
      id,
      label,
      value,
      min,
      max,
      step,
      onChange,
      formatter,
      logScale,
    }),
    [],
  );

  const specMap = useMemo(() => {
    const map = new Map<string, UniformSpec>();
    for (const spec of fractalSpecs) {
      map.set(spec.key, spec);
    }
    return map;
  }, [fractalSpecs]);
  const precisionTabMeta = useMemo(
    () => FRACTAL_PRECISION_TABS.reduce<Record<FractalPrecisionTab, string>>((acc, tab) => {
      acc[tab.id] = tab.label;
      return acc;
    }, {
      structure: "Structure",
      motion: "Motion",
      color: "Color",
      audio: "Audio",
      julia: "Julia",
      effects: "Effects",
    }),
    [],
  );

  const precisionTabSpecs = useMemo(
    () => (isFractal ? fractalSpecs.filter((spec) => mapSpecToPrecisionTab(spec) === precisionTab) : fractalSpecs),
    [fractalSpecs, isFractal, precisionTab],
  );
  const precisionTabsWithControls = useMemo(() => {
    const orderedTabs = FRACTAL_PRECISION_TABS.map((tab) => tab.id);
    if (!isFractal) return orderedTabs;
    const tabs = new Set<FractalPrecisionTab>();
    for (const spec of fractalSpecs) {
      tabs.add(mapSpecToPrecisionTab(spec));
    }
    // Keep Motion visible so global motion controls (intensity/speed) are always accessible.
    tabs.add("motion");
    return orderedTabs.filter((tabId) => tabs.has(tabId));
  }, [fractalSpecs, isFractal]);
  useEffect(() => {
    if (!isFractal) return;
    if (precisionTabsWithControls.length === 0) return;
    if (!precisionTabsWithControls.includes(precisionTab)) {
      setPrecisionTab(precisionTabsWithControls[0]);
    }
  }, [isFractal, precisionTab, precisionTabsWithControls]);

  const dialFromUniform = useCallback(
    (
      key: string,
      label: string,
      fallback: { min: number; max: number; step: number; value?: number; logScale?: boolean },
      formatter?: (value: number) => string,
    ): DialSpec | null => {
      const spec = specMap.get(key);
      if (!onFractalUniformChange) return null;
      if (spec && spec.type !== "float" && spec.type !== "int") return null;

      const min = spec?.min ?? fallback.min;
      const max = spec?.max ?? fallback.max;
      const step = spec?.step ?? fallback.step;
      const raw = fractalUniforms[key];
      const defaultValue = typeof spec?.default === "number" ? spec.default : fallback.value ?? min;
      const value = typeof raw === "number" ? raw : defaultValue;

      return {
        id: `u-${key}`,
        label,
        value,
        min,
        max,
        step,
        formatter,
        logScale: fallback.logScale,
        onChange: (next) => {
          if (spec?.type === "int") {
            onFractalUniformChange(key, Math.round(next));
          } else {
            onFractalUniformChange(key, next);
          }
        },
      };
    },
    [specMap, fractalUniforms, onFractalUniformChange],
  );

  const intensityDial = dialFromSetting(
    "s-intensity",
    "Intensity",
    settings.intensity,
    0,
    3,
    0.01,
    (next) => updateSetting("intensity", next),
    (value) => `${Math.round((value / 3) * 100)}%`,
  );
  const speedDial = dialFromSetting(
    "s-speed",
    "Speed",
    settings.speed,
    0,
    2,
    0.01,
    (next) => updateSetting("speed", next),
    (value) => `${Math.round((value / 2) * 100)}%`,
  );
  const fieldRotationDial = dialFromSetting(
    "s-field-rotation",
    "Field Rotation",
    settings.fieldRotation ?? 1,
    0,
    2,
    0.01,
    (next) => updateSetting("fieldRotation", next),
    (value) => `${Math.round((value / 2) * 100)}%`,
  );
  const glowDial = dialFromSetting(
    "s-glow",
    "Glow",
    settings.glowIntensity ?? 1,
    0.2,
    2,
    0.01,
    (next) => updateSetting("glowIntensity", next),
    (value) => `${Math.round((value / 2) * 100)}%`,
  );
  const zoomDial = dialFromSetting(
    "s-zoom",
    "Zoom",
    zoom,
    0.5,
    3,
    0.001,
    (next) => onZoomChange?.(next),
    (value) => `${Math.round(value * 100)}%`,
    true,
  );
  const trailsDial = dialFromSetting(
    "s-trails",
    "Trails",
    settings.trailsAmount ?? 0.75,
    0,
    1,
    0.01,
    (next) =>
      setSettings((prev: UISettings) => ({
        ...prev,
        trailsOn: next > 0.01,
        trailsAmount: next,
      })),
    (value) => `${Math.round(value * 100)}%`,
  );
  const cycleDial = dialFromUniform(
    "u_colorCycle",
    "Color Cycle",
    { min: 0, max: 1, step: 0.001, value: 0 },
    (value) => `${Math.round(value * 100)}%`,
  );
  const beatPunchDial = dialFromUniform(
    "u_beatPunch",
    "Beat Punch",
    { min: 0, max: 2, step: 0.01, value: 0.7 },
    (value) => `${Math.round((value / 2) * 100)}%`,
  );
  const spectrumSpeedDial = dialFromSetting(
    "c-spectrum",
    "Cycle Speed",
    colorSettings.spectrumSpeed,
    0.1,
    3,
    0.01,
    (next) => setColorSettings({ ...colorSettings, mode: "spectrum", spectrumSpeed: next }),
    (value) => `${value.toFixed(2)}x`,
  );

  const colorModeActions: RingItem[] = useMemo(
    () =>
      colorModes
        .filter((mode) => mode.id !== "ai" && mode.id !== "custom")
        .slice(0, 4)
        .map((mode) => ({
          id: `mode-${mode.id}`,
          kind: "action",
          label: mode.name.replace("Color", "").trim(),
          active: colorSettings.mode === mode.id,
          onSelect: () => setColorSettings({ ...colorSettings, mode: mode.id }),
        })),
    [colorSettings, setColorSettings],
  );

  const moodActions: RingItem[] = useMemo(
    () =>
      moodPresets.slice(0, 4).map((mood) => ({
        id: `mood-${mood.id}`,
        kind: "action",
        label: mood.name,
        active: colorSettings.moodPreset === mood.id,
        onSelect: () => setColorSettings({ ...colorSettings, mode: "mood", moodPreset: mood.id }),
      })),
    [colorSettings, setColorSettings],
  );

  const fractalStructureItems: RingItem[] = useMemo(() => {
    const items: RingItem[] = [];
    const complexity = dialFromUniform("u_iterations", "Complexity", { min: 50, max: 512, step: 1, value: 128 });
    const shape =
      dialFromUniform("u_power", "Shape", { min: 2, max: 6, step: 0.01, value: 2 }) ??
      dialFromUniform("u_trapRadius", "Shape", { min: 0.1, max: 2, step: 0.01, value: 0.6 });
    const distortion =
      dialFromUniform("u_warpAmount", "Distortion", { min: 0, max: 1, step: 0.01, value: 0 }) ??
      dialFromUniform("u_spiralDensity", "Distortion", { min: 0.5, max: 6, step: 0.1, value: 2.5 });
    const detail =
      dialFromUniform("u_edgeDetail", "Detail", { min: 0, max: 1, step: 0.01, value: 0.5 }) ??
      dialFromUniform("u_trapMix", "Detail", { min: 0, max: 1, step: 0.01, value: 0.8 });

    if (complexity) items.push({ id: "struct-complexity", kind: "dial", label: "Complexity", dial: complexity });
    if (shape) items.push({ id: "struct-shape", kind: "dial", label: "Shape", dial: shape });
    if (distortion) items.push({ id: "struct-distortion", kind: "dial", label: "Distortion", dial: distortion });
    if (detail) items.push({ id: "struct-detail", kind: "dial", label: "Detail", dial: detail });
    return items;
  }, [dialFromUniform]);

  const fractalMotionItems: RingItem[] = useMemo(() => {
    const items: RingItem[] = [];
    const infiniteZoom =
      dialFromUniform("u_zoomExp", "Infinite Zoom", {
        min: -80,
        max: 10,
        step: 0.01,
        value: 0,
      }) ??
      dialFromUniform("u_zoom", "Infinite Zoom", { min: 0.5, max: 80, step: 0.01, value: 1.2, logScale: true });
    const zoomSpeed =
      dialFromUniform("u_zoomPulseStrength", "Zoom Speed", { min: 0, max: 0.35, step: 0.005, value: 0.12 }) ??
      dialFromUniform("u_colorSpeed", "Zoom Speed", { min: 0, max: 2, step: 0.01, value: 0.25 });
    const rotation = dialFromUniform("u_rotation", "Rotation", { min: -3.14, max: 3.14, step: 0.001, value: 0 });
    const julia = dialFromUniform("u_juliaMorph", "Julia Morph", { min: 0, max: 1, step: 0.001, value: 0.3 });

    if (infiniteZoom) items.push({ id: "motion-infinite", kind: "dial", label: "Infinite Zoom", dial: infiniteZoom });
    if (zoomSpeed) items.push({ id: "motion-zoomspeed", kind: "dial", label: "Zoom Speed", dial: zoomSpeed });
    if (rotation) items.push({ id: "motion-rotation", kind: "dial", label: "Rotation", dial: rotation });
    if (julia) items.push({ id: "motion-julia", kind: "dial", label: "Julia Morph", dial: julia });
    return items;
  }, [dialFromUniform]);

  const fractalColorItems: RingItem[] = useMemo(() => {
    const items: RingItem[] = [];
    const tone = dialFromUniform("u_brightness", "Tone", { min: 0.3, max: 2, step: 0.01, value: 1.1 }) ?? cycleDial;
    const saturation = dialFromUniform("u_saturation", "Saturation", { min: 0, max: 2, step: 0.01, value: 1.1 });
    const cycle = cycleDial ?? spectrumSpeedDial;
    const edge = dialFromUniform("u_glowIntensity", "Edge Glow", { min: 0, max: 2, step: 0.01, value: 0.8 });

    if (tone) items.push({ id: "color-tone", kind: "dial", label: "Tone", dial: tone });
    if (saturation) items.push({ id: "color-saturation", kind: "dial", label: "Saturation", dial: saturation });
    if (cycle) items.push({ id: "color-cycle", kind: "dial", label: "Cycle", dial: cycle });
    if (edge) items.push({ id: "color-edgeglow", kind: "dial", label: "Edge Glow", dial: edge });
    return items;
  }, [dialFromUniform, cycleDial, spectrumSpeedDial]);

  const fractalAudioItems: RingItem[] = useMemo(() => {
    const items: RingItem[] = [];
    const bass = dialFromUniform("u_bassImpact", "Bass Impact", { min: 0, max: 2, step: 0.01, value: 0.7 });
    const mid = dialFromUniform("u_midMorph", "Mid Morph", { min: 0, max: 2, step: 0.01, value: 0.5 });
    const treble = dialFromUniform("u_trebleShimmer", "Treble Shimmer", { min: 0, max: 2, step: 0.01, value: 0.5 });
    const beat = beatPunchDial;

    if (bass) items.push({ id: "audio-bass", kind: "dial", label: "Bass Impact", dial: bass });
    if (mid) items.push({ id: "audio-mid", kind: "dial", label: "Mid Morph", dial: mid });
    if (treble) items.push({ id: "audio-treble", kind: "dial", label: "Treble Shimmer", dial: treble });
    if (beat) items.push({ id: "audio-beat", kind: "dial", label: "Beat Punch", dial: beat });
    return items;
  }, [dialFromUniform, beatPunchDial]);

  const fractalRenderItems: RingItem[] = useMemo(() => {
    const items: RingItem[] = [];
    const resolution = zoomDial;
    const steps = dialFromUniform("u_iterations", "Steps", { min: 50, max: 512, step: 1, value: 128 });
    const ao = dialFromUniform("u_interiorStyle", "AO", { min: 0, max: 1, step: 0.01, value: 0.5 });
    const shadows =
      dialFromUniform("u_orbitTrap", "Shadows", { min: 0, max: 1, step: 0.01, value: 0.5 }) ??
      dialFromUniform("u_trapMix", "Shadows", { min: 0, max: 1, step: 0.01, value: 0.8 });
    const aa = dialFromUniform("u_aaLevel", "Anti-Alias", { min: 1, max: 3, step: 1, value: 1 });

    if (resolution) items.push({ id: "render-resolution", kind: "dial", label: "Resolution", dial: resolution });
    if (steps) items.push({ id: "render-steps", kind: "dial", label: "Steps", dial: steps });
    if (ao) items.push({ id: "render-ao", kind: "dial", label: "AO", dial: ao });
    if (shadows) items.push({ id: "render-shadows", kind: "dial", label: "Shadows", dial: shadows });
    if (aa) items.push({ id: "render-aa", kind: "dial", label: "Anti-Alias", dial: aa, warning: adaptiveQualityTier === 0 });
    return items;
  }, [dialFromUniform, zoomDial, adaptiveQualityTier]);

  const advancedFractalItems: RingItem[] = useMemo(() => {
    const items: RingItem[] = [];
    const power = dialFromUniform("u_power", "Power", { min: 2, max: 6, step: 0.01, value: 2 });
    const iterations = dialFromUniform("u_iterations", "Iterations", { min: 50, max: 512, step: 1, value: 128 });
    const warp =
      dialFromUniform("u_warpAmount", "Warp", { min: 0, max: 1, step: 0.01, value: 0 }) ??
      dialFromUniform("u_spiralDensity", "Warp", { min: 0.5, max: 6, step: 0.1, value: 2.5 });
    const epsilon =
      dialFromUniform("u_edgeDetail", "Epsilon", { min: 0, max: 1, step: 0.01, value: 0.5 }) ??
      dialFromUniform("u_aaLevel", "Epsilon", { min: 1, max: 3, step: 1, value: 1 });

    if (power) items.push({ id: "adv-power", kind: "dial", label: "Power", dial: power });
    if (iterations) items.push({ id: "adv-iterations", kind: "dial", label: "Iterations", dial: iterations });
    if (warp) items.push({ id: "adv-warp", kind: "dial", label: "Warp", dial: warp });
    if (epsilon) items.push({ id: "adv-epsilon", kind: "dial", label: "Epsilon", dial: epsilon });
    return items;
  }, [dialFromUniform]);

  const baseAudioItems: RingItem[] = useMemo(() => {
    const micActive = micStatus === "running" || micStatus === "starting";
    return [
      {
        id: "audio-mic-toggle",
        kind: "action",
        label: micActive ? "Mic On" : "Mic Off",
        active: micActive,
        warning: micStatus === "error",
        onSelect: () => onToggleMicReactivity?.(),
      },
      {
        id: "audio-preset-out",
        kind: "action",
        label: settings.presetEnabled ? "Preset On" : "Preset Off",
        active: settings.presetEnabled,
        onSelect: () => updateSetting("presetEnabled", !settings.presetEnabled),
      },
      {
        id: "audio-trails-toggle",
        kind: "action",
        label: settings.trailsOn ? "Trails On" : "Trails Off",
        active: Boolean(settings.trailsOn),
        onSelect: () =>
          setSettings((prev: UISettings) => ({
            ...prev,
            trailsOn: !prev.trailsOn,
          })),
      },
      {
        id: "audio-ai-evo-toggle",
        kind: "action",
        label: settings.evolutionEnabled === false ? "AI Evo Off" : "AI Evo On",
        active: settings.evolutionEnabled !== false,
        onSelect: () => updateSetting("evolutionEnabled", !(settings.evolutionEnabled !== false)),
      },
    ];
  }, [micStatus, onToggleMicReactivity, settings.presetEnabled, settings.trailsOn, settings.evolutionEnabled, updateSetting, setSettings]);

  const baseWedges: PrimaryWedge[] = useMemo(
    () => [
      {
        id: "motion",
        label: "Motion",
        items: [
          { id: "m-intensity", kind: "dial", label: "Intensity", dial: intensityDial },
          { id: "m-speed", kind: "dial", label: "Speed", dial: speedDial },
          { id: "m-field-rotation", kind: "dial", label: "Rotation", dial: fieldRotationDial } as RingItem,
          { id: "m-zoom", kind: "dial", label: "Zoom", dial: zoomDial },
        ] as RingItem[],
      },
      {
        id: "color",
        label: "Color",
        items: [
          { id: "c-cycle", kind: "dial", label: "Cycle", dial: spectrumSpeedDial },
          ...colorModeActions.slice(0, 2),
          ...moodActions.slice(0, 1),
        ].slice(0, 5) as RingItem[],
      },
      {
        id: "fx",
        label: "FX",
        items: [
          { id: "fx-glow", kind: "dial", label: "Glow", dial: glowDial },
          { id: "fx-trails", kind: "dial", label: "Trails", dial: trailsDial },
          {
            id: "fx-glow-toggle",
            kind: "action",
            label: settings.glowEnabled === false ? "Glow Off" : "Glow On",
            active: settings.glowEnabled !== false,
            onSelect: () => updateSetting("glowEnabled", !(settings.glowEnabled !== false)),
          },
        ] as RingItem[],
      },
      { id: "audio", label: "Audio", items: baseAudioItems },
      { id: "settings-panel", label: "Settings" },
    ],
    [
      intensityDial,
      speedDial,
      fieldRotationDial,
      zoomDial,
      spectrumSpeedDial,
      colorModeActions,
      moodActions,
      glowDial,
      trailsDial,
      settings.glowEnabled,
      updateSetting,
      baseAudioItems,
    ],
  );

  const fractalWedges: PrimaryWedge[] = useMemo(
    () => [
      { id: "structure", label: "Structure", items: fractalStructureItems },
      { id: "motion", label: "Motion", items: fractalMotionItems },
      { id: "color", label: "Color", items: fractalColorItems },
      { id: "audio", label: "Audio", items: fractalAudioItems },
      {
        id: "render",
        label: "Render",
        warning: adaptiveQualityTier === 0,
        critical: adaptiveQualityTier === 0 && typeof fractalUniforms.u_aaLevel === "number" && fractalUniforms.u_aaLevel <= 1,
        items: fractalRenderItems,
      },
      { id: "settings-panel", label: "Settings" },
    ],
    [
      fractalStructureItems,
      fractalMotionItems,
      fractalColorItems,
      fractalAudioItems,
      adaptiveQualityTier,
      fractalRenderItems,
    ],
  );

  const performanceWedges: PrimaryWedge[] = useMemo(
    () => [
      {
        id: "perf-intensity",
        label: "Intensity",
        directDial: intensityDial,
        warning: intensityDial.value > 2.2,
        critical: intensityDial.value > 2.7,
      },
      {
        id: "perf-zoom",
        label: "Zoom",
        directDial: zoomDial,
        warning: zoomDial.value > 2.3,
        critical: zoomDial.value > 2.75,
      },
      {
        id: "perf-cycle",
        label: "Color Cycle",
        directDial: cycleDial ?? spectrumSpeedDial,
        warning: (cycleDial ?? spectrumSpeedDial).value > 0.78,
        critical: (cycleDial ?? spectrumSpeedDial).value > 0.92,
      },
      {
        id: "perf-glow",
        label: "Glow",
        directDial: glowDial,
        warning: glowDial.value > 1.45,
        critical: glowDial.value > 1.8,
      },
      {
        id: "perf-beat",
        label: "Beat Punch",
        warning: beatPunchDial ? beatPunchDial.value > 1.4 : false,
        critical: beatPunchDial ? beatPunchDial.value > 1.8 : false,
        directDial: beatPunchDial ?? intensityDial,
      },
    ],
    [intensityDial, zoomDial, cycleDial, spectrumSpeedDial, glowDial, beatPunchDial],
  );

  const primaryWedges = variant === "performance" ? performanceWedges : variant === "fractal" ? fractalWedges : baseWedges;

  const focusedPrimaryId = hoverPrimaryId ?? selectedPrimaryId;
  const selectedPrimary = primaryWedges.find((wedge) => wedge.id === focusedPrimaryId) ?? null;
  const focusedPrimaryIndex = focusedPrimaryId ? primaryWedges.findIndex((wedge) => wedge.id === focusedPrimaryId) : -1;

  const secondaryItems = useMemo(() => {
    if (variant === "performance") return [] as RingItem[];
    if (!selectedPrimary?.items?.length) return [] as RingItem[];
    if (variant === "fractal" && selectedPrimary.id === "structure" && shiftHeld && advancedFractalItems.length > 0) {
      return advancedFractalItems.slice(0, 5);
    }
    return selectedPrimary.items.slice(0, 5);
  }, [variant, selectedPrimary, shiftHeld, advancedFractalItems]);

  const dialRegistry = useMemo(() => {
    const map = new Map<string, DialSpec>();
    for (const wedge of primaryWedges) {
      if (wedge.directDial) {
        map.set(wedge.directDial.id, wedge.directDial);
      }
      for (const item of wedge.items ?? []) {
        if (item.kind === "dial") {
          map.set(item.dial.id, item.dial);
        }
      }
    }
    return map;
  }, [primaryWedges]);

  useEffect(() => {
    if (!activeDialId) return;
    if (!dialRegistry.has(activeDialId)) {
      setActiveDialId(null);
    }
  }, [activeDialId, dialRegistry]);

  const activeDial = activeDialId ? dialRegistry.get(activeDialId) ?? null : null;
  const radialVisible = isPinned || spaceHeld;
  const radialMounted = radialVisible && (!isDocked || isDocking);
  const dockingShiftX = isDocking ? -(anchor.x - 138) : 0;
  const radialShiftX = dockingShiftX;
  const showDockHandleBase = isDocked || !radialMounted;
  const showDockHandle = showDockHandleBase;
  const dockHandleTop = 96;
  const dockHandleLeft = useMemo(() => {
    if (typeof window === "undefined") return isCreateOrPerform ? (leftDockCollapsed ? 21 : 273) : 10;
    const preferred = isCreateOrPerform ? (leftDockCollapsed ? 21 : 273) : 10;
    return clamp(preferred, 8, Math.max(8, window.innerWidth - 92));
  }, [isCreateOrPerform, leftDockCollapsed]);

  const masterOuter = variant === "performance" ? 192 : MASTER_OUTER;
  const masterInner = variant === "performance" ? 96 : MASTER_INNER;
  const showSecondary = secondaryItems.length > 0 && !activeDial;
  const showFloatingTools = !settingsPanelOpen;

  useEffect(() => {
    onVisibilityStateChange?.({ radialMounted, settingsPanelOpen, isPinned });
  }, [onVisibilityStateChange, radialMounted, settingsPanelOpen, isPinned]);

  useEffect(() => {
    if (!openRequestToken) return;
    setHoverPrimaryId(null);
    setSelectedPrimaryId(null);
    setHoverSecondaryId(null);
    setActiveDialId(null);
    setShiftHeld(false);
    setIsPinned(true);
    setIsDocked(false);
    setSettingsPanelOpen(true);
  }, [openRequestToken]);

  useEffect(() => {
    if (!closeRequestToken) return;
    setSettingsPanelOpen(false);
    setHoverPrimaryId(null);
    setSelectedPrimaryId(null);
    setHoverSecondaryId(null);
    setActiveDialId(null);
    setShiftHeld(false);
    setIsPinned(false);
  }, [closeRequestToken]);

  const toolAngles = useMemo(() => {
    const wedgeCount = Math.max(1, primaryWedges.length);
    const step = 360 / wedgeCount;
    const activeWedgeAngle = focusedPrimaryIndex >= 0 ? focusedPrimaryIndex * step : 320;

    // Keep tools opposite the active wedge, but move them to the outer orbit.
    let orbitAngle = (activeWedgeAngle + 180) % 360;
    const nearRightSide = orbitAngle >= 55 && orbitAngle <= 125; // 90deg is right in this coordinate system
    const nearBottomSide = orbitAngle >= 145 && orbitAngle <= 230;
    if (nearRightSide) orbitAngle = (orbitAngle + 120) % 360;
    if (!nearRightSide && nearBottomSide) orbitAngle = 312;

    // Orbit outside the primary ring so controls never block wedge labels/content.
    const radius = masterOuter + 32;
    return {
      settings: polarPoint(CENTER, CENTER, radius, orbitAngle - 16),
      pin: polarPoint(CENTER, CENTER, radius, orbitAngle),
      close: polarPoint(CENTER, CENTER, radius, orbitAngle + 16),
    };
  }, [focusedPrimaryIndex, masterOuter, primaryWedges.length]);

  useEffect(() => {
    if (!enabled) return;
    setAnchor((prev) => clampAnchor(prev.x, prev.y, false));
  }, [enabled, clampAnchor]);

  const primaryRenderItems = primaryWedges.map((wedge) => ({
    id: wedge.id,
    label: wedge.label,
    warning: wedge.warning,
    critical: wedge.critical,
    disabled: false,
  }));

  const secondaryRenderItems = secondaryItems.map((item) => ({
    id: item.id,
    label: item.label,
    active: item.active,
    warning: item.warning,
    critical: item.critical,
    disabled: item.disabled,
  }));

  const setClampedAnchor = useCallback(
    (x: number, y: number) => {
      setAnchor(clampAnchor(x, y, showSecondary));
    },
    [clampAnchor, showSecondary],
  );

  const handleBackgroundPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!radialVisible) return;
    if (isPinned || !spaceHeld) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-radial-node='true']")) return;
    setClampedAnchor(event.clientX, event.clientY);
  };

  const handleBackgroundPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!radialVisible) return;
    if (isPinned || !spaceHeld) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-radial-node='true']")) return;
    setClampedAnchor(event.clientX, event.clientY);
  };

  const handleRadialDragStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      dragStateRef.current.active = true;
      dragStateRef.current.offsetX = event.clientX - anchor.x;
      dragStateRef.current.offsetY = event.clientY - anchor.y;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [anchor.x, anchor.y],
  );

  const handleDockRadial = useCallback(() => {
    if (dockTimerRef.current !== null) {
      window.clearTimeout(dockTimerRef.current);
    }

    setIsPinned(true);
    setIsDocking(true);
    setSettingsPanelOpen(false);
    setHoverPrimaryId(null);
    setSelectedPrimaryId(null);
    setHoverSecondaryId(null);
    setActiveDialId(null);

    dockTimerRef.current = window.setTimeout(() => {
      setIsDocking(false);
      setIsDocked(true);
      dockTimerRef.current = null;
      // Notify parent so showRadial syncs with visual state
      onDismiss?.();
    }, 220);
  }, [onDismiss]);

  const handleRestoreRadial = useCallback(() => {
    if (dockTimerRef.current !== null) {
      window.clearTimeout(dockTimerRef.current);
      dockTimerRef.current = null;
    }
    setIsPinned(true);
    setIsDocked(false);
    setIsDocking(false);
    setAnchor((prev) => clampAnchorLoose(isCreateOrPerform ? 360 : prev.x, prev.y));
  }, [clampAnchorLoose, isCreateOrPerform]);

  const openSettingsOverlay = useCallback(() => {
    setSettingsPanelOpen(true);
    setSelectedPrimaryId("settings-panel");
    setHoverPrimaryId("settings-panel");
    setHoverSecondaryId(null);
    setActiveDialId(null);
  }, []);

  const closeSettingsOverlay = useCallback(() => {
    setSettingsPanelOpen(false);
  }, []);

  const handlePrimarySelect = (id: string) => {
    if (id === "settings-panel") {
      openSettingsOverlay();
      return;
    }

    const wedge = primaryWedges.find((candidate) => candidate.id === id);
    if (!wedge) return;

    setSelectedPrimaryId(id);
    setHoverPrimaryId(id);
    setHoverSecondaryId(null);

    if (wedge.directDial) {
      setActiveDialId(wedge.directDial.id);
    } else {
      setActiveDialId(null);
    }
  };

  const handleSecondarySelect = (id: string) => {
    const item = secondaryItems.find((candidate) => candidate.id === id);
    if (!item || item.disabled) return;
    if (item.kind === "action") {
      item.onSelect();
      return;
    }
    setActiveDialId(item.dial.id);
  };

  const engineBadge =
    variant === "fractal"
      ? "Fractal Engine"
      : variant === "performance"
        ? "Performance Lock"
        : "Cymatic Engine";

  const zoomDepth =
    typeof fractalUniforms.u_zoomExp === "number" && fractalUniforms.u_infiniteZoom
      ? `Depth ${fractalUniforms.u_zoomExp.toFixed(2)}`
      : null;

  const fractalDepthNormalized = useMemo(() => {
    if (variant !== "fractal") return null;

    const zoomExp = fractalUniforms.u_zoomExp;
    if (typeof zoomExp === "number") {
      return clamp((zoomExp + 80) / 90, 0, 1);
    }

    const zoomValue = fractalUniforms.u_zoom;
    if (typeof zoomValue === "number" && zoomValue > 0) {
      const minZoom = 0.5;
      const maxZoom = 80;
      return clamp(Math.log(zoomValue / minZoom) / Math.log(maxZoom / minZoom), 0, 1);
    }

    return null;
  }, [variant, fractalUniforms]);

  const fractalDepthPointer = useMemo(() => {
    if (typeof fractalDepthNormalized !== "number") return null;
    return polarPoint(CENTER, CENTER, ENERGY_RING_RADIUS + 22, fractalDepthNormalized * 360);
  }, [fractalDepthNormalized]);

  return (
    <div
      className="fixed inset-0 z-[48] pointer-events-none"
      style={{ top: 52, bottom: 52 }}
      onPointerMove={handleBackgroundPointerMove}
      onPointerDown={handleBackgroundPointerDown}
    >
      <AnimatePresence>
        {radialMounted && (
          <motion.div
            key="auralvis-radial"
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0, scale: 0.85, x: 0 }}
            animate={{ opacity: isDocking ? 0 : 1, scale: isDocking ? 0.94 : 1, x: radialShiftX }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
          >
            <div
              className="absolute pointer-events-auto select-none"
              style={{
                left: anchor.x,
                top: anchor.y,
                transform: "translate(-50%, -50%) scale(0.8)",
                transformOrigin: "center center",
                width: "min(620px, 92vw)",
                height: "min(620px, 92vw)",
              }}
              data-radial-node="true"
              data-testid="radial-system"
            >
              <svg
                viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
                className="h-full w-full overflow-visible"
                data-radial-node="true"
                onMouseLeave={() => {
                  setHoverPrimaryId(null);
                  setHoverSecondaryId(null);
                }}
              >
                <defs>
                  <linearGradient id="auralvis-radial-accent" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--radial-accent-start)" />
                    <stop offset="100%" stopColor="var(--radial-accent-end)" />
                  </linearGradient>
                  <linearGradient id="auralvis-energy-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#D946EF" />
                    <stop offset="50%" stopColor="#FB7185" />
                    <stop offset="100%" stopColor="#06B6D4" />
                  </linearGradient>
                  <filter id="auralvis-radial-blur" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="12" />
                  </filter>
                  <filter id="auralvis-soft-glow" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feColorMatrix
                      in="blur"
                      type="matrix"
                      values="
                        1 0 0 0 0
                        0 1 0 0 0
                        0 0 1 0 0
                        0 0 0 0.55 0"
                      result="glow"
                    />
                    <feMerge>
                      <feMergeNode in="glow" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={masterOuter}
                  fill="var(--radial-bg)"
                  filter="url(#auralvis-radial-blur)"
                  opacity={0.95}
                />

                <g filter="url(#auralvis-soft-glow)" data-radial-node="true">
                  <circle
                    cx={CENTER}
                    cy={CENTER}
                    r={ENERGY_RING_RADIUS}
                    fill="none"
                    stroke="url(#auralvis-energy-grad)"
                    strokeWidth={ENERGY_RING_STROKE}
                    strokeLinecap="round"
                    opacity={variant === "performance" ? 0.95 : 0.85}
                  />
                  <circle
                    cx={CENTER}
                    cy={CENTER}
                    r={ENERGY_RING_RADIUS}
                    fill="none"
                    stroke="url(#auralvis-energy-grad)"
                    strokeWidth={ENERGY_RING_STROKE}
                    strokeLinecap="round"
                    strokeDasharray="4 11"
                    opacity={0.33}
                  />
                </g>

                {variant === "fractal" && (
                  <g opacity={0.34} data-radial-node="true">
                    {Array.from({ length: 60 }).map((_, index) => {
                      const angle = (index / 60) * 360;
                      const inner = ENERGY_RING_RADIUS + 12;
                      const outer = index % 10 === 0 ? ENERGY_RING_RADIUS + 22 : ENERGY_RING_RADIUS + 18;
                      const p1 = polarPoint(CENTER, CENTER, inner, angle);
                      const p2 = polarPoint(CENTER, CENTER, outer, angle);

                      return (
                        <line
                          key={`depth-tick-${index}`}
                          x1={p1.x}
                          y1={p1.y}
                          x2={p2.x}
                          y2={p2.y}
                          stroke="rgba(255,255,255,0.25)"
                          strokeWidth={index % 10 === 0 ? 2 : 1}
                          strokeLinecap="round"
                        />
                      );
                    })}
                  </g>
                )}

                {variant === "fractal" && fractalDepthPointer && (
                  <circle
                    cx={fractalDepthPointer.x}
                    cy={fractalDepthPointer.y}
                    r={4.2}
                    fill="rgba(255,255,255,0.9)"
                    stroke="rgba(0,0,0,0.3)"
                    strokeWidth={1}
                    data-radial-node="true"
                  />
                )}

                {showSecondary && (
                  <motion.g
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                  >
                    <ContextualSecondaryLayer
                      items={secondaryRenderItems}
                      parentIndex={focusedPrimaryIndex}
                      parentCount={primaryRenderItems.length}
                      innerRadius={SECONDARY_INNER}
                      outerRadius={SECONDARY_OUTER}
                      activeId={null}
                      hoverId={hoverSecondaryId}
                      onHover={(id) => setHoverSecondaryId(id)}
                      onLeave={() => setHoverSecondaryId(null)}
                      onSelect={handleSecondarySelect}
                      gradientId="auralvis-radial-accent"
                      textClassName="fill-white/80 text-[12px] font-medium tracking-[0.07em] uppercase"
                    />
                  </motion.g>
                )}

                <RingLayer
                  items={primaryRenderItems}
                  innerRadius={masterInner}
                  outerRadius={masterOuter}
                  activeId={focusedPrimaryId}
                  hoverId={hoverPrimaryId}
                  onHover={(id) => {
                    if (activeDial) return;
                    setHoverPrimaryId(id);
                  }}
                  onLeave={() => undefined}
                  onSelect={handlePrimarySelect}
                  gradientId="auralvis-radial-accent"
                />

                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={70}
                  fill="var(--radial-center-bg)"
                  stroke="rgba(255,255,255,0.16)"
                  strokeWidth={1.2}
                />
              </svg>

              <div
                className="absolute left-1/2 top-1/2 h-[140px] w-[140px] -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
                onPointerDown={handleRadialDragStart}
                style={{ cursor: "grab" }}
                title="Drag radial panel"
                data-radial-node="true"
              >
                <div className="flex h-full flex-col items-center justify-center gap-1 px-3 text-center" data-radial-node="true">
                  <p className="text-[18px] font-semibold leading-tight text-white">
                    {shortPresetName(settings.presetName)}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/70">{engineBadge}</p>
                  {zoomDepth ? (
                    <p className="text-[11px] font-medium text-cyan-300">{zoomDepth}</p>
                  ) : (
                    <p className="text-[11px] text-white/55">
                      {variant === "performance" ? "Hold SPACE to invoke" : "Instrument mode"}
                    </p>
                  )}
                  {shiftHeld && variant === "fractal" && (
                    <p className="flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-amber-300">
                      <Sparkles className="h-3 w-3" />
                      Shift Advanced
                    </p>
                  )}
                </div>
              </div>

              {selectedPrimary?.warning && (
                <div className="absolute left-1/2 top-[16%] -translate-x-1/2 rounded-md border border-amber-400/40 bg-amber-500/15 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-amber-200">
                  <TriangleAlert className="mr-1 inline-block h-3 w-3" />
                  Performance Watch
                </div>
              )}

              <div
                className={`absolute inset-0 z-20 pointer-events-none transition-all duration-150 ${showFloatingTools ? "opacity-100" : "opacity-0"}`}
                data-radial-node="true"
              >
                <button
                  type="button"
                  onClick={() => (settingsPanelOpen ? closeSettingsOverlay() : openSettingsOverlay())}
                  className="pointer-events-auto absolute rounded-full border border-white/15 bg-black/35 p-1.5 text-white/75 transition hover:bg-black/55 hover:text-white"
                  style={{
                    left: `${(toolAngles.settings.x / VIEW_SIZE) * 100}%`,
                    top: `${(toolAngles.settings.y / VIEW_SIZE) * 100}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                  data-radial-node="true"
                  data-testid="button-radial-settings"
                  title={settingsPanelOpen ? "Close radial settings" : "Open radial settings"}
                >
                  <SlidersHorizontal className="h-3 w-3" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsPinned(true)}
                  className="pointer-events-auto absolute rounded-full border border-white/15 bg-black/35 p-1.5 text-white/75 transition hover:bg-black/55 hover:text-white"
                  style={{
                    left: `${(toolAngles.pin.x / VIEW_SIZE) * 100}%`,
                    top: `${(toolAngles.pin.y / VIEW_SIZE) * 100}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                  data-radial-node="true"
                  data-testid="button-radial-pin"
                  title={isPinned ? "Radial pinned" : "Pin radial open"}
                >
                  <Pin className="h-3 w-3" />
                </button>

                <button
                  type="button"
                  onClick={handleDockRadial}
                  className="pointer-events-auto absolute rounded-full border border-white/15 bg-black/35 p-1.5 text-white/75 transition hover:bg-black/55 hover:text-white"
                  style={{
                    left: `${(toolAngles.close.x / VIEW_SIZE) * 100}%`,
                    top: `${(toolAngles.close.y / VIEW_SIZE) * 100}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                  data-radial-node="true"
                  data-testid="button-radial-exit"
                  title="Hide radial panel"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              <AnimatePresence>
                {settingsPanelOpen && (
                  <motion.div
                    key="radial-settings-panel"
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.94 }}
                    transition={{ duration: 0.18, ease: "easeInOut" }}
                    className="absolute inset-0 z-30 flex items-center justify-center pointer-events-auto"
                    data-radial-node="true"
                  >
                    <ResizablePanel
                      defaultSize={isFractal ? { w: 420, h: 720 } : { w: 360, h: 640 }}
                      storageKey={isFractal ? "fractalSettingsPanelSize_v1" : "presetSettingsPanelSize_v1"}
                      className="premium-glass-card radial-settings-surface pointer-events-auto"
                      contentClassName="settings-panel relative p-3"
                    >
                      <div
                        className="pointer-events-none absolute left-3 right-3 top-2 h-px rounded-full"
                        style={{ background: "linear-gradient(90deg, rgba(217,70,239,0.55), rgba(6,182,212,0.55))" }}
                      />
                      <div className="mb-2.5 flex items-center justify-between">
                        <p className="radial-settings-header-badge text-xs font-semibold uppercase tracking-[0.14em] text-white/90">
                          {isFractal ? "Fractal Settings" : "Preset Settings"}
                        </p>
                        <div className="flex items-center gap-1.5" data-radial-node="true">
                          <button
                            type="button"
                            onClick={() => setIsPinned(true)}
                            className="rounded border border-white/20 bg-black/35 p-1 text-white/80 transition hover:bg-white/10"
                            data-radial-node="true"
                            data-testid="button-radial-pin-overlay"
                            title={isPinned ? "Radial pinned" : "Pin radial open"}
                          >
                            <Pin className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={handleDockRadial}
                            className="rounded border border-white/20 bg-black/35 p-1 text-white/80 transition hover:bg-white/10"
                            data-radial-node="true"
                            data-testid="button-radial-exit-overlay"
                            title="Hide radial panel"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={closeSettingsOverlay}
                            className="rounded border border-white/20 bg-black/35 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] text-white/80 transition hover:bg-white/10"
                            data-radial-node="true"
                          >
                            Close
                          </button>
                        </div>
                      </div>

                      {isFractal ? (
                        <div
                          className="grid auto-rows-min grid-cols-12 grid-flow-row-dense items-start content-start gap-3"
                          data-radial-node="true"
                        >
                          <div
                            className={`radial-settings-section col-span-12 h-fit space-y-3 ${fractalSettingsTileOrder === "ai-first" ? "order-1" : "order-2"}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/70">AI Evolution</p>
                              <button
                                type="button"
                                onClick={toggleFractalSettingsTileOrder}
                                className="rounded border border-white/15 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/10 hover:text-white"
                                data-radial-node="true"
                                data-testid="button-radial-fractal-swap-tiles-ai"
                              >
                                Swap Position
                              </button>
                            </div>
                            <div className="flex items-center justify-between">
                              <Label className="text-xs text-white/65">Enable AI Evolution</Label>
                              <Switch
                                checked={settings.evolutionEnabled !== false}
                                onCheckedChange={(checked) => updateSetting("evolutionEnabled", checked)}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className="uppercase tracking-widest text-white/55">AI Strength</span>
                                <span className="radial-value-chip font-mono text-white/90">
                                  {Math.round((settings.aiEvolutionStrength ?? 0.62) * 100)}%
                                </span>
                              </div>
                              <Slider
                                min={0}
                                max={1}
                                step={0.01}
                                value={[settings.aiEvolutionStrength ?? 0.62]}
                                className="radial-premium-slider"
                                onValueChange={([value]) => updateSetting("aiEvolutionStrength", value)}
                                disabled={settings.evolutionEnabled === false}
                                data-testid="slider-radial-ai-strength-fractal"
                              />
                              <div className="radial-slider-ticks" />
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className="uppercase tracking-widest text-white/55">AI Mode</span>
                                <span className="radial-value-chip text-[10px] font-mono text-white/90">
                                  {(settings.aiEvolutionMode ?? "musical").toUpperCase()}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-1.5">
                                {AI_MODE_OPTIONS.map((mode) => {
                                  const active = (settings.aiEvolutionMode ?? "musical") === mode.id;
                                  return (
                                    <button
                                      key={mode.id}
                                      type="button"
                                      onClick={() => updateSetting("aiEvolutionMode", mode.id)}
                                      disabled={settings.evolutionEnabled === false}
                                      className={`rounded border px-2 py-1 text-[10px] uppercase tracking-[0.12em] transition ${
                                        active
                                          ? "border-cyan-300/60 bg-gradient-to-r from-fuchsia-500/20 to-cyan-400/20 text-white"
                                          : "border-white/15 bg-white/5 text-white/65 hover:bg-white/10"
                                      } ${settings.evolutionEnabled === false ? "opacity-45" : ""}`}
                                      data-radial-node="true"
                                      data-testid={`button-radial-ai-mode-${mode.id}`}
                                    >
                                      {mode.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className="uppercase tracking-widest text-white/55">Reactivity Bias</span>
                                <span className="radial-value-chip text-[10px] font-mono text-white/90">
                                  {(settings.aiReactivityBias ?? "motion").toUpperCase()}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                                {AI_BIAS_OPTIONS.map((bias) => {
                                  const active = (settings.aiReactivityBias ?? "motion") === bias.id;
                                  return (
                                    <button
                                      key={bias.id}
                                      type="button"
                                      onClick={() => updateSetting("aiReactivityBias", bias.id)}
                                      disabled={settings.evolutionEnabled === false}
                                      className={`rounded border px-2 py-1 text-[10px] uppercase tracking-[0.12em] transition ${
                                        active
                                          ? "border-cyan-300/60 bg-gradient-to-r from-fuchsia-500/20 to-cyan-400/20 text-white"
                                          : "border-white/15 bg-white/5 text-white/65 hover:bg-white/10"
                                      } ${settings.evolutionEnabled === false ? "opacity-45" : ""}`}
                                      data-radial-node="true"
                                      data-testid={`button-radial-ai-bias-${bias.id}`}
                                    >
                                      {bias.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className="uppercase tracking-widest text-white/55">Evolution Speed</span>
                                <span className="radial-value-chip font-mono text-white/90">
                                  {Math.round((settings.aiEvolutionSpeed ?? 0.55) * 100)}%
                                </span>
                              </div>
                              <Slider
                                min={0}
                                max={1}
                                step={0.01}
                                value={[settings.aiEvolutionSpeed ?? 0.55]}
                                className="radial-premium-slider"
                                onValueChange={([value]) => updateSetting("aiEvolutionSpeed", value)}
                                disabled={settings.evolutionEnabled === false}
                                data-testid="slider-radial-ai-evolution-speed"
                              />
                              <div className="radial-slider-ticks" />
                            </div>

                            <div className="flex items-center justify-between">
                              <Label className="text-xs text-white/65">Drop Boost</Label>
                              <Switch
                                checked={settings.aiDropBoost !== false}
                                onCheckedChange={(checked) => updateSetting("aiDropBoost", checked)}
                                disabled={settings.evolutionEnabled === false}
                              />
                            </div>
                          </div>

                          {fractalSpecs.length > 0 && fractalUniforms && onFractalUniformChange ? (
                            <div
                              className={`radial-settings-section col-span-12 h-fit space-y-3 ${fractalSettingsTileOrder === "precision-first" ? "order-1" : "order-2"}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/70">Precision Controls</p>
                                <button
                                  type="button"
                                  onClick={toggleFractalSettingsTileOrder}
                                  className="rounded border border-white/15 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/10 hover:text-white"
                                  data-radial-node="true"
                                  data-testid="button-radial-fractal-swap-tiles-precision"
                                >
                                  Swap Position
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-1.5" data-radial-node="true">
                                {precisionTabsWithControls.map((tabId) => (
                                  <button
                                    key={tabId}
                                    type="button"
                                    onClick={() => setPrecisionTab(tabId)}
                                    className={`rounded border px-2 py-1 text-[10px] uppercase tracking-[0.12em] transition ${
                                      precisionTab === tabId
                                        ? "border-cyan-300/60 bg-gradient-to-r from-fuchsia-500/20 to-cyan-400/20 text-white"
                                        : "border-white/15 bg-white/5 text-white/65 hover:bg-white/10"
                                    }`}
                                    data-radial-node="true"
                                    data-testid={`button-radial-precision-tab-${tabId}`}
                                  >
                                    {precisionTabMeta[tabId]}
                                  </button>
                                ))}
                              </div>
                              {precisionTab === "motion" && (
                                <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
                                  <div className="space-y-1.5">
                                    <div className="flex justify-between text-xs">
                                      <span className="uppercase tracking-widest text-white/55">Intensity</span>
                                      <span className="radial-value-chip font-mono text-white/90">{Math.round((settings.intensity / 3) * 100)}%</span>
                                    </div>
                                    <Slider
                                      min={0}
                                      max={3}
                                      step={0.01}
                                      value={[settings.intensity]}
                                      className="radial-premium-slider"
                                      onValueChange={([value]) => updateSetting("intensity", value)}
                                      data-testid="slider-radial-precision-intensity"
                                    />
                                    <div className="radial-slider-ticks" />
                                  </div>

                                  <div className="space-y-1.5">
                                    <div className="flex justify-between text-xs">
                                      <span className="uppercase tracking-widest text-white/55">Speed</span>
                                      <span className="radial-value-chip font-mono text-white/90">{Math.round((settings.speed / 2) * 100)}%</span>
                                    </div>
                                    <Slider
                                      min={0}
                                      max={2}
                                      step={0.01}
                                      value={[settings.speed]}
                                      className="radial-premium-slider"
                                      onValueChange={([value]) => updateSetting("speed", value)}
                                      data-testid="slider-radial-precision-speed"
                                    />
                                    <div className="radial-slider-ticks" />
                                  </div>
                                </div>
                              )}
                              {precisionTabSpecs.length > 0 ? (
                                <FractalControlPanel
                                  specs={precisionTabSpecs}
                                  uniforms={fractalUniforms}
                                  setUniform={onFractalUniformChange}
                                  compact
                                  fillAvailableWidth
                                />
                              ) : precisionTab === "motion" ? null : (
                                <p className="text-xs text-white/50">No controls available in this section for the selected preset.</p>
                              )}
                            </div>
                          ) : (
                            <div
                              className={`radial-settings-section col-span-12 h-fit ${fractalSettingsTileOrder === "precision-first" ? "order-1" : "order-2"}`}
                            >
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/70">Precision Controls</p>
                                <button
                                  type="button"
                                  onClick={toggleFractalSettingsTileOrder}
                                  className="rounded border border-white/15 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/10 hover:text-white"
                                  data-radial-node="true"
                                  data-testid="button-radial-fractal-swap-tiles-empty"
                                >
                                  Swap Position
                                </button>
                              </div>
                              <p className="text-xs text-white/55">No fractal controls available for this preset.</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2" data-radial-node="true">
                          <div className="radial-settings-section space-y-3">
                            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/70">Motion</p>

                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className="uppercase tracking-widest text-white/55">Intensity</span>
                                <span className="radial-value-chip font-mono text-white/90">{Math.round((settings.intensity / 3) * 100)}%</span>
                              </div>
                              <Slider
                                min={0}
                                max={3}
                                step={0.01}
                                value={[settings.intensity]}
                                className="radial-premium-slider"
                                onValueChange={([value]) => updateSetting("intensity", value)}
                                data-testid="slider-radial-intensity"
                              />
                              <div className="radial-slider-ticks" />
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className="uppercase tracking-widest text-white/55">Speed</span>
                                <span className="radial-value-chip font-mono text-white/90">{Math.round((settings.speed / 2) * 100)}%</span>
                              </div>
                              <Slider
                                min={0}
                                max={2}
                                step={0.01}
                                value={[settings.speed]}
                                className="radial-premium-slider"
                                onValueChange={([value]) => updateSetting("speed", value)}
                                data-testid="slider-radial-speed"
                              />
                              <div className="radial-slider-ticks" />
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className="uppercase tracking-widest text-white/55">Zoom</span>
                                <span className="radial-value-chip font-mono text-white/90">{Math.round(zoom * 100)}%</span>
                              </div>
                              <Slider
                                min={50}
                                max={300}
                                step={1}
                                value={[zoom * 100]}
                                className="radial-premium-slider"
                                onValueChange={([value]) => onZoomChange?.(value / 100)}
                                data-testid="slider-radial-zoom"
                              />
                              <div className="radial-slider-ticks" />
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className="uppercase tracking-widest text-white/55">Field Rotation</span>
                                <span className="radial-value-chip font-mono text-white/90">
                                  {Math.round(((settings.fieldRotation ?? 1) / 2) * 100)}%
                                </span>
                              </div>
                              <Slider
                                min={0}
                                max={2}
                                step={0.01}
                                value={[settings.fieldRotation ?? 1]}
                                className="radial-premium-slider"
                                onValueChange={([value]) => updateSetting("fieldRotation", value)}
                                data-testid="slider-radial-field-rotation"
                              />
                              <div className="radial-slider-ticks" />
                            </div>
                          </div>

                          <div className="radial-settings-section space-y-3">
                            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/70">Visual FX</p>
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className="uppercase tracking-widest text-white/55">Glow</span>
                                <span className="radial-value-chip font-mono text-white/90">{Math.round(((settings.glowIntensity ?? 1) / 2) * 100)}%</span>
                              </div>
                              <Slider
                                min={0.2}
                                max={2}
                                step={0.01}
                                value={[settings.glowIntensity ?? 1]}
                                className="radial-premium-slider"
                                onValueChange={([value]) => updateSetting("glowIntensity", value)}
                                data-testid="slider-radial-glow"
                              />
                              <div className="radial-slider-ticks" />
                            </div>

                            <div className="flex items-center justify-between">
                              <Label className="text-xs text-white/65">Motion Trails</Label>
                              <Switch
                                checked={Boolean(settings.trailsOn)}
                                onCheckedChange={(checked) =>
                                  setSettings((prev: UISettings) => ({
                                    ...prev,
                                    trailsOn: checked,
                                    trailsAmount: checked ? prev.trailsAmount ?? 0.75 : 0,
                                  }))
                                }
                              />
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className="uppercase tracking-widest text-white/55">Trails Amount</span>
                                <span className="radial-value-chip font-mono text-white/90">{Math.round((settings.trailsAmount ?? 0.75) * 100)}%</span>
                              </div>
                              <Slider
                                min={0}
                                max={1}
                                step={0.01}
                                value={[settings.trailsAmount ?? 0.75]}
                                className="radial-premium-slider"
                                onValueChange={([value]) =>
                                  setSettings((prev: UISettings) => ({
                                    ...prev,
                                    trailsOn: value > 0.01,
                                    trailsAmount: value,
                                  }))
                                }
                                data-testid="slider-radial-trails"
                              />
                              <div className="radial-slider-ticks" />
                            </div>

                            <div className="flex items-center justify-between">
                              <Label className="text-xs text-white/65">Glow Enable</Label>
                              <Switch
                                checked={settings.glowEnabled !== false}
                                onCheckedChange={(checked) => updateSetting("glowEnabled", checked)}
                              />
                            </div>
                          </div>

                          <div className="radial-settings-section space-y-3">
                            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/70">AI Evolution</p>
                            <div className="flex items-center justify-between">
                              <Label className="text-xs text-white/65">Enable AI Evolution</Label>
                              <Switch
                                checked={settings.evolutionEnabled !== false}
                                onCheckedChange={(checked) => updateSetting("evolutionEnabled", checked)}
                              />
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs">
                                <span className="uppercase tracking-widest text-white/55">AI Strength</span>
                                <span className="radial-value-chip font-mono text-white/90">
                                  {Math.round((settings.aiEvolutionStrength ?? 0.62) * 100)}%
                                </span>
                              </div>
                              <Slider
                                min={0}
                                max={1}
                                step={0.01}
                                value={[settings.aiEvolutionStrength ?? 0.62]}
                                className="radial-premium-slider"
                                onValueChange={([value]) => updateSetting("aiEvolutionStrength", value)}
                                disabled={settings.evolutionEnabled === false}
                                data-testid="slider-radial-ai-strength"
                              />
                              <div className="radial-slider-ticks" />
                            </div>
                          </div>

                          <div className="radial-settings-section space-y-3">
                            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/70">Color Engine</p>
                            <div className="flex flex-wrap gap-1">
                              {colorModes
                                .filter((mode) => mode.id !== "ai" && mode.id !== "custom")
                                .map((mode) => (
                                  <button
                                    key={mode.id}
                                    type="button"
                                    onClick={() => updateColorSetting("mode", mode.id)}
                                    className={`rounded border px-2 py-1 text-[10px] transition ${
                                      colorSettings.mode === mode.id
                                        ? "border-cyan-300/60 bg-gradient-to-r from-fuchsia-500/20 to-cyan-400/20 text-white"
                                        : "border-white/15 bg-white/5 text-white/65 hover:bg-white/10"
                                    }`}
                                    data-radial-node="true"
                                  >
                                    {mode.name}
                                  </button>
                                ))}
                            </div>

                            {(colorSettings.mode === "single" ||
                              colorSettings.mode === "gradient" ||
                              colorSettings.mode === "triadic") && (
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={colorSettings.primaryColor}
                                  onChange={(event) => updateColorSetting("primaryColor", event.target.value)}
                                  className="h-7 w-7 cursor-pointer rounded border-0"
                                  data-radial-node="true"
                                />
                                {(colorSettings.mode === "gradient" || colorSettings.mode === "triadic") && (
                                  <input
                                    type="color"
                                    value={colorSettings.secondaryColor}
                                    onChange={(event) => updateColorSetting("secondaryColor", event.target.value)}
                                    className="h-7 w-7 cursor-pointer rounded border-0"
                                    data-radial-node="true"
                                  />
                                )}
                                {colorSettings.mode === "triadic" && (
                                  <input
                                    type="color"
                                    value={colorSettings.tertiaryColor}
                                    onChange={(event) => updateColorSetting("tertiaryColor", event.target.value)}
                                    className="h-7 w-7 cursor-pointer rounded border-0"
                                    data-radial-node="true"
                                  />
                                )}
                              </div>
                            )}

                            {colorSettings.mode === "mood" && (
                              <div className="flex flex-wrap gap-1">
                                {moodPresets.map((mood) => (
                                  <button
                                    key={mood.id}
                                    type="button"
                                    onClick={() => updateColorSetting("moodPreset", mood.id)}
                                    className={`rounded border border-white/15 px-2 py-1 text-[10px] ${
                                      colorSettings.moodPreset === mood.id ? "ring-1 ring-white" : "opacity-70 hover:opacity-100"
                                    }`}
                                    style={{ background: `linear-gradient(135deg, ${mood.colors[0]}, ${mood.colors[1]})` }}
                                    data-radial-node="true"
                                  >
                                    {mood.name}
                                  </button>
                                ))}
                              </div>
                            )}

                            {colorSettings.mode === "spectrum" && (
                              <div className="space-y-1.5">
                                <div className="flex justify-between text-xs">
                                  <span className="uppercase tracking-widest text-white/55">Cycle Speed</span>
                                  <span className="radial-value-chip font-mono text-white/90">{colorSettings.spectrumSpeed.toFixed(1)}x</span>
                                </div>
                                <Slider
                                  min={0.1}
                                  max={3}
                                  step={0.1}
                                  value={[colorSettings.spectrumSpeed]}
                                  className="radial-premium-slider"
                                  onValueChange={([value]) => updateColorSetting("spectrumSpeed", value)}
                                  data-testid="slider-radial-spectrum"
                                />
                                <div className="radial-slider-ticks" />
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Auto-Evolve Panel — universally visible */}
                      {autoEvolveConfig && setAutoEvolveConfig && (
                        <div className="radial-settings-section mt-3 space-y-3" data-radial-node="true">
                          <div className="flex items-center justify-between">
                            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/70">Auto-Evolve</p>
                            <Switch
                              checked={autoEvolveConfig.enabled}
                              onCheckedChange={(checked) =>
                                setAutoEvolveConfig((prev) => ({ ...prev, enabled: checked }))
                              }
                              data-testid="switch-auto-evolve"
                            />
                          </div>

                          {/* Chaos Level */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                              <span className="uppercase tracking-widest text-white/55">Chaos Level</span>
                              <span className="radial-value-chip text-[10px] font-mono text-white/90">
                                {autoEvolveConfig.chaos.toUpperCase()}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5">
                              {CHAOS_LEVEL_OPTIONS.map((opt) => {
                                const active = autoEvolveConfig.chaos === opt.id;
                                return (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() =>
                                      setAutoEvolveConfig((prev) => ({ ...prev, chaos: opt.id }))
                                    }
                                    disabled={!autoEvolveConfig.enabled}
                                    className={`rounded border px-2 py-1 text-[10px] uppercase tracking-[0.12em] transition ${
                                      active
                                        ? "border-cyan-300/60 bg-gradient-to-r from-fuchsia-500/20 to-cyan-400/20 text-white"
                                        : "border-white/15 bg-white/5 text-white/65 hover:bg-white/10"
                                    } ${!autoEvolveConfig.enabled ? "opacity-45" : ""}`}
                                    data-radial-node="true"
                                    data-testid={`button-chaos-${opt.id}`}
                                    title={opt.desc}
                                  >
                                    {opt.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Status indicators (shown when enabled) */}
                          {autoEvolveConfig.enabled && autoEvolveOutput && (
                            <div className="space-y-2 rounded border border-white/10 bg-white/[0.03] p-2.5">
                              {/* Tension bar */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-[10px]">
                                  <span className="uppercase tracking-widest text-white/55">Tension</span>
                                  <span className="font-mono text-white/80">
                                    {Math.round(autoEvolveOutput.tensionLevel * 100)}%
                                  </span>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                                  <div
                                    className="h-full rounded-full transition-all duration-200"
                                    style={{
                                      width: `${autoEvolveOutput.tensionLevel * 100}%`,
                                      background: `linear-gradient(90deg, #22d3ee, #d946ef)`,
                                    }}
                                  />
                                </div>
                              </div>

                              {/* Phase + Mood row */}
                              <div className="flex items-center justify-between gap-2 text-[10px]">
                                <div className="flex items-center gap-1.5">
                                  <span className="uppercase tracking-widest text-white/55">Phase</span>
                                  <span
                                    className={`rounded-sm border px-1.5 py-0.5 font-mono uppercase tracking-wider ${
                                      autoEvolveOutput.tensionPhase === "peak"
                                        ? "border-fuchsia-400/50 bg-fuchsia-500/20 text-fuchsia-300"
                                        : autoEvolveOutput.tensionPhase === "building"
                                          ? "border-amber-400/50 bg-amber-500/20 text-amber-300"
                                          : autoEvolveOutput.tensionPhase === "releasing"
                                            ? "border-cyan-400/50 bg-cyan-500/20 text-cyan-300"
                                            : "border-white/20 bg-white/5 text-white/60"
                                    }`}
                                  >
                                    {autoEvolveOutput.tensionPhase}
                                  </span>
                                </div>
                                {autoEvolveOutput.currentMood && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="uppercase tracking-widest text-white/55">Mood</span>
                                    <span className="rounded-sm border border-white/20 bg-white/5 px-1.5 py-0.5 font-mono uppercase tracking-wider text-white/70">
                                      {autoEvolveOutput.currentMood}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Last switch reason */}
                              {autoEvolveOutput.lastSwitchReason && (
                                <div className="text-[9px] italic text-white/40">
                                  Last: {autoEvolveOutput.lastSwitchReason}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Mood-preset mapping editor (collapsible) */}
                          {autoEvolveConfig.enabled && (
                            <MoodPresetEditor
                              moodMap={autoEvolveConfig.moodMap}
                              onChange={(moodMap) =>
                                setAutoEvolveConfig((prev) => ({ ...prev, moodMap }))
                              }
                            />
                          )}
                        </div>
                      )}
                    </ResizablePanel>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {activeDial && (
                  <DialPanel
                    dial={activeDial}
                    onClose={() => setActiveDialId(null)}
                    fps={fps}
                    showDepthTicks={variant === "fractal"}
                  />
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDockHandle && (
          <motion.button
            key="radial-dock-handle"
            type="button"
            onClick={handleRestoreRadial}
            className="panel-edge-handle absolute z-[70] pointer-events-auto flex h-12 w-6 items-center justify-center text-white/75 transition hover:text-white"
            style={{ left: dockHandleLeft - 3, top: dockHandleTop }}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            data-testid="button-radial-restore"
            title="Restore radial panel"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
