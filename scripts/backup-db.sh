#!/usr/bin/env bash
# Encrypted database backup script for GeekSpace
# Usage: ./scripts/backup-db.sh [backup_dir]
# Requires: GPG_PASSPHRASE env var for encryption

set -euo pipefail

BACKUP_DIR="${1:-/root/backups}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DB_VOLUME_PATH="/var/lib/docker/volumes/geekspace20_geekspace-data/_data/geekspace.db"
BACKUP_FILE="${BACKUP_DIR}/geekspace-${TIMESTAMP}.db"
ENCRYPTED_FILE="${BACKUP_FILE}.gpg"
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

# Copy database (SQLite safe to copy in WAL mode when idle)
echo "[backup] Copying database..."
cp "$DB_VOLUME_PATH" "$BACKUP_FILE"

# Encrypt with GPG symmetric encryption
if [ -n "${GPG_PASSPHRASE:-}" ]; then
  echo "[backup] Encrypting..."
  echo "$GPG_PASSPHRASE" | gpg --batch --yes --passphrase-fd 0 --symmetric --cipher-algo AES256 "$BACKUP_FILE"
  rm -f "$BACKUP_FILE"
  echo "[backup] Encrypted backup: $ENCRYPTED_FILE"
else
  echo "[backup] WARNING: GPG_PASSPHRASE not set — backup is unencrypted"
  echo "[backup] Unencrypted backup: $BACKUP_FILE"
fi

# Clean old backups
echo "[backup] Cleaning backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "geekspace-*.db*" -mtime +${RETENTION_DAYS} -delete

echo "[backup] Done."
