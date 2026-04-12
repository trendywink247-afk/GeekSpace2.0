#!/usr/bin/env bash
# =============================================================================
# backup-db.sh — Local SQLite backup for GeekSpace 2.0
#
# Safe for WAL mode: uses `sqlite3 .backup` which checkpoints WAL and creates
# a consistent snapshot even while the DB is in active use.
#
# Retention policy:
#   - Daily backups: keep last 30
#   - Weekly backups: keep last 4 (taken on Sunday; the daily double as weekly)
#
# Output:
#   /root/backups/geekspace/geekspace-YYYY-MM-DD-HHMMSS.db.gz
#
# Usage:
#   ./scripts/backup-db.sh
#   LOG_FILE=/var/log/geekspace-backup.log ./scripts/backup-db.sh
# =============================================================================

set -uo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
BACKUP_DIR="/root/backups/geekspace"
LOG_FILE="${LOG_FILE:-/var/log/geekspace-backup.log}"
TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)
DAY_OF_WEEK=$(date +%u)   # 1=Mon … 7=Sun
KEEP_DAILY=30
KEEP_WEEKLY=4

# Source DB — prefer the live Docker volume; fall back to local dev path.
DOCKER_DB="/var/lib/docker/volumes/geekspace20_geekspace-data/_data/geekspace.db"
LOCAL_DB="/root/GeekSpace2.0/server/data/geekspace.db"

# ---------------------------------------------------------------------------
# Logging helper
# ---------------------------------------------------------------------------
log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
  echo "$msg"
  echo "$msg" >> "$LOG_FILE" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
if ! command -v sqlite3 &>/dev/null; then
  log "ERROR: sqlite3 not found in PATH — aborting"
  exit 1
fi

if [ -f "$DOCKER_DB" ]; then
  SOURCE_DB="$DOCKER_DB"
  log "INFO: Using Docker volume DB: $SOURCE_DB"
elif [ -f "$LOCAL_DB" ]; then
  SOURCE_DB="$LOCAL_DB"
  log "INFO: Using local dev DB: $SOURCE_DB"
else
  log "ERROR: No database found at:"
  log "       Docker: $DOCKER_DB"
  log "       Local:  $LOCAL_DB"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# ---------------------------------------------------------------------------
# Take backup (WAL-safe snapshot)
# ---------------------------------------------------------------------------
RAW_BACKUP="/tmp/geekspace-backup-$$.db"
DEST_FILE="${BACKUP_DIR}/geekspace-${TIMESTAMP}.db.gz"

log "INFO: Starting backup -> $DEST_FILE"

if ! sqlite3 "$SOURCE_DB" ".backup '${RAW_BACKUP}'" 2>>"$LOG_FILE"; then
  log "ERROR: sqlite3 .backup command failed"
  rm -f "$RAW_BACKUP"
  exit 1
fi

# Verify snapshot is non-empty before compressing
RAW_SIZE=$(stat -c%s "$RAW_BACKUP" 2>/dev/null || stat -f%z "$RAW_BACKUP" 2>/dev/null || echo "0")
if [ "$RAW_SIZE" -eq 0 ]; then
  log "ERROR: Backup file is empty — aborting"
  rm -f "$RAW_BACKUP"
  exit 1
fi

# Compress and secure
gzip -c "$RAW_BACKUP" > "$DEST_FILE"
rm -f "$RAW_BACKUP"
chmod 600 "$DEST_FILE"

DEST_SIZE=$(stat -c%s "$DEST_FILE" 2>/dev/null || stat -f%z "$DEST_FILE" 2>/dev/null || echo "0")
log "INFO: Backup complete. Raw: ${RAW_SIZE} bytes -> Compressed: ${DEST_SIZE} bytes"

# ---------------------------------------------------------------------------
# Retention — daily: keep last 30
# ---------------------------------------------------------------------------
log "INFO: Applying daily retention (keep last $KEEP_DAILY)..."

# List all backups sorted oldest-first; delete everything beyond the newest 30
DAILY_COUNT=$(ls -1t "${BACKUP_DIR}"/geekspace-*.db.gz 2>/dev/null | wc -l)
if [ "$DAILY_COUNT" -gt "$KEEP_DAILY" ]; then
  TO_DELETE=$(ls -1t "${BACKUP_DIR}"/geekspace-*.db.gz 2>/dev/null | tail -n +"$((KEEP_DAILY + 1))")
  while IFS= read -r old_file; do
    log "INFO: Deleting old daily backup: $old_file"
    rm -f "$old_file"
  done <<< "$TO_DELETE"
fi

# ---------------------------------------------------------------------------
# Retention — weekly: on Sundays keep a weekly copy (keep last 4)
# Weekly backups are tagged geekspace-weekly-YYYY-MM-DD.db.gz
# ---------------------------------------------------------------------------
if [ "$DAY_OF_WEEK" -eq 7 ]; then
  WEEKLY_FILE="${BACKUP_DIR}/geekspace-weekly-$(date +%Y-%m-%d).db.gz"
  if [ ! -f "$WEEKLY_FILE" ]; then
    cp "$DEST_FILE" "$WEEKLY_FILE"
    chmod 600 "$WEEKLY_FILE"
    log "INFO: Weekly snapshot saved: $WEEKLY_FILE"
  fi

  WEEKLY_COUNT=$(ls -1t "${BACKUP_DIR}"/geekspace-weekly-*.db.gz 2>/dev/null | wc -l)
  if [ "$WEEKLY_COUNT" -gt "$KEEP_WEEKLY" ]; then
    TO_DELETE=$(ls -1t "${BACKUP_DIR}"/geekspace-weekly-*.db.gz 2>/dev/null | tail -n +"$((KEEP_WEEKLY + 1))")
    while IFS= read -r old_file; do
      log "INFO: Deleting old weekly backup: $old_file"
      rm -f "$old_file"
    done <<< "$TO_DELETE"
  fi
fi

log "INFO: Backup job finished successfully."
