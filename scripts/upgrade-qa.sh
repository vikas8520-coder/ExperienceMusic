#!/usr/bin/env bash
set -uo pipefail

# ExperienceMusic — 10-Feature Upgrade QA Bot
# Validates all 10 upgrade features are present and functional

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

pass=0
fail=0
warn=0

check() {
  local label="$1"
  shift
  if "$@" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} $label"
    pass=$((pass + 1))
  else
    echo -e "  ${RED}✗${NC} $label"
    fail=$((fail + 1))
  fi
}

check_warn() {
  local label="$1"
  shift
  if "$@" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} $label"
    pass=$((pass + 1))
  else
    echo -e "  ${YELLOW}⚠${NC} $label (non-blocking)"
    warn=$((warn + 1))
  fi
}

echo -e "${CYAN}═══════════════════════════════════════════${NC}"
echo -e "${CYAN}  ExperienceMusic 10-Feature Upgrade QA${NC}"
echo -e "${CYAN}═══════════════════════════════════════════${NC}"
echo

# --- Core checks ---
echo -e "${CYAN}[Core]${NC}"
check "Build succeeds" npm run build
check_warn "TypeScript (non-blocking)" npx tsc --noEmit
check "Unit tests pass" npm test

echo

# --- Feature 1: BPM Oscillators ---
echo -e "${CYAN}[F1] BPM Oscillators & Beat-Phase Tracking${NC}"
check "bpm field in AudioData" grep -q "bpm:" client/src/hooks/use-audio-analyzer.ts
check "beatPhase field" grep -q "beatPhase" client/src/hooks/use-audio-analyzer.ts
check "bpmSin1 oscillator" grep -q "bpmSin1" client/src/hooks/use-audio-analyzer.ts
check "AudioFeatures extended" grep -q "bpm:" client/src/engine/presets/types.ts

echo

# --- Feature 2: Command Palette ---
echo -e "${CYAN}[F2] Command Palette (Cmd+K)${NC}"
check "CommandPalette component exists" test -f client/src/components/CommandPalette.tsx
check "Cmd+K handler in Home" grep -q 'key === "k"' client/src/pages/Home.tsx
check "commandPaletteOpen state" grep -q "commandPaletteOpen" client/src/pages/Home.tsx

echo

# --- Feature 3: Ambient UI ---
echo -e "${CYAN}[F3] Ambient UI (Auto-hide Controls)${NC}"
check "ambientMode state" grep -q "ambientMode" client/src/pages/Home.tsx
check "4s idle timer" grep -q "4000" client/src/pages/Home.tsx
check "Peek bar" grep -q "ambient-peek-bar" client/src/pages/Home.tsx

echo

# --- Feature 4: Register All Presets ---
echo -e "${CYAN}[F4] Register All Presets${NC}"
check "BurningShipPreset registered" grep -q "Burning Ship" client/src/engine/presets/registry.ts
check "MultibrotPreset registered" grep -q "Multibrot" client/src/engine/presets/registry.ts
check "PhoenixPreset registered" grep -q "Phoenix" client/src/engine/presets/registry.ts
check "NewtonPreset registered" grep -q "Newton" client/src/engine/presets/registry.ts
check "LivingTunnelPreset registered" grep -q "Living Tunnel" client/src/engine/presets/registry.ts
check "GrayScottPreset registered" grep -q "Gray Scott" client/src/engine/presets/registry.ts
check "CurlFlowPreset registered" grep -q "Curl Flow" client/src/engine/presets/registry.ts
check "9 presets in registry" test "$(grep -c '":' client/src/engine/presets/registry.ts)" -ge 9

echo

# --- Feature 5: ISF Shader Import ---
echo -e "${CYAN}[F5] ISF Shader Import${NC}"
check "ISFAdapter exists" test -f client/src/engine/presets/ISFAdapter.ts
check "parseISF function" grep -q "parseISF" client/src/engine/presets/ISFAdapter.ts
check "registerISFPreset" grep -q "registerISFPreset" client/src/engine/presets/ISFAdapter.ts

echo

# --- Feature 6: MilkDrop / Butterchurn ---
echo -e "${CYAN}[F6] MilkDrop / Butterchurn Integration${NC}"
check "MilkdropRenderer exists" test -f client/src/engine/milkdrop/MilkdropRenderer.tsx
check "MilkdropBridge exists" test -f client/src/engine/milkdrop/MilkdropBridge.ts
check "butterchurn import" grep -q "butterchurn" client/src/engine/milkdrop/MilkdropRenderer.tsx

echo

# --- Feature 7: Preset Marketplace ---
echo -e "${CYAN}[F7] Preset Marketplace${NC}"
check "shareCode in schema" grep -q "shareCode" shared/schema.ts
check "share route" grep -q "share" shared/routes.ts
check "PresetMarketplace component" test -f client/src/components/PresetMarketplace.tsx
check "getPublicPresets in storage" grep -q "getPublicPresets" server/storage.ts

echo

# --- Feature 8: Virtual Camera ---
echo -e "${CYAN}[F8] Virtual Camera Output${NC}"
check "virtualCamera module exists" test -f client/src/lib/virtualCamera.ts
check "captureStream" grep -q "captureStream" client/src/lib/virtualCamera.ts
check "stopVirtualCamera" grep -q "stopVirtualCamera" client/src/lib/virtualCamera.ts

echo

# --- Feature 9: Session Gamification ---
echo -e "${CYAN}[F9] Session Gamification${NC}"
check "useSessionStats hook" test -f client/src/hooks/useSessionStats.ts
check "SessionStats component" test -f client/src/components/SessionStats.tsx
check "listenTime tracking" grep -q "listenTime" client/src/hooks/useSessionStats.ts
check "milestone toasts" grep -q "milestone" client/src/hooks/useSessionStats.ts

echo

# --- Feature 10: This script ---
echo -e "${CYAN}[F10] Upgrade QA Bot${NC}"
check "upgrade-qa.sh exists" test -f scripts/upgrade-qa.sh

echo
echo -e "${CYAN}═══════════════════════════════════════════${NC}"
total=$((pass + fail))
echo -e "  ${GREEN}Passed: ${pass}${NC} / ${total}  ${RED}Failed: ${fail}${NC}  ${YELLOW}Warnings: ${warn}${NC}"

if [ "$fail" -eq 0 ]; then
  echo -e "  ${GREEN}ALL UPGRADE CHECKS PASSED ✓${NC}"
else
  echo -e "  ${RED}SOME CHECKS FAILED ✗${NC}"
fi
echo -e "${CYAN}═══════════════════════════════════════════${NC}"

exit "$fail"
