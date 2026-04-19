#!/usr/bin/env bash
# paperclip-watchdog.sh — Poll the Paperclip server health endpoint.
# If the server fails health checks for > 5 minutes, restart the container.
#
# Deployed via paperclip-watchdog.service (systemd).
# Logs go to journald; view with: journalctl -u paperclip-watchdog -f

set -uo pipefail

HEALTH_URL="${PAPERCLIP_HEALTH_URL:-http://localhost:3033/health}"
CONTAINER="${PAPERCLIP_CONTAINER:-docker-server-1}"
MAX_FAIL_SECONDS=300   # 5 minutes
CHECK_INTERVAL=30      # seconds between checks

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [paperclip-watchdog] $*"; }

fail_start=0

while true; do
  if curl -sf --max-time 5 "$HEALTH_URL" > /dev/null 2>&1; then
    if [ "$fail_start" -ne 0 ]; then
      log "Paperclip recovered — resetting failure timer"
    fi
    fail_start=0
  else
    now=$(date +%s)
    if [ "$fail_start" -eq 0 ]; then
      fail_start=$now
      log "Paperclip health check FAILED — starting failure timer"
    fi

    elapsed=$(( now - fail_start ))
    log "Paperclip unreachable for ${elapsed}s (threshold: ${MAX_FAIL_SECONDS}s)"

    if [ "$elapsed" -ge "$MAX_FAIL_SECONDS" ]; then
      log "Threshold exceeded — restarting container: $CONTAINER"
      docker restart "$CONTAINER" 2>&1 | while IFS= read -r line; do log "$line"; done
      fail_start=0
      log "Restart issued — sleeping 60s before next check"
      sleep 60
      continue
    fi
  fi

  sleep "$CHECK_INTERVAL"
done
