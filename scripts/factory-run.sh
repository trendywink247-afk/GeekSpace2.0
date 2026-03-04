#!/bin/bash
set -euo pipefail

REPO="/data/.openclaw/workspace/repo"
QUEUE="$REPO/ops/phase-queue.txt"
LOG_DIR="$REPO/ops/reports"
CLAUDE_REMOTE="/data/bin/claude-remote"
NOTIFY="/data/bin/notify"
PR_CREATE="/data/bin/pr-create"
WAIT_CI="/data/bin/wait-for-ci"
LOCK_FILE="/tmp/factory.lock"
MAX_PHASES=5
# CI retries: keep trying for up to 3 hours before giving up on a single PR
CI_MAX_HOURS=3
LAST_RUN_FILE="$LOG_DIR/.last-run"

COMPLETED=0
FAILED=0
PR_LINES=""

# Create lock file so /status can detect us; remove on any exit
touch "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT

mkdir -p "$LOG_DIR"
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$LAST_RUN_FILE"

notify() { "$NOTIFY" "$@" 2>/dev/null || true; }

# ── Auto-queue: if queue is empty, ask Claude to plan next phases ─────────────
auto_queue_if_empty() {
  local QUEUED
  QUEUED=$(grep -c "^PHASE:" "$QUEUE" 2>/dev/null || echo 0)
  [[ "$QUEUED" -gt 0 ]] && return 0

  notify "📋 Queue empty — asking Claude to plan next phases..."

  local PLANNER_LOG="$LOG_DIR/planner-$(date +%Y%m%d-%H%M%S).log"
  {
    echo "You are the Agentin Planner — the autonomous product manager and architect for Agentin (GeekSpace 2.0)."
    echo "The phase queue at ops/phase-queue.txt is now empty. Your job: plan the next 5 phases."
    echo ""
    echo "STEP 1 — Understand the current state:"
    echo "1. cd /root/GeekSpace2.0"
    echo "2. Read ops/AI_BACKLOG.md — this is your feature roadmap with quality standards"
    echo "3. Read ops/AI_HANDOFF.md — understand what was just built"
    echo "4. Read ops/phase-queue.txt — see DONE phases so you never duplicate"
    echo "5. Read ops/AI_LESSONS.md if it exists — learn from past mistakes"
    echo ""
    echo "STEP 2 — Choose 5 phases from AI_BACKLOG.md:"
    echo "- Pick from 🔴 High Priority first, then 🟡 Medium"
    echo "- Prefer features that compound: search + inbox + notes together > any one alone"
    echo "- Prefer features usable from Telegram (no-browser daily use)"
    echo "- Skip any feature that requires env vars not in the confirmed-available list in AI_BACKLOG.md"
    echo "- DO NOT pick phases already marked ✅ in AI_BACKLOG.md"
    echo ""
    echo "STEP 3 — Write a detailed prompt file for each phase at ops/phases/<phase-name>.txt"
    echo "Each prompt MUST follow this exact structure (80-120 lines, be specific):"
    echo "  ## Step 1 — Rehydrate: cd, checkout main, pull, read AI_HANDOFF.md + 2 relevant files"
    echo "  ## Step 2 — DB schema: exact CREATE TABLE SQL with all columns, indexes, foreign keys"
    echo "  ## Step 3 — Service: TypeScript function signatures, LLM call details, error handling"
    echo "  ## Step 4 — Routes: every HTTP endpoint with method, path, params, response shape"
    echo "  ## Step 5 — Frontend: component name, user interactions, nav group (Productivity/Communication/Insights/Automation)"
    echo "  ## Step 6 — Tests: list 30-40 specific test scenarios by name"
    echo "  ## Step 7 — Branch, commit, push: exact bash with branch name pattern ai/phase-\$(date +%Y%m%d)-<name>"
    echo "  Final line: Print: PHASE_COMPLETE: \$BRANCH <test_count>"
    echo ""
    echo "STEP 4 — Queue all 5 phases:"
    echo "Append to ops/phase-queue.txt (DO NOT remove DONE lines, DO NOT add duplicates):"
    echo "  PHASE: builder:<phase-name>"
    echo ""
    echo "STEP 5 — Commit and push:"
    echo "  git add ops/ && git commit -m 'chore(queue): auto-queue next 5 phases'"
    echo "  git push origin main"
    echo ""
    echo "STEP 6 — Print: QUEUE_UPDATED"
    echo ""
    echo "QUALITY BAR: Vague phase prompts produce vague code. Be as specific as the examples"
    echo "already in ops/phases/. Read 2-3 existing phase files to calibrate your output."
  } | "$CLAUDE_REMOTE" 2>&1 | tee "$PLANNER_LOG"

  if grep -q "QUEUE_UPDATED" "$PLANNER_LOG" 2>/dev/null; then
    local NEW_COUNT
    NEW_COUNT=$(grep -c "^PHASE:" "$QUEUE" 2>/dev/null || echo 0)
    notify "✅ Auto-queued $NEW_COUNT new phases — starting factory..."
    return 0
  else
    notify "⚠️ Auto-queue planner failed — add phases manually to ops/phase-queue.txt"
    return 1
  fi
}

