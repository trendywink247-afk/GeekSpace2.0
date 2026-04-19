#!/usr/bin/env bash
# =============================================================================
# install-litestream.sh — idempotent Litestream installer for the VPS.
#
# Installs the Litestream .deb, writes /etc/litestream.yml from the template
# in this directory, and creates /etc/default/litestream from the R2 secrets
# passed in via the environment. Enables and (re)starts the systemd unit.
#
# Required env vars (delivered by ops-remote-exec.yml from GitHub secrets):
#   R2_ACCOUNT_ID
#   R2_ACCESS_KEY_ID
#   R2_SECRET_ACCESS_KEY
#
# Optional:
#   R2_BUCKET                   (default: geekspace-backups)
#   LITESTREAM_VERSION          (default: 0.3.13)
#
# Not intended to be run by hand — the sanctioned path is the
# litestream-install arm of .github/workflows/ops-remote-exec.yml.
# See docs/LITESTREAM.md for context.
# =============================================================================

set -euo pipefail

LITESTREAM_VERSION="${LITESTREAM_VERSION:-0.3.13}"
R2_BUCKET="${R2_BUCKET:-geekspace-backups}"
SRC_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

require_var() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "ERROR: required env var $name is empty" >&2
    exit 1
  fi
}

require_var R2_ACCOUNT_ID
require_var R2_ACCESS_KEY_ID
require_var R2_SECRET_ACCESS_KEY

if [ "$(id -u)" -ne 0 ]; then
  echo "ERROR: must run as root" >&2
  exit 1
fi

echo "--- Installing litestream ${LITESTREAM_VERSION} ---"
INSTALLED_VERSION="$(litestream version 2>/dev/null | awk '{print $NF}' | sed 's/^v//' || true)"
if [ "$INSTALLED_VERSION" = "$LITESTREAM_VERSION" ]; then
  echo "litestream ${LITESTREAM_VERSION} already installed, skipping package step"
else
  DEB_URL="https://github.com/benbjohnson/litestream/releases/download/v${LITESTREAM_VERSION}/litestream-v${LITESTREAM_VERSION}-linux-amd64.deb"
  DEB_PATH="/tmp/litestream-v${LITESTREAM_VERSION}.deb"
  echo "Downloading ${DEB_URL}"
  curl -fsSL "$DEB_URL" -o "$DEB_PATH"
  dpkg -i "$DEB_PATH"
  rm -f "$DEB_PATH"
fi

echo "--- Writing /etc/default/litestream (mode 0600) ---"
# Layered write: only overwrite the MANAGED R2_* block. Any additional lines
# an operator has appended below the managed marker (e.g. extra systemd env
# for future ops) are preserved across re-runs (AGE-15 P2).
DEFAULT_FILE=/etc/default/litestream
MANAGED_MARKER="# --- end managed block (do not remove) ---"
PRESERVED=""
if [ -f "$DEFAULT_FILE" ]; then
  # Everything strictly after the marker, if present, is operator-owned.
  PRESERVED="$(awk -v m="$MANAGED_MARKER" 'f{print} $0==m{f=1}' "$DEFAULT_FILE")"
fi
umask 077
TMP_FILE="$(mktemp)"
chmod 0600 "$TMP_FILE"
{
  echo "# Managed by ops/litestream/install-litestream.sh — do not hand-edit above the marker."
  echo "# To add non-R2 env (for other ops tooling), append BELOW the marker; re-runs preserve it."
  echo "R2_ACCOUNT_ID=${R2_ACCOUNT_ID}"
  echo "R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}"
  echo "R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}"
  echo "R2_BUCKET=${R2_BUCKET}"
  echo "$MANAGED_MARKER"
  if [ -n "$PRESERVED" ]; then
    printf '%s\n' "$PRESERVED"
  fi
} > "$TMP_FILE"
mv "$TMP_FILE" "$DEFAULT_FILE"
chmod 0600 "$DEFAULT_FILE"
umask 022

echo "--- Writing /etc/litestream.yml ---"
install -m 0644 "${SRC_DIR}/litestream.yml" /etc/litestream.yml

echo "--- Installing systemd unit ---"
install -m 0644 "${SRC_DIR}/litestream.service" /etc/systemd/system/litestream.service
systemctl daemon-reload
systemctl enable litestream.service

echo "--- Restarting litestream ---"
systemctl restart litestream.service
sleep 3
systemctl --no-pager --full status litestream.service || true

echo "--- Done ---"
