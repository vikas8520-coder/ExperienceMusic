import { type DomainWarpParams, defaultDomainWarpParams } from "@/components/PsyDomainWarp";
import { type MandalaParams, defaultMandalaParams } from "@/components/PsyMandala";
import { type FractalFlameParams, defaultFractalFlameParams } from "@/components/PsyFractalFlame";
import { type VoronoiParams, defaultVoronoiParams } from "@/components/PsyVoronoi";
import { psyPalettes, type PsyPalette } from "@/lib/psyPalettes";

export type EngineType = "domain-warp" | "mandala" | "fractal-flame" | "voronoi";

export type PsyPresetEntry = {
  name: string;
  engine: EngineType;
  params: DomainWarpParams | MandalaParams | FractalFlameParams | VoronoiParams;
  thumbnail?: string; // base64 data URL
};

export type PsyPresetPack = {
  version: 1;
  name: string;
  author: string;
  description: string;
  createdAt: string;
  presets: PsyPresetEntry[];
};

export function createPresetPack(
  name: string,
  author: string,
  description: string,
  presets: PsyPresetEntry[],
): PsyPresetPack {
  return {
    version: 1,
    name,
    author,
    description,
    createdAt: new Date().toISOString(),
    presets,
  };
}

export function exportPackJSON(pack: PsyPresetPack): string {
  return JSON.stringify(pack, null, 2);
}

export function downloadPackJSON(pack: PsyPresetPack) {
  const json = exportPackJSON(pack);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = `${pack.name.replace(/\s+/g, "-").toLowerCase()}-preset-pack.json`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

export function importPackJSON(json: string): PsyPresetPack | null {
  try {
    const data = JSON.parse(json);
    if (data.version !== 1 || !Array.isArray(data.presets)) return null;
    // Rehydrate palette references — match by id
    for (const entry of data.presets) {
      if (entry.params?.palette?.id) {
        const match = psyPalettes.find((p) => p.id === entry.params.palette.id);
        if (match) entry.params.palette = match;
      }
    }
    return data as PsyPresetPack;
  } catch {
    return null;
  }
}

// --- Sweep Generation ---

export type SweepAxis = {
  param: string;
  values: number[];
};

export type SweepConfig = {
  engine: EngineType;
  baseParams: DomainWarpParams | MandalaParams | FractalFlameParams | VoronoiParams;
  axes: SweepAxis[];
  palettes: PsyPalette[];
  seeds: number[];
};

function cartesianProduct<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>(
    (acc, arr) => acc.flatMap((combo) => arr.map((item) => [...combo, item])),
    [[]],
  );
}

export function generateSweepVariants(config: SweepConfig): Array<{
  params: Record<string, any>;
  label: string;
}> {
  const { baseParams, axes, palettes, seeds } = config;

  // Build all dimension arrays
  const dimensions: { name: string; values: any[] }[] = [];

  for (const axis of axes) {
    if (axis.values.length > 0) {
      dimensions.push({ name: axis.param, values: axis.values });
    }
  }
  if (palettes.length > 0) {
    dimensions.push({ name: "palette", values: palettes });
  }
  if (seeds.length > 0) {
    dimensions.push({ name: "seed", values: seeds });
  }

  if (dimensions.length === 0) return [];

  const combos = cartesianProduct(dimensions.map((d) => d.values));

  return combos.map((combo) => {
    const overrides: Record<string, any> = {};
    const labelParts: string[] = [];
    combo.forEach((val, i) => {
      const dim = dimensions[i];
      overrides[dim.name] = val;
      if (dim.name === "palette") {
        labelParts.push((val as PsyPalette).name);
      } else {
        labelParts.push(`${dim.name}=${val}`);
      }
    });

    return {
      params: { ...baseParams, ...overrides },
      label: labelParts.join("_"),
    };
  });
}

export function getDefaultParams(engine: EngineType) {
  switch (engine) {
    case "domain-warp": return { ...defaultDomainWarpParams };
    case "mandala": return { ...defaultMandalaParams };
    case "fractal-flame": return { ...defaultFractalFlameParams };
    case "voronoi": return { ...defaultVoronoiParams };
  }
}

// --- URL Sharing ---

export function encodeParamsToHash(engine: EngineType, params: Record<string, any>): string {
  const compact: Record<string, any> = { e: engine };
  const defaults = getDefaultParams(engine) as Record<string, any>;

  for (const [key, val] of Object.entries(params)) {
    if (key === "palette") {
      compact.pal = (val as PsyPalette).id;
    } else if (val !== defaults[key]) {
      compact[key] = val;
    }
  }
  return "#" + btoa(JSON.stringify(compact));
}

export function decodeParamsFromHash(hash: string): { engine: EngineType; params: Record<string, any> } | null {
  try {
    const raw = hash.startsWith("#") ? hash.slice(1) : hash;
    if (!raw) return null;
    const data = JSON.parse(atob(raw));
    const engine = data.e as EngineType;
    if (!engine) return null;

    const defaults = getDefaultParams(engine) as Record<string, any>;
    const params = { ...defaults };

    for (const [key, val] of Object.entries(data)) {
      if (key === "e") continue;
      if (key === "pal") {
        const match = psyPalettes.find((p) => p.id === val);
        if (match) params.palette = match;
      } else {
        params[key] = val;
      }
    }
    return { engine, params };
  } catch {
    return null;
  }
}

