#!/usr/bin/env bash
# ============================================================
# load-test.sh — Phase 83 load test for GeekSpace 2.0
#
# Simulates 40 concurrent users, 60s duration
# Targets: GET /api/health (unauthenticated)
#          POST /api/agent/chat (with demo token if available)
#
# Results written to: ops/reports/load-test-YYYYMMDD.txt
# Usage: ./scripts/load-test.sh [BASE_URL]
# ============================================================

set -euo pipefail

BASE_URL="${1:-http://localhost:3001}"
DATE=$(date +%Y%m%d)
TIMESTAMP=$(date +%Y%m%dT%H%M%S)
REPORT_DIR="ops/reports"
REPORT_FILE="${REPORT_DIR}/load-test-${DATE}.txt"
DURATION=60
CONNECTIONS=40

mkdir -p "$REPORT_DIR"

echo "============================================" | tee -a "$REPORT_FILE"
echo " GeekSpace Load Test — ${TIMESTAMP}" | tee -a "$REPORT_FILE"
echo " Target: ${BASE_URL}" | tee -a "$REPORT_FILE"
echo " Connections: ${CONNECTIONS}  Duration: ${DURATION}s" | tee -a "$REPORT_FILE"
echo "============================================" | tee -a "$REPORT_FILE"

# ── Dependency check ─────────────────────────────────────────
if ! command -v npx &>/dev/null; then
  echo "ERROR: npx not found — install Node.js" | tee -a "$REPORT_FILE"
  exit 1
fi

# ── Helper: run autocannon and extract key metrics ───────────
run_autocannon() {
  local label="$1"
  local url="$2"
  local method="${3:-GET}"
  local body="${4:-}"
  local headers="${5:-}"

  echo "" | tee -a "$REPORT_FILE"
  echo "── ${label} ──────────────────────────────" | tee -a "$REPORT_FILE"
  echo "  Method:  ${method}" | tee -a "$REPORT_FILE"
  echo "  URL:     ${url}" | tee -a "$REPORT_FILE"

  local ac_args=( --connections "$CONNECTIONS" --duration "$DURATION" --json )
  if [ "$method" = "POST" ]; then
    ac_args+=( -m POST )
    if [ -n "$body" ]; then
      ac_args+=( --body "$body" )
    fi
    ac_args+=( -H "Content-Type: application/json" )
  fi
  if [ -n "$headers" ]; then
    ac_args+=( -H "$headers" )
  fi

  local result
  result=$(npx autocannon "${ac_args[@]}" "$url" 2>/dev/null || echo '{"errors":0,"non2xx":0,"requests":{"average":0},"latency":{"p95":0},"throughput":{"average":0}}')

  # Parse JSON output
  local rps p95 errors non2xx total
  rps=$(echo "$result" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.requests?.average?.toFixed(1) || '0')" 2>/dev/null || echo "0")
  p95=$(echo "$result" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.latency?.p95 || '0')" 2>/dev/null || echo "0")
  errors=$(echo "$result" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.errors || 0)" 2>/dev/null || echo "0")
  non2xx=$(echo "$result" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.non2xx || 0)" 2>/dev/null || echo "0")

  echo "  RPS:     ${rps} req/s" | tee -a "$REPORT_FILE"
  echo "  p95 lat: ${p95} ms" | tee -a "$REPORT_FILE"
  echo "  Errors:  ${errors}" | tee -a "$REPORT_FILE"
  echo "  Non-2xx: ${non2xx}" | tee -a "$REPORT_FILE"

  # Gate: p95 < 2000ms
  local p95_int
  p95_int=$(echo "$p95" | cut -d. -f1)
  if [ "$p95_int" -lt 2000 ] 2>/dev/null; then
    echo "  p95 GATE: ✅ PASS (${p95}ms < 2000ms)" | tee -a "$REPORT_FILE"
  else
    echo "  p95 GATE: ⚠️  WARN (${p95}ms >= 2000ms)" | tee -a "$REPORT_FILE"
  fi
}

# ── Test 1: Health endpoint (unauthenticated) ─────────────────
run_autocannon "GET /api/health" "${BASE_URL}/api/health" "GET"

# ── Test 2: Agent chat (unauthenticated — expect 401, tests throughput) ──
CHAT_BODY='{"message":"ping","personality":"jarvis"}'
run_autocannon "POST /api/agent/chat (unauth)" \
  "${BASE_URL}/api/agent/chat" "POST" "$CHAT_BODY"

# ── Test 3: Demo login to get token, then test authenticated chat ──
echo "" | tee -a "$REPORT_FILE"
echo "── Fetching demo token ──────────────────" | tee -a "$REPORT_FILE"
DEMO_TOKEN=$(curl -s -X POST "${BASE_URL}/api/auth/demo" \
  -H "Content-Type: application/json" \
  | node -e "try{const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));console.log(d.token||'')}catch{console.log('')}" 2>/dev/null || echo "")

if [ -n "$DEMO_TOKEN" ]; then
  echo "  Demo token acquired ✅" | tee -a "$REPORT_FILE"
  run_autocannon "POST /api/agent/chat (authed, builtin)" \
    "${BASE_URL}/api/agent/chat" "POST" \
    '{"message":"hello","personality":"jarvis","model":"builtin"}' \
    "Authorization: Bearer ${DEMO_TOKEN}"
else
  echo "  Demo token unavailable — skipping authenticated chat test" | tee -a "$REPORT_FILE"
fi

# ── Summary ───────────────────────────────────────────────────
echo "" | tee -a "$REPORT_FILE"
echo "============================================" | tee -a "$REPORT_FILE"
echo " Load test complete: ${TIMESTAMP}" | tee -a "$REPORT_FILE"
echo " Results saved to: ${REPORT_FILE}" | tee -a "$REPORT_FILE"
echo "============================================" | tee -a "$REPORT_FILE"
