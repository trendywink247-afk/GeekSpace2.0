#!/usr/bin/env bash
# =============================================================================
# rotate-app-secrets.sh — Rotate JWT_SECRET + ENCRYPTION_KEY on the VPS.
#
# Phase 3 of AGE-18 rotation plan (AGE-25). Invoked via the sanctioned
# workflow_dispatch path `rotate-jwt-encryption` in ops-remote-exec.yml.
# Never run ad-hoc from an interactive shell — the closed whitelist is the
# audit trail.
#
# Sequencing (matches docs/SSH-ACCESS.md `ENCRYPTION_KEY rotation`):
#
#   1. Back up /root/.agentin-secrets to /root/secret-backups/
#   2. Generate new JWT_SECRET (hex 64B) + ENCRYPTION_KEY (hex 32B)
#   3. If --re-encrypt, run server/scripts/reencrypt-api-keys.ts with
#      OLD_ENCRYPTION_KEY=<old> and ENCRYPTION_KEY=<new> BEFORE the env file
#      is flipped. The app keeps decrypting under the old key during this
#      step because its config is still loaded.
#   4. Write the new key file atomically via `install -m 600`.
#   5. Restart the app container so the new ENCRYPTION_KEY is loaded.
#   6. Smoke-test /api/health.
#
# Flags:
#   --dry-run       Print every step with candidate value LENGTHS only; no writes.
#   --re-encrypt    Run the re-encryption script before flipping the env file.
#                   Required whenever ENCRYPTION_KEY actually changes.
#   --rollback <p>  Restore <p> (a path under /root/secret-backups/) over
#                   /root/.agentin-secrets. Used by the -rollback workflow arm.
#   -h | --help     Show this message.
#
# Exit codes:
#   0  success
#   2  bad invocation / preflight failure
#   3  reencrypt script failed (transactionally rolled back; env file was not
#      touched, so the service keeps running under the OLD key — safe to
#      retry after reconciling orphaned rows)
#   4  container restart or health-check failed
# =============================================================================

set -euo pipefail

SECRETS_FILE="/root/.agentin-secrets"
BACKUP_DIR="/root/secret-backups"
REPO_DIR="${REPO_DIR:-/root/GeekSpace2.0}"
REENCRYPT_SCRIPT="${REPO_DIR}/server/scripts/reencrypt-api-keys.ts"
APP_CONTAINER="${APP_CONTAINER:-geekspace}"
DOCKER_DB="${DOCKER_DB:-/var/lib/docker/volumes/geekspace20_geekspace-data/_data/geekspace.db}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3001/api/health}"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"

DRY_RUN=0
REENCRYPT=0
ROLLBACK_SOURCE=""

usage() {
  sed -n '/^# =\+$/,/^# =\+$/p' "$0" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --re-encrypt) REENCRYPT=1 ;;
    --rollback)
      shift
      [ -z "${1:-}" ] && { echo "ERROR: --rollback requires a path" >&2; exit 2; }
      ROLLBACK_SOURCE="$1"
      ;;
    -h|--help) usage; exit 0 ;;
    *) echo "ERROR: unknown flag: $1" >&2; exit 2 ;;
  esac
  shift
done

log() { echo "[$(date -u +%FT%TZ)] $*"; }

