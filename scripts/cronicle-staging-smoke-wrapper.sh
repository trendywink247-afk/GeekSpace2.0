#!/usr/bin/env bash
set -euo pipefail
cd /root/GeekSpace2.0

./scripts/smoke-staging.sh || {
  ./scripts/notify-telegram.sh "🚨 Agentin STAGING SMOKE FAILED. Check staging.agentin.chat + Cronicle logs."
  exit 1
}
