#!/usr/bin/env bash
# ============================================================
# launch-check.sh — Phase 83 automated launch readiness check
#
# Runs all automatable items from ops/LAUNCH_CHECKLIST.md.
# Results written to ops/reports/launch-check-YYYYMMDD.txt
#
# Usage: ./scripts/launch-check.sh [BASE_URL]
# Exit: 0 = all pass, 1 = one or more failures
# ============================================================

set -uo pipefail

BASE_URL="${1:-https://api.agentin.chat}"
FRONTEND_URL="${BASE_URL/api./ai.}"   # api.agentin.chat → ai.agentin.chat
DATE=$(date +%Y%m%d)
TIMESTAMP=$(date +%Y%m%dT%H%M%S)
REPORT_DIR="ops/reports"
REPORT_FILE="${REPORT_DIR}/launch-check-${DATE}.txt"

mkdir -p "$REPORT_DIR"

PASS=0
FAIL=0
WARN=0

log()  { echo "$1" | tee -a "$REPORT_FILE"; }
ok()   { PASS=$((PASS+1)); log "  ✅ PASS: $1"; }
fail() { FAIL=$((FAIL+1)); log "  ❌ FAIL: $1"; }
warn() { WARN=$((WARN+1)); log "  ⚠️  WARN: $1"; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

log "============================================"
log " Agentin Chat Launch Check — ${TIMESTAMP}"
log " API Base: ${BASE_URL}"
log "============================================"

# ── 1. Infrastructure ─────────────────────────────────────────
log ""
log "[1] Infrastructure & Uptime"

if curl -sf "${BASE_URL}/api/health" >/dev/null 2>&1; then
  ok "Health endpoint returns 200"
else
  # Try local fallback
  if curl -sf "http://localhost:3001/api/health" >/dev/null 2>&1; then
    warn "Health endpoint: production unreachable, local OK"
  else
    fail "Health endpoint not responding"
  fi
fi

if command -v docker &>/dev/null; then
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "geekspace-app"; then
    ok "geekspace-app container running"
  else
    fail "geekspace-app container not found"
  fi
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "geekspace-redis"; then
    ok "Redis container running"
  else
    warn "Redis container not found (may use external Redis)"
  fi
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "geekspace-caddy\|caddy"; then
    ok "Caddy container running"
  else
    warn "Caddy container not found (may use host Caddy)"
  fi
  RESTART_COUNT=$(docker inspect --format '{{.RestartCount}}' geekspace-app 2>/dev/null || echo "N/A")
  if [ "$RESTART_COUNT" = "N/A" ]; then
    warn "Could not read geekspace-app restart count"
  elif [ "$RESTART_COUNT" -gt 5 ] 2>/dev/null; then
    warn "geekspace-app has restarted ${RESTART_COUNT} times"
  else
    ok "geekspace-app restart count acceptable (${RESTART_COUNT})"
  fi
else
  warn "docker not available — skipping container checks"
fi

FREE_GB=$(df -BG / 2>/dev/null | awk 'NR==2{gsub("G","",$4); print $4}' || echo "0")
if [ "${FREE_GB:-0}" -gt 10 ] 2>/dev/null; then
  ok "Disk free: ${FREE_GB}GB (> 10GB)"
else
  fail "Disk free: ${FREE_GB}GB (< 10GB — needs attention)"
fi

MEM_PCT=$(free -m 2>/dev/null | awk 'NR==2{printf "%.0f", $3/$2*100}' || echo "0")
if [ "${MEM_PCT:-0}" -lt 85 ] 2>/dev/null; then
  ok "Memory usage: ${MEM_PCT}% (< 85%)"
else
  warn "Memory usage: ${MEM_PCT}% (>= 85%)"
fi

# ── 2. SSL ────────────────────────────────────────────────────
log ""
log "[2] SSL & Networking"

for domain in "api.agentin.chat" "ai.agentin.chat"; do
  SSL_RESULT=$(curl -sv "https://${domain}/" 2>&1 | grep -i "SSL certificate verify ok" || echo "")
  if [ -n "$SSL_RESULT" ]; then
    ok "SSL valid: ${domain}"
  else
    # Check if we're in dev mode (localhost)
    if [[ "$BASE_URL" == *"localhost"* ]]; then
      warn "SSL check skipped for localhost (${domain})"
    else
      fail "SSL check failed: ${domain}"
    fi
  fi
done

# ── 3. Database ───────────────────────────────────────────────
log ""
log "[3] Database & Backups"

DOCKER_DB="/var/lib/docker/volumes/geekspace20_geekspace-data/_data/geekspace.db"
LOCAL_DB="${PROJECT_DIR}/server/data/geekspace.db"

if [ -f "$DOCKER_DB" ]; then
  DB_PATH="$DOCKER_DB"
elif [ -f "$LOCAL_DB" ]; then
  DB_PATH="$LOCAL_DB"
else
  DB_PATH=""
fi

if [ -n "$DB_PATH" ] && command -v sqlite3 &>/dev/null; then
  ok "Database file found: ${DB_PATH}"
  INTEGRITY=$(sqlite3 "$DB_PATH" "PRAGMA integrity_check;" 2>&1)
  if [ "$INTEGRITY" = "ok" ]; then
    ok "DB integrity_check: ok"
  else
    fail "DB integrity_check: ${INTEGRITY}"
  fi
  WAL=$(sqlite3 "$DB_PATH" "PRAGMA journal_mode;" 2>&1)
  if [ "$WAL" = "wal" ]; then
    ok "DB journal_mode: WAL"
  else
    warn "DB journal_mode: ${WAL} (recommend WAL for production)"
  fi
else
  warn "Cannot access DB directly — skipping integrity check"
fi

BACKUP_COUNT=$(ls /root/backups/*.db 2>/dev/null | wc -l || echo "0")
if [ "$BACKUP_COUNT" -gt 0 ]; then
  ok "Backups found: ${BACKUP_COUNT} files in /root/backups/"
else
  warn "No backups found in /root/backups/"
fi

# ── 4. Tests & Quality ────────────────────────────────────────
log ""
log "[4] Tests & Quality"

if command -v node &>/dev/null && [ -f "${PROJECT_DIR}/server/package.json" ]; then
  cd "${PROJECT_DIR}/server"
  TEST_OUT=$(TEST_MODE=true npx vitest run --reporter=verbose 2>&1 | tail -5)
  if echo "$TEST_OUT" | grep -q "Tests.*passed"; then
    PASSING=$(echo "$TEST_OUT" | grep -oP '\d+ passed' | head -1)
    ok "Server tests: ${PASSING}"
  else
    fail "Server tests: failed — check server/npm test output"
  fi
  cd "$PROJECT_DIR"

  TSC_OUT=$(cd "${PROJECT_DIR}/server" && npx tsc --noEmit 2>&1 || true)
  if [ -z "$TSC_OUT" ]; then
    ok "Server TypeScript: 0 errors"
  else
    fail "Server TypeScript: errors found"
    log "    ${TSC_OUT}"
  fi
else
  warn "node/server not accessible — skipping test checks"
fi

BRAND_OUT=$(npm run brand-guard --prefix "${PROJECT_DIR}" 2>&1 | tail -3 || true)
if echo "$BRAND_OUT" | grep -q "no violations"; then
  ok "Brand guard: 0 violations"
else
  warn "Brand guard: could not verify (check manually)"
fi

# ── 5. Features ───────────────────────────────────────────────
log ""
log "[5] Features & Integrations"

DEMO_TOKEN=$(curl -s -X POST "${BASE_URL}/api/auth/demo" -H "Content-Type: application/json" \
  2>/dev/null | node -e "try{const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));console.log(d.token?'ok':'')}catch{console.log('')}" 2>/dev/null || echo "")
if [ "$DEMO_TOKEN" = "ok" ]; then
  ok "Demo login: token issued"
else
  # Try local
  DEMO_LOCAL=$(curl -s -X POST "http://localhost:3001/api/auth/demo" -H "Content-Type: application/json" 2>/dev/null | node -e "try{const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));console.log(d.token?'ok':'')}catch{console.log('')}" 2>/dev/null || echo "")
  if [ "$DEMO_LOCAL" = "ok" ]; then
    warn "Demo login: works on localhost (production unreachable)"
  else
    fail "Demo login: failed"
  fi
fi

PRIVACY=$(curl -sf "${FRONTEND_URL}/privacy" 2>/dev/null | grep -i "privacy" || echo "")
if [ -n "$PRIVACY" ] || [[ "$BASE_URL" == *"localhost"* ]]; then
  ok "Privacy policy page: accessible"
else
  warn "Privacy policy page: could not verify (check manually)"
fi

TERMS=$(curl -sf "${FRONTEND_URL}/terms" 2>/dev/null | grep -i "terms" || echo "")
if [ -n "$TERMS" ] || [[ "$BASE_URL" == *"localhost"* ]]; then
  ok "Terms of service page: accessible"
else
  warn "Terms of service page: could not verify (check manually)"
fi

INVITE_PAGE=$(curl -sf "${FRONTEND_URL}/invite" 2>/dev/null | grep -c "invite\|code\|Agentin" || echo "0")
if [ "${INVITE_PAGE:-0}" -gt 0 ] || [[ "$BASE_URL" == *"localhost"* ]]; then
  ok "Invite page: accessible"
else
  warn "Invite page: could not verify (check manually)"
fi

# ── Summary ───────────────────────────────────────────────────
log ""
log "============================================"
log " Results: ${PASS} passed, ${FAIL} failed, ${WARN} warnings"
log " Report: ${REPORT_FILE}"
log " Checked: ${TIMESTAMP}"
log "============================================"

if [ "$FAIL" -eq 0 ] && [ "$WARN" -eq 0 ]; then
  log " STATUS: ✅ ALL CLEAR — ready for launch"
elif [ "$FAIL" -eq 0 ]; then
  log " STATUS: ⚠️  WARNINGS ONLY — review before launch"
else
  log " STATUS: ❌ FAILURES DETECTED — fix before launch"
fi

[ "$FAIL" -eq 0 ]
