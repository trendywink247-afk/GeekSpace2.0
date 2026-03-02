#!/bin/bash
# ============================================================
# Publish AI Handoff
#
# Publishes ops/AI_HANDOFF.md to here.now after each phase
# and sends the URL via Telegram.
#
# Usage:
#   ./scripts/publish-handoff.sh
#
# Called automatically by openclaw-auto.sh after a successful
# session. Safe to run manually at any time.
# ============================================================
set -euo pipefail

HANDOFF="/root/GeekSpace2.0/ops/AI_HANDOFF.md"

if [[ ! -f "$HANDOFF" ]]; then
  echo "❌ No handoff file at $HANDOFF" >&2
  exit 1
fi

echo "📄 Publishing handoff..."

URL=""
if command -v curl &> /dev/null && command -v jq &> /dev/null; then
  URL=$(curl -s -X POST https://here.now/api/publish \
    -H "Content-Type: text/markdown" \
    --data-binary @"$HANDOFF" 2>/dev/null | jq -r '.url // empty' 2>/dev/null || true)
fi

if [[ -n "$URL" ]]; then
  echo "✅ Handoff published: $URL"
else
  echo "⚠️  here.now publish skipped (no URL returned)"
fi

# Notify via Telegram
if [[ -f "/root/.secrets/telegram.env" ]]; then
  # shellcheck source=/dev/null
  source /root/.secrets/telegram.env

  if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]]; then
    MSG="📄 Phase handoff ready${URL:+
Published: $URL}"
    curl -s -X POST \
      "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      -d "text=${MSG}" \
      > /dev/null 2>&1 || true
    echo "Telegram notification sent."
  fi
fi
