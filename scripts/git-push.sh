#!/bin/bash
# git-push.sh — Helper to push git changes from host (for use inside containers)
# Usage: ./scripts/git-push.sh [branch]
# Default branch: current branch

set -euo pipefail

BRANCH="${1:-$(git branch --show-current)}"
REPO="/root/GeekSpace2.0"
SSH_KEY="/data/.ssh/id_openclaw"
KNOWN_HOSTS="/data/.ssh/known_hosts"
HOST="root@172.22.0.1"

echo "📤 Pushing $BRANCH to origin (via host SSH)..."

ssh -i "$SSH_KEY" -o UserKnownHostsFile="$KNOWN_HOSTS" "$HOST" "cd $REPO && git push -u origin '$BRANCH'"

echo "✅ Pushed $BRANCH"
