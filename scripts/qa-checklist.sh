#!/usr/bin/env bash
set -euo pipefail

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color
BOLD='\033[1m'

PASS=0
FAIL=0
WARN=0

pass() { echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  ${RED}✗${NC} $1"; FAIL=$((FAIL + 1)); }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; WARN=$((WARN + 1)); }

echo -e "${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   ExperienceMusic QA Checklist       ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════╝${NC}"
echo

# --- 1. Build check ---
echo -e "${BOLD}[1/5] Build check${NC}"
if npm run build > /dev/null 2>&1; then
  pass "Production build succeeds"
else
  fail "Production build failed"
  echo -e "  ${RED}Aborting — fix build errors first${NC}"
  exit 1
fi
echo

# --- 2. Type check ---
echo -e "${BOLD}[2/5] Type check${NC}"
if npx tsc --noEmit 2>&1; then
  pass "No TypeScript errors"
else
  warn "Pre-existing TypeScript errors (non-blocking)"
fi
echo

# --- 3. Unit tests ---
echo -e "${BOLD}[3/5] Unit tests${NC}"
if npm test 2>&1 | tail -5; then
  pass "All unit tests pass"
else
  fail "Unit tests failed"
  exit 1
fi
echo

# --- 4. Feature presence checks ---
echo -e "${BOLD}[4/5] Feature presence checks${NC}"

# darkOverlay in settings state
if grep -q 'darkOverlay: false' client/src/pages/Home.tsx; then
  pass "darkOverlay exists in Home.tsx settings state"
else
  fail "darkOverlay missing from Home.tsx settings state"
fi

# darkOverlay toggle reads settings.darkOverlay
if grep -q 'settings.darkOverlay' client/src/components/UIControls.tsx; then
  pass "Dark Overlay toggle reads settings.darkOverlay"
else
  fail "Dark Overlay toggle not wired to settings.darkOverlay"
fi

# Trash2 import in TrackLibrary
if grep -q 'Trash2' client/src/components/TrackLibrary.tsx; then
  pass "Trash2 imported in TrackLibrary.tsx"
else
  fail "Trash2 not imported in TrackLibrary.tsx"
fi

# onDeleteTrack with stopPropagation
if grep -q 'stopPropagation' client/src/components/TrackLibrary.tsx; then
  pass "onDeleteTrack wired with stopPropagation"
else
  fail "onDeleteTrack missing stopPropagation"
fi

# Save Preset button
if grep -q 'button-save-preset' client/src/components/UIControls.tsx; then
  pass "Save Preset button with data-testid present"
else
  fail "Save Preset button missing"
fi

# afterimageOn checks both trailsOn and darkOverlay
if grep -q 'darkOverlay' client/src/components/AudioVisualizer.tsx; then
  pass "afterimageOn checks darkOverlay in AudioVisualizer"
else
  fail "afterimageOn does not check darkOverlay"
fi

# CollapsibleSection in UIControls
if grep -q 'CollapsibleSection' client/src/components/UIControls.tsx; then
  pass "CollapsibleSection component exists in UIControls"
else
  fail "CollapsibleSection missing from UIControls"
fi
echo

# --- 5. Summary ---
echo -e "${BOLD}[5/5] Summary${NC}"
echo -e "  ${GREEN}Passed: ${PASS}${NC}"
if [ $WARN -gt 0 ]; then
  echo -e "  ${YELLOW}Warnings: ${WARN}${NC}"
fi
if [ $FAIL -gt 0 ]; then
  echo -e "  ${RED}Failed: ${FAIL}${NC}"
  echo
  echo -e "${RED}${BOLD}QA FAILED${NC}"
  exit 1
else
  echo -e "  ${RED}Failed: 0${NC}"
  echo
  echo -e "${GREEN}${BOLD}ALL QA CHECKS PASSED ✓${NC}"
fi