# ---------------------------------------------------------------------------
# Rollback path
# ---------------------------------------------------------------------------
if [ -n "$ROLLBACK_SOURCE" ]; then
  case "$ROLLBACK_SOURCE" in
    "$BACKUP_DIR"/*) ;;
    *) echo "ERROR: rollback source must live under $BACKUP_DIR — got: $ROLLBACK_SOURCE" >&2; exit 2 ;;
  esac
  if [ ! -f "$ROLLBACK_SOURCE" ]; then
    echo "ERROR: rollback source not found: $ROLLBACK_SOURCE" >&2
    exit 2
  fi

  log "ROLLBACK: restoring $ROLLBACK_SOURCE -> $SECRETS_FILE"
  if [ "$DRY_RUN" -eq 1 ]; then
    log "dry-run: would install -m 600 $ROLLBACK_SOURCE $SECRETS_FILE"
  else
    install -m 600 "$ROLLBACK_SOURCE" "$SECRETS_FILE"
  fi

  log "restarting container $APP_CONTAINER"
  if [ "$DRY_RUN" -eq 1 ]; then
    log "dry-run: would docker restart $APP_CONTAINER"
  else
    docker restart "$APP_CONTAINER" >/dev/null || { log "ERROR: docker restart failed"; exit 4; }
    sleep 5
    curl -fsS "$HEALTH_URL" >/dev/null || { log "ERROR: health check failed after rollback"; exit 4; }
  fi
  log "rollback complete"
  exit 0
fi

# ---------------------------------------------------------------------------
# Forward path — rotation
# ---------------------------------------------------------------------------
log "rotate-app-secrets starting (dry-run=$DRY_RUN re-encrypt=$REENCRYPT)"

# Preflight
[ -f "$SECRETS_FILE" ] || { echo "ERROR: $SECRETS_FILE missing" >&2; exit 2; }
MODE="$(stat -c '%a' "$SECRETS_FILE")"
if [ "$MODE" != "600" ]; then
  echo "ERROR: expected mode 600 on $SECRETS_FILE, got $MODE" >&2
  exit 2
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

if [ "$REENCRYPT" -eq 1 ] && [ ! -f "$REENCRYPT_SCRIPT" ]; then
  echo "ERROR: --re-encrypt set but script missing: $REENCRYPT_SCRIPT" >&2
  exit 2
fi

# Pull current values so we can pass OLD_ENCRYPTION_KEY into the reencrypt script.
# We deliberately do NOT echo these to the run log.
# shellcheck disable=SC1090
set -a; . "$SECRETS_FILE"; set +a
OLD_JWT_SECRET="${JWT_SECRET:-}"
OLD_ENCRYPTION_KEY="${ENCRYPTION_KEY:-}"
if [ -z "$OLD_JWT_SECRET" ] || [ -z "$OLD_ENCRYPTION_KEY" ]; then
  echo "ERROR: $SECRETS_FILE is missing JWT_SECRET or ENCRYPTION_KEY" >&2
  exit 2
fi

# Candidates
NEW_JWT_SECRET="$(openssl rand -hex 64)"
NEW_ENCRYPTION_KEY="$(openssl rand -hex 32)"
log "generated candidates (lengths: jwt=${#NEW_JWT_SECRET} enc=${#NEW_ENCRYPTION_KEY})"

# Backup
BACKUP_PATH="$BACKUP_DIR/agentin-secrets.$TIMESTAMP.bak"
log "backing up $SECRETS_FILE -> $BACKUP_PATH"
if [ "$DRY_RUN" -eq 1 ]; then
  log "dry-run: would install -m 600 $SECRETS_FILE $BACKUP_PATH"
else
  install -m 600 "$SECRETS_FILE" "$BACKUP_PATH"
fi

# Re-encrypt api_keys BEFORE flipping the env file. The app keeps reading
# with the old key during this step (env file not yet written, container
# not yet restarted). Idempotent on resume.
if [ "$REENCRYPT" -eq 1 ]; then
  log "running reencrypt-api-keys against $DOCKER_DB"
  if [ "$DRY_RUN" -eq 1 ]; then
    log "dry-run: would run reencrypt script with DRY_RUN=1"
    # shellcheck disable=SC2016
    OLD_ENCRYPTION_KEY="$OLD_ENCRYPTION_KEY" \
    ENCRYPTION_KEY="$NEW_ENCRYPTION_KEY" \
    DB_PATH="$DOCKER_DB" \
    DRY_RUN=1 \
      node --experimental-strip-types "$REENCRYPT_SCRIPT" || { log "ERROR: reencrypt dry-run failed"; exit 3; }
  else
    set +e
    OLD_ENCRYPTION_KEY="$OLD_ENCRYPTION_KEY" \
    ENCRYPTION_KEY="$NEW_ENCRYPTION_KEY" \
    DB_PATH="$DOCKER_DB" \
      node --experimental-strip-types "$REENCRYPT_SCRIPT"
    RC=$?
    set -e
    if [ "$RC" -ne 0 ]; then
      log "ERROR: reencrypt script failed (rc=$RC) — transaction rolled back, env file NOT touched"
      log "      the service keeps running under the OLD key; backup preserved at $BACKUP_PATH"
      exit 3
    fi
  fi
fi

# Atomically rewrite the env file. Preserve any keys we did NOT touch.
TMP_FILE="$(mktemp)"
chmod 600 "$TMP_FILE"
awk -v new_jwt="$NEW_JWT_SECRET" -v new_enc="$NEW_ENCRYPTION_KEY" '
  BEGIN { rewrote_jwt=0; rewrote_enc=0 }
  /^JWT_SECRET=/        { print "JWT_SECRET=" new_jwt;       rewrote_jwt=1; next }
  /^ENCRYPTION_KEY=/    { print "ENCRYPTION_KEY=" new_enc;   rewrote_enc=1; next }
                        { print }
  END {
    if (!rewrote_jwt) print "JWT_SECRET=" new_jwt
    if (!rewrote_enc) print "ENCRYPTION_KEY=" new_enc
  }
' "$SECRETS_FILE" > "$TMP_FILE"

log "writing new $SECRETS_FILE (atomic install)"
if [ "$DRY_RUN" -eq 1 ]; then
  log "dry-run: would install -m 600 <tmp> $SECRETS_FILE"
  rm -f "$TMP_FILE"
else
  install -m 600 "$TMP_FILE" "$SECRETS_FILE"
  rm -f "$TMP_FILE"
fi

# Restart
log "restarting container $APP_CONTAINER"
if [ "$DRY_RUN" -eq 1 ]; then
  log "dry-run: would docker restart $APP_CONTAINER"
else
  docker restart "$APP_CONTAINER" >/dev/null || { log "ERROR: docker restart failed"; exit 4; }
  sleep 5
  curl -fsS "$HEALTH_URL" >/dev/null || { log "ERROR: health check failed"; exit 4; }
fi

log "rotation complete"
log "backup:       $BACKUP_PATH"
log "rotated keys: JWT_SECRET, ENCRYPTION_KEY"
log "next steps:   login round-trip on a test account + one api_keys decrypt;"
log "              append rotation log entry in docs/SSH-ACCESS.md."
