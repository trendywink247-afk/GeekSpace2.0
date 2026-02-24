#!/usr/bin/env bash
# phase-gate.sh — Core verification gate before commit/PR
# Usage: ./ops/phase-gate.sh [--skip-e2e]
set -euo pipefail

SKIP_E2E="${1:-}"
ROOT="$(git rev-parse --show-toplevel)"
PASS=0
FAIL=0

ok() { echo "  ✅ $1"; ((PASS++)) || true; }
fail() { echo "  ❌ $1"; ((FAIL++)) || true; }

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Phase Gate — GeekSpace 2.0"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Frontend lint
echo ""
echo "▶ Frontend lint..."
if cd "$ROOT" && npm run lint --silent 2>&1 | grep -q "0 errors"; then
  ok "Frontend lint"
elif cd "$ROOT" && npm run lint 2>&1 | grep -v "^$" | tail -3 | grep -q "0 errors"; then
  ok "Frontend lint"
else
  # Run and capture
  cd "$ROOT"
  if npm run lint 2>&1 | grep -E "error|Error" | head -5; then
    fail "Frontend lint — errors found"
  else
    ok "Frontend lint (warnings only)"
  fi
fi

# 2. Frontend typecheck
echo ""
echo "▶ Frontend typecheck..."
cd "$ROOT"
if npx tsc --noEmit 2>&1 | grep -q "error TS"; then
  npx tsc --noEmit 2>&1 | head -10
  fail "Frontend typecheck"
else
  ok "Frontend typecheck"
fi

# 3. Frontend build
echo ""
echo "▶ Frontend build..."
cd "$ROOT"
if npm run build 2>&1 | tail -3 | grep -qiE "error|failed"; then
  fail "Frontend build"
else
  ok "Frontend build"
fi

# 4. Server tests
echo ""
echo "▶ Server unit tests..."
cd "$ROOT/server"
TEST_OUTPUT=$(npm test 2>&1)
if echo "$TEST_OUTPUT" | grep -q "Tests.*passed"; then
  TOTAL=$(echo "$TEST_OUTPUT" | grep "Tests" | grep -oE "[0-9]+ passed" | head -1)
  ok "Server tests — $TOTAL"
else
  echo "$TEST_OUTPUT" | tail -10
  fail "Server tests"
fi

# 5. Server typecheck
echo ""
echo "▶ Server typecheck..."
cd "$ROOT/server"
if npx tsc --noEmit 2>&1 | grep -q "error TS"; then
  npx tsc --noEmit 2>&1 | head -10
  fail "Server typecheck"
else
  ok "Server typecheck"
fi

# 6. Server build
echo ""
echo "▶ Server build..."
cd "$ROOT/server"
if npm run build 2>&1 | grep -qiE "^error|Error TS"; then
  fail "Server build"
else
  ok "Server build"
fi

# 7. E2E (optional)
if [ "$SKIP_E2E" != "--skip-e2e" ]; then
  echo ""
  echo "▶ E2E smoke (chromium, --skip-e2e to skip)..."
  cd "$ROOT"
  if npx playwright test --project=chromium 2>&1 | grep -q "passed"; then
    ok "E2E tests"
  else
    fail "E2E tests — run 'npx playwright test' for details"
  fi
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: $PASS passed, $FAIL failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "🚫 Phase gate FAILED — fix issues before committing"
  exit 1
else
  echo "🚀 Phase gate PASSED — safe to commit and PR"
  exit 0
fi
