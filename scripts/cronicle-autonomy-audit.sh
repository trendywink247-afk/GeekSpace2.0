#!/usr/bin/env bash
# ============================================================
# GeekSpace 2.0 — Cronicle Autonomy Audit
# Read-only daily health + audit check, designed for Cronicle.
# NEVER commits, pushes, deploys, or modifies any files.
#
# Usage: Called by Cronicle (or manually: ./scripts/cronicle-autonomy-audit.sh)
# Exit codes:
#   0 = all checks passed (or only warnings)
#   1 = infra-critical failure (prod down, disk <5GB, unhealthy
#       containers, openclaw alias missing)
#   2 = unit tests actually failing (npm test non-zero)
# ============================================================
set -euo pipefail

export CRONICLE_AUDIT_ONLY=1

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

PASS=0
CRIT=0       # infra-critical → exit 1
TEST_FAIL=0  # actual test failures → exit 2
WARN=0

# ── Helpers ───────────────────────────────────────────────────
ok()   { echo "[OK]   $1"; PASS=$((PASS + 1)); }
crit() { echo "[CRIT] $1"; CRIT=$((CRIT + 1)); }
warn() { echo "[WARN] $1"; WARN=$((WARN + 1)); }

echo "=========================================="
echo "  Cronicle Autonomy Audit"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
echo ""

