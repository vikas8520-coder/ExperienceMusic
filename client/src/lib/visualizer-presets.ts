export const colorPalettes = [
  { name: "Neon Cyber", colors: ["#ff00ff", "#00ffff", "#ff0080", "#aa00ff"] },
  { name: "Sunset Synth", colors: ["#ff9900", "#ff0055", "#6600cc", "#0000ff"] },
  { name: "Toxic Sludge", colors: ["#39ff14", "#ccff00", "#008000", "#003300"] },
  { name: "Ice Realm", colors: ["#e0ffff", "#00ffff", "#0080ff", "#000080"] },
  { name: "Void Fire", colors: ["#ff3300", "#ff0000", "#660000", "#1a0000"] },
];

export const presets = [
  "Energy Rings",
  "Psy Tunnel",
  "Particle Field"
] as const;

export type PresetName = typeof presets[number];
