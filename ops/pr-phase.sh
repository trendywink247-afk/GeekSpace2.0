#!/usr/bin/env bash
# pr-phase.sh — Push branch + create/update draft PR for current phase
# Usage: ./ops/pr-phase.sh
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
BRANCH=$(git branch --show-current)
PHASE_PLAN="$ROOT/ops/AI_PHASE_PLAN.md"

if [ -z "$BRANCH" ]; then
  echo "❌ Not on a branch. Run from a feature worktree."
  exit 1
fi

echo "📤 Pushing branch: $BRANCH"
git push -u origin "$BRANCH" 2>&1

# Check if PR already exists
EXISTING_PR=$(gh pr list --head "$BRANCH" --json number --jq '.[0].number' 2>/dev/null || echo "")

if [ -n "$EXISTING_PR" ]; then
  echo "✏️  Updating existing PR #$EXISTING_PR"
  gh pr edit "$EXISTING_PR" --body "$(cat "$PHASE_PLAN")" 2>&1 || true
  echo "🔗 PR #$EXISTING_PR updated"
  gh pr view "$EXISTING_PR" --json url --jq '.url'
else
  # Extract phase title from plan file
  TITLE=$(grep "^# Phase" "$PHASE_PLAN" | head -1 | sed 's/^# //')
  if [ -z "$TITLE" ]; then
    TITLE="Phase: $(date +%Y-%m-%d) improvements"
  fi

  echo "📝 Creating draft PR: $TITLE"
  gh pr create \
    --draft \
    --title "$TITLE" \
    --body "$(cat "$PHASE_PLAN")" \
    --base main 2>&1
fi

echo ""
echo "✅ Done"
