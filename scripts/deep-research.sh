#!/usr/bin/env bash
set -uo pipefail

# ExperienceMusic — Deep Research Bot
# Project-specific tech research for audio-reactive visuals
# Generates structured reports on trends, tools, and techniques

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

REPORT_DIR="research-reports"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
REPORT_FILE="${REPORT_DIR}/research-${TIMESTAMP}.md"

mkdir -p "$REPORT_DIR"

# ─── Header ──────────────────────────────────────────────────────────────────

echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  ExperienceMusic Deep Research Bot${NC}"
echo -e "${CYAN}  $(date '+%Y-%m-%d %H:%M')${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo

cat > "$REPORT_FILE" << 'HEADER'
# ExperienceMusic Deep Research Report
HEADER

echo "**Generated**: $(date '+%Y-%m-%d %H:%M')" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# ─── 1. Codebase Audit ──────────────────────────────────────────────────────

echo -e "${MAGENTA}[1/7] Codebase Audit${NC}"

# Count presets
preset_count=$(grep -c "name:" client/src/lib/visualizer-presets.ts 2>/dev/null || echo "0")
fractal_count=$(grep -c '":' client/src/engine/presets/registry.ts 2>/dev/null || echo "0")
shader_files=$(find client/src/engine -name "*.glsl" -o -name "*.frag" -o -name "*.vert" 2>/dev/null | wc -l | tr -d ' ')
component_count=$(find client/src/components -name "*.tsx" 2>/dev/null | wc -l | tr -d ' ')
hook_count=$(find client/src/hooks -name "*.ts" -o -name "*.tsx" 2>/dev/null | wc -l | tr -d ' ')
test_count=$(find client/src/__tests__ -name "*.test.*" 2>/dev/null | wc -l | tr -d ' ')

# Check for key features
has_bpm="no"; grep -q "bpm:" client/src/hooks/use-audio-analyzer.ts 2>/dev/null && has_bpm="yes"
has_isf="no"; test -f client/src/engine/presets/ISFAdapter.ts 2>/dev/null && has_isf="yes"
has_milkdrop="no"; test -d client/src/engine/milkdrop 2>/dev/null && has_milkdrop="yes"
has_virtualcam="no"; test -f client/src/lib/virtualCamera.ts 2>/dev/null && has_virtualcam="yes"
has_marketplace="no"; test -f client/src/components/PresetMarketplace.tsx 2>/dev/null && has_marketplace="yes"

echo -e "  ${GREEN}✓${NC} Presets: ~${preset_count} total, ${fractal_count} fractal"
echo -e "  ${GREEN}✓${NC} Shaders: ${shader_files} GLSL files"
echo -e "  ${GREEN}✓${NC} Components: ${component_count}, Hooks: ${hook_count}, Tests: ${test_count}"
echo -e "  ${GREEN}✓${NC} BPM tracking: ${has_bpm} | ISF: ${has_isf} | MilkDrop: ${has_milkdrop}"
echo -e "  ${GREEN}✓${NC} Virtual camera: ${has_virtualcam} | Marketplace: ${has_marketplace}"

{
  echo "## 1. Codebase Audit"
  echo ""
  echo "| Metric | Value |"
  echo "|--------|-------|"
  echo "| Total presets | ~${preset_count} |"
  echo "| Fractal presets | ${fractal_count} |"
  echo "| GLSL shader files | ${shader_files} |"
  echo "| React components | ${component_count} |"
  echo "| Custom hooks | ${hook_count} |"
  echo "| Test files | ${test_count} |"
  echo "| BPM tracking | ${has_bpm} |"
  echo "| ISF import | ${has_isf} |"
  echo "| MilkDrop/Butterchurn | ${has_milkdrop} |"
  echo "| Virtual camera | ${has_virtualcam} |"
  echo "| Preset marketplace | ${has_marketplace} |"
  echo ""
} >> "$REPORT_FILE"

echo

# ─── 2. Dependency Analysis ─────────────────────────────────────────────────

echo -e "${MAGENTA}[2/7] Dependency Analysis${NC}"

