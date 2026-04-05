#!/bin/bash
# Nightly AI Audit — runs via Cronicle, dispatches to Claude Bridge
set -e

BRIDGE_URL="http://claude-bridge:8787"

# Check bridge health
if ! curl -sf "$BRIDGE_URL/health" > /dev/null 2>&1; then
  echo "ERROR: Claude Bridge not reachable at $BRIDGE_URL"
  exit 1
fi

echo "=== Starting nightly AI audit ==="
echo "Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Task 1: Run lint on changed files from last 24h
RESPONSE=$(curl -sf -X POST "$BRIDGE_URL/run" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Run these commands and report any issues:\n1. cd /workspace && git diff --name-only HEAD~1 -- \"*.ts\" \"*.tsx\" | head -20\n2. If there are changed files, run: npx eslint --max-warnings=0 on those files\n3. cd /workspace/server && npx tsc --noEmit 2>&1 | head -20\n4. cd /workspace && npx tsc -b --noEmit 2>&1 | head -20\nReport: PASS or FAIL with details.",
    "timeout": 300
  }' 2>/dev/null)

echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print('Lint/Type check:', 'PASS' if d.get('ok') else 'FAIL'); print(d.get('stdout','')[:500])" 2>/dev/null || echo "Failed to parse response"

echo ""
echo "=== Nightly audit complete ==="
