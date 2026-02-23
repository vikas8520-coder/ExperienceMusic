import type { BabylonPresetDefinition } from "./types";
import { createAudioBarsPreset } from "./presets/AudioBars_BJS";
import { createCosmicWebPreset } from "./presets/CosmicWeb_BJS";
import { createCymaticSandPlatePreset } from "./presets/CymaticSandPlate_BJS";
import { createEnergyRingsPreset } from "./presets/EnergyRings_BJS";
import { createGeometricKaleidoscopePreset } from "./presets/GeometricKaleidoscope_BJS";
import { createParticleFieldPreset } from "./presets/ParticleField_BJS";
import { createPsyBowlPreset } from "./presets/PsyBowl_BJS";
import { createPsyExtraPreset } from "./presets/PsyExtra_BJS";
import { createRitualTapestryV3Preset } from "./presets/RitualTapestryV3_BJS";
import { createWaterMembraneOrbV2Preset } from "./presets/WaterMembraneOrbV2_BJS";
import { createWaveformSpherePreset } from "./presets/WaveformSphere_BJS";

export const BABYLON_PRESETS: Record<string, BabylonPresetDefinition> = {
  "Energy Rings (Babylon)": {
    id: "energy-rings",
    name: "Energy Rings (Babylon)",
    create: ({ scene }) => createEnergyRingsPreset(scene, { enableGlow: true }),
  },
  "Psy Tunnel (Babylon)": {
    id: "psy-tunnel",
    name: "Psy Tunnel (Babylon)",
    create: ({ scene }) => createPsyBowlPreset(scene, { enableGlow: true }),
  },
  "Psy Extra (Babylon)": {
    id: "psy-extra",
    name: "Psy Extra (Babylon)",
    create: ({ scene }) => createPsyExtraPreset(scene, { enableGlow: true }),
  },
  "Particle Field (Babylon)": {
    id: "particle-field",
    name: "Particle Field (Babylon)",
    create: ({ scene }) => createParticleFieldPreset(scene, { enableGlow: true }),
  },
  "Waveform Sphere (Babylon)": {
    id: "waveform-sphere",
    name: "Waveform Sphere (Babylon)",
    create: ({ scene }) => createWaveformSpherePreset(scene, { enableGlow: true }),
  },
  "Audio Bars (Babylon)": {
    id: "audio-bars",
    name: "Audio Bars (Babylon)",
    create: ({ scene }) => createAudioBarsPreset(scene),
  },
  "Geometric Kaleidoscope (Babylon)": {
    id: "geometric-kaleidoscope",
    name: "Geometric Kaleidoscope (Babylon)",
    create: ({ scene }) => createGeometricKaleidoscopePreset(scene, { enableGlow: true, heavyEdges: true }),
  },
  "Cosmic Web (Babylon)": {
    id: "cosmic-web",
    name: "Cosmic Web (Babylon)",
    create: ({ scene }) => createCosmicWebPreset(scene, { enableGlow: true }),
  },
  "Cymatic Sand Plate (Babylon)": {
    id: "cymatic-sand-plate",
    name: "Cymatic Sand Plate (Babylon)",
    create: ({ scene }) => createCymaticSandPlatePreset(scene, {
      enableGlow: true,
      heavyEdges: true,
      controlCamera: true,
    }),
  },
  "Water Membrane Orb (Babylon)": {
    id: "water-membrane-orb",
    name: "Water Membrane Orb (Babylon)",
    create: ({ scene }) => createWaterMembraneOrbV2Preset(scene, {
      enableGlow: true,
      heavyEdges: true,
    }),
  },
  "Ritual Tapestry (Babylon)": {
    id: "ritual-tapestry",
    name: "Ritual Tapestry (Babylon)",
    create: ({ scene }) => createRitualTapestryV3Preset(scene, {
      enableGlow: true,
      heavyEdges: true,
    }),
  },
  "Ritual Tapestry V3 (Babylon)": {
    id: "ritual-tapestry-v3",
    name: "Ritual Tapestry V3 (Babylon)",
    create: ({ scene }) => createRitualTapestryV3Preset(scene, {
      enableGlow: true,
      heavyEdges: true,
    }),
  },
};

export function hasBabylonPreset(presetName: string): boolean {
  return Object.prototype.hasOwnProperty.call(BABYLON_PRESETS, presetName);
}
