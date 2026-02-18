#!/bin/bash
# GeekSpace Health Check — runs every 4 hours via cron
# Checks all system components and logs results

LOG="/var/log/geekspace-health.log"
API="http://localhost:3001"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

log() { echo "[$TIMESTAMP] $*" | tee -a "$LOG"; }

log "=== GeekSpace Health Check ==="

# 1. API health endpoint
HEALTH=$(curl -sf "$API/api/health" 2>/dev/null)
if [ $? -eq 0 ]; then
  log "API: OK"
  echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); [print(f'  {k}: {v}') for k,v in d.items() if k!='timestamp']" 2>/dev/null | tee -a "$LOG"
else
  log "API: FAILED — geekspace-app may be down"
fi

# 2. Docker containers
log "Containers:"
docker ps --format "  {{.Names}}: {{.Status}}" | grep -E "geekspace|redis|picoclaw" | tee -a "$LOG"

# 3. Redis
REDIS_PING=$(docker exec geekspace-redis redis-cli ping 2>/dev/null)
if [ "$REDIS_PING" = "PONG" ]; then
  log "Redis: OK"
else
  log "Redis: FAILED"
fi

# 4. Disk space
DISK=$(df -h / | awk 'NR==2 {print $5 " used of " $2}')
log "Disk: $DISK"

# 5. Memory
MEM=$(free -m | awk '/^Mem:/{printf "%sMB used / %sMB total", $3, $2}')
log "Memory: $MEM"

log "=== Check complete ==="
