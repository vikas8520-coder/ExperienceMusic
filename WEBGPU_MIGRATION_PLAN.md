# WebGPU Migration Plan

Branch: `webgpu-migration`

## Current State (already done)
- `Canvas` now uses async `WebGPURenderer` init in `client/src/components/AudioVisualizer.tsx`.
- Capability check exists (`hasWebGPU`) and compatibility banner exists when `navigator.gpu` is missing.
- Build and typecheck pass.

## Surface Area Inventory
- Renderer entrypoint:
  - `client/src/components/AudioVisualizer.tsx`
- Postprocessing chain (WebGL-oriented):
  - `client/src/components/Effects.tsx`
  - `client/src/components/KaleidoscopeEffect.tsx`
  - `client/src/components/AfterimageEffect.tsx`
- Fractal/custom GLSL preset renderers:
  - `client/src/engine/presets/fractals/MandelbrotPreset.tsx`
  - `client/src/engine/presets/fractals/BurningShipPreset.tsx`
  - `client/src/engine/presets/fractals/JuliaOrbitTrapPreset.tsx`
  - `client/src/engine/presets/fractals/LivingTunnelPreset.tsx`
  - `client/src/engine/presets/fractals/EscapeFamilyPresets.tsx`
- GPU simulation presets with manual ping-pong render targets:
  - `client/src/engine/presets/fractals/SimulationFieldPresets.tsx`
- Audio/FFT pipeline feeding uniforms:
  - `client/src/hooks/use-audio-analyzer.ts`
  - `client/src/engine/presets/FractalPresetBridge.tsx`

## Phase 1: Stabilize WebGPU Runtime
Goal: keep app running with clear fallbacks while migrating effects.

1. Add runtime renderer mode detection in `AudioVisualizer.tsx` (`webgpu` vs `compatibility`).
2. Guard postprocessing in `Effects.tsx` behind compatibility mode until WebGPU-compatible replacements are ready.
3. Keep current fallback banner text and include current renderer mode for debugging.

Exit criteria:
- No black screen with presets enabled.
- App runs with and without `navigator.gpu`.

## Phase 2: Migrate Post Stack
Goal: replace WebGL-only post chain with WebGPU-friendly path.

1. Replace `EffectComposer` chain in `Effects.tsx` with:
   - lightweight in-shader bloom-like glow for core presets, or
   - WebGPU node/post path if available in your Three stack.
2. Fold custom `KaleidoscopeEffect` and `AfterimageEffect` logic into per-preset shader uniforms where possible.
3. Keep feature flags in settings so visual quality can be compared quickly.

Exit criteria:
- No dependency on `@react-three/postprocessing` for core render path.
- Comparable look for bloom/chroma/noise/vignette in primary presets.

## Phase 3: Fractal Shader Compatibility Pass
Goal: make all fractal presets deterministic on WebGPU path.

1. Standardize a shared shader-safe helper set:
   - clamp logs, avoid NaN paths, avoid unsupported derivative assumptions.
2. Align all fractal presets to a consistent uniform contract:
   - `u_resolution`, `u_time`, `u_center`, `u_zoom`, `u_rotation`, audio uniforms.
3. Validate each preset in order:
   - `Mandelbrot` -> `Burning Ship` -> `Julia Orbit Trap` -> `Living Tunnel` -> `Escape Family`.

Exit criteria:
- All fractal presets render on first load without shader compile failures.
- Uniform changes from controls remain stable.

## Phase 4: Rebuild Simulation Presets for WebGPU Compute
Goal: move Gray-Scott and Curl-Flow from manual WebGL ping-pong to compute-oriented updates.

1. Current blocker is `usePingPong(gl: THREE.WebGLRenderer, ...)` in `SimulationFieldPresets.tsx`.
2. Introduce a new simulation backend abstraction:
   - `webgpu-compute` backend
   - temporary `webgl-pingpong` backend
3. Migrate kernels:
   - Gray-Scott update pass
   - Curl-flow advection pass
4. Keep display shaders separate from sim kernels for easier tuning.

Exit criteria:
- Gray-Scott and Curl-Flow updates run via compute backend when available.
- Performance baseline better than current ping-pong on same machine.

## Phase 5: Audio-Driven GPU Data Path
Goal: reduce CPU uniform churn and prepare heavy scenes.

1. Keep FFT extraction in `use-audio-analyzer.ts` (already solid).
2. Add optional packed audio texture/buffer upload path (instead of many scalar uniforms).
3. Update `FractalPresetBridge.tsx` to provide both:
   - scalar legacy audio fields
   - packed GPU-ready audio payload.

Exit criteria:
- Presets can consume either scalar audio uniforms or packed audio data.
- No regression in reactivity timing.

## Immediate Next Patch (recommended)
1. Implement renderer mode state in `AudioVisualizer.tsx`.
2. Gate `Effects` component in WebGPU mode.
3. Add a small diagnostic label showing `WebGPU` or `Compatibility`.

This gets you a stable baseline for iterative shader and compute migration.
