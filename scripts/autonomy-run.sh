#!/usr/bin/env bash
# ============================================================
# GeekSpace 2.0 — Autonomy Run Orchestrator
# Pre-flight checks + audit for autonomous development sessions
# Usage: ./scripts/autonomy-run.sh [--full]
#   (no flag)  — pre-flight + audit only
#   --full     — also runs gate + stage + PR after implementation
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

MODE="${1:-audit}"
PASS=0
FAIL=0

green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
red()   { printf '\033[0;31m%s\033[0m\n' "$1"; }
yellow(){ printf '\033[0;33m%s\033[0m\n' "$1"; }
bold()  { printf '\033[1m%s\033[0m\n' "$1"; }

preflight_ok()   { green "  OK    $1"; PASS=$((PASS + 1)); }
preflight_fail() { red   "  FAIL  $1"; FAIL=$((FAIL + 1)); }
preflight_warn() { yellow "  WARN  $1"; }

# ── Pre-flight ────────────────────────────────────────────────
bold "=========================================="
bold "  Autonomy Run — GeekSpace 2.0"
bold "  $(date '+%Y-%m-%d %H:%M:%S')"
bold "=========================================="
echo ""

bold "[Pre-flight Checks]"

# 1. Production health
PROD_STATUS=$(curl -sf --max-time 10 https://ai.geekspace.space/api/health 2>/dev/null | grep -o '"ok":true' || echo "")
if [ -n "$PROD_STATUS" ]; then
  preflight_ok "Production health"
else
  preflight_fail "Production health — endpoint unreachable or unhealthy"
fi

# 2. Staging health
STAGING_STATUS=$(curl -sf --max-time 10 https://staging.agentin.chat/api/health 2>/dev/null | grep -o '"ok":true' || echo "")
if [ -n "$STAGING_STATUS" ]; then
  preflight_ok "Staging health"
else
  preflight_warn "Staging health — endpoint unreachable (may need deploy)"
fi

# 3. Disk space
DISK_AVAIL=$(df -BG / | tail -1 | awk '{print $4}' | tr -d 'G')
if [ "$DISK_AVAIL" -gt 1 ]; then
  preflight_ok "Disk space (${DISK_AVAIL}G available)"
else
  preflight_fail "Disk space critical (${DISK_AVAIL}G available, need >1G)"
fi

# 4. Git branch
BRANCH=$(git branch --show-current 2>/dev/null || echo "detached")
if [ "$BRANCH" = "main" ]; then
  preflight_ok "On main branch"
else
  preflight_warn "On branch '$BRANCH' (expected main for new phase)"
fi

# 5. Clean working tree
if git diff --quiet 2>/dev/null && git diff --cached --quiet 2>/dev/null; then
  preflight_ok "Clean working tree"
else
  preflight_warn "Uncommitted changes detected"
fi

# 6. Docker containers
CONTAINER_COUNT=$(docker ps --filter "name=geekspace" --format '{{.Names}}' 2>/dev/null | wc -l)
if [ "$CONTAINER_COUNT" -ge 4 ]; then
  preflight_ok "Docker containers ($CONTAINER_COUNT running)"
else
  preflight_fail "Docker containers (only $CONTAINER_COUNT running, expected >= 4)"
fi

echo ""

# Stop if critical pre-flight failures
if [ "$FAIL" -gt 0 ]; then
  red "Pre-flight FAILED ($FAIL issues). Fix before starting autonomous session."
  exit 1
fi

# ── Audit ─────────────────────────────────────────────────────
bold "[Audit]"

# Read handoff
if [ -f "ops/AI_HANDOFF.md" ]; then
  PHASE=$(grep -oP 'Phase \K[0-9]+' ops/AI_HANDOFF.md | head -1 || echo "?")
  LAST_TESTS=$(grep -oP '\d+/\d+' ops/AI_HANDOFF.md | head -1 || echo "?")
  echo "  Last phase:   $PHASE"
  echo "  Last tests:   $LAST_TESTS"
else
  echo "  No handoff file found"
  PHASE="0"
fi

NEXT_PHASE=$((PHASE + 1))
echo "  Next phase:   $NEXT_PHASE"

# Run baseline tests
echo ""
bold "[Baseline Tests]"
echo "  Running server tests..."
cd "$PROJECT_DIR/server"
TEST_OUTPUT=$(npm test 2>&1 || true)
TEST_PASSED=$(echo "$TEST_OUTPUT" | grep -oP '\d+ passed' | head -1 || echo "0 passed")
TEST_FAILED=$(echo "$TEST_OUTPUT" | grep -oP '\d+ failed' | head -1 || echo "")
cd "$PROJECT_DIR"

if [ -z "$TEST_FAILED" ]; then
  green "  Baseline: $TEST_PASSED"
else
  yellow "  Baseline: $TEST_PASSED, $TEST_FAILED"
fi

# Recent commits
echo ""
bold "[Recent Commits]"
git log --oneline -5 2>/dev/null | sed 's/^/  /'

echo ""
bold "=========================================="
green "  Pre-flight PASSED — ready for Phase $NEXT_PHASE"
bold "=========================================="

# ── Full mode: Gate + Stage + PR ──────────────────────────────
if [ "$MODE" = "--full" ]; then
  echo ""
  bold "[Phase Gate]"
  if "$PROJECT_DIR/ops/phase-gate.sh" --skip-e2e; then
    green "  Gate passed"
  else
    red "  Gate FAILED — fix issues before staging"
    exit 1
  fi

  echo ""
  bold "[Staging Deploy]"
  "$PROJECT_DIR/scripts/staging.sh"

  echo ""
  bold "[Staging Smoke Tests]"
  if "$PROJECT_DIR/scripts/smoke-staging.sh"; then
    green "  All staging checks passed"
  else
    red "  Staging smoke tests FAILED"
    exit 1
  fi

  echo ""
  bold "=========================================="
  green "  Full run complete — create PR when ready"
  bold "=========================================="
fi
