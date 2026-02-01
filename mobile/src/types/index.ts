export interface Track {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string | null;
  durationMs: number;
  streamUrl: string | null;
  source: 'soundcloud';
  sourceId: string;
}

export interface User {
  id: string;
  username: string;
  avatarUrl: string | null;
  fullName: string;
}

export interface AudioBands {
  sub: number;
  bass: number;
  mid: number;
  high: number;
  kick: number;
  energy: number;
}

export interface PlaybackState {
  track: Track | null;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  volume: number;
}

export interface GyroscopeData {
  x: number;
  y: number;
  z: number;
}

export type VisualPreset = 
  | 'energy-rings'
  | 'psy-tunnel'
  | 'particle-field'
  | 'waveform-sphere'
  | 'audio-bars'
  | 'geometric-kaleidoscope'
  | 'cosmic-web'
  | 'cymatic-sand'
  | 'water-membrane'
  | 'chladni'
  | 'resonant-field';

export interface VisualizerSettings {
  preset: VisualPreset;
  intensity: number;
  speed: number;
  colorPalette: string[];
}