# ── 1. Production Health (CRITICAL) ─────────────────────────
echo "--- Production Health ---"
PROD_RESP=$(curl -sf --max-time 15 https://ai.geekspace.space/api/health 2>/dev/null || echo "{}")
PROD_OK=$(echo "$PROD_RESP" | grep -o '"ok":true' || echo "")
PROD_USERS=$(echo "$PROD_RESP" | grep -oP '"users":\K[0-9]+' || echo "?")
PROD_ERRS=$(echo "$PROD_RESP" | grep -oP '"totalErrors":\K[0-9]+' || echo "?")

if [ -n "$PROD_OK" ]; then
  ok "Production healthy (users=$PROD_USERS, errors=$PROD_ERRS)"
else
  crit "Production UNHEALTHY or unreachable"
fi

# ── 2. Staging Health (WARN — may just need deploy) ─────────
echo ""
echo "--- Staging Health ---"
STAGING_RESP=$(curl -sf --max-time 15 https://staging.agentin.chat/api/health 2>/dev/null || echo "{}")
STAGING_OK=$(echo "$STAGING_RESP" | grep -o '"ok":true' || echo "")

if [ -n "$STAGING_OK" ]; then
  ok "Staging healthy"
else
  warn "Staging unreachable (may need deploy)"
fi

# ── 3. Docker Containers (CRITICAL if < 4 or unhealthy) ─────
echo ""
echo "--- Docker Containers ---"
CONTAINERS=$(docker ps --filter "name=geekspace" --format '{{.Names}} {{.Status}}' 2>/dev/null || echo "")
CONTAINER_COUNT=$(echo "$CONTAINERS" | grep -c . || echo "0")

if [ "$CONTAINER_COUNT" -ge 4 ]; then
  ok "Containers running ($CONTAINER_COUNT)"
else
  crit "Only $CONTAINER_COUNT containers (expected >= 4)"
fi

UNHEALTHY=$(docker ps --filter "name=geekspace" --filter "health=unhealthy" --format '{{.Names}}' 2>/dev/null || echo "")
if [ -n "$UNHEALTHY" ]; then
  crit "Unhealthy containers: $UNHEALTHY"
else
  ok "All containers healthy"
fi

echo "$CONTAINERS" | sed 's/^/  /'

# ── 4. Disk / Memory (CRITICAL if disk <5GB) ────────────────
echo ""
echo "--- System Resources ---"
DISK_AVAIL=$(df -BG / | tail -1 | awk '{print $4}' | tr -d 'G')
DISK_PCT=$(df / | tail -1 | awk '{print $5}')
MEM_AVAIL=$(free -m | awk '/Mem:/{print $7}')

if [ "$DISK_AVAIL" -gt 5 ]; then
  ok "Disk: ${DISK_AVAIL}G free ($DISK_PCT used)"
else
  crit "Disk critical: ${DISK_AVAIL}G free ($DISK_PCT used) — need >5GB"
fi

if [ "$MEM_AVAIL" -gt 512 ]; then
  ok "Memory: ${MEM_AVAIL}MB available"
elif [ "$MEM_AVAIL" -gt 256 ]; then
  warn "Memory low: ${MEM_AVAIL}MB available"
else
  warn "Memory very low: ${MEM_AVAIL}MB available"
fi

# ── 5. OpenClaw Alias (CRITICAL if missing) ──────────────────
echo ""
echo "--- OpenClaw Alias ---"
OC_CONTAINER=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -E '^openclaw-.*-openclaw-1$' | head -1 || echo "")
if [ -n "$OC_CONTAINER" ]; then
  OC_ALIASES=$(docker inspect "$OC_CONTAINER" --format '{{json (index .NetworkSettings.Networks "geekspace-shared").Aliases}}' 2>/dev/null || echo "null")
  if echo "$OC_ALIASES" | grep -q '"openclaw"'; then
    ok "OpenClaw alias present on $OC_CONTAINER"
  else
    crit "OpenClaw alias MISSING on $OC_CONTAINER"
  fi
else
  warn "No OpenClaw container found"
fi

# ── 6. Git State (informational) ────────────────────────────
echo ""
echo "--- Git State ---"
BRANCH=$(git branch --show-current 2>/dev/null || echo "detached")
LAST_COMMIT=$(git log --oneline -1 2>/dev/null || echo "unknown")
DIRTY=$(git status --porcelain 2>/dev/null | wc -l)

echo "  Branch: $BRANCH"
echo "  Last:   $LAST_COMMIT"
if [ "$DIRTY" -eq 0 ]; then
  ok "Working tree clean"
else
  warn "Working tree has $DIRTY uncommitted changes"
fi

# ── 7. Phase Handoff (informational) ────────────────────────
echo ""
echo "--- Phase Status ---"
HANDOFF_BASELINE=0
if [ -f "ops/AI_HANDOFF.md" ]; then
  PHASE=$(grep -oP 'Phase \K[0-9]+' ops/AI_HANDOFF.md | head -1 || echo "?")
  LAST_TESTS=$(grep -oP '\d+/\d+' ops/AI_HANDOFF.md | head -1 || echo "?")
  HANDOFF_BASELINE=$(echo "$LAST_TESTS" | grep -oP '^\d+' || echo "0")
  echo "  Last phase: $PHASE"
  echo "  Last tests: $LAST_TESTS (Docker full suite)"
  ok "Handoff file present"
else
  warn "No handoff file (ops/AI_HANDOFF.md)"
  PHASE="0"
fi

# ── 8. Baseline Tests ───────────────────────────────────────
echo ""
echo "--- Baseline Tests ---"
cd "$PROJECT_DIR/server"
TEST_EXIT=0
TEST_OUTPUT=$(npm test 2>&1) || TEST_EXIT=$?
TEST_PASSED=$(echo "$TEST_OUTPUT" | grep -oP '\d+ passed' | head -1 || echo "0 passed")
TEST_FAILED_CT=$(echo "$TEST_OUTPUT" | grep -oP '(\d+) failed' | grep -oP '\d+' || echo "0")
CURRENT_CT=$(echo "$TEST_PASSED" | grep -oP '\d+' || echo "0")
cd "$PROJECT_DIR"

echo "  Result: $TEST_PASSED (local server suite)"

# Actual test failures — tests ran but some failed
if [ "$TEST_FAILED_CT" -gt 0 ]; then
  echo "[FAIL] $TEST_FAILED_CT tests actually failing"
  TEST_FAIL=1
elif [ "$TEST_EXIT" -ne 0 ]; then
  echo "[FAIL] npm test exited non-zero ($TEST_EXIT) — may not have run"
  TEST_FAIL=1
else
  ok "All local tests passing ($CURRENT_CT)"
fi

# Baseline comparison — warn-only because handoff tracks Docker
# full suite (818) while local npm test runs server subset (74)
if [ "$HANDOFF_BASELINE" -gt 0 ] && [ "$CURRENT_CT" -gt 0 ] && [ "$HANDOFF_BASELINE" -ne "$CURRENT_CT" ]; then
  warn "Baseline mismatch: local=$CURRENT_CT vs handoff=$HANDOFF_BASELINE (different test scopes — Docker full suite vs local server)"
fi

# ── 9. SSL Certificates ─────────────────────────────────────
echo ""
echo "--- SSL Certificates ---"
for DOMAIN in ai.geekspace.space staging.agentin.chat; do
  EXPIRY=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN":443 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2 || echo "")
  if [ -n "$EXPIRY" ]; then
    EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s 2>/dev/null || echo "0")
    NOW_EPOCH=$(date +%s)
    DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
    if [ "$DAYS_LEFT" -gt 14 ]; then
      ok "$DOMAIN: ${DAYS_LEFT}d until expiry"
    elif [ "$DAYS_LEFT" -gt 0 ]; then
      warn "$DOMAIN: only ${DAYS_LEFT}d until expiry"
    else
      crit "$DOMAIN: certificate EXPIRED"
    fi
  else
    warn "$DOMAIN: could not check SSL"
  fi
done

# ── Summary ──────────────────────────────────────────────────
echo ""
echo "=========================================="
TOTAL=$((PASS + CRIT + WARN))
echo "  Checks: $TOTAL total — $PASS ok, $CRIT critical, $WARN warn"
if [ "$TEST_FAIL" -gt 0 ]; then
  echo "  Tests:  FAILING ($TEST_FAILED_CT failures)"
fi

if [ "$CRIT" -gt 0 ]; then
  echo "  Status: CRITICAL — infra issues need immediate attention"
  echo "=========================================="
  exit 1
elif [ "$TEST_FAIL" -gt 0 ]; then
  echo "  Status: TEST FAILURES — unit tests not passing"
  echo "=========================================="
  exit 2
else
  echo "  Status: ALL CLEAR"
  echo "=========================================="
  exit 0
fi
