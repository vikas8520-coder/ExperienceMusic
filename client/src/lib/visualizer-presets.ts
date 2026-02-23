import type { EvolutionPreset, Section } from "@/engine/evolution/types";

// Color modes for flexible color selection
export const colorModes = [
  { id: "single", name: "Single Color", description: "Pick one color" },
  { id: "gradient", name: "Gradient", description: "Two-color blend" },
  { id: "triadic", name: "Triadic", description: "Three harmonious colors" },
  { id: "spectrum", name: "Spectrum", description: "Rainbow cycling" },
  { id: "mood", name: "Mood", description: "Emotion-based themes" },
  { id: "custom", name: "Custom", description: "Build your own palette" },
  { id: "ai", name: "AI Extracted", description: "From thumbnail analysis" },
] as const;

export type ColorModeId = typeof colorModes[number]["id"];

// Mood presets for the mood color mode
export const moodPresets = [
  { id: "energetic", name: "Energetic", colors: ["#ff0066", "#ff6600", "#ffcc00", "#ff3399"] },
  { id: "calm", name: "Calm", colors: ["#6699cc", "#99ccff", "#336699", "#003366"] },
  { id: "dark", name: "Dark", colors: ["#1a1a2e", "#16213e", "#0f3460", "#533483"] },
  { id: "ethereal", name: "Ethereal", colors: ["#e0c3fc", "#8ec5fc", "#ffecd2", "#fcb69f"] },
  { id: "fire", name: "Fire", colors: ["#ff4500", "#ff6347", "#dc143c", "#8b0000"] },
  { id: "ice", name: "Ice", colors: ["#e0ffff", "#87ceeb", "#4169e1", "#000080"] },
  { id: "forest", name: "Forest", colors: ["#228b22", "#32cd32", "#006400", "#90ee90"] },
  { id: "cosmic", name: "Cosmic", colors: ["#9400d3", "#4b0082", "#0000ff", "#00ffff"] },
] as const;

export type MoodPresetId = typeof moodPresets[number]["id"];

// Color settings for the visualization
export interface ColorSettings {
  mode: ColorModeId;
  primaryColor: string;
  secondaryColor: string;
  tertiaryColor: string;
  moodPreset: MoodPresetId;
  customColors: string[];
  aiColors: string[];
  spectrumSpeed: number;
  spectrumOffset: number;
}

// Default color settings
export const defaultColorSettings: ColorSettings = {
  mode: "gradient",
  primaryColor: "#ff00ff",
  secondaryColor: "#00ffff",
  tertiaryColor: "#ff6600",
  moodPreset: "energetic",
  customColors: ["#ff00ff", "#00ffff", "#ff0080", "#aa00ff"],
  aiColors: [],
  spectrumSpeed: 1.0,
  spectrumOffset: 0,
};

// Generate color palette based on color settings
export function generateColorPalette(settings: ColorSettings, time: number = 0): string[] {
  switch (settings.mode) {
    case "single": {
      // Generate variations from single color
      const base = settings.primaryColor;
      return [base, lighten(base, 20), darken(base, 20), saturate(base, 30)];
    }
    case "gradient": {
      // Interpolate between two colors
      const c1 = settings.primaryColor;
      const c2 = settings.secondaryColor;
      return [c1, interpolateColor(c1, c2, 0.33), interpolateColor(c1, c2, 0.66), c2];
    }
    case "triadic": {
      // Three colors with automatic complementary fourth
      const c1 = settings.primaryColor;
      const c2 = settings.secondaryColor;
      const c3 = settings.tertiaryColor;
      return [c1, c2, c3, interpolateColor(c1, c3, 0.5)];
    }
    case "spectrum": {
      // Rainbow cycling based on time
      const offset = (time * settings.spectrumSpeed * 0.1 + settings.spectrumOffset) % 1;
      return [
        hslToHex((offset * 360) % 360, 100, 50),
        hslToHex((offset * 360 + 90) % 360, 100, 50),
        hslToHex((offset * 360 + 180) % 360, 100, 50),
        hslToHex((offset * 360 + 270) % 360, 100, 50),
      ];
    }
    case "mood": {
      const mood = moodPresets.find(m => m.id === settings.moodPreset);
      return mood ? [...mood.colors] : [...moodPresets[0].colors];
    }
    case "custom": {
      return settings.customColors.length >= 4 
        ? settings.customColors.slice(0, 4) 
        : [...settings.customColors, ...Array(4 - settings.customColors.length).fill("#ffffff")];
    }
    case "ai": {
      return settings.aiColors.length >= 4 
        ? settings.aiColors.slice(0, 4) 
        : settings.aiColors.length > 0 
          ? [...settings.aiColors, ...Array(4 - settings.aiColors.length).fill(settings.aiColors[0])]
          : ["#ff00ff", "#00ffff", "#ff0080", "#aa00ff"];
    }
    default:
      return ["#ff00ff", "#00ffff", "#ff0080", "#aa00ff"];
  }
}

