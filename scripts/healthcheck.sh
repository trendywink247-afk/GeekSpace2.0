#!/usr/bin/env bash
# ============================================================
# GeekSpace 2.0 — health check all components
# ============================================================
set -euo pipefail

PORT="${PORT:-3001}"
BRIDGE_PORT="${BRIDGE_PORT:-8787}"
OLLAMA_PORT="${OLLAMA_PORT:-11434}"

echo "=== GeekSpace API (port $PORT) ==="
curl -sf "http://localhost:$PORT/api/health" 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "  UNREACHABLE"

echo ""
echo "=== EDITH Bridge (port $BRIDGE_PORT) ==="
curl -sf "http://localhost:$BRIDGE_PORT/health" 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "  NOT RUNNING (start with: docker compose --profile edith up -d)"

echo ""
echo "=== Ollama (port $OLLAMA_PORT) ==="
MODELS=$(curl -sf "http://localhost:$OLLAMA_PORT/api/tags" 2>/dev/null)
if [ -n "$MODELS" ]; then
  echo "$MODELS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  Models: {len(d.get(\"models\",[]))}'); [print(f'    - {m[\"name\"]}') for m in d.get('models',[])]" 2>/dev/null || echo "  REACHABLE (could not parse models)"
else
  echo "  UNREACHABLE"
fi

echo ""
echo "=== Docker Containers ==="
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -i geekspace
