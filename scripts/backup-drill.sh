#!/usr/bin/env bash
# ============================================================
# backup-drill.sh — Phase 83 backup verification drill
#
# Workflow:
#   1. Locate SQLite DB (Docker volume → local dev path)
#   2. Backup to /root/backups/drill-YYYYMMDD.db
#   3. Verify backup file size > 0
#   4. Restore to temp path
#   5. Run PRAGMA integrity_check
#   6. Log PASS/FAIL to ops/reports/backup-drill-YYYYMMDD.txt
#
# Usage: ./scripts/backup-drill.sh
# ============================================================

set -uo pipefail

DATE=$(date +%Y%m%d)
TIMESTAMP=$(date +%Y%m%dT%H%M%S)
BACKUP_DIR="/root/backups"
DRILL_FILE="${BACKUP_DIR}/drill-${DATE}.db"
TEMP_RESTORE="/tmp/gs-restore-${DATE}.db"
REPORT_DIR="ops/reports"
REPORT_FILE="${REPORT_DIR}/backup-drill-${DATE}.txt"

mkdir -p "$BACKUP_DIR" "$REPORT_DIR"

PASS=0
FAIL=0

log() {
  echo "$1" | tee -a "$REPORT_FILE"
}

check() {
  local label="$1"
  local result="$2"   # "pass" or "fail"
  if [ "$result" = "pass" ]; then
    PASS=$((PASS+1))
    log "  ✅ PASS: ${label}"
  else
    FAIL=$((FAIL+1))
    log "  ❌ FAIL: ${label}"
  fi
}

log "============================================"
log " GeekSpace Backup Drill — ${TIMESTAMP}"
log "============================================"

# ── 1. Locate source DB ───────────────────────────────────────
DOCKER_DB="/var/lib/docker/volumes/geekspace20_geekspace-data/_data/geekspace.db"
LOCAL_DB="$(cd "$(dirname "$0")/.." && pwd)/server/data/geekspace.db"
SOURCE_DB=""

if [ -f "$DOCKER_DB" ]; then
  SOURCE_DB="$DOCKER_DB"
  log "[step 1] Using Docker DB: ${SOURCE_DB}"
elif [ -f "$LOCAL_DB" ]; then
  SOURCE_DB="$LOCAL_DB"
  log "[step 1] Using local dev DB: ${SOURCE_DB}"
else
  log "[step 1] ❌ No database found at:"
  log "         Docker: ${DOCKER_DB}"
  log "         Local:  ${LOCAL_DB}"
  log ""
  log "RESULT: FAIL — database not found"
  exit 1
fi

check "Database file exists" "pass"

# ── 2. Backup ─────────────────────────────────────────────────
log ""
log "[step 2] Backing up to: ${DRILL_FILE}"
if sqlite3 "$SOURCE_DB" ".backup '${DRILL_FILE}'" 2>>"$REPORT_FILE"; then
  check "Backup command succeeded" "pass"
else
  check "Backup command succeeded" "fail"
fi

# ── 3. Verify backup size > 0 ────────────────────────────────
log ""
log "[step 3] Verifying backup file size..."
if [ -f "$DRILL_FILE" ]; then
  SIZE=$(stat -c%s "$DRILL_FILE" 2>/dev/null || stat -f%z "$DRILL_FILE" 2>/dev/null || echo "0")
  log "  File size: ${SIZE} bytes"
  if [ "$SIZE" -gt 0 ]; then
    check "Backup file size > 0" "pass"
  else
    check "Backup file size > 0" "fail"
  fi
else
  check "Backup file exists after backup" "fail"
fi

# ── 4. Restore to temp path ──────────────────────────────────
log ""
log "[step 4] Restoring to temp: ${TEMP_RESTORE}"
if cp "$DRILL_FILE" "$TEMP_RESTORE" 2>>"$REPORT_FILE"; then
  check "Restore copy succeeded" "pass"
else
  check "Restore copy succeeded" "fail"
fi

# ── 5. PRAGMA integrity_check ────────────────────────────────
log ""
log "[step 5] Running PRAGMA integrity_check on restored DB..."
if [ -f "$TEMP_RESTORE" ]; then
  INTEGRITY=$(sqlite3 "$TEMP_RESTORE" "PRAGMA integrity_check;" 2>&1)
  log "  Result: ${INTEGRITY}"
  if [ "$INTEGRITY" = "ok" ]; then
    check "PRAGMA integrity_check = ok" "pass"
  else
    check "PRAGMA integrity_check = ok" "fail"
  fi
else
  check "Restored DB exists for integrity check" "fail"
fi

# ── 6. Cleanup temp ──────────────────────────────────────────
rm -f "$TEMP_RESTORE"

# ── Summary ──────────────────────────────────────────────────
log ""
log "============================================"
log " Results: ${PASS} passed, ${FAIL} failed"
log " Drill backup retained at: ${DRILL_FILE}"
log " Report saved to: ${REPORT_FILE}"
log "============================================"

if [ "$FAIL" -eq 0 ]; then
  log " OVERALL: ✅ PASS"
  exit 0
else
  log " OVERALL: ❌ FAIL (${FAIL} checks failed)"
  exit 1
fi
