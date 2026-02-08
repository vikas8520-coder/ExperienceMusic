import { useEffect, useMemo, useRef, useState } from "react";
import type { AudioFeatures, FractalPreset, PresetContext, UniformValues } from "./types";

function buildDefaults(preset: FractalPreset): UniformValues {
  const u: UniformValues = {};
  for (const spec of preset.uniformSpecs) u[spec.key] = spec.default;
  return u;
}

export function usePresetEngine(opts: {
  preset: FractalPreset;
  audio: AudioFeatures;
  ctx: PresetContext;
}) {
  const { preset, audio, ctx } = opts;

  const [uniforms, setUniforms] = useState<UniformValues>(() => buildDefaults(preset));
  const stateRef = useRef<any>({});
  const presetRef = useRef<FractalPreset | null>(null);

  useEffect(() => {
    const prev = presetRef.current;
    if (prev) {
      try { prev.dispose(ctx); } catch {}
    }

    presetRef.current = preset;
    stateRef.current = {};

    setUniforms(buildDefaults(preset));

    (async () => {
      try { await preset.init(ctx); } catch (e) { console.error("preset.init failed", e); }
    })();

    return () => {
      try { preset.dispose(ctx); } catch {}
    };
  }, [preset.id]);

  const tick = () => {
    const p = presetRef.current;
    if (!p) return;
    p.update({ ctx, audio, uniforms, state: stateRef.current });
  };

  const setUniform = (key: string, value: any) => {
    setUniforms((prev) => ({ ...prev, [key]: value }));
  };

  const macros = useMemo(() => {
    return preset.uniformSpecs.filter((s) => s.macro);
  }, [preset]);

  return {
    uniforms,
    setUniforms,
    setUniform,
    tick,
    state: stateRef.current,
    Render: preset.Render,
    macros,
    specs: preset.uniformSpecs,
  };
}
