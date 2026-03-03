#!/bin/bash
# Usage: ./scripts/spawn-agent.sh [type] [prompt-file]
set -euo pipefail

REPO="/data/.openclaw/workspace/repo"
TYPE="${1:-builder}"
PROMPT_FILE="${2:-$REPO/ops/current-phase-prompt.txt}"
LOG="$REPO/ops/reports/agent-${TYPE}-$(date +%Y%m%d-%H%M%S).log"
PREAMBLE="$REPO/ops/agent-preambles/${TYPE}.txt"
CLAUDE_REMOTE="/data/bin/claude-remote"

notify() {
  if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]]; then
    curl -s -X POST \
      "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      -d "text=$1" > /dev/null 2>&1 || true
  fi
}

if [[ ! -f "$PROMPT_FILE" ]]; then
  notify "⚠️ spawn-agent: prompt file not found: $PROMPT_FILE"
  echo "Error: prompt file not found: $PROMPT_FILE" >&2
  exit 1
fi

if [[ ! -x "$CLAUDE_REMOTE" ]]; then
  notify "⚠️ spawn-agent: claude-remote not found at $CLAUDE_REMOTE"
  echo "Error: claude-remote not found at $CLAUDE_REMOTE" >&2
  exit 1
fi

mkdir -p "$(dirname "$LOG")"
notify "🤖 Spawning $TYPE agent: $(basename "$PROMPT_FILE")"

if [[ -f "$PREAMBLE" ]]; then
  cat "$PREAMBLE" "$PROMPT_FILE" | "$CLAUDE_REMOTE" 2>&1 | tee "$LOG"
else
  cat "$PROMPT_FILE" | "$CLAUDE_REMOTE" 2>&1 | tee "$LOG"
fi

EXIT=${PIPESTATUS[0]:-0}
SUMMARY=$(tail -5 "$LOG" 2>/dev/null | tr '\n' ' ' || echo "no output")
notify "$([ $EXIT -eq 0 ] && echo '✅' || echo '❌') $TYPE agent done: ${SUMMARY:0:200}"
exit $EXIT
