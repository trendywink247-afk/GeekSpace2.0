#!/usr/bin/env bash
set -euo pipefail

if [[ -f /root/.secrets/telegram.env ]]; then
  set -a
  source /root/.secrets/telegram.env
  set +a
fi

: "${TELEGRAM_BOT_TOKEN:?Missing TELEGRAM_BOT_TOKEN}"
: "${TELEGRAM_CHAT_ID:?Missing TELEGRAM_CHAT_ID}"

MSG="${1:-"(no message)"}"
curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
  --data-urlencode "text=${MSG}" >/dev/null
