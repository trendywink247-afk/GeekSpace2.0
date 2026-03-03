#!/usr/bin/env bash
set -euo pipefail
cd /root/GeekSpace2.0

CRONICLE_AUDIT_ONLY=1 ./scripts/cronicle-autonomy-audit.sh || {
  ./scripts/notify-telegram.sh "🚨 Agentin AUDIT FAILED. Check Cronicle logs."
  exit 1
}