if [[ ! -f "$QUEUE" ]]; then
  notify "⚠️ Factory: No queue at ops/phase-queue.txt"
  exit 1
fi

# Try auto-queue if empty
QUEUED=$(grep -c "^PHASE:" "$QUEUE" 2>/dev/null || echo 0)
if [[ "$QUEUED" -eq 0 ]]; then
  auto_queue_if_empty || exit 0
  QUEUED=$(grep -c "^PHASE:" "$QUEUE" 2>/dev/null || echo 0)
fi

if [[ "$QUEUED" -eq 0 ]]; then
  notify "💤 Factory: Queue still empty after auto-queue attempt"
  exit 0
fi

notify "🏭 Factory starting — $QUEUED phases queued (up to $MAX_PHASES this run)
$(date '+%d %b %Y %H:%M IST')"

# ── CI self-healing: retry until pass or CI_MAX_HOURS elapsed ─────────────────
ci_loop() {
  local PR_URL="$1"
  local BRANCH="$2"
  local PROMPT_NAME="$3"
  local CI_START
  CI_START=$(date +%s)
  local CI_RESULT="pending"
  local ATTEMPT=0

  while true; do
    ATTEMPT=$(( ATTEMPT + 1 ))
    local ELAPSED_H=$(( ( $(date +%s) - CI_START ) / 3600 ))

    # Hard time limit
    if [[ $ELAPSED_H -ge $CI_MAX_HOURS ]]; then
      notify "⏱️ CI time limit (${CI_MAX_HOURS}h) reached for $PROMPT_NAME — moving on"
      CI_RESULT="timeout"
      break
    fi

    if [[ -x "$WAIT_CI" ]]; then
      "$WAIT_CI" "$PR_URL" 20 >&2 2>/dev/null && CI_RESULT="passed" && break
      CI_RESULT="failed"
    else
      CI_RESULT="skipped"
      break
    fi

    notify "❌ CI failed (attempt $ATTEMPT) — fetching error and spawning fixer..."

    # Get the failed run ID
    local FAILED_RUN_ID
    FAILED_RUN_ID=$(ssh -n -i /data/.ssh/id_openclaw -o StrictHostKeyChecking=no root@172.22.0.1 \
      "cd /root/GeekSpace2.0 && GH_TOKEN=\$(grep GITHUB_DEV_TOKEN .env | cut -d= -f2) \
       gh run list --branch '$BRANCH' --json databaseId,conclusion --limit 5 2>/dev/null \
       | python3 -c \"import json,sys; runs=json.load(sys.stdin); r=[x for x in runs if x.get('conclusion')=='failure']; print(r[0]['databaseId'] if r else '')\"" 2>/dev/null || echo "")

    local CI_ERRORS=""
    if [[ -n "$FAILED_RUN_ID" ]]; then
      CI_ERRORS=$(ssh -n -i /data/.ssh/id_openclaw -o StrictHostKeyChecking=no root@172.22.0.1 \
        "cd /root/GeekSpace2.0 && GH_TOKEN=\$(grep GITHUB_DEV_TOKEN .env | cut -d= -f2) \
         gh run view $FAILED_RUN_ID --log-failed 2>/dev/null | tail -80" 2>/dev/null || echo "Could not fetch CI log")
    fi

    local FIX_LOG="$LOG_DIR/fix-$(date +%Y%m%d-%H%M%S)-${PROMPT_NAME}.log"
    {
      echo "You are a CI fixer agent for GeekSpace 2.0."
      echo "Branch '$BRANCH' has a failing CI run (attempt $ATTEMPT)."
      echo ""
      echo "CI FAILURE OUTPUT:"
      echo "$CI_ERRORS"
      echo ""
      echo "INSTRUCTIONS:"
      echo "1. cd /root/GeekSpace2.0 (already there via claude-remote)"
      echo "2. git checkout $BRANCH"
      echo "3. Read the error carefully — fix ONLY what's failing"
      echo "4. Common issues: wrong import style ({x} vs default), missing type, lint error"
      echo "5. Run: cd server && npm test to verify locally, then cd .. && npx tsc --noEmit"
      echo "6. git add -A && git commit -m 'fix(ci): resolve CI failure attempt $ATTEMPT in $PROMPT_NAME'"
      echo "7. git push origin $BRANCH"
      echo "8. Print: CI_FIXED"
    } | "$CLAUDE_REMOTE" 2>&1 | tee "$FIX_LOG"

    local FIX_EXIT=${PIPESTATUS[1]:-0}
    if grep -q "CI_FIXED" "$FIX_LOG" 2>/dev/null && [[ $FIX_EXIT -eq 0 ]]; then
      notify "🔧 Fix applied (attempt $ATTEMPT) — waiting for CI again..."
      sleep 30
    else
      notify "⚠️ Fixer could not resolve CI attempt $ATTEMPT — will retry after cooldown..."
      sleep 120
    fi
  done

  echo "$CI_RESULT"
}

