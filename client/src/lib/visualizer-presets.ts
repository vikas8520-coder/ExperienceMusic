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
] as const;

export type PresetName = typeof presets[number];
