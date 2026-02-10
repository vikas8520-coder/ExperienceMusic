export type AudioFeatures = {
  rms: number;
  bass: number;
  mid: number;
  treble: number;
  beat: number;
  spectrum?: Float32Array;
};

export type PresetContext = {
  now: number;
  dt: number;
  width: number;
  height: number;
  dpr: number;
  quality: "low" | "med" | "high";
  isMobile: boolean;
};

export type UniformType =
  | "float"
  | "int"
  | "bool"
  | "vec2"
  | "vec3"
  | "vec4"
  | "color";

export type UniformSpec = {
  key: string;
  label: string;
  type: UniformType;

  min?: number;
  max?: number;
  step?: number;

  options?: { label: string; value: any }[];
  group?: "Fractal" | "Color" | "Motion" | "Audio" | "Quality" | "Overlay" | "Julia" | "Effects" | "Camera" | "Material" | "Lighting";

  default: any;
  macro?: boolean;

  visibleIf?: (uniforms: Record<string, any>) => boolean;
  transform?: (v: any) => any;
};

export type UniformValues = Record<string, any>;

export interface FractalPreset {
  id: string;
  name: string;
  category:
    | "Fractals/Complex"
    | "Fractals/Geometry"
    | "Fractals/3D"
    | "Fractals/Noise";

  kind: "shader2d" | "geometry" | "raymarch3d";

  uniformSpecs: UniformSpec[];

  init(ctx: PresetContext): Promise<void> | void;
  update(args: {
    ctx: PresetContext;
    audio: AudioFeatures;
    uniforms: UniformValues;
    state: any;
  }): void;
  dispose(ctx: PresetContext): void;

  Render?: React.FC<{ uniforms: UniformValues; state: any }>;
}
