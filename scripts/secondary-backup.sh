#!/usr/bin/env bash
# =============================================================================
# secondary-backup.sh — Weekly sync to a second off-site rclone remote
#
# Complements offsite-backup.sh which targets the primary "offsite" remote.
# This script targets a separate "offsite-b2" remote (Backblaze B2 by default,
# but any rclone-compatible provider works).
#
# Schedule: weekly (e.g. Sundays at 04:00) via cron:
#   0 4 * * 0 /root/GeekSpace2.0/scripts/secondary-backup.sh >> /root/backups/secondary-sync.log 2>&1
#
# Setup:
#   1. Configure the second remote:  rclone config  (name it "offsite-b2")
#   2. Create a bucket/container:    rclone mkdir offsite-b2:geekspace-backups
#   3. Test:  ./secondary-backup.sh --dry-run
#   4. Install cron: ./scripts/setup-offsite-backup.sh --secondary-cron
# =============================================================================

set -euo pipefail

BACKUP_DIR="/root/backups"
REMOTE="${SECONDARY_BACKUP_REMOTE:-offsite-b2}"
BUCKET="${SECONDARY_BACKUP_BUCKET:-geekspace-backups}"
LOG_FILE="/root/backups/secondary-sync.log"
TRANSFERS=4
CHECKERS=8
DRY_RUN=""

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN="--dry-run" ;;
    --help|-h)
      echo "Usage: $0 [--dry-run]"
      echo ""
      echo "Syncs /root/backups/ to the '$REMOTE' rclone remote."
      echo "Override remote/bucket with env vars:"
      echo "  SECONDARY_BACKUP_REMOTE=myremote ./secondary-backup.sh"
      echo "  SECONDARY_BACKUP_BUCKET=mybucket  ./secondary-backup.sh"
      exit 0
      ;;
  esac
done

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

if ! command -v rclone &>/dev/null; then
  log "ERROR: rclone not found. Install: curl https://rclone.org/install.sh | bash"
  exit 1
fi

if ! rclone listremotes 2>/dev/null | grep -q "^${REMOTE}:$"; then
  log "ERROR: rclone remote '${REMOTE}' is not configured."
  log "  Run: rclone config  (name the remote '${REMOTE}')"
  exit 1
fi

if [ ! -d "$BACKUP_DIR" ]; then
  log "ERROR: Backup directory $BACKUP_DIR does not exist."
  exit 1
fi

FILE_COUNT=$(find "$BACKUP_DIR" -type f | wc -l)
DIR_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)

log "=== Secondary off-site backup sync started ==="
log "Source:      $BACKUP_DIR ($DIR_SIZE, $FILE_COUNT files)"
log "Destination: ${REMOTE}:${BUCKET}/"
[ -n "$DRY_RUN" ] && log "Mode:        DRY RUN"

rclone sync \
  "$BACKUP_DIR" \
  "${REMOTE}:${BUCKET}/" \
  --transfers "$TRANSFERS" \
  --checkers "$CHECKERS" \
  --log-level INFO \
  --stats 30s \
  --stats-one-line \
  $DRY_RUN \
  2>&1 | while IFS= read -r line; do log "$line"; done

SYNC_EXIT=${PIPESTATUS[0]}

if [ "$SYNC_EXIT" -eq 0 ]; then
  log "=== Secondary off-site backup sync completed successfully ==="
else
  log "=== Secondary off-site backup sync FAILED (exit code: $SYNC_EXIT) ==="
fi

exit "$SYNC_EXIT"
