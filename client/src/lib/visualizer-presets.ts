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
  "Particle Field",
  "Waveform Sphere",
  "Audio Bars",
  "Geometric Kaleidoscope",
  "Cosmic Web",
  "Cymatic Sand Plate",
  "Water Membrane Orb",
  "Chladni Geometry",
  "Resonant Field Lines",
  "Mandelbrot Explorer",
  "Julia Orbit Trap",
] as const;

export type PresetName = typeof presets[number];

// Categorized presets for UI display
export const presetCategories = [
  {
    name: "Base",
    presets: [
      { name: "Energy Rings" as PresetName, icon: "rings", shortName: "Rings" },
      { name: "Psy Tunnel" as PresetName, icon: "tunnel", shortName: "Tunnel" },
      { name: "Particle Field" as PresetName, icon: "particles", shortName: "Particles" },
      { name: "Waveform Sphere" as PresetName, icon: "sphere", shortName: "Sphere" },
      { name: "Audio Bars" as PresetName, icon: "bars", shortName: "Bars" },
      { name: "Geometric Kaleidoscope" as PresetName, icon: "kaleidoscope", shortName: "Kaleid" },
      { name: "Cosmic Web" as PresetName, icon: "web", shortName: "Web" },
    ],
  },
  {
    name: "Cymatics",
    presets: [
      { name: "Cymatic Sand Plate" as PresetName, icon: "sand", shortName: "Sand" },
      { name: "Water Membrane Orb" as PresetName, icon: "water", shortName: "Water" },
      { name: "Chladni Geometry" as PresetName, icon: "geometry", shortName: "Chladni" },
      { name: "Resonant Field Lines" as PresetName, icon: "field", shortName: "Field" },
    ],
  },
  {
    name: "Fractals",
    presets: [
      { name: "Mandelbrot Explorer" as PresetName, icon: "mandelbrot", shortName: "Mandelbrot" },
      { name: "Julia Orbit Trap" as PresetName, icon: "juliaorbittrap", shortName: "Orbit Trap" },
    ],
  },
] as const;


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
