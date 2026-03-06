# PSY Studio — Psychedelic Wallpaper Engine

A GPU-powered generative art studio built into ExperienceMusic. Creates print-ready psychedelic wallpapers, audio-reactive visualizer presets, and video content — all from the browser.

**Route:** `/wallpaper`

---

## Architecture

```
psyPalettes.ts          — 12 IQ cosine palettes + GLSL helpers
psyPresetPack.ts        — Preset packs, sweep gen, gallery, URL sharing, print sizes
PsyDomainWarp.tsx       — fBm domain warping engine
PsyMandala.tsx          — Polar symmetry mandala engine
PsyFractalFlame.tsx     — 8 fractal flame variations (IFS)
PsyVoronoi.tsx          — 4-mode Voronoi pattern engine
WallpaperStudio.tsx     — Studio UI (Design, Sweep, Presets, Gallery, Record)
AudioVisualizer.tsx     — Hosts all engines as audio-reactive presets
visualizer-presets.ts   — Preset registry + evolution configs
```

### Dual-Purpose Components

Every engine component serves two roles:
- **Wallpaper mode:** `<PsyDomainWarp params={...} />` — static/animated with tweakable params
- **Visualizer mode:** `<PsyDomainWarp getAudioData={fn} />` — audio-reactive preset in the main player

### Rendering Technique

All engines use fullscreen GLSL quad rendering:
- Vertex: `gl_Position = vec4(position.xy, 0.0, 1.0)` with `planeGeometry args={[2, 2]}`
- Fragment: All visual logic in fragment shader
- `frustumCulled={false}` on mesh
- NO vertex texture fetch (crashes macOS GPUs)
- `preserveDrawingBuffer: true` on Canvas for PNG export

---

## Engines

### 1. Domain Warp (`PsyDomainWarp.tsx`)
Recursive fBm domain warping: `fbm(p + fbm(p + fbm(p)))`

| Param | Range | Description |
|-------|-------|-------------|
| symmetry | 1-24 | Polar fold segments |
| warpStrength | 0-10 | Distortion intensity |
| warpLayers | 1-3 | Recursion depth |
| noiseScale | 0.5-8 | Base noise frequency |
| noiseOctaves | 1-8 | fBm detail layers |
| zoom | 0.1-10 | View zoom |
| rotation | 0-360 | View rotation (degrees) |
| speed | 0-2 | Animation speed |
| seed | 0-99999 | Deterministic randomization |
| palette | PsyPalette | IQ cosine color scheme |

### 2. Mandala (`PsyMandala.tsx`)
Polar symmetry with concentric rings and 3 inner fill patterns.

| Param | Range | Description |
|-------|-------|-------------|
| symmetry | 2-24 | Mirror segments |
| ringCount | 1-12 | Concentric ring layers |
| complexity | 1-10 | Detail within rings |
| innerPattern | 0-2 | 0=fBm, 1=Voronoi, 2=Spirals |
| zoom, rotation, speed, seed, palette | — | Same as Domain Warp |

### 3. Fractal Flame (`PsyFractalFlame.tsx`)
Iterated function system with 8 nonlinear variations + log-density tone mapping.

**Variations:** Sinusoidal, Spherical, Swirl, Horseshoe, Polar, Handkerchief, Heart, Julia

| Param | Range | Description |
|-------|-------|-------------|
| variation | 0-7 | Nonlinear variation function |
| symmetry | 1-12 | Polar fold segments |
| iterations | 5-20 | IFS iteration count |
| spread | 0.5-5 | Affine transform spread |
| zoom, rotation, speed, seed, palette | — | Same as Domain Warp |

### 4. Voronoi (`PsyVoronoi.tsx`)
Voronoi tessellation with domain warping and 4 rendering modes.

**Modes:** Cells (solid fill), Edges (neon wireframe), Crystal (faceted gem), Organic (biological)

| Param | Range | Description |
|-------|-------|-------------|
| cellScale | 2-30 | Cell density |
| symmetry | 1-24 | Polar fold segments |
| edgeWidth | 0-1 | Edge line thickness |
| warpStrength | 0-5 | Pre-Voronoi domain warp |
| mode | 0-3 | Rendering mode |
| zoom, rotation, speed, seed, palette | — | Same as Domain Warp |

