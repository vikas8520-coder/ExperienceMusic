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
};

export function isMilkdropPreset(name: string): boolean {
  return name.startsWith("MilkDrop:");
}

export function resolveButterchurnPresetKey(uiName: string): string | undefined {
  return MILKDROP_PRESET_MAP[uiName];
}
