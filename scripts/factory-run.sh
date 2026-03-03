#!/bin/bash
set -euo pipefail

REPO="/data/.openclaw/workspace/repo"
QUEUE="$REPO/ops/phase-queue.txt"
LOG_DIR="$REPO/ops/reports"
CLAUDE_REMOTE="/data/bin/claude-remote"
MAX_PHASES=5

COMPLETED=0
FAILED=0
RESULTS=""

mkdir -p "$LOG_DIR"

notify() {
  local msg="$1"
  if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]]; then
    curl -s -X POST \
      "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      -d "text=${msg}" > /dev/null 2>&1 || true
  fi
}

if [[ ! -f "$QUEUE" ]]; then
  notify "⚠️ Factory: No queue at ops/phase-queue.txt"
  exit 1
fi

QUEUED=$(grep -c "^PHASE:" "$QUEUE" 2>/dev/null || echo 0)

if [[ "$QUEUED" -eq 0 ]]; then
  notify "💤 Factory: Queue empty — running health check"
  cd "$REPO"
  HEALTH=$(./scripts/smoke-staging.sh 2>&1 | tail -3 || echo "smoke test not available")
  notify "❤️ Health check done: $HEALTH"
  exit 0
fi

notify "🏭 Factory starting — $QUEUED phases queued, running up to $MAX_PHASES"

while IFS= read -r line && [[ $COMPLETED -lt $MAX_PHASES ]]; do
  [[ ! "$line" =~ ^PHASE: ]] && continue
  
  PHASE_NAME="${line#PHASE: }"
  
  # Format: PHASE: type:filename
  # e.g. PHASE: builder:phase-88-payments
  AGENT_TYPE="builder"
  PROMPT_NAME="$PHASE_NAME"
  
  if [[ "$PHASE_NAME" == *:* ]]; then
    AGENT_TYPE="${PHASE_NAME%%:*}"
    PROMPT_NAME="${PHASE_NAME##*:}"
  fi
  
  PROMPT_FILE="$REPO/ops/phases/$PROMPT_NAME.txt"
  LOG="$LOG_DIR/factory-$(date +%Y%m%d-%H%M%S)-${PROMPT_NAME}.log"
  
  if [[ ! -f "$PROMPT_FILE" ]]; then
    notify "⚠️ Prompt missing: ops/phases/$PROMPT_NAME.txt — skipping"
    sed -i "s|^PHASE: $PHASE_NAME$|SKIP: $PHASE_NAME (missing prompt)|" "$QUEUE"
    continue
  fi
  
  notify "🤖 [$((COMPLETED+1))/$MAX_PHASES] Starting $AGENT_TYPE agent: $PROMPT_NAME"
  START=$(date +%s)
  
  cd "$REPO"
  
  # Prepend agent preamble and pipe through Claude Code on the host
  PREAMBLE_FILE="$REPO/ops/agent-preambles/$AGENT_TYPE.txt"
  if [[ -f "$PREAMBLE_FILE" ]]; then
    cat "$PREAMBLE_FILE" "$PROMPT_FILE" | "$CLAUDE_REMOTE" 2>&1 | tee "$LOG"
  else
    cat "$PROMPT_FILE" | "$CLAUDE_REMOTE" 2>&1 | tee "$LOG"
  fi
  
  EXIT_CODE=${PIPESTATUS[0]:-0}
  END=$(date +%s)
  DURATION=$(( (END - START) / 60 ))
  
  if [[ $EXIT_CODE -eq 0 ]]; then
    COMPLETED=$((COMPLETED + 1))
    TESTS=$(grep -E "Tests.*passed|passed.*Tests|test.*pass" "$LOG" 2>/dev/null | tail -1 | tr -d '\n' || echo "")
    RESULTS="${RESULTS} ✅ $PROMPT_NAME (${DURATION}m) ${TESTS}"
    notify "✅ Done: $PROMPT_NAME in ${DURATION}m — ${TESTS}"
    sed -i "s|^PHASE: $PHASE_NAME$|DONE: $PHASE_NAME|" "$QUEUE"
  else
    FAILED=$((FAILED + 1))
    LAST=$(tail -5 "$LOG" 2>/dev/null | tr '\n' ' ' || echo "no log output")
    RESULTS="${RESULTS} ❌ $PROMPT_NAME FAILED: ${LAST:0:150}"
    notify "❌ FAILED: $PROMPT_NAME — stopping factory. Check: $LOG"
    break
  fi
  
  # 2 minute cooldown between phases
  [[ $COMPLETED -lt $MAX_PHASES ]] && sleep 120
done < "$QUEUE"

PENDING=$(grep -c "^PHASE:" "$QUEUE" 2>/dev/null || echo 0)

REPORT="🏭 Factory Report — $(date '+%Y-%m-%d %H:%M IST')
✅ Completed: $COMPLETED
❌ Failed: $FAILED
📋 Still queued: $PENDING
$RESULTS"

notify "$REPORT"
echo "$REPORT" > "$LOG_DIR/factory-$(date +%Y%m%d).txt"

echo "Factory done. Completed: $COMPLETED Failed: $FAILED"