---

## Color System (`psyPalettes.ts`)

IQ Cosine Palette formula: `color = a + b * cos(6.28318 * (c * t + d))`

Each palette has 4 vec3 parameters (a, b, c, d) passed as GLSL uniforms.

**12 Built-in Palettes:**
1. DMT Hyperspace
2. Mushroom Forest
3. Cosmic Nebula
4. UV Blacklight
5. Sacred Gold
6. Acid Neon
7. Deep Ocean
8. Fire Serpent
9. Aurora Borealis
10. Alien Blood
11. Crystal Cave
12. Psilocybin Sunset

---

## Studio Tabs

### Design
Parameter sliders, palette picker, seed control. Export as PNG or batch (10 seed variants).

### Sweep
Cartesian product parameter sweep:
- Seed range (count, start, step)
- Symmetry values (comma-separated)
- Palette multi-select

Example: 5 seeds x 4 symmetry x 3 palettes = 60 PNGs in one click.

### Presets
- Save/load named presets (persisted in localStorage)
- Export as `.json` preset pack (for Gumroad/selling)
- Import `.json` packs from others
- Palette references rehydrated on import

### Gallery
- Snapshot current design as thumbnail
- Visual grid with hover actions (Load, Fav, Delete)
- Favorites filter
- Up to 100 items in localStorage

### Record
- WebM VP9 video capture at 30fps / 8Mbps
- Adjustable duration (3-60 seconds)
- For TikTok, Instagram Reels, animated previews

---

## Export Sizes

### Screen
| Label | Resolution |
|-------|-----------|
| 1080p | 1920x1080 |
| 4K | 3840x2160 |
| Phone | 1170x2532 |
| Square | 2048x2048 |

### Print (300 DPI)
| Label | Resolution | Physical |
|-------|-----------|----------|
| Tapestry 60x80" | 5400x7200 | Wall hanging |
| Poster 24x36" | 3600x5400 | Large poster |
| Poster 18x24" | 2700x3600 | Standard poster |
| Phone Case | 1242x2688 | Phone case print |
| Tote Bag 15x15" | 2250x2250 | Tote bag |
| Sticker 4x4" | 1200x1200 | Die-cut sticker |

---

## Shareable URLs

Designs encode as base64 JSON in the URL hash:
```
/wallpaper#eyJlIjoiZG9tYWluLXdhcnAiLCJzeW1tZXRyeSI6OCwic2VlZCI6NDIwMDB9
```

Only non-default params are stored. Palette stored by ID. Decoded on page load.

---

## Visualizer Integration

All 4 engines are registered as presets in `visualizer-presets.ts`:
- "Domain Warp" — Cymatics category
- "Psy Mandala" — Cymatics category
- "Fractal Flame" — Cymatics category
- "Psy Voronoi" — Cymatics category

Render cases in `AudioVisualizer.tsx` pass `getAudioData` for audio reactivity.

Audio mapping (all engines):
- `bass` — spatial displacement, cell brightness pulse
- `mid` — smoothing target
- `high` — edge shimmer
- `kick` — sharp displacement, glow bursts
- `sub` — slow deep modulation
- `energy` — overall brightness boost

---

## Roadmap

### Production / Monetization
- [ ] **Printify API** — send wallpapers to print-on-demand (tapestries, posters, cases)
- [ ] **Gumroad storefront** — auto-package preset packs with previews
- [ ] **Watermark mode** — branding on social previews, clean for buyers

### More Engines
- [ ] **Reaction-Diffusion** — Gray-Scott, Turing morphogenesis
- [ ] **Hyperbolic Tilings** — Poincare disk tessellations
- [ ] **Moire Patterns** — interference pattern generator

### UX Polish
- [ ] **Undo/Redo** — parameter history stack
- [ ] **A/B Compare** — split-screen two designs
- [ ] **Keyboard shortcuts** — arrow keys nudge params, space = discover

### Distribution
- [ ] **Daily wallpaper bot** — auto-generate + post to social
- [ ] **Embed widget** — iframe snippet for live wallpapers on websites