// --- Gallery ---

export type GalleryItem = {
  id: string;
  engine: EngineType;
  params: Record<string, any>;
  thumbnail: string; // base64 data URL (small)
  createdAt: string;
  favorite: boolean;
};

const GALLERY_KEY = "psy-gallery";
const MAX_GALLERY = 100;

export function loadGallery(): GalleryItem[] {
  try {
    const raw = localStorage.getItem(GALLERY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveGallery(items: GalleryItem[]) {
  localStorage.setItem(GALLERY_KEY, JSON.stringify(items.slice(0, MAX_GALLERY)));
}

export function addToGallery(
  engine: EngineType,
  params: Record<string, any>,
  thumbnailDataUrl: string,
): GalleryItem {
  const items = loadGallery();
  const item: GalleryItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    engine,
    params: { ...params, palette: { id: params.palette?.id } },
    thumbnail: thumbnailDataUrl,
    createdAt: new Date().toISOString(),
    favorite: false,
  };
  items.unshift(item);
  saveGallery(items);
  return item;
}

export function rehydrateGalleryParams(item: GalleryItem): Record<string, any> {
  const defaults = getDefaultParams(item.engine) as Record<string, any>;
  const params = { ...defaults, ...item.params };
  if (item.params.palette?.id) {
    const match = psyPalettes.find((p) => p.id === item.params.palette.id);
    if (match) params.palette = match;
  }
  return params;
}

// --- Discover (Random) ---

const ENGINES: EngineType[] = ["domain-warp", "mandala", "fractal-flame", "voronoi"];

function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min: number, max: number, decimals = 1) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

export function generateRandomDesign(): { engine: EngineType; params: Record<string, any> } {
  const engine = ENGINES[randInt(0, ENGINES.length - 1)];
  const palette = psyPalettes[randInt(0, psyPalettes.length - 1)];
  const seed = randInt(0, 99999);

  switch (engine) {
    case "domain-warp":
      return {
        engine,
        params: {
          ...defaultDomainWarpParams,
          symmetry: randInt(1, 16),
          warpStrength: randFloat(0.5, 6),
          warpLayers: randInt(1, 3),
          noiseScale: randFloat(1, 6),
          noiseOctaves: randInt(2, 7),
          zoom: randFloat(0.3, 3),
          rotation: randInt(0, 360),
          speed: randFloat(0.2, 1.5),
          seed,
          palette,
        },
      };
    case "mandala":
      return {
        engine,
        params: {
          ...defaultMandalaParams,
          symmetry: randInt(3, 20),
          ringCount: randInt(2, 10),
          complexity: randFloat(2, 8),
          innerPattern: randInt(0, 2),
          zoom: randFloat(0.3, 3),
          rotation: randInt(0, 360),
          speed: randFloat(0.2, 1.5),
          seed,
          palette,
        },
      };
    case "fractal-flame":
      return {
        engine,
        params: {
          ...defaultFractalFlameParams,
          variation: randInt(0, 7),
          symmetry: randInt(1, 8),
          iterations: randInt(8, 18),
          spread: randFloat(1, 4),
          zoom: randFloat(0.3, 3),
          rotation: randInt(0, 360),
          speed: randFloat(0.2, 1.5),
          seed,
          palette,
        },
      };
    case "voronoi":
      return {
        engine,
        params: {
          ...defaultVoronoiParams,
          cellScale: randInt(4, 20),
          symmetry: randInt(1, 16),
          edgeWidth: randFloat(0.05, 0.8),
          warpStrength: randFloat(0, 3),
          mode: randInt(0, 3),
          zoom: randFloat(0.3, 3),
          rotation: randInt(0, 360),
          speed: randFloat(0.2, 1.5),
          seed,
          palette,
        },
      };
  }
}

// --- Print-Ready Sizes ---

export const PRINT_SIZES = [
  { label: "1080p", width: 1920, height: 1080, category: "screen" },
  { label: "4K", width: 3840, height: 2160, category: "screen" },
  { label: "Phone", width: 1170, height: 2532, category: "screen" },
  { label: "Square", width: 2048, height: 2048, category: "screen" },
  { label: "Tapestry 60x80\"", width: 5400, height: 7200, category: "print" },
  { label: "Poster 24x36\"", width: 3600, height: 5400, category: "print" },
  { label: "Poster 18x24\"", width: 2700, height: 3600, category: "print" },
  { label: "Phone Case", width: 1242, height: 2688, category: "print" },
  { label: "Tote Bag 15x15\"", width: 2250, height: 2250, category: "print" },
  { label: "Sticker 4x4\"", width: 1200, height: 1200, category: "print" },
] as const;

export type PrintSize = typeof PRINT_SIZES[number];
