#!/bin/bash
# One-time setup: Install GitHub Actions self-hosted runner on VPS
# Run this manually on the VPS as root
set -euo pipefail

RUNNER_DIR="/opt/actions-runner"
RUNNER_VERSION="2.321.0"

mkdir -p "$RUNNER_DIR" && cd "$RUNNER_DIR"

# Download runner
curl -fL -o actions-runner.tar.gz \
  "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
tar xzf actions-runner.tar.gz
rm actions-runner.tar.gz

echo ""
echo "Runner extracted to $RUNNER_DIR"
echo ""
echo "Next steps (run manually):"
echo "  1. Go to: https://github.com/trendywink247-afk/GeekSpace2.0/settings/actions/runners/new"
echo "  2. Copy the ./config.sh command with the token"
echo "  3. Run: ./config.sh --url https://github.com/trendywink247-afk/GeekSpace2.0 --token <YOUR_TOKEN>"
echo "  4. Install as service: sudo ./svc.sh install && sudo ./svc.sh start"
echo "  5. Verify: sudo ./svc.sh status"
