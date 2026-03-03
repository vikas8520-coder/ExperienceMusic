import type { AudioData } from "@/hooks/use-audio-analyzer";

/**
 * Converts AudioData from our analyzer into the format expected by Butterchurn.
 * Butterchurn expects a Uint8Array of 512 frequency bins (0-255).
 */
export function convertAudioForButterchurn(audioData: AudioData): {
  frequencyData: Uint8Array;
  waveformData: Uint8Array;
} {
  const freqData = audioData.frequencyData;

  // If we have real frequency data, resample to 512 bins
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

  // Generate a synthetic waveform from the audio bands
  const waveformData = new Uint8Array(512);
  const bass = audioData.bass * 255;
  const mid = audioData.mid * 255;
  const high = audioData.high * 255;
  for (let i = 0; i < 512; i++) {
    const t = i / 512;
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
  "Flexi - when the bass kicks in",
  "Geiss - Cosmic Dust 2 - Gravity Mix",
  "Cope - The Drain to Heaven",
  "Eo.S. + Phat - chasers 19",
  "Rovastar - Fractopia (Crazed Spiral Mix)",
  "Rovastar - Altars Of Madness 3",
  "Martin - liquid fast",
  "Flexi - mindblob [shiny mix]",
  "Zylot - Azurite (Hyperion Mix)",
  "Cope + Martin - Tunnel of Synth",
  "Geiss - Swirl 1",
  "Rovastar - Sunflower Passion",
  "fiShbRaiN - Cthulhu Rising",
  "Phat - Rainbow Sperm",
  "Geiss - Spiral Artifact",
  "Martin - disco mix 3",
  "Unchained - Morat's Final Trainer",
  "Rovastar - Cosmic Echoes 3",
  "Flexi - predator-prey ecosystem",
  "Cope - Vertigo (Stare Mix)",
] as const;

export type MilkdropPresetName = typeof MILKDROP_PRESET_NAMES[number];