if [ -f package.json ]; then
  deps=$(node -e "const p=require('./package.json'); console.log(Object.keys(p.dependencies||{}).length)" 2>/dev/null || echo "?")
  dev_deps=$(node -e "const p=require('./package.json'); console.log(Object.keys(p.devDependencies||{}).length)" 2>/dev/null || echo "?")
  echo -e "  ${GREEN}✓${NC} Dependencies: ${deps} prod, ${dev_deps} dev"

  # Key audio/visual deps
  echo "" >> "$REPORT_FILE"
  echo "## 2. Dependency Analysis" >> "$REPORT_FILE"
  echo "" >> "$REPORT_FILE"
  echo "**Total**: ${deps} production, ${dev_deps} dev" >> "$REPORT_FILE"
  echo "" >> "$REPORT_FILE"
  echo "### Key Audio/Visual Libraries" >> "$REPORT_FILE"
  echo "" >> "$REPORT_FILE"

  for dep in "three" "@react-three/fiber" "@react-three/drei" "babylonjs" "@babylonjs/core" "tone" "butterchurn" "cmdk" "framer-motion" "zustand" "howler"; do
    version=$(node -e "const p=require('./package.json'); console.log((p.dependencies||{})['${dep}'] || (p.devDependencies||{})['${dep}'] || 'not installed')" 2>/dev/null || echo "unknown")
    if [ "$version" != "not installed" ]; then
      echo -e "  ${GREEN}✓${NC} ${dep}: ${version}"
      echo "- \`${dep}\`: ${version}" >> "$REPORT_FILE"
    else
      echo -e "  ${YELLOW}○${NC} ${dep}: not installed"
      echo "- \`${dep}\`: *not installed*" >> "$REPORT_FILE"
    fi
  done
else
  echo -e "  ${RED}✗${NC} package.json not found"
fi

echo

# ─── 3. Audio Analysis Capabilities ─────────────────────────────────────────

echo -e "${MAGENTA}[3/7] Audio Analysis Capabilities${NC}"

{
  echo ""
  echo "## 3. Audio Analysis Capabilities"
  echo ""
} >> "$REPORT_FILE"

analyzer_file="client/src/hooks/use-audio-analyzer.ts"
if [ -f "$analyzer_file" ]; then
  features=0

  for feature in "frequencyData" "waveformData" "bass" "mid" "high" "energy" "bpm" "beatPhase" "bpmSin" "bassHits" "bassPresence" "spectralCentroid" "spectralFlux" "onset"; do
    if grep -q "$feature" "$analyzer_file" 2>/dev/null; then
      echo -e "  ${GREEN}✓${NC} ${feature}"
      echo "- ${feature}: implemented" >> "$REPORT_FILE"
      features=$((features + 1))
    else
      echo -e "  ${YELLOW}○${NC} ${feature}: not found"
      echo "- ${feature}: *not implemented*" >> "$REPORT_FILE"
    fi
  done

  echo -e "  ${CYAN}→${NC} Total audio features: ${features}"
  echo "" >> "$REPORT_FILE"
  echo "**Total implemented**: ${features}" >> "$REPORT_FILE"
else
  echo -e "  ${RED}✗${NC} Audio analyzer not found"
fi

echo

# ─── 4. Shader / Rendering Tech ─────────────────────────────────────────────

echo -e "${MAGENTA}[4/7] Shader & Rendering Tech${NC}"

{
  echo ""
  echo "## 4. Shader & Rendering Technology"
  echo ""
} >> "$REPORT_FILE"

