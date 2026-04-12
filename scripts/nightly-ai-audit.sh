#!/usr/bin/env bash
# Nightly AI Audit — reads FULL_AUDIT.md, sends to Claude Bridge for analysis,
# reports findings via Telegram. Run by Cronicle at 07:00 UTC daily.
#
# Exit codes:
#   0 = always (Cronicle compatibility)

set -uo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
AUDIT_FILE="$PROJECT_DIR/.pi/FULL_AUDIT.md"
BRIDGE_URL="http://localhost:8787"
BRIDGE_TIMEOUT=120

# ── Load Telegram credentials ─────────────────────────────────────────────────
# shellcheck source=/root/.claude/.env
if [[ -f "$HOME/.claude/.env" ]]; then
  source "$HOME/.claude/.env" 2>/dev/null || true
fi

TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"

# ── Helpers ───────────────────────────────────────────────────────────────────
log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"; }

send_telegram() {
  local message="$1"
  if [[ -z "$TELEGRAM_BOT_TOKEN" || -z "$TELEGRAM_CHAT_ID" ]]; then
    log "WARN: Telegram tokens not set — skipping notification"
    return 0
  fi
  curl -sf -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=${message}" \
    -d "parse_mode=HTML" \
    > /dev/null 2>&1 || log "WARN: Telegram delivery failed"
}

# Always exit 0 for Cronicle compatibility
trap 'exit 0' EXIT

log "=== Nightly AI Audit starting ==="

# ── 1. Read audit file ────────────────────────────────────────────────────────
if [[ ! -f "$AUDIT_FILE" ]]; then
  log "ERROR: Audit file not found: $AUDIT_FILE"
  send_telegram "AI Audit: <b>Audit file missing</b> — <code>.pi/FULL_AUDIT.md</code> does not exist. Cronicle 06:00 job may have failed."
  exit 0
fi

AUDIT_CONTENT="$(cat "$AUDIT_FILE")"
log "Audit file read ($(wc -c < "$AUDIT_FILE") bytes)"

# ── 2. Generate diff against previous git version ────────────────────────────
cd "$PROJECT_DIR"
AUDIT_DIFF="$(git diff HEAD~1 -- .pi/FULL_AUDIT.md 2>/dev/null || true)"

if [[ -z "$AUDIT_DIFF" ]]; then
  DIFF_NOTE="Note: The audit file is unchanged from the previous git commit — the Cronicle 06:00 refresh job may not have run today."
  log "WARN: Audit file unchanged (empty diff vs HEAD~1)"
else
  DIFF_NOTE="Git diff vs yesterday (HEAD~1):"$'\n'"$AUDIT_DIFF"
  log "Diff generated ($(echo "$AUDIT_DIFF" | wc -l) lines)"
fi

