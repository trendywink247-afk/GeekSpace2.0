#!/usr/bin/env bash
# ============================================================
# GeekSpace Smoke Test Suite
# Hits key API endpoints and reports pass/fail
# Usage: ./scripts/smoke-test.sh [base_url]
# ============================================================

set -euo pipefail

BASE="${1:-http://localhost:3001}"
TEST_EMAIL="${2:-alex@example.com}"
TEST_PASSWORD="${3:-demo123}"
PASS=0
FAIL=0

green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
red()   { printf '\033[0;31m%s\033[0m\n' "$1"; }
bold()  { printf '\033[1m%s\033[0m\n' "$1"; }

check() {
  local name="$1"
  local method="$2"
  local path="$3"
  local expected_status="${4:-200}"
  local body="${5:-}"

  local args=(-s -o /dev/null -w '%{http_code}' -X "$method")
  if [ -n "$body" ]; then
    args+=(-H 'Content-Type: application/json' -d "$body")
  fi

  local status
  status=$(curl "${args[@]}" "${BASE}${path}" 2>/dev/null || echo "000")

  if [ "$status" = "$expected_status" ]; then
    green "  PASS  $name ($status)"
    PASS=$((PASS + 1))
  else
    red "  FAIL  $name (got $status, expected $expected_status)"
    FAIL=$((FAIL + 1))
  fi
}

check_auth() {
  local name="$1"
  local method="$2"
  local path="$3"
  local expected_status="${4:-200}"
  local body="${5:-}"

  local args=(-s -o /dev/null -w '%{http_code}' -X "$method" -H "Authorization: Bearer $TOKEN")
  if [ -n "$body" ]; then
    args+=(-H 'Content-Type: application/json' -d "$body")
  fi

  local status
  status=$(curl "${args[@]}" "${BASE}${path}" 2>/dev/null || echo "000")

  if [ "$status" = "$expected_status" ]; then
    green "  PASS  $name ($status)"
    PASS=$((PASS + 1))
  else
    red "  FAIL  $name (got $status, expected $expected_status)"
    FAIL=$((FAIL + 1))
  fi
}

check_sse() {
  local name="$1"
  local path="$2"

  local output
  output=$(curl -s -N --max-time 8 -H "Authorization: Bearer $TOKEN" "${BASE}${path}" 2>/dev/null | head -1 || echo "")

  if echo "$output" | grep -q "data:"; then
    green "  PASS  $name (SSE streaming)"
    PASS=$((PASS + 1))
  else
    red "  FAIL  $name (no SSE data received)"
    FAIL=$((FAIL + 1))
  fi
}

bold "=========================================="
bold "  GeekSpace Smoke Test"
bold "  Target: $BASE"
bold "=========================================="
echo ""

# ---- Public endpoints ----
bold "[Public Endpoints]"
check "GET /api/health" GET "/api/health"
check "GET /api/billing/plans" GET "/api/billing/plans"
check "GET /api/agent/personalities" GET "/api/agent/personalities"

echo ""

# ---- Auth ----
bold "[Authentication]"
TOKEN=$(curl -s -X POST "${BASE}/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}" \
  2>/dev/null | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  green "  PASS  POST /api/auth/login (got JWT)"
  PASS=$((PASS + 1))
else
  red "  FAIL  POST /api/auth/login (no token)"
  FAIL=$((FAIL + 1))
  bold "Cannot continue without auth token. Aborting."
  exit 1
fi

echo ""

# ---- Authenticated endpoints ----
bold "[Authenticated Endpoints]"
check_auth "GET /api/agent/config" GET "/api/agent/config"
check_auth "GET /api/billing/plan" GET "/api/billing/plan"
check_auth "GET /api/billing/usage" GET "/api/billing/usage"
check_auth "GET /api/recipes" GET "/api/recipes"
check_auth "GET /api/pico/agents" GET "/api/pico/agents"
check_auth "GET /api/usage/summary" GET "/api/usage/summary"

echo ""

# ---- SSE ----
bold "[SSE Streams]"
check_sse "GET /api/health/stream" "/api/health/stream"

echo ""

# ---- Summary ----
bold "=========================================="
TOTAL=$((PASS + FAIL))
if [ "$FAIL" -eq 0 ]; then
  green "  ALL $TOTAL TESTS PASSED"
else
  red "  $FAIL/$TOTAL TESTS FAILED"
fi
bold "=========================================="

exit "$FAIL"