# ── Main phase loop ────────────────────────────────────────────────────────────
while IFS= read -r line <&3 && [[ $COMPLETED -lt $MAX_PHASES ]]; do
  [[ ! "$line" =~ ^PHASE: ]] && continue

  PHASE_NAME="${line#PHASE: }"

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

  notify "🤖 [$((COMPLETED+1))/$MAX_PHASES] $AGENT_TYPE: $PROMPT_NAME
⏳ Claude working — updates every 1 min..."
  START=$(date +%s)

  # Background heartbeat — every 60 seconds while Claude works
  (
    sleep 60
    while kill -0 $$ 2>/dev/null; do
      ELAPSED=$(( ($(date +%s) - START) / 60 ))
      # Show last non-empty line and count of lines written
      LINES=$(wc -l < "$LOG" 2>/dev/null || echo 0)
      TAIL=$(tail -5 "$LOG" 2>/dev/null | grep -v '^$' | tail -1 | cut -c1-180)
      if [[ "$LINES" -gt 0 && -n "$TAIL" ]]; then
        notify "⏳ ${PROMPT_NAME} — ${ELAPSED}m | ${LINES} lines
📝 ${TAIL}"
      else
        notify "⏳ ${PROMPT_NAME} — ${ELAPSED}m (Claude thinking...)"
      fi
      sleep 60
    done
  ) &
  HEARTBEAT_PID=$!

  cd "$REPO"

  # Pipe preamble + prompt through Claude Code on the host
  PREAMBLE_FILE="$REPO/ops/agent-preambles/$AGENT_TYPE.txt"
  if [[ -f "$PREAMBLE_FILE" ]]; then
    cat "$PREAMBLE_FILE" "$PROMPT_FILE" | "$CLAUDE_REMOTE" 2>&1 | tee "$LOG"
  else
    cat "$PROMPT_FILE" | "$CLAUDE_REMOTE" 2>&1 | tee "$LOG"
  fi

  EXIT_CODE=${PIPESTATUS[1]:-0}
  kill "$HEARTBEAT_PID" 2>/dev/null || true
  wait "$HEARTBEAT_PID" 2>/dev/null || true

  END=$(date +%s)
  DURATION=$(( (END - START) / 60 ))
  # Show seconds if under a minute
  if [[ $DURATION -eq 0 ]]; then
    DURATION_STR="$(( END - START ))s"
  else
    DURATION_STR="${DURATION}m"
  fi

  if [[ $EXIT_CODE -eq 0 ]]; then
    COMPLETED=$(( COMPLETED + 1 ))
    TESTS=$(grep -oE '[0-9]+ (tests? )?(passed|pass)' "$LOG" 2>/dev/null | tail -1 || echo "")

    # Extract branch name from PHASE_COMPLETE marker
    BRANCH=$(grep "PHASE_COMPLETE:" "$LOG" 2>/dev/null | tail -1 | awk '{print $2}' || echo "")

    sed -i "s|^PHASE: $PHASE_NAME$|DONE: $PHASE_NAME|" "$QUEUE"

    notify "✅ $PROMPT_NAME done in ${DURATION_STR}${TESTS:+ — $TESTS}
