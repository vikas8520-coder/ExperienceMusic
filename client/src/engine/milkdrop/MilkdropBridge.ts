import type { AudioData } from "@/hooks/use-audio-analyzer";

/**
 * Converts AudioData from our analyzer into the format expected by Butterchurn.
 * Butterchurn's AudioProcessor uses fftSize=1024 (numSamps=512, fftSize=numSamps*2).
 * The `render({ audioLevels })` API expects timeByteArray / timeByteArrayL / timeByteArrayR
 * as Uint8Array(1024) with unsigned time-domain samples (0-255, 128=silence).
 */
export function convertAudioForButterchurn(audioData: AudioData): {
  frequencyData: Uint8Array;
  waveformData: Uint8Array;
} {
  const FFT_SIZE = 1024;
  const freqData = audioData.frequencyData;

  // Resample frequency data to 512 bins
  let frequencyData: Uint8Array;
  if (freqData.length > 0) {
    frequencyData = new Uint8Array(512);
    const ratio = freqData.length / 512;
    for (let i = 0; i < 512; i++) {
      const srcIdx = Math.floor(i * ratio);
      frequencyData[i] = freqData[Math.min(srcIdx, freqData.length - 1)];
    }
  } else {
    frequencyData = new Uint8Array(512);
  }

  // Generate a synthetic waveform (1024 samples, unsigned 0-255, 128=center)
  const waveformData = new Uint8Array(FFT_SIZE);
  const bass = audioData.bass * 255;
  const mid = audioData.mid * 255;
  const high = audioData.high * 255;
  for (let i = 0; i < FFT_SIZE; i++) {
    const t = i / FFT_SIZE;
    const wave =
      128 +
      bass * 0.3 * Math.sin(t * Math.PI * 2) +
      mid * 0.2 * Math.sin(t * Math.PI * 6) +
      high * 0.1 * Math.sin(t * Math.PI * 14);
    waveformData[i] = Math.max(0, Math.min(255, Math.round(wave)));
  }

  return { frequencyData, waveformData };
}

/**
 * Curated MilkDrop preset names from butterchurn-presets.
 * These are known to look good and perform well on WebGL.
 */
export const MILKDROP_PRESET_NAMES = [
  "Flexi - smashing fractals [acid etching mix]",
  "Geiss - Reaction Diffusion 2",
  "Cope - The Neverending Explosion of Red Liquid Fire",
  "Phat+fiShbRaiN+Eo.S_Mandala_Chasers_remix",
  "flexi - patternton, district of media, capitol of the united abstractions of fractopia",
  "Rovastar + Loadus + Geiss - FractalDrop (Triple Mix)",
  "Flexi - mindblob [shiny mix]",
  "Geiss - Spiral Artifact",
  "Flexi - predator-prey-spirals",
  "Flexi - infused with the spiral",
  "Flexi - alien fish pond",
  "Flexi - area 51",
  "Geiss - Cauldron - painterly 2 (saturation remix)",
  "Geiss - Thumb Drum",
  "Rovastar - Oozing Resistance",
  "Unchained - Rewop",
  "Unchained - Unified Drag 2",
  "martin - castle in the air",
  "martin - disco mix 4",
  "martin - witchcraft reloaded",
  "martin - mandelbox explorer - high speed demo version",
  "martin - extreme heat",
  "Geiss - Tokamak Plus 3",
  "ShadowHarlequin - mashup - Satin Sunburst (Neon Tokyo Megamix) v1",
  "Flexi - molten neon fire spirit",
  "flexi + fishbrain - neon mindblob grafitti",
  "Flexi - gold plated maelstrom of chaos",
  "martin - golden mirror",
  "martin + flexi - diamond cutter [prismaticvortex.com] - camille - i wish i wish i wish i was constrained",
  "Geiss - Cosmic Dust 2",
  "Geiss - Reaction Diffusion 3",
  "Geiss - Aurora 2",
  "Geiss - Cosmic Dust 2 - Trails 7",
  "Goody - Aurora Totalis",
  "Rovastar - Cosmic Echoes 2",
  "martin - mandelbulb slideshow",
  "Flexi - working with infinity",
  "flexi - fractal descent",
  "Flexi - reality tunnel",
  "Flexi - smashing fractals 2.0",
  "Flexi - intensive shader fractal",
  "Flexi - Julia fractal",
  "martin + flexi - mandelbox explorer - high speed oversustained bipolar",
  "martin - elusive impressions mix2 - flacc mess proph nz+2",
  "ORB - Magma Pool",
] as const;

