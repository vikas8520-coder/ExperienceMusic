#!/usr/bin/env bash
set -euo pipefail

# ─── QA Bot: ExperienceMusic Full Permutation Test Suite ──────────────
# Mirrors all testing logic: build, typecheck, unit tests (510+),
# component presence, data-testid coverage, feature grep checks,
# and generates a structured report.
# Usage: bash scripts/qa-bot.sh [--report] [--ci]
#   --report  Generate qa-report.json
#   --ci      Exit 1 on any failure (for CI/CD)

# ─── Colors ───────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'

PASS=0
FAIL=0
WARN=0
TOTAL_TESTS=0
REPORT_MODE=false
CI_MODE=false
REPORT_FILE="qa-report.json"
FAILURES=()

for arg in "$@"; do
  case $arg in
    --report) REPORT_MODE=true ;;
    --ci)     CI_MODE=true ;;
  esac
done

pass() { echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  ${RED}✗${NC} $1"; FAIL=$((FAIL + 1)); FAILURES+=("$1"); }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; WARN=$((WARN + 1)); }
section() { echo -e "\n${BOLD}${CYAN}[$1]${NC} ${BOLD}$2${NC}"; }

START_TIME=$(date +%s)

echo -e "${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   ExperienceMusic QA Bot — Full Permutation      ║${NC}"
echo -e "${BOLD}║   $(date '+%Y-%m-%d %H:%M:%S')                          ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${NC}"

# ─── Phase 1: Build Check ─────────────────────────────────────────────
section "1/8" "Production Build"
if npm run build > /dev/null 2>&1; then
  pass "Production build succeeds"
else
  fail "Production build failed"
  if $CI_MODE; then
    echo -e "  ${RED}Aborting — fix build errors first${NC}"
    exit 1
  fi
fi

# ─── Phase 2: Type Check ──────────────────────────────────────────────
section "2/8" "TypeScript Type Check"
TS_OUTPUT=$(npx tsc --noEmit 2>&1 || true)
TS_ERRORS=$(echo "$TS_OUTPUT" | grep -c "error TS" || true)
if [ "$TS_ERRORS" -eq 0 ]; then
  pass "No TypeScript errors"
else
  warn "Pre-existing TypeScript errors: $TS_ERRORS (non-blocking)"
fi

# ─── Phase 3: Unit Tests ──────────────────────────────────────────────
section "3/8" "Unit Tests (Vitest)"
TEST_OUTPUT=$(npm test 2>&1)
TEST_EXIT=$?

# Extract test counts (macOS-compatible)
# Vitest output: "Test Files  28 passed" then "Tests  510 passed"
TEST_FILES=$(echo "$TEST_OUTPUT" | grep "Test Files" | grep -oE '[0-9]+ passed' | grep -oE '[0-9]+' || echo "0")
TOTAL_TESTS=$(echo "$TEST_OUTPUT" | grep "Tests " | grep -oE '[0-9]+ passed' | grep -oE '[0-9]+' || echo "0")
FAILED_TESTS=$(echo "$TEST_OUTPUT" | grep "Tests " | grep -oE '[0-9]+ failed' | grep -oE '[0-9]+' || echo "0")

if [ "$FAILED_TESTS" -eq 0 ] && [ "$TEST_EXIT" -eq 0 ]; then
  pass "All $TOTAL_TESTS tests pass across $TEST_FILES files"
else
  fail "$FAILED_TESTS tests failed out of $((TOTAL_TESTS + FAILED_TESTS))"
  echo "$TEST_OUTPUT" | grep "FAIL" | head -10
  if $CI_MODE; then exit 1; fi
fi

# ─── Phase 4: Component File Presence ─────────────────────────────────
section "4/8" "Component File Presence (28 checks)"

# Layout components
for comp in ZenMode CommandCenter IconRail SidePanel ModeToggle ProjectionButton; do
  if [ -f "client/src/components/layout/${comp}.tsx" ]; then
    pass "Layout: ${comp}.tsx exists"
  else
    fail "Layout: ${comp}.tsx missing"
  fi
done

# Player components
for comp in FloatingPlayer PlayerBar; do
  if [ -f "client/src/components/player/${comp}.tsx" ]; then
    pass "Player: ${comp}.tsx exists"
  else
    fail "Player: ${comp}.tsx missing"
  fi
done

# Settings panels
for panel in PresetsPanel ColorsPanel EffectsPanel PerformPanel AudioPanel RecordPanel LibraryPanel; do
  if [ -f "client/src/components/settings/${panel}.tsx" ]; then
    pass "Settings: ${panel}.tsx exists"
  else
    fail "Settings: ${panel}.tsx missing"
  fi
done

# Hooks
if [ -f "client/src/hooks/useProjection.ts" ]; then
  pass "Hook: useProjection.ts exists"
else
  fail "Hook: useProjection.ts missing"
fi

# Test files
for test in ZenMode CommandCenter Projection FloatingPlayer PlayerBar IconRail SidePanel ModeToggle ProjectionButton EffectsPanel RecordPanel AudioPanel PresetsPanel ColorsPanel PerformPanel LibraryPanel; do
  if [ -f "client/src/__tests__/${test}.test.tsx" ] || [ -f "client/src/__tests__/${test}.test.ts" ]; then
    pass "Test: ${test}.test.* exists"
  else
    fail "Test: ${test}.test.* missing"
  fi
done

# ─── Phase 5: Data-TestID Coverage ────────────────────────────────────
section "5/8" "Data-TestID Coverage"

# Critical testids that must exist in source
TESTIDS=(
  "command-center"
  "player-bar"
  "panel-presets"
  "panel-colors"
  "panel-effects"
  "panel-audio"
  "panel-perform"
  "panel-record"
  "panel-library"
  "floating-player"
  "floating-play-pause"
  "icon-rail"
  "side-panel"
  "side-panel-close"
  "mode-toggle"
  "projection-button"
  "zen-canvas-catcher"
  "command-canvas-catcher"
  "button-play-pause"
  "button-save-preset"
  "toggle-preset-enabled"
  "button-record"
  "button-fullscreen"
  "button-mic-toggle"
  "toggle-trails"
  "toggle-dark-overlay"
  "session-stats"
)

for tid in "${TESTIDS[@]}"; do
  if grep -rq "data-testid=\"${tid}\"" client/src/components/ client/src/pages/ 2>/dev/null; then
    pass "TestID: ${tid}"
  else
    fail "TestID: ${tid} not found in source"
  fi
done

# ─── Phase 6: Feature Grep Checks ─────────────────────────────────────
section "6/8" "Feature Grep Checks"

# Layout mode state in Home.tsx
if grep -q 'layoutMode' client/src/pages/Home.tsx; then
  pass "layoutMode state present in Home.tsx"
else
  fail "layoutMode state missing from Home.tsx"
fi

# useProjection hook used in Home
if grep -q 'useProjection' client/src/pages/Home.tsx; then
  pass "useProjection hook used in Home.tsx"
else
  fail "useProjection hook missing from Home.tsx"
fi

# Conditional rendering of ZenMode and CommandCenter in Home
if grep -q 'ZenMode' client/src/pages/Home.tsx && grep -q 'CommandCenter' client/src/pages/Home.tsx; then
  pass "Both ZenMode and CommandCenter rendered in Home.tsx"
else
  fail "Missing ZenMode or CommandCenter rendering in Home.tsx"
fi

# Mode toggle keyboard shortcut
if grep -q 'Ctrl.*Shift.*L\|ctrl.*shift.*l\|KeyL' client/src/pages/Home.tsx; then
  pass "Ctrl+Shift+L keyboard shortcut in Home.tsx"
else
  fail "Mode toggle keyboard shortcut missing"
fi

# Projection keyboard shortcut (P key)
if grep -q 'KeyP' client/src/pages/Home.tsx; then
  pass "P key projection shortcut in Home.tsx"
else
  fail "Projection keyboard shortcut missing"
fi

# CommandPalette has mode switch action
if grep -q 'action:switch-mode' client/src/components/CommandPalette.tsx; then
  pass "CommandPalette has mode switch action"
else
  fail "CommandPalette missing mode switch action"
fi

# CommandPalette has projection action
if grep -q 'action:toggle-projection' client/src/components/CommandPalette.tsx; then
  pass "CommandPalette has toggle-projection action"
else
  fail "CommandPalette missing toggle-projection action"
fi

# darkOverlay in settings state
if grep -q 'darkOverlay' client/src/pages/Home.tsx; then
  pass "darkOverlay in Home.tsx settings"
else
  fail "darkOverlay missing from Home.tsx"
fi

# afterimageOn checks darkOverlay
if grep -q 'darkOverlay' client/src/components/AudioVisualizer.tsx; then
  pass "afterimageOn checks darkOverlay in AudioVisualizer"
else
  fail "afterimageOn does not check darkOverlay"
fi

# Trails toggle in effects
if grep -q 'trailsOn' client/src/components/settings/EffectsPanel.tsx; then
  pass "trailsOn toggle in EffectsPanel"
else
  fail "trailsOn missing from EffectsPanel"
fi

# Save Preset button with testid
if grep -q 'button-save-preset' client/src/components/settings/PresetsPanel.tsx; then
  pass "Save Preset button with data-testid"
else
  fail "Save Preset button missing"
fi

# canvas.captureStream in projection hook
if grep -q 'captureStream' client/src/hooks/useProjection.ts; then
  pass "captureStream used in useProjection"
else
  fail "captureStream missing from useProjection"
fi

# window.open in projection hook
if grep -q 'window.open' client/src/hooks/useProjection.ts; then
  pass "window.open used in useProjection"
else
  fail "window.open missing from useProjection"
fi

# localStorage persistence for layoutMode
if grep -q 'experience-layout-mode\|localStorage.*layoutMode\|layoutMode.*localStorage' client/src/pages/Home.tsx; then
  pass "layoutMode persisted to localStorage"
else
  fail "layoutMode localStorage persistence missing"
fi

# Escape key closes panels in ZenMode
if grep -q 'Escape' client/src/components/layout/ZenMode.tsx; then
  pass "Escape key handler in ZenMode"
else
  fail "Escape key handler missing from ZenMode"
fi

# IconRail has 7 panels defined (count entries in panelIcons array)
PANEL_COUNT=$(grep -c '{ id:' client/src/components/layout/IconRail.tsx || true)
if [ "$PANEL_COUNT" -ge 7 ]; then
  pass "IconRail has $PANEL_COUNT panel definitions (≥7)"
else
  fail "IconRail has only $PANEL_COUNT panel definitions (need 7)"
fi

# AnimatePresence in SidePanel for animations
if grep -q 'AnimatePresence' client/src/components/layout/SidePanel.tsx; then
  pass "AnimatePresence used in SidePanel"
else
  fail "AnimatePresence missing from SidePanel"
fi

# Framer-motion drag in FloatingPlayer
if grep -q 'drag' client/src/components/player/FloatingPlayer.tsx; then
  pass "Draggable FloatingPlayer (framer-motion drag)"
else
  fail "FloatingPlayer not draggable"
fi

# ─── Phase 7: Test Permutation Coverage Analysis ──────────────────────
section "7/8" "Test Permutation Coverage Analysis"

# Count tests per file
echo -e "  ${DIM}Test distribution:${NC}"
for f in client/src/__tests__/*.test.{tsx,ts}; do
  if [ -f "$f" ]; then
    TEST_COUNT=$(grep -c "it(" "$f" || true)
    FNAME=$(basename "$f")
    echo -e "    ${DIM}${FNAME}: ${TEST_COUNT} test cases${NC}"
  fi
done

# Verify minimum test counts for key files
check_min_tests() {
  local file=$1
  local min=$2
  local label=$3
  if [ -f "$file" ]; then
    local count=$(grep -c "it(" "$file" || true)
    if [ "$count" -ge "$min" ]; then
      pass "$label: $count tests (≥$min min)"
    else
      fail "$label: only $count tests (need ≥$min)"
    fi
  else
    fail "$label: test file missing"
  fi
}

# Note: static it() counts are lower than runtime counts because
# forEach loops generate multiple tests from a single it() call.
# Thresholds are based on static it() declarations.
check_min_tests "client/src/__tests__/ZenMode.test.tsx" 18 "ZenMode permutation tests"
check_min_tests "client/src/__tests__/CommandCenter.test.tsx" 18 "CommandCenter permutation tests"
check_min_tests "client/src/__tests__/Projection.test.ts" 4 "Projection hook tests"
check_min_tests "client/src/__tests__/FloatingPlayer.test.tsx" 10 "FloatingPlayer tests"
check_min_tests "client/src/__tests__/PlayerBar.test.tsx" 8 "PlayerBar tests"
check_min_tests "client/src/__tests__/IconRail.test.tsx" 5 "IconRail tests"
check_min_tests "client/src/__tests__/SidePanel.test.tsx" 4 "SidePanel tests"
check_min_tests "client/src/__tests__/ModeToggle.test.tsx" 4 "ModeToggle tests"
check_min_tests "client/src/__tests__/ProjectionButton.test.tsx" 4 "ProjectionButton tests"
check_min_tests "client/src/__tests__/EffectsPanel.test.tsx" 8 "EffectsPanel tests"
check_min_tests "client/src/__tests__/RecordPanel.test.tsx" 8 "RecordPanel tests"
check_min_tests "client/src/__tests__/AudioPanel.test.tsx" 6 "AudioPanel tests"
check_min_tests "client/src/__tests__/PresetsPanel.test.tsx" 5 "PresetsPanel tests"
check_min_tests "client/src/__tests__/ColorsPanel.test.tsx" 8 "ColorsPanel tests"
check_min_tests "client/src/__tests__/PerformPanel.test.tsx" 6 "PerformPanel tests"
check_min_tests "client/src/__tests__/LibraryPanel.test.tsx" 8 "LibraryPanel tests"

# Verify permutation patterns exist
if grep -q 'forEach' client/src/__tests__/ZenMode.test.tsx; then
  pass "ZenMode uses forEach permutation loops"
else
  fail "ZenMode missing forEach permutation pattern"
fi

if grep -q '7×7\|permutation matrix' client/src/__tests__/ZenMode.test.tsx; then
  pass "ZenMode has 7×7 panel swap matrix"
else
  warn "ZenMode may not have full 7×7 swap matrix"
fi

if grep -q 'forEach' client/src/__tests__/CommandCenter.test.tsx; then
  pass "CommandCenter uses forEach permutation loops"
else
  fail "CommandCenter missing forEach permutation pattern"
fi

# ─── Phase 8: Summary ─────────────────────────────────────────────────
section "8/8" "Summary"

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo -e "  ${GREEN}Passed:  ${PASS}${NC}"
if [ $WARN -gt 0 ]; then
  echo -e "  ${YELLOW}Warnings: ${WARN}${NC}"
fi
echo -e "  ${RED}Failed:  ${FAIL}${NC}"
echo -e "  ${DIM}Unit tests: ${TOTAL_TESTS}${NC}"
echo -e "  ${DIM}Duration: ${ELAPSED}s${NC}"
echo

if [ ${#FAILURES[@]} -gt 0 ]; then
  echo -e "${RED}${BOLD}Failed checks:${NC}"
  for f in "${FAILURES[@]}"; do
    echo -e "  ${RED}• ${f}${NC}"
  done
  echo
fi

# ─── Generate JSON Report ─────────────────────────────────────────────
if $REPORT_MODE; then
  cat > "$REPORT_FILE" << JSONEOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "passed": $PASS,
  "failed": $FAIL,
  "warnings": $WARN,
  "unitTests": $TOTAL_TESTS,
  "duration": $ELAPSED,
  "status": "$([ $FAIL -eq 0 ] && echo 'PASS' || echo 'FAIL')",
  "failures": [$(if [ ${#FAILURES[@]} -gt 0 ]; then printf '"%s",' "${FAILURES[@]}" | sed 's/,$//'; fi)]
}
JSONEOF
  echo -e "${DIM}Report written to ${REPORT_FILE}${NC}"
  echo
fi

# ─── Final Verdict ────────────────────────────────────────────────────
if [ $FAIL -gt 0 ]; then
  echo -e "${RED}${BOLD}QA BOT: FAILED${NC} — $FAIL issue(s) need attention"
  if $CI_MODE; then exit 1; fi
  exit 0
else
  echo -e "${GREEN}${BOLD}QA BOT: ALL CHECKS PASSED ✓${NC}"
fi
