#!/bin/bash
# deploy-and-test.sh — One command: build, deploy, smoke, report
# Usage: ./scripts/deploy-and-test.sh [--skip-backend] [--skip-live-test]
set -e
cd /root/GeekSpace2.0

echo "========================================"
echo "  AGENTIN DEPLOY + SMOKE PIPELINE"
echo "  $(date)"
echo "========================================"

SKIP_BACKEND=false
SKIP_LIVE=false
for arg in "$@"; do
  case $arg in
    --skip-backend) SKIP_BACKEND=true ;;
    --skip-live-test) SKIP_LIVE=true ;;
  esac
done

# -- GATE: TypeScript must be clean
echo "[1/7] TypeScript check..."
npx tsc --noEmit || { echo "FAIL: Frontend TS errors"; exit 1; }
cd server && npx tsc --noEmit && cd .. || { echo "FAIL: Server TS errors"; exit 1; }
echo "  OK: TypeScript clean"

# -- GATE: Tests must pass
echo "[2/7] Running tests..."
cd server
TEST_OUTPUT=$(npm test -- --reporter=dot 2>&1)
PASS=$(echo "$TEST_OUTPUT" | grep -oP '\d+(?= passed)' | tail -1)
if [ -z "$PASS" ] || [ "$PASS" -lt 2429 ]; then
  echo "FAIL: Test count below 2429. Got: ${PASS:-0}"
  echo "$TEST_OUTPUT" | tail -10
  exit 1
fi
echo "  OK: $PASS tests passing"
cd ..

# -- GATE: Brand guard
echo "[3/7] Brand guard..."
npm run brand-guard > /dev/null 2>&1 || { echo "FAIL: Brand violations"; exit 1; }
echo "  OK: Brand clean"

# -- BUILD
echo "[4/7] Building..."
npm run build 2>&1 | tail -3

if [ "$SKIP_BACKEND" = false ]; then
  cd server && npm run build 2>&1 | tail -3 && cd ..
fi

# -- DEPLOY FRONTEND
echo "[5/7] Deploying frontend..."
find /var/www/geekspace/assets/ -name "index-*" -not -name "*.css" -delete 2>/dev/null || true
cp -r dist/assets/* /var/www/geekspace/assets/
cp dist/index.html /var/www/geekspace/index.html
echo "  OK: Frontend deployed"

# -- RESTART CONTAINER (if backend changed)
if [ "$SKIP_BACKEND" = false ]; then
  echo "[6/7] Restarting app container..."
  docker compose up -d --build geekspace 2>&1 | tail -3
  sleep 8
else
  echo "[6/7] Skipping backend restart (--skip-backend)"
fi

# -- HEALTH CHECK
echo "[7/7] Health check..."
HEALTH=$(curl -sf localhost:3001/api/health | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('status','unknown'))" 2>/dev/null || echo "unreachable")
if [ "$HEALTH" != "ok" ] && [ "$HEALTH" != "degraded" ]; then
  echo "FAIL: Health check: $HEALTH"
  docker compose logs geekspace --tail=20
  exit 1
fi
echo "  OK: Health: $HEALTH"

# -- OPTIONAL LIVE TEST
if [ "$SKIP_LIVE" = false ] && [ -f ops/agentin-live-test-v1.mjs ]; then
  if grep -q "ALIYA_EMAIL" .env 2>/dev/null && grep -q "ALIYA_PASS" .env 2>/dev/null; then
    echo ""
    echo "Running live agentic tests..."
    set -a && source .env && set +a
    PROMPT_DELAY_MS=3000 node ops/agentin-live-test-v1.mjs 2>&1 | tail -30
  else
    echo "  Skipping live test (ALIYA_EMAIL/ALIYA_PASS not in .env)"
  fi
else
  echo "  Skipping live test"
fi

echo ""
echo "========================================"
echo "  DEPLOY COMPLETE — ai.agentin.chat"
echo "  Tests: $PASS | Health: $HEALTH"
echo "  $(date)"
echo "========================================"