// Color utility functions
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 255, g: 0, b: 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(x => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
}

function interpolateColor(c1: string, c2: string, t: number): string {
  const rgb1 = hexToRgb(c1);
  const rgb2 = hexToRgb(c2);
  return rgbToHex(
    rgb1.r + (rgb2.r - rgb1.r) * t,
    rgb1.g + (rgb2.g - rgb1.g) * t,
    rgb1.b + (rgb2.b - rgb1.b) * t
  );
}

function lighten(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  return rgbToHex(
    rgb.r + (255 - rgb.r) * (percent / 100),
    rgb.g + (255 - rgb.g) * (percent / 100),
    rgb.b + (255 - rgb.b) * (percent / 100)
  );
}

function darken(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  return rgbToHex(
    rgb.r * (1 - percent / 100),
    rgb.g * (1 - percent / 100),
    rgb.b * (1 - percent / 100)
  );
}

function saturate(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  const gray = 0.2989 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  return rgbToHex(
    gray + (rgb.r - gray) * (1 + percent / 100),
    gray + (rgb.g - gray) * (1 + percent / 100),
    gray + (rgb.b - gray) * (1 + percent / 100)
  );
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Legacy color palettes for backwards compatibility
export const colorPalettes = [
  { name: "Neon Cyber", colors: ["#ff00ff", "#00ffff", "#ff0080", "#aa00ff"] },
  { name: "Sunset Synth", colors: ["#ff9900", "#ff0055", "#6600cc", "#0000ff"] },
  { name: "Toxic Sludge", colors: ["#39ff14", "#ccff00", "#008000", "#003300"] },
  { name: "Ice Realm", colors: ["#e0ffff", "#00ffff", "#0080ff", "#000080"] },
  { name: "Void Fire", colors: ["#ff3300", "#ff0000", "#660000", "#1a0000"] },
  { name: "Aurora", colors: ["#00ff87", "#60efff", "#ff00ff", "#0061ff"] },
  { name: "Midnight", colors: ["#1a0033", "#4d0099", "#9933ff", "#cc66ff"] },
  { name: "Golden Hour", colors: ["#ff6b35", "#f7c59f", "#efa00b", "#d68c45"] },
  { name: "Ocean Deep", colors: ["#001f3f", "#003366", "#006699", "#00ccff"] },
  { name: "Cherry Blossom", colors: ["#ffb7c5", "#ff69b4", "#ff1493", "#c71585"] },
];

export const presets = [
  "Energy Rings",
  "Psy Tunnel",
  "Psy Extra",
  "Particle Field",
  "Waveform Sphere",
  "Audio Bars",
  "Geometric Kaleidoscope",
  "Cosmic Web",
  "Cymatic Sand Plate",
  "Water Membrane Orb",
  "Energy Rings (Babylon)",
  "Psy Tunnel (Babylon)",
  "Psy Extra (Babylon)",
  "Particle Field (Babylon)",
  "Waveform Sphere (Babylon)",
  "Audio Bars (Babylon)",
  "Geometric Kaleidoscope (Babylon)",
  "Cosmic Web (Babylon)",
  "Cymatic Sand Plate (Babylon)",
  "Water Membrane Orb (Babylon)",
  "Ritual Tapestry (Babylon)",
  "Ritual Tapestry V3 (Babylon)",
  "Chladni Geometry",
  "Resonant Field Lines",
  "Premium Field",
  "Mandelbrot Explorer",
  "Julia Orbit Trap",
] as const;

export type PresetName = typeof presets[number];

// Categorized presets for UI display
export const presetCategories = [
  {
    name: "Fractals",
    presets: [
      { name: "Mandelbrot Explorer" as PresetName, icon: "mandelbrot", shortName: "Mandelbrot" },
      { name: "Julia Orbit Trap" as PresetName, icon: "juliaorbittrap", shortName: "Orbit Trap" },
    ],
  },
  {
    name: "Base",
    presets: [
      { name: "Energy Rings" as PresetName, icon: "rings", shortName: "Rings" },
      { name: "Psy Tunnel" as PresetName, icon: "tunnel", shortName: "Psy" },
      { name: "Psy Extra" as PresetName, icon: "tunnel", shortName: "Psy+" },
      { name: "Particle Field" as PresetName, icon: "particles", shortName: "Particles" },
      { name: "Waveform Sphere" as PresetName, icon: "sphere", shortName: "Sphere" },
      { name: "Audio Bars" as PresetName, icon: "bars", shortName: "Bars" },
      { name: "Geometric Kaleidoscope" as PresetName, icon: "kaleidoscope", shortName: "Kaleid" },
      { name: "Cosmic Web" as PresetName, icon: "web", shortName: "Web" },
    ],
  },
  {
    name: "Babylon",
    presets: [
      { name: "Energy Rings (Babylon)" as PresetName, icon: "rings", shortName: "Rings B" },
      { name: "Psy Tunnel (Babylon)" as PresetName, icon: "tunnel", shortName: "Psy B" },
      { name: "Psy Extra (Babylon)" as PresetName, icon: "tunnel", shortName: "Psy+ B" },
      { name: "Particle Field (Babylon)" as PresetName, icon: "particles", shortName: "Part B" },
      { name: "Waveform Sphere (Babylon)" as PresetName, icon: "sphere", shortName: "Sphr B" },
      { name: "Audio Bars (Babylon)" as PresetName, icon: "bars", shortName: "Bars B" },
      { name: "Geometric Kaleidoscope (Babylon)" as PresetName, icon: "kaleidoscope", shortName: "Kal B" },
      { name: "Cosmic Web (Babylon)" as PresetName, icon: "web", shortName: "Web B" },
      { name: "Cymatic Sand Plate (Babylon)" as PresetName, icon: "sand", shortName: "Sand B" },
      { name: "Water Membrane Orb (Babylon)" as PresetName, icon: "water", shortName: "Water B" },
      { name: "Ritual Tapestry (Babylon)" as PresetName, icon: "kaleidoscope", shortName: "Rit B" },
      { name: "Ritual Tapestry V3 (Babylon)" as PresetName, icon: "kaleidoscope", shortName: "Rit V3" },
    ],
  },
  {
    name: "Cymatics",
    presets: [
      { name: "Cymatic Sand Plate" as PresetName, icon: "sand", shortName: "Sand" },
      { name: "Water Membrane Orb" as PresetName, icon: "water", shortName: "Water" },
      { name: "Chladni Geometry" as PresetName, icon: "geometry", shortName: "Chladni" },
      { name: "Resonant Field Lines" as PresetName, icon: "field", shortName: "Field" },
      { name: "Premium Field" as PresetName, icon: "field", shortName: "Premium" },
    ],
  },
] as const;

export type PresetEvolutionConfig = {
  preset: EvolutionPreset;
  defaultSections: Section[];
  defaultBpm?: number;
};

function createDefaultEvolutionSections(durationSec = 240): Section[] {
  const total = Math.max(60, durationSec);
  return [
    { type: "intro", startSec: 0, endSec: total * 0.125 },
    { type: "build", startSec: total * 0.125, endSec: total * 0.3125 },
    { type: "drop", startSec: total * 0.3125, endSec: total * 0.5625 },
    { type: "breakdown", startSec: total * 0.5625, endSec: total * 0.7083 },
    { type: "drop", startSec: total * 0.7083, endSec: total * 0.9166 },
    { type: "outro", startSec: total * 0.9166, endSec: total },
  ];
}

const AI_PROFILE_DEFAULT = {
  enabled: true,
  strength: 0.62,
  responsiveness: 0.58,
  creativity: 0.5,
} as const;

const FIELD_EVOLUTION: EvolutionPreset = {
  enabled: true,
  base: {
    complexity: 0.35,
    warp: 0.25,
    symmetry: 0.15,
    glow: 0.18,
    particles: 0.1,
    saturation: 0.35,
    speed: 0.35,
    zoomPulse: 0.05,
    palette: 0.25,
  },
  phaseTargets: {
    intro: { complexity: 0.25, warp: 0.15, glow: 0.08, saturation: 0.22, speed: 0.25 },
    build: { complexity: 0.5, warp: 0.35, glow: 0.18, saturation: 0.4, speed: 0.45 },
    drop: {
      complexity: 0.85,
      warp: 0.7,
      glow: 0.55,
      particles: 0.45,
      saturation: 0.7,
      speed: 0.65,
      symmetry: 0.45,
    },
    breakdown: { complexity: 0.35, warp: 0.18, glow: 0.12, particles: 0.15, saturation: 0.25, speed: 0.28 },
    outro: { complexity: 0.18, warp: 0.1, glow: 0.06, saturation: 0.15, speed: 0.18 },
  },
  curves: { defaultEase: "smoothstep", dropPunch: 0.4, settleMs: 260 },
  phraseEvents: { everyBars: 16, actions: ["symmetryShift", "warpBurst"] },
  ai: { ...AI_PROFILE_DEFAULT, strength: 0.66, responsiveness: 0.6, creativity: 0.52 },
};

const WATER_EVOLUTION: EvolutionPreset = {
  enabled: true,
  base: {
    complexity: 0.3,
    warp: 0.22,
    symmetry: 0.05,
    glow: 0.1,
    particles: 0.05,
    saturation: 0.28,
    speed: 0.3,
    zoomPulse: 0.02,
    palette: 0.15,
  },
  phaseTargets: {
    intro: { warp: 0.12, glow: 0.06, speed: 0.22 },
    build: { warp: 0.28, glow: 0.12, speed: 0.4, saturation: 0.35 },
    drop: { warp: 0.55, glow: 0.35, speed: 0.55, particles: 0.2, saturation: 0.55 },
    breakdown: { warp: 0.15, glow: 0.08, speed: 0.25, saturation: 0.22 },
    outro: { warp: 0.1, glow: 0.05, speed: 0.18, saturation: 0.15 },
  },
  curves: { defaultEase: "smoothstep", dropPunch: 0.3, settleMs: 240 },
  phraseEvents: { everyBars: 16, actions: ["paletteFlip"] },
  ai: { ...AI_PROFILE_DEFAULT, strength: 0.58, responsiveness: 0.56, creativity: 0.6 },
};

const SAND_EVOLUTION: EvolutionPreset = {
  enabled: true,
  base: {
    complexity: 0.32,
    warp: 0.2,
    symmetry: 0.22,
    glow: 0.12,
    particles: 0.08,
    saturation: 0.3,
    speed: 0.28,
    zoomPulse: 0.04,
    palette: 0.22,
  },
  phaseTargets: {
    intro: { complexity: 0.2, warp: 0.1, glow: 0.06, speed: 0.2 },
    build: { complexity: 0.42, warp: 0.26, glow: 0.15, speed: 0.36, saturation: 0.38 },
    drop: { complexity: 0.72, warp: 0.45, glow: 0.3, particles: 0.25, speed: 0.52, symmetry: 0.4 },
    breakdown: { complexity: 0.28, warp: 0.16, glow: 0.1, speed: 0.24, saturation: 0.24 },
    outro: { complexity: 0.14, warp: 0.08, glow: 0.05, speed: 0.16, saturation: 0.14 },
  },
  curves: { defaultEase: "smoothstep", dropPunch: 0.32, settleMs: 230 },
  phraseEvents: { everyBars: 8, actions: ["warpBurst"] },
  ai: { ...AI_PROFILE_DEFAULT, strength: 0.64, responsiveness: 0.62, creativity: 0.44 },
};

const CHLADNI_EVOLUTION: EvolutionPreset = {
  enabled: true,
  base: {
    complexity: 0.34,
    warp: 0.18,
    symmetry: 0.3,
    glow: 0.14,
    particles: 0.06,
    saturation: 0.26,
    speed: 0.3,
    zoomPulse: 0.03,
    palette: 0.2,
  },
  phaseTargets: {
    intro: { complexity: 0.22, warp: 0.12, symmetry: 0.38, glow: 0.08, speed: 0.22 },
    build: { complexity: 0.46, warp: 0.24, symmetry: 0.5, glow: 0.16, speed: 0.38, saturation: 0.34 },
    drop: { complexity: 0.78, warp: 0.42, symmetry: 0.72, glow: 0.34, speed: 0.58, saturation: 0.52 },
    breakdown: { complexity: 0.3, warp: 0.14, symmetry: 0.42, glow: 0.11, speed: 0.26, saturation: 0.2 },
    outro: { complexity: 0.15, warp: 0.08, symmetry: 0.25, glow: 0.06, speed: 0.18, saturation: 0.12 },
  },
  curves: { defaultEase: "smoothstep", dropPunch: 0.28, settleMs: 220 },
  phraseEvents: { everyBars: 16, actions: ["symmetryShift", "paletteFlip"] },
  ai: { ...AI_PROFILE_DEFAULT, strength: 0.63, responsiveness: 0.55, creativity: 0.57 },
};

const GENERIC_AI_EVOLUTION: EvolutionPreset = {
  enabled: true,
  base: {
    complexity: 0.32,
    warp: 0.24,
    symmetry: 0.2,
    glow: 0.18,
    particles: 0.12,
    saturation: 0.36,
    speed: 0.34,
    zoomPulse: 0.08,
    palette: 0.36,
  },
  phaseTargets: {
    intro: { complexity: 0.22, warp: 0.14, glow: 0.1, speed: 0.24, saturation: 0.24 },
    build: { complexity: 0.42, warp: 0.32, glow: 0.24, speed: 0.44, saturation: 0.42 },
    drop: {
      complexity: 0.72,
      warp: 0.62,
      glow: 0.56,
      particles: 0.44,
      speed: 0.66,
      saturation: 0.7,
      symmetry: 0.46,
    },
    breakdown: { complexity: 0.3, warp: 0.2, glow: 0.14, particles: 0.2, speed: 0.3, saturation: 0.3 },
    outro: { complexity: 0.14, warp: 0.1, glow: 0.06, speed: 0.18, saturation: 0.16 },
  },
  curves: { defaultEase: "smoothstep", dropPunch: 0.32, settleMs: 230 },
  phraseEvents: { everyBars: 16, actions: ["warpBurst", "paletteFlip"] },
  ai: { ...AI_PROFILE_DEFAULT },
};

const FRACTAL_AI_EVOLUTION: EvolutionPreset = {
  enabled: true,
  base: {
    complexity: 0.42,
    warp: 0.34,
    symmetry: 0.34,
    glow: 0.18,
    particles: 0.04,
    saturation: 0.34,
    speed: 0.3,
    zoomPulse: 0.12,
    palette: 0.28,
  },
  phaseTargets: {
    intro: { complexity: 0.28, warp: 0.2, glow: 0.1, speed: 0.22, symmetry: 0.42 },
    build: { complexity: 0.52, warp: 0.42, glow: 0.2, speed: 0.38, symmetry: 0.52 },
    drop: {
      complexity: 0.86,
      warp: 0.74,
      glow: 0.46,
      speed: 0.58,
      symmetry: 0.76,
      zoomPulse: 0.54,
      saturation: 0.62,
    },
    breakdown: { complexity: 0.4, warp: 0.28, glow: 0.14, speed: 0.28, symmetry: 0.48, saturation: 0.28 },
    outro: { complexity: 0.18, warp: 0.12, glow: 0.08, speed: 0.16, symmetry: 0.3, saturation: 0.16 },
  },
  curves: { defaultEase: "smoothstep", dropPunch: 0.38, settleMs: 250 },
  phraseEvents: { everyBars: 8, actions: ["symmetryShift", "warpBurst"] },
  ai: { ...AI_PROFILE_DEFAULT, strength: 0.68, responsiveness: 0.6, creativity: 0.58 },
};

const presetEvolutionMap: Partial<Record<PresetName, { preset: EvolutionPreset; defaultBpm: number }>> = {
  "Energy Rings": { preset: GENERIC_AI_EVOLUTION, defaultBpm: 128 },
  "Psy Tunnel": { preset: GENERIC_AI_EVOLUTION, defaultBpm: 134 },
  "Psy Extra": { preset: GENERIC_AI_EVOLUTION, defaultBpm: 136 },
  "Particle Field": { preset: GENERIC_AI_EVOLUTION, defaultBpm: 130 },
  "Waveform Sphere": { preset: GENERIC_AI_EVOLUTION, defaultBpm: 126 },
  "Audio Bars": { preset: GENERIC_AI_EVOLUTION, defaultBpm: 124 },
  "Geometric Kaleidoscope": { preset: GENERIC_AI_EVOLUTION, defaultBpm: 132 },
  "Cosmic Web": { preset: GENERIC_AI_EVOLUTION, defaultBpm: 130 },
  "Energy Rings (Babylon)": { preset: GENERIC_AI_EVOLUTION, defaultBpm: 128 },
  "Psy Tunnel (Babylon)": { preset: GENERIC_AI_EVOLUTION, defaultBpm: 134 },
  "Psy Extra (Babylon)": { preset: GENERIC_AI_EVOLUTION, defaultBpm: 136 },
  "Particle Field (Babylon)": { preset: GENERIC_AI_EVOLUTION, defaultBpm: 130 },
  "Waveform Sphere (Babylon)": { preset: GENERIC_AI_EVOLUTION, defaultBpm: 126 },
  "Audio Bars (Babylon)": { preset: GENERIC_AI_EVOLUTION, defaultBpm: 124 },
  "Geometric Kaleidoscope (Babylon)": { preset: GENERIC_AI_EVOLUTION, defaultBpm: 132 },
  "Cosmic Web (Babylon)": { preset: GENERIC_AI_EVOLUTION, defaultBpm: 130 },
  "Ritual Tapestry (Babylon)": { preset: GENERIC_AI_EVOLUTION, defaultBpm: 124 },
  "Ritual Tapestry V3 (Babylon)": { preset: GENERIC_AI_EVOLUTION, defaultBpm: 124 },
  "Resonant Field Lines": { preset: FIELD_EVOLUTION, defaultBpm: 138 },
  "Premium Field": { preset: FIELD_EVOLUTION, defaultBpm: 136 },
  "Water Membrane Orb": { preset: WATER_EVOLUTION, defaultBpm: 132 },
  "Water Membrane Orb (Babylon)": { preset: WATER_EVOLUTION, defaultBpm: 132 },
  "Cymatic Sand Plate": { preset: SAND_EVOLUTION, defaultBpm: 136 },
  "Cymatic Sand Plate (Babylon)": { preset: SAND_EVOLUTION, defaultBpm: 136 },
  "Chladni Geometry": { preset: CHLADNI_EVOLUTION, defaultBpm: 130 },
  "Mandelbrot Explorer": { preset: FRACTAL_AI_EVOLUTION, defaultBpm: 128 },
  "Julia Orbit Trap": { preset: FRACTAL_AI_EVOLUTION, defaultBpm: 128 },
};

export function getPresetEvolutionConfig(
  presetName: PresetName,
  durationSec?: number,
): PresetEvolutionConfig | null {
  const entry = presetEvolutionMap[presetName] ?? {
    preset: GENERIC_AI_EVOLUTION,
    defaultBpm: 128,
  };
  return {
    preset: entry.preset,
    defaultSections: createDefaultEvolutionSections(durationSec),
    defaultBpm: entry.defaultBpm,
  };
}


export const imageFilters = [
  { name: "None", id: "none" },
  { name: "Kaleidoscope", id: "kaleidoscope" },
  { name: "Mirror Fractal", id: "mirror" },
  { name: "Color Shift", id: "colorshift" },
  { name: "Invert Pulse", id: "invert" },
  { name: "Pixelate", id: "pixelate" },
  { name: "RGB Split", id: "rgbsplit" },
  { name: "Wave Distort", id: "wave" },
  { name: "Zoom Pulse", id: "zoompulse" },
] as const;

export type ImageFilterId = typeof imageFilters[number]["id"];

export const psyOverlays = [
  { name: "Blue Tunnel", id: "blueTunnel" },
  { name: "BW Vortex", id: "bwVortex" },
  { name: "Rainbow Spiral", id: "rainbowSpiral" },
  { name: "Red Mandala", id: "redMandala" },
] as const;

export type PsyOverlayId = typeof psyOverlays[number]["id"];
