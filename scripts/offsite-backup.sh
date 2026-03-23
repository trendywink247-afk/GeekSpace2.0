#!/bin/bash
#
# offsite-backup.sh — Sync local backups to off-site storage via rclone
#
# Usage:
#   ./offsite-backup.sh              # run the sync
#   ./offsite-backup.sh --dry-run    # preview what would be synced
#
# Expects an rclone remote named "offsite" to be configured.
# Run "rclone config" or use setup-offsite-backup.sh to set it up.
#

set -euo pipefail

BACKUP_DIR="/root/backups"
REMOTE="offsite"
BUCKET="geekspace-backups"
LOG_FILE="/root/backups/offsite-sync.log"
TRANSFERS=4
CHECKERS=8
DRY_RUN=""

# Parse arguments
for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN="--dry-run"
      ;;
    --help|-h)
      echo "Usage: $0 [--dry-run]"
      echo ""
      echo "Syncs /root/backups/ to the 'offsite' rclone remote."
      echo "  --dry-run   Preview changes without uploading"
      exit 0
      ;;
  esac
done

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# Check rclone is installed
if ! command -v rclone &>/dev/null; then
  log "ERROR: rclone is not installed. Run: curl https://rclone.org/install.sh | bash"
  exit 1
fi

# Check the remote is configured
if ! rclone listremotes 2>/dev/null | grep -q "^${REMOTE}:$"; then
  log "ERROR: rclone remote '${REMOTE}' is not configured."
  log ""
  log "To configure it, run one of:"
  log "  rclone config                                     # interactive setup"
  log "  ./scripts/setup-offsite-backup.sh --interactive   # guided setup"
  log ""
  log "The remote must be named '${REMOTE}'."
  exit 1
fi

# Check backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
  log "ERROR: Backup directory $BACKUP_DIR does not exist. Nothing to sync."
  exit 1
fi

# Count files to sync
FILE_COUNT=$(find "$BACKUP_DIR" -type f | wc -l)
DIR_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)

log "=== Off-site backup sync started ==="
log "Source:      $BACKUP_DIR ($DIR_SIZE, $FILE_COUNT files)"
log "Destination: ${REMOTE}:${BUCKET}/"
if [ -n "$DRY_RUN" ]; then
  log "Mode:        DRY RUN (no changes will be made)"
fi

# Run the sync
rclone sync \
  "$BACKUP_DIR" \
  "${REMOTE}:${BUCKET}/" \
  --transfers "$TRANSFERS" \
  --checkers "$CHECKERS" \
  --log-level INFO \
  --stats 30s \
  --stats-one-line \
  $DRY_RUN \
  2>&1 | while IFS= read -r line; do
    log "$line"
  done

SYNC_EXIT=${PIPESTATUS[0]}

if [ "$SYNC_EXIT" -eq 0 ]; then
  log "=== Off-site backup sync completed successfully ==="
else
  log "=== Off-site backup sync FAILED (exit code: $SYNC_EXIT) ==="
fi

exit "$SYNC_EXIT"
