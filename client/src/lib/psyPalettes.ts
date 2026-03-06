// IQ Cosine Palette System
// vec3 palette(float t) = a + b * cos(6.28318 * (c * t + d))
// Each palette is 4 vec3s: [a, b, c, d]

export interface PsyPalette {
  id: string;
  name: string;
  a: [number, number, number];
  b: [number, number, number];
  c: [number, number, number];
  d: [number, number, number];
}

export const psyPalettes: PsyPalette[] = [
  {
    id: "dmt-hyperspace",
    name: "DMT Hyperspace",
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 1.0, 1.0],
    d: [0.0, 0.33, 0.67],
  },
  {
    id: "mushroom-forest",
    name: "Mushroom Forest",
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 0.7, 0.4],
    d: [0.0, 0.15, 0.20],
  },
  {
    id: "cosmic-nebula",
    name: "Cosmic Nebula",
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [2.0, 1.0, 0.0],
    d: [0.5, 0.2, 0.25],
  },
  {
    id: "uv-blacklight",
    name: "UV Blacklight",
    a: [0.15, 0.0, 0.3],
    b: [0.5, 0.3, 0.7],
    c: [1.0, 1.0, 1.0],
    d: [0.6, 0.2, 0.0],
  },
  {
    id: "sacred-gold",
    name: "Sacred Gold",
    a: [0.5, 0.4, 0.2],
    b: [0.5, 0.3, 0.2],
    c: [1.0, 0.8, 0.5],
    d: [0.0, 0.05, 0.1],
  },
  {
    id: "acid-neon",
    name: "Acid Neon",
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [1.0, 1.0, 0.5],
    d: [0.8, 0.9, 0.3],
  },
  {
    id: "deep-ocean",
    name: "Deep Ocean",
    a: [0.0, 0.2, 0.4],
    b: [0.3, 0.4, 0.5],
    c: [1.0, 1.0, 1.0],
    d: [0.0, 0.1, 0.2],
  },
  {
    id: "fire-serpent",
    name: "Fire Serpent",
    a: [0.5, 0.2, 0.0],
    b: [0.5, 0.3, 0.2],
    c: [1.0, 1.0, 1.0],
    d: [0.0, 0.1, 0.2],
  },
  {
    id: "aurora-borealis",
    name: "Aurora Borealis",
    a: [0.2, 0.5, 0.3],
    b: [0.3, 0.5, 0.5],
    c: [1.0, 1.0, 0.5],
    d: [0.0, 0.3, 0.6],
  },
  {
    id: "alien-blood",
    name: "Alien Blood",
    a: [0.5, 0.5, 0.5],
    b: [0.5, 0.5, 0.5],
    c: [2.0, 1.0, 1.0],
    d: [0.0, 0.25, 0.5],
  },
  {
    id: "crystal-cave",
    name: "Crystal Cave",
    a: [0.3, 0.3, 0.5],
    b: [0.4, 0.4, 0.5],
    c: [1.0, 1.0, 0.5],
    d: [0.1, 0.2, 0.3],
  },
  {
    id: "psilocybin-sunset",
    name: "Psilocybin Sunset",
    a: [0.8, 0.3, 0.2],
    b: [0.2, 0.5, 0.5],
    c: [2.0, 1.0, 1.0],
    d: [0.0, 0.15, 0.35],
  },
];

// Generate GLSL uniform declarations for a palette
export function paletteToGLSLUniforms(palette: PsyPalette) {
  return {
    uPalA: { value: palette.a },
    uPalB: { value: palette.b },
    uPalC: { value: palette.c },
    uPalD: { value: palette.d },
  };
}

// GLSL function string to include in shaders
export const PALETTE_GLSL = /* glsl */ `
  uniform vec3 uPalA;
  uniform vec3 uPalB;
  uniform vec3 uPalC;
  uniform vec3 uPalD;

  vec3 iqPalette(float t) {
    return uPalA + uPalB * cos(6.28318 * (uPalC * t + uPalD));
  }
`;
