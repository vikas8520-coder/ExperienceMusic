import { describe, it, expect } from "vitest";
import { parseISF, isfInputsToUniformSpecs, createISFPreset } from "@/engine/presets/ISFAdapter";

const SAMPLE_ISF = `/*
{
  "DESCRIPTION": "Test Shader",
  "CREDIT": "Test Author",
  "INPUTS": [
    { "NAME": "brightness", "TYPE": "float", "DEFAULT": 0.5, "MIN": 0.0, "MAX": 1.0 },
    { "NAME": "enabled", "TYPE": "bool", "DEFAULT": true },
    { "NAME": "tint", "TYPE": "color", "DEFAULT": [1.0, 0.0, 0.0, 1.0] },
    { "NAME": "inputImage", "TYPE": "image" }
  ]
}
*/
void main() {
  gl_FragColor = vec4(1.0);
}`;

describe("ISF Parser", () => {
  it("parses ISF header correctly", () => {
    const result = parseISF(SAMPLE_ISF);
    expect(result.header.DESCRIPTION).toBe("Test Shader");
    expect(result.header.CREDIT).toBe("Test Author");
    expect(result.header.INPUTS).toHaveLength(4);
  });

  it("extracts GLSL body", () => {
    const result = parseISF(SAMPLE_ISF);
    expect(result.glslBody).toContain("void main()");
    expect(result.glslBody).toContain("gl_FragColor");
  });

  it("throws on missing header", () => {
    expect(() => parseISF("void main() {}")).toThrow("No ISF JSON header found");
  });

  it("throws on invalid JSON header", () => {
    expect(() => parseISF("/* { invalid json } */\nvoid main() {}")).toThrow("Invalid ISF JSON header");
  });

  it("throws on empty GLSL body", () => {
    expect(() => parseISF('/* { "DESCRIPTION": "empty" } */')).toThrow("No GLSL body found");
  });
});

describe("ISF Input Mapping", () => {
  it("maps float inputs to slider UniformSpec", () => {
    const specs = isfInputsToUniformSpecs([
      { NAME: "brightness", TYPE: "float", DEFAULT: 0.5, MIN: 0.0, MAX: 1.0 },
    ]);

    expect(specs).toHaveLength(1);
    expect(specs[0].type).toBe("float");
    expect(specs[0].key).toBe("u_brightness");
    expect(specs[0].default).toBe(0.5);
    expect(specs[0].min).toBe(0);
    expect(specs[0].max).toBe(1);
  });

  it("maps bool inputs to toggle", () => {
    const specs = isfInputsToUniformSpecs([
      { NAME: "enabled", TYPE: "bool", DEFAULT: true },
    ]);

    expect(specs).toHaveLength(1);
    expect(specs[0].type).toBe("bool");
    expect(specs[0].default).toBe(true);
  });

  it("maps color inputs", () => {
    const specs = isfInputsToUniformSpecs([
      { NAME: "tint", TYPE: "color" },
    ]);

    expect(specs).toHaveLength(1);
    expect(specs[0].type).toBe("color");
  });

  it("skips image inputs", () => {
    const specs = isfInputsToUniformSpecs([
      { NAME: "inputImage", TYPE: "image" },
    ]);

    expect(specs).toHaveLength(0);
  });

  it("skips audio/audioFFT inputs", () => {
    const specs = isfInputsToUniformSpecs([
      { NAME: "audioFFT", TYPE: "audioFFT" },
      { NAME: "audio", TYPE: "audio" },
    ]);

    expect(specs).toHaveLength(0);
  });
});

describe("ISF Preset Creation", () => {
  it("creates a valid FractalPreset", () => {
    const preset = createISFPreset(SAMPLE_ISF);

    expect(preset.id).toContain("isf-");
    expect(preset.name).toBe("Test Shader");
    expect(preset.kind).toBe("shader2d");
    expect(typeof preset.init).toBe("function");
    expect(typeof preset.update).toBe("function");
    expect(typeof preset.dispose).toBe("function");
  });

  it("uniform specs exclude image inputs", () => {
    const preset = createISFPreset(SAMPLE_ISF);
    // Should have brightness, enabled, tint (not inputImage)
    expect(preset.uniformSpecs).toHaveLength(3);
  });
});
