import type { FractalPreset, UniformSpec, UniformType, PresetContext, UniformValues } from "./types";

export interface ISFInput {
  NAME: string;
  TYPE: string;
  DEFAULT?: number | boolean | number[];
  MIN?: number;
  MAX?: number;
  LABEL?: string;
}

export interface ISFHeader {
  DESCRIPTION?: string;
  CREDIT?: string;
  INPUTS?: ISFInput[];
  PASSES?: unknown[];
  CATEGORIES?: string[];
}

export interface ISFParseResult {
  header: ISFHeader;
  glslBody: string;
}

export function parseISF(source: string): ISFParseResult {
  // ISF format: /* { JSON } */ followed by GLSL
  const headerMatch = source.match(/\/\*\s*(\{[\s\S]*?\})\s*\*\//);
  if (!headerMatch) {
    throw new Error("No ISF JSON header found. Expected /* { ... } */ at the start of the file.");
  }

  let header: ISFHeader;
  try {
    header = JSON.parse(headerMatch[1]);
  } catch (e) {
    throw new Error(`Invalid ISF JSON header: ${(e as Error).message}`);
  }

  const glslBody = source.slice(headerMatch.index! + headerMatch[0].length).trim();
  if (!glslBody) {
    throw new Error("No GLSL body found after ISF header.");
  }

  return { header, glslBody };
}

function isfTypeToUniformType(isfType: string): UniformType | null {
  switch (isfType.toLowerCase()) {
    case "float": return "float";
    case "bool": return "bool";
    case "color": return "color";
    case "long": case "int": return "int";
    case "point2d": return "vec2";
    case "image": return null; // skip image inputs
    case "audio": case "audiofft": return null; // mapped to our audio system
    default: return null;
  }
}

export function isfInputsToUniformSpecs(inputs: ISFInput[]): UniformSpec[] {
  const specs: UniformSpec[] = [];
  for (const input of inputs) {
    const type = isfTypeToUniformType(input.TYPE);
    if (!type) continue;

    const spec: UniformSpec = {
      key: `u_${input.NAME}`,
      label: input.LABEL || input.NAME,
      type,
      group: "Effects",
      default: input.DEFAULT ?? (type === "float" ? 0.5 : type === "bool" ? false : 0),
    };

    if (type === "float" || type === "int") {
      spec.min = input.MIN ?? 0;
      spec.max = input.MAX ?? 1;
      spec.step = type === "int" ? 1 : 0.01;
    }

    specs.push(spec);
  }
  return specs;
}

let isfCounter = 0;

export function createISFPreset(source: string): FractalPreset {
  const { header, glslBody } = parseISF(source);
  const inputs = header.INPUTS || [];
  const uniformSpecs = isfInputsToUniformSpecs(inputs);
  const id = `isf-${++isfCounter}-${(header.DESCRIPTION || "custom").slice(0, 20).replace(/\s+/g, "-").toLowerCase()}`;
  const name = header.DESCRIPTION || header.CREDIT || `ISF Shader ${isfCounter}`;

  return {
    id,
    name,
    category: "Fractals/Noise",
    kind: "shader2d",
    uniformSpecs,
    init() {},
    update({ audio, state }) {
      // Pass audio data to state for the Render component
      state.audioBass = audio.bass;
      state.audioMid = audio.mid;
      state.audioHigh = audio.treble;
      state.audioBeat = audio.beat;
      state.bpmSin1 = audio.bpmSin1;
    },
    dispose() {},
  };
}

// Dynamic ISF preset registry
const isfPresets = new Map<string, FractalPreset>();

export function registerISFPreset(source: string): { id: string; preset: FractalPreset } {
  const preset = createISFPreset(source);
  isfPresets.set(preset.id, preset);
  return { id: preset.id, preset };
}

export function unregisterISFPreset(id: string): boolean {
  return isfPresets.delete(id);
}

export function getISFPresets(): Map<string, FractalPreset> {
  return isfPresets;
}
