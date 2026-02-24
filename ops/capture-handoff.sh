#!/usr/bin/env bash
# capture-handoff.sh — Update AI_HANDOFF.md with current state
# Usage: ./ops/capture-handoff.sh
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
HANDOFF="$ROOT/ops/AI_HANDOFF.md"
BRANCH=$(git branch --show-current)
DATE=$(date '+%Y-%m-%d %H:%M')

echo "📝 Capturing handoff snapshot..."

# Get recent commits
RECENT_COMMITS=$(git log --oneline -5 2>/dev/null | sed 's/^/  /')

# Get changed files
CHANGED_FILES=$(git diff --name-only HEAD 2>/dev/null | head -20 | sed 's/^/  - /')
if [ -z "$CHANGED_FILES" ]; then
  CHANGED_FILES="  (none staged)"
fi

# Write handoff snapshot to runtime/
mkdir -p "$ROOT/ops/runtime"
cat > "$ROOT/ops/runtime/snapshot-$(date +%Y%m%d-%H%M).md" <<EOF
# Handoff Snapshot — $DATE

**Branch:** $BRANCH
**Working dir:** $ROOT

## Recent Commits
$RECENT_COMMITS

## Changed Files (unstaged)
$CHANGED_FILES

## Test Status
Run: cd server && npm test

## Resume Command
\`\`\`bash
cd $ROOT
git status
cat ops/AI_PHASE_PLAN.md
cd server && npm test
\`\`\`
EOF

echo "✅ Snapshot written to ops/runtime/"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Current branch: $BRANCH"
echo "  Date: $DATE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Recent commits:"
git log --oneline -5
echo ""
echo "Git status:"
git status --short | head -20