🔀 Creating PR from ${BRANCH:-unknown branch}..."

    # Create PR
    PR_URL=""
    if [[ -x "$PR_CREATE" && -n "$BRANCH" ]]; then
      PR_URL=$("$PR_CREATE" --phase "$PROMPT_NAME" --type "$AGENT_TYPE" --branch "$BRANCH" --log "$LOG" 2>/dev/null || echo "")
    fi

    if [[ -n "$PR_URL" ]]; then
      notify --html "🔀 <b>PR created:</b> <a href='${PR_URL}'>${PR_URL##*/}</a>
⏳ Watching CI (will keep retrying until it passes)..."

      CI_RESULT=$(ci_loop "$PR_URL" "$BRANCH" "$PROMPT_NAME")

      CI_EMOJI="✅"
      [[ "$CI_RESULT" == "failed" ]]  && CI_EMOJI="❌"
      [[ "$CI_RESULT" == "timeout" ]] && CI_EMOJI="⏱️"
      [[ "$CI_RESULT" == "skipped" ]] && CI_EMOJI="⏭️"

      notify --html "${CI_EMOJI} CI <b>${CI_RESULT}</b> — <a href='${PR_URL}'>PR ready to review</a>"
      PR_LINES="${PR_LINES}
• ${CI_EMOJI} <a href='${PR_URL}'>${PROMPT_NAME}</a> (CI: ${CI_RESULT})"
    else
      notify "⚠️ No branch detected or PR creation failed — check that Claude printed PHASE_COMPLETE: <branch>"
      PR_LINES="${PR_LINES}
• ⚠️ ${PROMPT_NAME} (no PR)"
    fi

  else
    FAILED=$(( FAILED + 1 ))
    LAST=$(tail -5 "$LOG" 2>/dev/null | tr '\n' ' ' || echo "no log output")
    notify "❌ FAILED: $PROMPT_NAME — factory stopped
${LAST:0:200}"
    break
  fi

  # Cooldown between phases
  [[ $COMPLETED -lt $MAX_PHASES && $(grep -c "^PHASE:" "$QUEUE" 2>/dev/null || echo 0) -gt 0 ]] && sleep 60
done 3< "$QUEUE"

PENDING=$(grep -c "^PHASE:" "$QUEUE" 2>/dev/null || echo 0)

notify --html "🏭 <b>Factory Report</b> — $(date '+%d %b %H:%M IST')
✅ Done: ${COMPLETED}  ❌ Failed: ${FAILED}  📋 Left: ${PENDING}
${PR_LINES}"

echo "$(date '+%Y-%m-%dT%H:%M:%SZ') completed=$COMPLETED failed=$FAILED pending=$PENDING" \
  >> "$LOG_DIR/factory-$(date +%Y%m%d).txt"

echo "Factory done. Completed: $COMPLETED Failed: $FAILED Pending: $PENDING"
