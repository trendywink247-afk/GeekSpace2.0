#!/bin/bash
# ============================================================
# OpenClaw Autonomous Session Runner
#
# Reads the current phase prompt from ops/current-phase-prompt.txt
# and runs it via `claude --print`, then notifies via Telegram.
#
# Usage:
#   ./scripts/openclaw-auto.sh
#
# The prompt file is written by write-phase-prompt.sh.
# This script is idempotent — safe to run multiple times.
# ============================================================
set -euo pipefail

REPO="/root/GeekSpace2.0"
PROMPT_FILE="$REPO/ops/current-phase-prompt.txt"
LOG_DIR="$REPO/ops/reports"
LOG="$LOG_DIR/auto-$(date +%Y%m%d-%H%M%S).log"

mkdir -p "$LOG_DIR"

if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "❌ No prompt file at $PROMPT_FILE" | tee "$LOG"
  exit 1
fi

echo "🚀 OpenClaw session starting: $(date)" | tee "$LOG"
echo "Prompt preview: $(head -3 "$PROMPT_FILE")" | tee -a "$LOG"

cd "$REPO"
claude --print < "$PROMPT_FILE" 2>&1 | tee -a "$LOG"

EXIT_CODE=${PIPESTATUS[0]}
SUMMARY=$(tail -10 "$LOG" | tr '\n' ' ')

# Publish log to here.now for phone review (optional)
HERENOW_URL=""
if command -v curl &> /dev/null && command -v jq &> /dev/null; then
  HERENOW_URL=$(curl -s -X POST https://here.now/api/publish \
    -H "Content-Type: text/plain" \
    --data-binary @"$LOG" 2>/dev/null | jq -r '.url // empty' 2>/dev/null || true)
fi

# Notify via Telegram (requires /root/.secrets/telegram.env with
# TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID)
if [[ -f "/root/.secrets/telegram.env" ]]; then
  # shellcheck source=/dev/null
  source /root/.secrets/telegram.env

  if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]]; then
    STATUS_EMOJI="$([ $EXIT_CODE -eq 0 ] && echo '✅ SUCCESS' || echo '❌ FAILED')"
    MSG="🤖 OpenClaw session complete
Status: ${STATUS_EMOJI}
Time: $(date)
Summary: ${SUMMARY:0:200}${HERENOW_URL:+
Log: $HERENOW_URL}"

    curl -s -X POST \
      "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      -d "text=${MSG}" \
      > /dev/null 2>&1 || true
  fi
fi

# Publish handoff after successful session
if [[ $EXIT_CODE -eq 0 ]] && [[ -f "$REPO/scripts/publish-handoff.sh" ]]; then
  bash "$REPO/scripts/publish-handoff.sh" || true
fi

echo "Session complete. Exit: $EXIT_CODE" | tee -a "$LOG"
exit $EXIT_CODE