# Check WebGL vs WebGPU usage
webgl_refs=$(grep -r "WebGL\|webgl\|GL_\|gl\." client/src/engine/ --include="*.ts" --include="*.tsx" --include="*.glsl" 2>/dev/null | wc -l | tr -d ' ')
webgpu_refs=$(grep -r "WebGPU\|webgpu\|GPUDevice\|GPUBuffer" client/src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
echo -e "  ${GREEN}✓${NC} WebGL references: ${webgl_refs}"
echo -e "  ${GREEN}✓${NC} WebGPU references: ${webgpu_refs}"
echo "- WebGL references: ${webgl_refs}" >> "$REPORT_FILE"
echo "- WebGPU references: ${webgpu_refs}" >> "$REPORT_FILE"

# Shader types
frag_shaders=$(find client/src -name "*.frag" -o -name "*.glsl" 2>/dev/null | wc -l | tr -d ' ')
inline_shaders=$(grep -r "fragmentShader\|vertexShader\|shaderMaterial" client/src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
echo -e "  ${GREEN}✓${NC} Fragment/GLSL files: ${frag_shaders}"
echo -e "  ${GREEN}✓${NC} Inline shader refs: ${inline_shaders}"
echo "- Standalone shader files: ${frag_shaders}" >> "$REPORT_FILE"
echo "- Inline shader references: ${inline_shaders}" >> "$REPORT_FILE"

# Render techniques
for technique in "raymarching\|ray.march" "SDF\|signedDistance" "reaction.diffusion\|reactionDiffusion" "particle\|Particles" "instanced\|InstancedMesh" "postprocessing\|EffectComposer" "bloom\|Bloom" "feedback\|feedbackLoop"; do
  label=$(echo "$technique" | sed 's/\\|/ or /g')
  count=$(grep -r "$technique" client/src/engine/ --include="*.ts" --include="*.tsx" --include="*.glsl" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$count" -gt 0 ]; then
    echo -e "  ${GREEN}✓${NC} ${label}: ${count} refs"
    echo "- ${label}: ${count} references" >> "$REPORT_FILE"
  fi
done

echo

# ─── 5. Upgrade Opportunities ───────────────────────────────────────────────

echo -e "${MAGENTA}[5/7] Upgrade Opportunities${NC}"

{
  echo ""
  echo "## 5. Upgrade Opportunities"
  echo ""
  echo "### High Priority"
  echo ""
} >> "$REPORT_FILE"

opportunities=0

# WebGPU compute shaders
if [ "$webgpu_refs" -eq 0 ]; then
  echo -e "  ${YELLOW}★${NC} WebGPU compute shaders — massive parallelism for particle/reaction-diffusion"
  echo "- **WebGPU compute shaders**: Massive parallelism for particle systems and reaction-diffusion. R3F supports WebGPU via \`@react-three/fiber\` v9 \`createRoot({ gl: { renderer: 'webgpu' } })\`" >> "$REPORT_FILE"
  opportunities=$((opportunities + 1))
fi

# Spectral analysis
if ! grep -q "spectralCentroid" "$analyzer_file" 2>/dev/null; then
  echo -e "  ${YELLOW}★${NC} Spectral centroid/flux — richer audio → visual mapping"
  echo "- **Spectral centroid/flux/rolloff**: Enables brightness/timbre-reactive visuals beyond simple band energy" >> "$REPORT_FILE"
  opportunities=$((opportunities + 1))
fi

# Chromagram / pitch detection
if ! grep -q "chromagram\|chroma\|pitch" "$analyzer_file" 2>/dev/null; then
  echo -e "  ${YELLOW}★${NC} Chromagram / pitch detection — harmonic-reactive color mapping"
  echo "- **Chromagram/pitch detection**: Map musical notes to colors (C→red, D→orange, etc.) for harmonic visuals" >> "$REPORT_FILE"
  opportunities=$((opportunities + 1))
fi

# MIDI input
midi_refs=$(grep -r "MIDI\|midi\|MIDIAccess" client/src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
if [ "$midi_refs" -eq 0 ]; then
  echo -e "  ${YELLOW}★${NC} Web MIDI API — hardware controller input for live performance"
  echo "- **Web MIDI API**: Accept hardware controller input (knobs, faders, pads) for live VJ performance" >> "$REPORT_FILE"
  opportunities=$((opportunities + 1))
fi

# OSC protocol
osc_refs=$(grep -r "OSC\|osc\|oscMessage" client/src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
if [ "$osc_refs" -eq 0 ]; then
  echo -e "  ${YELLOW}★${NC} OSC protocol support — integrate with Ableton, TouchDesigner, Resolume"
  echo "- **OSC protocol**: Send/receive Open Sound Control messages for integration with Ableton, TouchDesigner, Resolume" >> "$REPORT_FILE"
  opportunities=$((opportunities + 1))
fi

# NDI / Spout / Syphon
ndi_refs=$(grep -r "NDI\|Spout\|Syphon" client/src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
if [ "$ndi_refs" -eq 0 ]; then
  echo -e "  ${YELLOW}★${NC} NDI/Spout/Syphon output — pro video pipeline integration"
  echo "- **NDI/Spout/Syphon**: Pro video output protocols for integration with OBS, vMix, Resolume" >> "$REPORT_FILE"
  opportunities=$((opportunities + 1))
fi

# WebXR / VR
xr_refs=$(grep -r "WebXR\|XRSession\|VRButton\|ARButton\|useXR" client/src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
if [ "$xr_refs" -eq 0 ]; then
  echo -e "  ${YELLOW}★${NC} WebXR — immersive VR/AR audio-reactive experiences"
  echo "- **WebXR/VR/AR**: Immersive 3D audio-reactive experiences via Quest, Vision Pro, or WebXR" >> "$REPORT_FILE"
  opportunities=$((opportunities + 1))
fi

# Audio worklet
worklet_refs=$(grep -r "AudioWorklet\|audioWorklet\|registerProcessor" client/src/ --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
if [ "$worklet_refs" -eq 0 ]; then
  echo -e "  ${YELLOW}★${NC} AudioWorklet — off-main-thread audio processing"
  echo "- **AudioWorklet**: Move audio analysis off main thread for smoother visuals at 60fps" >> "$REPORT_FILE"
  opportunities=$((opportunities + 1))
fi

echo -e "  ${CYAN}→${NC} Total opportunities found: ${opportunities}"

{
  echo ""
  echo "**Total opportunities**: ${opportunities}"
  echo ""
} >> "$REPORT_FILE"

echo

# ─── 6. ISF & Community Shaders ──────────────────────────────────────────────

echo -e "${MAGENTA}[6/7] ISF & Community Shader Ecosystem${NC}"

{
  echo "## 6. ISF & Community Shader Ecosystem"
  echo ""
  echo "### ISF (Interactive Shader Format)"
  echo "- **Standard**: Open format by Vidvox, used by VDMX, CoGe, Magic, Resolume"
  echo "- **Registry**: [interactiveshaderformat.com](https://interactiveshaderformat.com) — 1000+ community shaders"
  echo "- **Input types**: float, bool, color, point2D, image, audioFFT, audio"
  echo "- **ExperienceMusic status**: ISFAdapter.ts $([ "$has_isf" = "yes" ] && echo "implemented" || echo "not implemented")"
  echo ""
  echo "### MilkDrop / Butterchurn"
  echo "- **Library**: 100,000+ presets from Winamp/MilkDrop community"
  echo "- **Butterchurn**: WebGL 2.0 renderer by jberg, npm package"
  echo "- **Curated set**: butterchurn-presets includes ~200 high-quality presets"
  echo "- **ExperienceMusic status**: $([ "$has_milkdrop" = "yes" ] && echo "MilkdropRenderer + Bridge implemented" || echo "not implemented")"
  echo ""
  echo "### Shadertoy / GLSL Sandbox"
  echo "- **Shadertoy**: 90,000+ shaders, many audio-reactive (iChannel0 = audio texture)"
  echo "- **Conversion**: Requires remapping iResolution, iTime, iChannel uniforms"
  echo "- **ExperienceMusic potential**: Build ShadertoyAdapter similar to ISFAdapter"
  echo ""
  echo "### Key Community Resources"
  echo "- [The Book of Shaders](https://thebookofshaders.com) — GLSL fundamentals"
  echo "- [Inigo Quilez articles](https://iquilezles.org/articles/) — SDF, raymarching, procedural"
  echo "- [Patricio Gonzalez Vivo](https://patriciogonzalezvivo.com) — GLSL tools & lygia library"
  echo "- [gpu-io](https://github.com/amandaghassaei/gpu-io) — GPU compute framework for WebGL"
  echo ""
} >> "$REPORT_FILE"

echo -e "  ${GREEN}✓${NC} ISF ecosystem: 1000+ community shaders available"
echo -e "  ${GREEN}✓${NC} MilkDrop: 100K+ presets via Butterchurn"
echo -e "  ${GREEN}✓${NC} Shadertoy: 90K+ shaders (convertible)"
echo -e "  ${GREEN}✓${NC} GLSL Sandbox, lygia, gpu-io — additional sources"

echo

# ─── 7. Technology Radar ─────────────────────────────────────────────────────

echo -e "${MAGENTA}[7/7] Technology Radar${NC}"

{
  echo "## 7. Technology Radar"
  echo ""
  echo "### Adopt (ready now)"
  echo "- **AudioWorklet**: Off-thread audio analysis (all modern browsers)"
  echo "- **Web MIDI API**: Hardware controller support (Chrome, Edge)"
  echo "- **OffscreenCanvas**: Parallel rendering for Butterchurn (Chrome, FF)"
  echo "- **MediaRecorder API**: Record visuals to WebM/MP4"
  echo ""
  echo "### Trial (experiment)"
  echo "- **WebGPU**: Next-gen GPU compute (Chrome 113+, R3F v9 support)"
  echo "- **WebCodecs**: Low-level video encode/decode for recording"
  echo "- **ml5.js / TensorFlow.js**: ML-driven audio classification (genre, mood)"
  echo "- **Essentia.js**: Music analysis library (key, scale, rhythm, mood)"
  echo ""
  echo "### Assess (watch closely)"
  echo "- **WebXR**: VR/AR experiences (Quest Browser, Vision Pro)"
  echo "- **WebTransport**: Low-latency remote collaboration"
  echo "- **WASM audio**: Rust-compiled audio analysis via wasm-bindgen"
  echo "- **Model-based beat tracking**: ML-based BPM (madmom, aubio.js)"
  echo ""
  echo "### Hold (not yet viable)"
  echo "- **NDI over WebRTC**: Browser-native video output to pro tools"
  echo "- **Spatial audio (Ambisonics)**: 3D audio-reactive positioning"
  echo "- **WebNN**: Neural network inference for real-time style transfer"
  echo ""
} >> "$REPORT_FILE"

echo -e "  ${GREEN}Adopt${NC}:  AudioWorklet, Web MIDI, OffscreenCanvas, MediaRecorder"
echo -e "  ${YELLOW}Trial${NC}:  WebGPU, WebCodecs, ml5/TF.js, Essentia.js"
echo -e "  ${CYAN}Assess${NC}: WebXR, WebTransport, WASM audio, ML beat tracking"
echo -e "  ${RED}Hold${NC}:   NDI/WebRTC, Spatial audio, WebNN"

echo

# ─── Summary ─────────────────────────────────────────────────────────────────

{
  echo "---"
  echo ""
  echo "## Next Steps (Recommended)"
  echo ""
  echo "1. **AudioWorklet migration** — Move FFT analysis off main thread for smoother 60fps rendering"
  echo "2. **WebGPU compute shaders** — Enable massively parallel particle systems and fluid simulations"
  echo "3. **Web MIDI input** — Accept hardware controllers for live VJ performance"
  echo "4. **Shadertoy adapter** — Import 90K+ community shaders (similar pattern to ISFAdapter)"
  echo "5. **Essentia.js integration** — Music-aware visuals (key detection → harmonic colors, mood → palette)"
  echo "6. **WebXR mode** — Immersive VR/AR audio-reactive environments"
  echo ""
  echo "---"
  echo "*Report generated by ExperienceMusic Deep Research Bot*"
} >> "$REPORT_FILE"

echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}Report saved: ${REPORT_FILE}${NC}"
echo -e "  ${CYAN}Presets: ~${preset_count}${NC} | ${CYAN}Audio features: ${features:-0}${NC} | ${CYAN}Opportunities: ${opportunities}${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
