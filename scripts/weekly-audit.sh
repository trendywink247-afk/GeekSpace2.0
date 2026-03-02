#!/bin/bash
set -euo pipefail

REPO="/data/.openclaw/workspace/repo"
DATE=$(date +%Y-%m-%d)
REPORT="$REPO/ops/reports/weekly-audit-$DATE.md"

# Source Telegram secrets if available
if [[ -f "/root/.secrets/telegram.env" ]]; then
  source /root/.secrets/telegram.env 2>/dev/null || true
fi

notify() {
  if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]]; then
    curl -s -X POST \
      "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      -d "text=$1" > /dev/null 2>&1 || true
  fi
}

notify "🔍 Weekly audit starting: $DATE"
cd "$REPO"

{
  echo "# Weekly Audit — $DATE"
  echo ""
  echo "## Infrastructure"
  docker ps --format "- {{.Names}}: {{.Status}}" 2>/dev/null || echo "Docker not available"
  echo ""
  echo "## Disk"
  df -h / 2>/dev/null | tail -1 | awk '{print "Used: "$3" / "$2" ("$5")"}' || echo "Disk check failed"
  echo ""
  echo "## Tests"
  cd server && npm test 2>&1 | grep -E "Tests|Test Files|passed|failed" | tail -3 || echo "Tests not available"
  cd "$REPO"
  echo ""
  echo "## Recent Errors (7 days)"
  docker logs geekspace-app --since 168h 2>&1 | \
    grep -iE "error|critical|fatal" | tail -10 2>/dev/null || echo "No recent errors or logs unavailable"
  echo ""
  echo "## API Response Times"
  for ep in "/api/health" "/api/usage/today" "/api/agent/personalities"; do
    T=$(curl -s -o /dev/null -w "%{time_total}" \
      "https://ai.geekspace.space$ep" 2>/dev/null || echo "fail")
    echo " $ep: ${T}s"
  done
  echo ""
  echo "## Queue Status"
  grep -cE "^DONE:" ops/phase-queue.txt 2>/dev/null | xargs -I{} echo "Completed phases: {}" || echo "Completed phases: 0"
  grep -cE "^PHASE:" ops/phase-queue.txt 2>/dev/null | xargs -I{} echo "Pending phases: {}" || echo "Pending phases: 0"
  echo ""
  echo "## Improvement Backlog"
  cat ops/IMPROVEMENT_BACKLOG.md 2>/dev/null | head -15 || echo "Empty"
} > "$REPORT"

# Create auto-audit prompt for auditor agent
cat > ops/phases/auto-weekly-audit.txt << 'AUDIT'
You are OpenClaw auditor for GeekSpace 2.0. Read ops/AI_HANDOFF.md first.

Run this audit and append findings to ops/IMPROVEMENT_BACKLOG.md:

SECURITY:
- grep -r "TODO\|FIXME\|HACK\|console.log" server/src/routes/ | head -10
- Check all admin routes have requireAdminToken middleware
- Check all user routes have requireAuth middleware

PERFORMANCE:
- Look for any db.prepare inside loops (N+1 query pattern)
- Check for missing await on async calls

MOBILE:
- grep -r "w-\[.*px\]" src/dashboard/ | grep -v node_modules | head -10
- List fixed pixel widths that could break mobile layout

DEPENDENCIES:
- npm audit 2>&1 | tail -5

For each HIGH finding: fix it now and commit.
For MED/LOW: append to ops/IMPROVEMENT_BACKLOG.md with date.

Commit any fixes: "fix(audit): weekly audit $(date +%Y-%m-%d)"
AUDIT

./scripts/spawn-agent.sh auditor ops/phases/auto-weekly-audit.txt 2>/dev/null || true

notify "📊 Weekly audit complete. Report: $REPORT"
echo "✅ Audit done: $REPORT"
