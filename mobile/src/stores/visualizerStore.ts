import { create } from 'zustand';
import type { VisualPreset, AudioBands, VisualizerSettings } from '@/types';

const DEFAULT_PALETTE = ['#ff006e', '#8338ec', '#3a86ff', '#06ffa5', '#ffbe0b'];

interface VisualizerStore {
  settings: VisualizerSettings;
  audioBands: AudioBands;
  setPreset: (preset: VisualPreset) => void;
  setIntensity: (intensity: number) => void;
  setSpeed: (speed: number) => void;
  setColorPalette: (palette: string[]) => void;
  updateAudioBands: (bands: Partial<AudioBands>) => void;
}

export const useVisualizerStore = create<VisualizerStore>((set) => ({
  settings: {
    preset: 'energy-rings',
    intensity: 0.7,
    speed: 1.0,
    colorPalette: DEFAULT_PALETTE,
  },
  audioBands: {
    sub: 0,
    bass: 0,
    mid: 0,
    high: 0,
    kick: 0,
    energy: 0,
  },

  setPreset: (preset: VisualPreset) => 
    set((state) => ({ settings: { ...state.settings, preset } })),

  setIntensity: (intensity: number) =>
    set((state) => ({ settings: { ...state.settings, intensity: Math.max(0, Math.min(1, intensity)) } })),

  setSpeed: (speed: number) =>
    set((state) => ({ settings: { ...state.settings, speed: Math.max(0.1, Math.min(3, speed)) } })),

  setColorPalette: (colorPalette: string[]) =>
    set((state) => ({ settings: { ...state.settings, colorPalette } })),

  updateAudioBands: (bands: Partial<AudioBands>) =>
    set((state) => ({ audioBands: { ...state.audioBands, ...bands } })),
}));