# ── 3. Build analysis prompt ──────────────────────────────────────────────────
# Truncate audit content to avoid oversize payloads (keep first 6000 chars)
AUDIT_TRUNCATED="${AUDIT_CONTENT:0:6000}"
if [[ ${#AUDIT_CONTENT} -gt 6000 ]]; then
  AUDIT_TRUNCATED+=$'\n... [truncated for prompt size]'
fi

# Truncate diff too (keep first 2000 chars)
DIFF_TRUNCATED="${DIFF_NOTE:0:2000}"
if [[ ${#DIFF_NOTE} -gt 2000 ]]; then
  DIFF_TRUNCATED+=$'\n... [diff truncated]'
fi

PROMPT="You are a DevOps analyst reviewing the daily VPS audit for GeekSpace 2.0.

Analyze the audit data below and produce a concise report under 200 words.

Flag these issues if present (use WARN or CRIT prefix):
- Containers down or in restarting loops
- Disk usage >85% on any mount
- Memory usage >90%
- SSL certificates expiring in <30 days
- Failed or skipped Cronicle cron jobs
- Error log spikes >2x compared to the previous day
- Any service marked unhealthy

If the diff section shows no changes, note that the refresh job may have failed.

If everything looks normal, say: 'All systems nominal.'

Format:
- Start with a one-line status summary.
- Then bullet any WARN/CRIT items.
- End with a recommendation if action is needed.

=== AUDIT FILE (today) ===
${AUDIT_TRUNCATED}

=== ${DIFF_TRUNCATED} ==="

# ── 4. Check bridge reachability ──────────────────────────────────────────────
log "Checking Claude Bridge at $BRIDGE_URL ..."
if ! curl -sf --max-time 10 "$BRIDGE_URL/health" > /dev/null 2>&1; then
  log "ERROR: Claude Bridge unreachable at $BRIDGE_URL"
  send_telegram "AI Audit: <b>Bridge unreachable</b> — <code>$BRIDGE_URL</code> did not respond. Manual review of <code>.pi/FULL_AUDIT.md</code> needed."
  exit 0
fi
log "Bridge reachable"

# ── 5. POST to bridge ─────────────────────────────────────────────────────────
log "Sending prompt to bridge (timeout: ${BRIDGE_TIMEOUT}s) ..."

# Build JSON payload with jq to safely escape the prompt
PAYLOAD="$(jq -n \
  --arg prompt "$PROMPT" \
  --argjson timeout "$BRIDGE_TIMEOUT" \
  '{prompt: $prompt, cwd: "/root/GeekSpace2.0", timeout: ($timeout * 1000)}')"

HTTP_CODE=""
BRIDGE_RESPONSE=""

BRIDGE_RESPONSE="$(curl -sf \
  --max-time "$((BRIDGE_TIMEOUT + 10))" \
  -X POST "$BRIDGE_URL/run" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" \
  -w "\n__HTTP_STATUS__%{http_code}" \
  2>/dev/null || true)"

# Extract HTTP status code from response trailer
HTTP_CODE="$(echo "$BRIDGE_RESPONSE" | grep -o '__HTTP_STATUS__[0-9]*' | grep -o '[0-9]*' || true)"
BRIDGE_RESPONSE="$(echo "$BRIDGE_RESPONSE" | sed 's/__HTTP_STATUS__[0-9]*//' || true)"

log "Bridge HTTP status: ${HTTP_CODE:-unknown}"

if [[ -z "$BRIDGE_RESPONSE" ]]; then
  log "ERROR: Empty response from bridge"
  send_telegram "AI Audit: <b>Bridge returned empty response</b> — could not analyse audit. Manual review needed."
  exit 0
fi

# ── 6. Parse response ─────────────────────────────────────────────────────────
# Bridge returns { ok: bool, stdout: string, stderr: string, exitCode: number }
ANALYSIS="$(echo "$BRIDGE_RESPONSE" | jq -r '.stdout // .output // .result // empty' 2>/dev/null || true)"

if [[ -z "$ANALYSIS" ]]; then
  # Fallback: treat raw response as text if it's not JSON
  ANALYSIS="$BRIDGE_RESPONSE"
fi

# Trim leading/trailing whitespace
ANALYSIS="$(echo "$ANALYSIS" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"

log "Analysis received (${#ANALYSIS} chars)"
log "--- Analysis ---"
echo "$ANALYSIS"
log "--- End Analysis ---"

# ── 7. Detect issues and send Telegram ───────────────────────────────────────
DATE_LABEL="$(date -u '+%Y-%m-%d %H:%M UTC')"

# Check if analysis contains any WARN/CRIT flags or negative indicators
HAS_ISSUES=0
if echo "$ANALYSIS" | grep -qiE '\b(WARN|CRIT|down|restarting|expired|failed|critical|error spike|spike|unhealthy|>85|>90)\b'; then
  HAS_ISSUES=1
fi

if [[ "$HAS_ISSUES" -eq 1 ]]; then
  MESSAGE="<b>Daily AI Audit — ${DATE_LABEL}</b>

<b>Issues detected:</b>

${ANALYSIS}"
  log "Issues detected — sending alert"
else
  MESSAGE="<b>Daily AI Audit — ${DATE_LABEL}</b>

All systems nominal."
  log "All clear — sending nominal notification"
fi

# Telegram has a 4096-char message limit; truncate if needed
if [[ ${#MESSAGE} -gt 4000 ]]; then
  MESSAGE="${MESSAGE:0:3980}"$'\n<i>... (truncated)</i>'
fi

send_telegram "$MESSAGE"

log "=== Nightly AI Audit complete ==="
