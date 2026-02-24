#!/usr/bin/env bash
# claude-cycle.sh — Session checkpoint reminders + handoff capture
# Usage: ./ops/claude-cycle.sh [T+minutes]
# Sends reminder prompts at key session milestones
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
ELAPSED="${1:-0}"

checkpoint() {
  local t=$1
  local msg=$2
  echo ""
  echo "⏱  T+${t}m CHECKPOINT"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  $msg"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

if [ "$ELAPSED" -ge 225 ]; then
  checkpoint 225 "🚨 SESSION ENDING SOON — write handoff NOW, no new features"
  echo ""
  echo "Run: ./ops/capture-handoff.sh"
  echo "Then commit + push current work"
  exit 0
fi

if [ "$ELAPSED" -ge 200 ]; then
  checkpoint 200 "Final verification window — run phase-gate, update PR"
  echo ""
  echo "Run: ./ops/phase-gate.sh --skip-e2e"
  echo "Then: ./ops/pr-phase.sh"
  exit 0
fi

if [ "$ELAPSED" -ge 120 ]; then
  checkpoint 120 "Refinement window — finish current item, run tests, no scope expansion"
  echo ""
  echo "Run: cd server && npm test"
  exit 0
fi

# Default: T+0 startup
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  GeekSpace 2.0 — AI Session Start"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Current branch: $(git branch --show-current)"
echo "Last commit:    $(git log --oneline -1)"
echo ""
echo "Phase plan: ops/AI_PHASE_PLAN.md"
echo "Backlog:    ops/AI_BACKLOG.md"
echo "Handoff:    ops/AI_HANDOFF.md"
echo ""
echo "Quick start:"
echo "  cd server && npm test      # verify baseline"
echo "  cat ops/AI_PHASE_PLAN.md   # read current phase"
echo ""
"$ROOT/ops/capture-handoff.sh"
