#!/usr/bin/env bash
# ============================================================
# GeekSpace Staging Smoke Tests
# Runs key endpoint checks against staging.agentin.chat
# Usage: ./scripts/smoke-staging.sh [base_url]
# ============================================================
set -euo pipefail

BASE="${1:-https://staging.agentin.chat}"
PASS=0
FAIL=0
WARN=0
TOKEN=""

green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
red()   { printf '\033[0;31m%s\033[0m\n' "$1"; }
yellow(){ printf '\033[0;33m%s\033[0m\n' "$1"; }
bold()  { printf '\033[1m%s\033[0m\n' "$1"; }

check() {
  local name="$1" method="$2" path="$3" expected="${4:-200}" body="${5:-}"
  local args=(-s -o /dev/null -w '%{http_code}' -X "$method" --max-time 15)
  [ -n "$body" ] && args+=(-H 'Content-Type: application/json' -d "$body")

  local status
  status=$(curl "${args[@]}" "${BASE}${path}" 2>/dev/null || echo "000")

  if [ "$status" = "$expected" ]; then
    green "  PASS  $name ($status)"
    PASS=$((PASS + 1))
  else
    red "  FAIL  $name (got $status, expected $expected)"
    FAIL=$((FAIL + 1))
  fi
}

check_auth() {
  local name="$1" method="$2" path="$3" expected="${4:-200}"
  local args=(-s -o /dev/null -w '%{http_code}' -X "$method" --max-time 15)
  args+=(-H "Authorization: Bearer $TOKEN")

  local status
  status=$(curl "${args[@]}" "${BASE}${path}" 2>/dev/null || echo "000")

  if [ "$status" = "$expected" ]; then
    green "  PASS  $name ($status)"
    PASS=$((PASS + 1))
  else
    red "  FAIL  $name (got $status, expected $expected)"
    FAIL=$((FAIL + 1))
  fi
}

bold "=========================================="
bold "  GeekSpace Staging Smoke Tests"
bold "  Target: $BASE"
bold "=========================================="
echo ""

# ---- 1. Health ----
bold "[Health]"
check "GET /api/health" GET "/api/health"
echo ""

# ---- 2. Public endpoints ----
bold "[Public Endpoints]"
check "GET /api/billing/plans" GET "/api/billing/plans"
check "GET /api/agent/personalities" GET "/api/agent/personalities"
echo ""

# ---- 3. Auth ----
bold "[Authentication]"

# Register a staging test user (idempotent — 201 = created, 409 = exists)
REG_STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X POST "${BASE}/api/auth/signup" \
  -H 'Content-Type: application/json' \
  -d '{"email":"staging-smoke@test.local","password":"SmokeTest2026!","username":"smoke_test","name":"Smoke Test"}' \
  --max-time 15 2>/dev/null || echo "000")

if [ "$REG_STATUS" = "200" ] || [ "$REG_STATUS" = "201" ] || [ "$REG_STATUS" = "409" ]; then
  green "  PASS  User registration ($REG_STATUS)"
  PASS=$((PASS + 1))
else
  yellow "  WARN  User registration ($REG_STATUS)"
  WARN=$((WARN + 1))
fi

# Login
LOGIN_RESP=$(curl -s -X POST "${BASE}/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"staging-smoke@test.local","password":"SmokeTest2026!"}' \
  --max-time 15 2>/dev/null || echo "{}")

TOKEN=$(echo "$LOGIN_RESP" | grep -o '"token":"[^"]*"' | cut -d'"' -f4 || true)

if [ -n "$TOKEN" ]; then
  green "  PASS  POST /api/auth/login (got JWT)"
  PASS=$((PASS + 1))
else
  red "  FAIL  POST /api/auth/login (no token)"
  FAIL=$((FAIL + 1))
  bold ""
  bold "  Skipping authenticated endpoint tests (no token)."
  TOKEN=""
fi
echo ""

# ---- 4. Authenticated endpoints ----
if [ -n "$TOKEN" ]; then
  bold "[Authenticated Endpoints]"
  check_auth "GET /api/agent/config" GET "/api/agent/config"
  check_auth "GET /api/billing/plan" GET "/api/billing/plan"
  check_auth "GET /api/billing/usage" GET "/api/billing/usage"
  check_auth "GET /api/reminders" GET "/api/reminders"
  check_auth "GET /api/usage/summary" GET "/api/usage/summary"
  echo ""
fi

# ---- 5. Frontend ----
bold "[Frontend]"
FRONTEND_STATUS=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "${BASE}/" 2>/dev/null || echo "000")
if [ "$FRONTEND_STATUS" = "200" ] || [ "$FRONTEND_STATUS" = "302" ] || [ "$FRONTEND_STATUS" = "308" ]; then
  green "  PASS  Frontend loads ($FRONTEND_STATUS)"
  PASS=$((PASS + 1))
else
  red "  FAIL  Frontend (got $FRONTEND_STATUS)"
  FAIL=$((FAIL + 1))
fi
echo ""

# ---- Summary ----
bold "=========================================="
TOTAL=$((PASS + FAIL + WARN))
if [ "$FAIL" -eq 0 ]; then
  green "  ALL $TOTAL CHECKS PASSED ($WARN warnings)"
else
  red "  $FAIL/$TOTAL CHECKS FAILED ($WARN warnings)"
fi
bold "=========================================="

exit "$FAIL"
