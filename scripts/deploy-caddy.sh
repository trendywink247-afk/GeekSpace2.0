#!/usr/bin/env bash
# ============================================================
# GeekSpace 2.0 — Caddy deploy
#
# Pushes ./caddy/Caddyfile (the canonical, version-controlled config)
# to /etc/caddy/Caddyfile (where the host systemd Caddy reads from),
# validates it, reloads Caddy, and verifies the reload succeeded.
#
# Usage:
#   sudo ./scripts/deploy-caddy.sh           # deploy
#   sudo ./scripts/deploy-caddy.sh --dry-run # validate only, no copy/reload
#   sudo ./scripts/deploy-caddy.sh --diff    # show what would change, no copy
#
# Why this script exists:
# Caddy on this VPS runs as a systemd service on the host (not in
# Docker). The repo's `caddy/Caddyfile` is the canonical source of
# truth, but historically anyone editing it didn't realise the host
# config at /etc/caddy/Caddyfile was a separate (and silently
# drifting) copy. On 2026-04-06 the two had diverged so far that the
# repo file was effectively documentation. Use this script to keep
# them in sync; the pre-deploy validate will block obviously broken
# changes before they ever touch the running server.
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SRC="$PROJECT_DIR/caddy/Caddyfile"
DST="/etc/caddy/Caddyfile"
BACKUP="/etc/caddy/Caddyfile.bak.$(date -u +%Y-%m-%d_%H%M%S)"

DRY_RUN=0
DIFF_ONLY=0
case "${1:-}" in
  --dry-run) DRY_RUN=1 ;;
  --diff)    DIFF_ONLY=1 ;;
  "")        ;;
  *) echo "Unknown flag: $1"; exit 2 ;;
esac

# ── Pre-flight ─────────────────────────────────────────────
if [ ! -f "$SRC" ]; then
  echo "ERROR: $SRC not found." >&2
  exit 1
fi

if [ "$EUID" -ne 0 ] && [ "$DRY_RUN" -eq 0 ] && [ "$DIFF_ONLY" -eq 0 ]; then
  echo "ERROR: deploy needs root (writes /etc/caddy and reloads systemd). Re-run with sudo." >&2
  exit 1
fi

if ! command -v caddy >/dev/null 2>&1; then
  echo "ERROR: 'caddy' binary not found in PATH." >&2
  exit 1
fi

# ── Validate (always, even in --diff) ──────────────────────
echo ">> Validating $SRC ..."
if ! caddy validate --config "$SRC" --adapter caddyfile >/tmp/caddy-validate.log 2>&1; then
  echo "VALIDATION FAILED:" >&2
  cat /tmp/caddy-validate.log >&2
  exit 1
fi
grep -q 'Valid configuration' /tmp/caddy-validate.log && echo "   ✓ Valid configuration"
echo

# ── Diff vs live ───────────────────────────────────────────
if [ -f "$DST" ]; then
  if diff -q "$SRC" "$DST" >/dev/null 2>&1; then
    echo ">> $SRC is already in sync with $DST."
    if [ "$DIFF_ONLY" -eq 1 ] || [ "$DRY_RUN" -eq 1 ]; then
      exit 0
    fi
    echo "   Nothing to deploy. (Will still reload caddy to pick up any rendered changes.)"
  else
    echo ">> Pending changes (repo → live):"
    # diff returns 1 on differences; under `set -o pipefail` that would
    # kill the script. `|| true` swallows it without losing real errors.
    { diff -u "$DST" "$SRC" || true; } | sed 's/^/    /' | head -120
    echo
  fi
else
  echo ">> $DST does not exist yet — will create."
fi

if [ "$DIFF_ONLY" -eq 1 ]; then
  exit 0
fi

if [ "$DRY_RUN" -eq 1 ]; then
  echo "Dry-run: validated, no changes written."
  exit 0
fi

# ── Backup + copy ──────────────────────────────────────────
if [ -f "$DST" ]; then
  cp -p "$DST" "$BACKUP"
  echo ">> Backup saved: $BACKUP"
fi

install -m 0644 "$SRC" "$DST"
echo ">> Wrote $DST"

# ── Reload caddy ───────────────────────────────────────────
echo ">> Reloading caddy via systemctl..."
if ! systemctl reload caddy; then
  echo "ERROR: systemctl reload failed. Restoring backup." >&2
  if [ -f "$BACKUP" ]; then
    install -m 0644 "$BACKUP" "$DST"
    systemctl reload caddy || systemctl restart caddy || true
  fi
  exit 1
fi

sleep 2
if ! systemctl is-active --quiet caddy; then
  echo "ERROR: caddy is not active after reload. Restoring backup." >&2
  if [ -f "$BACKUP" ]; then
    install -m 0644 "$BACKUP" "$DST"
    systemctl restart caddy || true
  fi
  exit 1
fi
echo "   ✓ caddy reloaded and active"
echo

# ── Smoke test ─────────────────────────────────────────────
echo ">> Smoke test: HTTPS health on key hostnames"
for host in ai.agentin.chat staging.agentin.chat api.geekspace.space; do
  code=$(curl -sk --resolve "$host:443:127.0.0.1" -o /dev/null -w '%{http_code}' "https://$host/api/health" || true)
  printf "   %-26s /api/health  HTTP %s\n" "$host" "$code"
done
echo
echo "Caddy deploy complete."
