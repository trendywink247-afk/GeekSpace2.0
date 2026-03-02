#!/bin/bash
# Usage: ./scripts/spawn-agent.sh [type] [prompt-file]
set -euo pipefail

REPO="/data/.openclaw/workspace/repo"
TYPE="${1:-builder}"
PROMPT_FILE="${2:-$REPO/ops/current-phase-prompt.txt}"
LOG="$REPO/ops/reports/agent-${TYPE}-$(date +%Y%m%d-%H%M%S).log"
PREAMBLE="$REPO/ops/agent-preambles/${TYPE}.txt"

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

notify "🤖 Spawning $TYPE agent: $(basename "$PROMPT_FILE" 2>/dev/null || echo "unknown")"

if [[ -f "$PREAMBLE" ]]; then
  cat "$PREAMBLE" "$PROMPT_FILE" 2>&1 | tee "$LOG"
else
  cat "$PROMPT_FILE" 2>&1 | tee "$LOG"
fi

EXIT=${PIPESTATUS[0]:-0}
SUMMARY=$(tail -5 "$LOG" 2>/dev/null | tr '\n' ' ' || echo "no output")
notify "$([ $EXIT -eq 0 ] && echo '✅' || echo '❌') $TYPE agent done: ${SUMMARY:0:200}"
exit $EXIT
