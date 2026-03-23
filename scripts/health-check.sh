#!/bin/bash
# GeekSpace Health Check — runs every 4 hours via cron
# Checks all system components and logs results

LOG="/var/log/geekspace-health.log"
API="http://localhost:3001"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
FAILURES=""
NOTIFY="/root/GeekSpace2.0/scripts/notify-telegram.sh"

log() { echo "[$TIMESTAMP] $*" | tee -a "$LOG"; }

log "=== GeekSpace Health Check ==="

# 1. API health endpoint
HEALTH=$(curl -sf "$API/api/health" 2>/dev/null)
if [ $? -eq 0 ]; then
  log "API: OK"
  echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); [print(f'  {k}: {v}') for k,v in d.items() if k!='timestamp']" 2>/dev/null | tee -a "$LOG"
else
  log "API: FAILED — geekspace-app may be down"
  FAILURES="${FAILURES}\n- API health endpoint unreachable"
fi

# 2. Docker containers
log "Containers:"
docker ps --format "  {{.Names}}: {{.Status}}" | grep -E "geekspace|redis|picoclaw" | tee -a "$LOG"

# 3. Redis — pass auth flag if REDIS_PASSWORD is set
if [ -z "${REDIS_PASSWORD:-}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  ENV_FILE="${SCRIPT_DIR}/../.env"
  if [ -f "$ENV_FILE" ]; then
    REDIS_PASSWORD=$(grep -E '^REDIS_PASSWORD=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
  fi
fi
REDIS_AUTH=()
[ -n "${REDIS_PASSWORD:-}" ] && REDIS_AUTH=(-a "$REDIS_PASSWORD")

REDIS_PING=$(docker exec geekspace-redis redis-cli "${REDIS_AUTH[@]}" ping 2>/dev/null)
if [ "$REDIS_PING" = "PONG" ]; then
  log "Redis: OK"
else
  log "Redis: FAILED"
  FAILURES="${FAILURES}\n- Redis not responding"
fi

# 4. Disk space
DISK=$(df -h / | awk 'NR==2 {print $5 " used of " $2}')
log "Disk: $DISK"

# 5. Memory
MEM=$(free -m | awk '/^Mem:/{printf "%sMB used / %sMB total", $3, $2}')
log "Memory: $MEM"

log "=== Check complete ==="

# Telegram alert on failures
if [ -n "$FAILURES" ]; then
  log "Sending failure alert via Telegram..."
  "$NOTIFY" "$(printf '🔴 GeekSpace health check FAILED (%s):\n%b' "$TIMESTAMP" "$FAILURES")" 2>/dev/null \
    || log "WARN: Telegram notification failed"
fi