export type MilkdropPresetName = typeof MILKDROP_PRESET_NAMES[number];

/**
 * Maps UI-facing preset names to Butterchurn preset keys.
 */
export const MILKDROP_PRESET_MAP: Record<string, string> = {
  "MilkDrop: Bass Kicks": "Flexi - smashing fractals [acid etching mix]",
  "MilkDrop: Cosmic Dust": "Geiss - Reaction Diffusion 2",
  "MilkDrop: Drain to Heaven": "Cope - The Neverending Explosion of Red Liquid Fire",
  "MilkDrop: Chasers": "Phat+fiShbRaiN+Eo.S_Mandala_Chasers_remix",
  "MilkDrop: Fractopia": "flexi - patternton, district of media, capitol of the united abstractions of fractopia",
  "MilkDrop: Mandelbox": "martin - mandelbox explorer - high speed demo version",
  "MilkDrop: Extreme Heat": "martin - extreme heat",
  "MilkDrop: Tokamak": "Geiss - Tokamak Plus 3",
  "MilkDrop: Neon Tokyo": "ShadowHarlequin - mashup - Satin Sunburst (Neon Tokyo Megamix) v1",
  "MilkDrop: Neon Fire": "Flexi - molten neon fire spirit",
  "MilkDrop: Neon Grafitti": "flexi + fishbrain - neon mindblob grafitti",
  "MilkDrop: Gold Maelstrom": "Flexi - gold plated maelstrom of chaos",
  "MilkDrop: Golden Mirror": "martin - golden mirror",
  "MilkDrop: Diamond Cutter": "martin + flexi - diamond cutter [prismaticvortex.com] - camille - i wish i wish i wish i was constrained",
  "MilkDrop: Cosmic Dust II": "Geiss - Cosmic Dust 2",
  "MilkDrop: Reaction Diffusion": "Geiss - Reaction Diffusion 3",
  "MilkDrop: Aurora": "Geiss - Aurora 2",
  "MilkDrop: Cosmic Trails": "Geiss - Cosmic Dust 2 - Trails 7",
  "MilkDrop: Aurora Totalis": "Goody - Aurora Totalis",
  "MilkDrop: Cosmic Echoes": "Rovastar - Cosmic Echoes 2",
  "MilkDrop: Mandelbulb": "martin - mandelbulb slideshow",
  "MilkDrop: Infinity": "Flexi - working with infinity",
  "MilkDrop: Fractal Descent": "flexi - fractal descent",
  "MilkDrop: Reality Tunnel": "Flexi - reality tunnel",
  "MilkDrop: Smashing Fractals": "Flexi - smashing fractals 2.0",
  "MilkDrop: Shader Fractal": "Flexi - intensive shader fractal",
  "MilkDrop: Julia Fractal": "Flexi - Julia fractal",
  "MilkDrop: Mandelbox Bipolar": "martin + flexi - mandelbox explorer - high speed oversustained bipolar",
  "MilkDrop: Elusive Impressions": "martin - elusive impressions mix2 - flacc mess proph nz+2",
  "MilkDrop: Magma Pool": "ORB - Magma Pool",
};

export function isMilkdropPreset(name: string): boolean {
  return name.startsWith("MilkDrop:");
}

export function resolveButterchurnPresetKey(uiName: string): string | undefined {
  return MILKDROP_PRESET_MAP[uiName];
}
