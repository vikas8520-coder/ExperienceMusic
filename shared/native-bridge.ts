import { z } from "zod";

export const TrackMessageSchema = z.object({
  type: z.literal("track"),
  source: z.enum(["spotify", "soundcloud", "applemusic", "local"]),
  title: z.string(),
  artist: z.string(),
  artworkUrl: z.string().optional(),
  durationMs: z.number(),
  trackId: z.string().optional(),
  albumName: z.string().optional(),
});

export const PlaybackMessageSchema = z.object({
  type: z.literal("playback"),
  isPlaying: z.boolean(),
  positionMs: z.number(),
  volume: z.number().min(0).max(1).optional(),
});

export const BandsMessageSchema = z.object({
  type: z.literal("bands"),
  sub: z.number().min(0).max(1).optional(),
  bass: z.number().min(0).max(1),
  mid: z.number().min(0).max(1),
  high: z.number().min(0).max(1),
  kick: z.number().min(0).max(1).optional(),
  energy: z.number().min(0).max(1).optional(),
  dominantFreq: z.number().optional(),
  modeIndex: z.number().optional(),
});

export const PresetMessageSchema = z.object({
  type: z.literal("preset"),
  presetName: z.string(),
  intensity: z.number().min(0).max(2).optional(),
  speed: z.number().min(0).max(3).optional(),
  trailsOn: z.boolean().optional(),
  trailsAmount: z.number().min(0).max(1).optional(),
  colorPalette: z.array(z.string()).optional(),
});

export const ControlMessageSchema = z.object({
  type: z.literal("control"),
  action: z.enum(["play", "pause", "stop", "seek", "setVolume", "nextPreset", "prevPreset"]),
  value: z.number().optional(),
});

export const NativeMessageSchema = z.discriminatedUnion("type", [
  TrackMessageSchema,
  PlaybackMessageSchema,
  BandsMessageSchema,
  PresetMessageSchema,
  ControlMessageSchema,
]);

export type TrackMessage = z.infer<typeof TrackMessageSchema>;
export type PlaybackMessage = z.infer<typeof PlaybackMessageSchema>;
export type BandsMessage = z.infer<typeof BandsMessageSchema>;
export type PresetMessage = z.infer<typeof PresetMessageSchema>;
export type ControlMessage = z.infer<typeof ControlMessageSchema>;
export type NativeMessage = z.infer<typeof NativeMessageSchema>;

export function createTrackMessage(data: Omit<TrackMessage, "type">): TrackMessage {
  return { type: "track", ...data };
}

export function createPlaybackMessage(data: Omit<PlaybackMessage, "type">): PlaybackMessage {
  return { type: "playback", ...data };
}

export function createBandsMessage(data: Omit<BandsMessage, "type">): BandsMessage {
  return { type: "bands", ...data };
}

export function createPresetMessage(data: Omit<PresetMessage, "type">): PresetMessage {
  return { type: "preset", ...data };
}

export function createControlMessage(data: Omit<ControlMessage, "type">): ControlMessage {
  return { type: "control", ...data };
}

export function parseNativeMessage(jsonString: string): NativeMessage | null {
  try {
    const data = JSON.parse(jsonString);
    return NativeMessageSchema.parse(data);
  } catch (error) {
    console.error("Failed to parse native message:", error);
    return null;
  }
}

export function serializeMessage(message: NativeMessage): string {
  return JSON.stringify(message);
}

export const AUDIO_BAND_RANGES = {
  sub: { min: 20, max: 60, description: "Sub bass - slow heavy motion" },
  bass: { min: 60, max: 250, description: "Bass - bloom, breathing, zoom" },
  mid: { min: 250, max: 2000, description: "Mid - rotation, shape, density" },
  high: { min: 2000, max: 12000, description: "High - sparkles, glitch, aberration" },
} as const;

export const PRESET_NAMES = [
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
  "Blue Tunnel",
  "BW Vortex",
  "Rainbow Spiral",
  "Red Mandala",
] as const;

export const SOURCE_NAMES = ["spotify", "soundcloud", "applemusic", "local"] as const;
