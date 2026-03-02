#!/bin/bash
# ============================================================
# Write Phase Prompt Helper
#
# Atomically writes the next phase prompt to
# ops/current-phase-prompt.txt for use by openclaw-auto.sh.
#
# Usage:
#   ./scripts/write-phase-prompt.sh < phase_prompt.txt
#   echo "Your phase prompt here" | ./scripts/write-phase-prompt.sh
#   cat my-prompt.txt | ./scripts/write-phase-prompt.sh
#
# This script is idempotent — overwrites any existing prompt.
# ============================================================
set -euo pipefail

PROMPT_FILE="/root/GeekSpace2.0/ops/current-phase-prompt.txt"
REPO="/root/GeekSpace2.0"

mkdir -p "$(dirname "$PROMPT_FILE")"

# Read from stdin atomically (write to temp, then move)
TMPFILE=$(mktemp)
cat > "$TMPFILE"

if [[ ! -s "$TMPFILE" ]]; then
  echo "❌ No input provided. Pipe your prompt via stdin." >&2
  rm -f "$TMPFILE"
  exit 1
fi

mv "$TMPFILE" "$PROMPT_FILE"
LINES=$(wc -l < "$PROMPT_FILE")
echo "✅ Prompt written to $PROMPT_FILE ($LINES lines)"
echo ""
echo "Run:  cd $REPO && ./scripts/openclaw-auto.sh"
echo "Or:   Enable the Cronicle job 'OpenClaw Auto Session' for scheduled execution."
