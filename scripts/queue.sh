#!/bin/bash
# Simple CLI for managing the phase queue

QUEUE="/data/.openclaw/workspace/repo/ops/phase-queue.txt"
CMD="${1:-status}"

case "$CMD" in
  status)
    echo "=== Phase Queue ==="
    echo "Pending: $(grep -c '^PHASE:' "$QUEUE" 2>/dev/null || echo 0)"
    echo "Done: $(grep -c '^DONE:' "$QUEUE" 2>/dev/null || echo 0)"
    echo "Failed: $(grep -c '^FAIL:' "$QUEUE" 2>/dev/null || echo 0)"
    echo ""
    echo "--- Pending ---"
    grep "^PHASE:" "$QUEUE" 2>/dev/null || echo "(none)"
    ;;
  add)
    # Usage: ./scripts/queue.sh add builder phase-88-payments
    TYPE="${2:-builder}"
    NAME="${3:?Usage: queue.sh add [type] [phase-name]}"
    echo "PHASE: $TYPE:$NAME" >> "$QUEUE"
    echo "✅ Added: PHASE: $TYPE:$NAME"
    ;;
  clear-done)
    sed -i '/^DONE:/d' "$QUEUE" 2>/dev/null || true
    echo "✅ Cleared completed phases"
    ;;
  next)
    grep "^PHASE:" "$QUEUE" 2>/dev/null | head -5 || echo "(none)"
    ;;
  *)
    echo "Usage: queue.sh [status|add|clear-done|next]"
    ;;
esac
