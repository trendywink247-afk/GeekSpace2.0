#!/usr/bin/env bash
# agentin-openclaw-alias-fix.sh
# Watchdog: ensure the openclaw container has the 'openclaw' alias
# on the geekspace-shared Docker network.
# Runs as a systemd timer every 2 minutes.
set -euo pipefail

NETWORK="geekspace-shared"
REQUIRED_ALIAS="openclaw"
LOG_TAG="openclaw-alias-fix"

log() { logger -t "$LOG_TAG" "$*"; echo "[$LOG_TAG] $*"; }

# 1. Find the openclaw container (name pattern: openclaw-*-openclaw-1)
CONTAINER=$(docker ps --format '{{.Names}}' | grep -E '^openclaw-.*-openclaw-1$' | head -1 || true)

if [ -z "$CONTAINER" ]; then
  log "SKIP: No running openclaw container found"
  exit 0
fi

# 2. Ensure network exists
docker network create "$NETWORK" 2>/dev/null || true

# 3. Check if container is connected to the network
CURRENT_ALIASES=$(docker inspect "$CONTAINER" \
  --format '{{json (index .NetworkSettings.Networks "'"$NETWORK"'").Aliases}}' 2>/dev/null || echo "null")

if [ "$CURRENT_ALIASES" = "null" ] || [ "$CURRENT_ALIASES" = "" ] || [ "$CURRENT_ALIASES" = "<no value>" ]; then
  # Not connected to the network at all
  log "Connecting $CONTAINER to $NETWORK with alias '$REQUIRED_ALIAS'"
  docker network connect --alias "$REQUIRED_ALIAS" "$NETWORK" "$CONTAINER"
  log "OK: Connected with alias"
  exit 0
fi

# 4. Check if the required alias is present
if echo "$CURRENT_ALIASES" | grep -q "\"$REQUIRED_ALIAS\""; then
  # All good — alias already present
  exit 0
fi

# 5. Alias missing — disconnect and reconnect with alias
log "WARN: $CONTAINER on $NETWORK but missing alias '$REQUIRED_ALIAS'. Reconnecting..."
docker network disconnect "$NETWORK" "$CONTAINER" 2>/dev/null || true
sleep 1
docker network connect --alias "$REQUIRED_ALIAS" "$NETWORK" "$CONTAINER"
log "OK: Reconnected $CONTAINER with alias '$REQUIRED_ALIAS'"
