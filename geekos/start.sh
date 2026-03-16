#!/bin/bash
set -e

echo "GeekOS — Starting Agentin Agent Runtime"

# Build space-separated list of --character args
ARGS=""
for f in /app/characters/*.character.json; do
  if [ -f "$f" ]; then
    echo "  Loading: $(basename "$f")"
    ARGS="$ARGS --character $f"
  fi
done

echo "Starting ElizaOS..."
exec npx elizaos start $ARGS
