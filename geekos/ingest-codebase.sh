#!/bin/bash
# Ingest key documentation into GeekOS dev companion
GEEKOS_URL="${GEEKOS_URL:-http://localhost:3000}"

echo "Ingesting codebase docs into GeekOS dev companion..."
echo "Target: $GEEKOS_URL"

cd /root/GeekSpace2.0 || exit 1

for doc in CLAUDE.md README.md docs/ARCHITECTURE.md docs/API.md docs/DEPLOYMENT.md; do
  if [ -f "$doc" ]; then
    echo "  Ingesting $doc..."
    curl -sf -X POST "$GEEKOS_URL/api/knowledge" \
      -H "Content-Type: application/json" \
      -d "{\"text\": $(cat "$doc" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'), \"source\": \"$doc\"}" || echo "  Warning: Failed to ingest $doc"
  fi
done

echo "Done. Codebase ingested into GeekOS."
