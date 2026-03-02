#!/usr/bin/env bash
# ============================================================
# cronicle-launch-check-wrapper.sh — Cronicle daily pre-launch check
#
# Schedule: 08:00 IST (02:30 UTC) daily
# Runs launch-check.sh and posts summary to Telegram.
#
# Cronicle Job Config:
#   ID:       gs_prelaunch_check
#   Schedule: "02 30 * * *" (02:30 UTC = 08:00 IST)
#   Script:   /host/GeekSpace2.0/scripts/cronicle-launch-check-wrapper.sh
# ============================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

DATE=$(date +%Y%m%d)
TIMESTAMP=$(date +%Y%m%dT%H%M%S)
REPORT_FILE="ops/reports/launch-check-${DATE}.txt"

echo "[launch-check] Starting at ${TIMESTAMP}"

# Run the launch check
EXIT_CODE=0
bash "${SCRIPT_DIR}/launch-check.sh" http://localhost:3001 || EXIT_CODE=$?

# Summarise
PASS=$(grep -c '✅' "$REPORT_FILE" 2>/dev/null || echo 0)
FAIL=$(grep -c '❌' "$REPORT_FILE" 2>/dev/null || echo 0)
WARN=$(grep -c '⚠️' "$REPORT_FILE" 2>/dev/null || echo 0)

if [ "$EXIT_CODE" -eq 0 ]; then
  STATUS="✅ ALL CLEAR"
else
  STATUS="❌ FAILURES: ${FAIL}"
fi

MSG="🚀 Agentin Chat — Pre-Launch Check (${DATE})
${STATUS}
✅ ${PASS} passed | ⚠️ ${WARN} warnings | ❌ ${FAIL} failed
Report: ops/reports/launch-check-${DATE}.txt"

# Post to Telegram (non-fatal if fails)
if [ -f "${SCRIPT_DIR}/notify-telegram.sh" ]; then
  bash "${SCRIPT_DIR}/notify-telegram.sh" "$MSG" || true
else
  echo "[launch-check] notify-telegram.sh not found — skipping Telegram notification"
fi

echo "[launch-check] Done. Exit: ${EXIT_CODE}"
exit "$EXIT_CODE"
