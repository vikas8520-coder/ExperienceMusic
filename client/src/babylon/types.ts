import type { AudioData } from "@/hooks/use-audio-analyzer";

export type PresetBlend = {
  intensity: number;
  morph: number;
};

export type BabylonPresetRuntime = {
  update: (audio: AudioData, dt: number, blend: PresetBlend) => void;
  dispose: () => void;
};

export type BabylonPresetCreateArgs = {
  scene: unknown;
};

export type BabylonPresetDefinition = {
  id: string;
  name: string;
  create: (args: BabylonPresetCreateArgs) => BabylonPresetRuntime;
  update?: () => void;
};
