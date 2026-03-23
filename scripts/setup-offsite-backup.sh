#!/bin/bash
#
# setup-offsite-backup.sh — Configure off-site backups for GeekSpace2.0
#
# Usage:
#   ./setup-offsite-backup.sh                # print setup instructions
#   ./setup-offsite-backup.sh --interactive  # run rclone config interactively
#   ./setup-offsite-backup.sh --cron         # install the cron job
#

set -euo pipefail

OFFSITE_SCRIPT="/root/GeekSpace2.0/scripts/offsite-backup.sh"
LOG_FILE="/root/backups/offsite-sync.log"
CRON_SCHEDULE="30 3 * * *"

print_header() {
  echo ""
  echo "============================================"
  echo "  GeekSpace2.0 Off-Site Backup Setup"
  echo "============================================"
  echo ""
}

print_provider_instructions() {
  echo "Choose a cloud storage provider and configure rclone."
  echo "The remote MUST be named 'offsite'."
  echo ""
  echo "--------------------------------------------"
  echo "  Option 1: Backblaze B2 (recommended)"
  echo "--------------------------------------------"
  echo "  Cheapest object storage (\$0.005/GB/month)."
  echo ""
  echo "  1. Create account: https://www.backblaze.com/b2/"
  echo "  2. Create a bucket named 'geekspace-backups'"
  echo "  3. Create an application key (read/write to that bucket)"
  echo "  4. Run: rclone config"
  echo "     - New remote -> name: offsite"
  echo "     - Type: b2"
  echo "     - Account ID: <your-account-id>"
  echo "     - Application Key: <your-app-key>"
  echo ""
  echo "--------------------------------------------"
  echo "  Option 2: AWS S3 / S3-compatible"
  echo "--------------------------------------------"
  echo "  Works with AWS, DigitalOcean Spaces, MinIO, etc."
  echo ""
  echo "  1. Create an S3 bucket named 'geekspace-backups'"
  echo "  2. Create IAM credentials with s3:PutObject, s3:GetObject, s3:ListBucket"
  echo "  3. Run: rclone config"
  echo "     - New remote -> name: offsite"
  echo "     - Type: s3"
  echo "     - Provider: AWS (or DigitalOcean, etc.)"
  echo "     - Access Key ID: <your-key>"
  echo "     - Secret Access Key: <your-secret>"
  echo "     - Region: <your-region>"
  echo ""
  echo "--------------------------------------------"
  echo "  Option 3: Google Drive (free 15GB)"
  echo "--------------------------------------------"
  echo "  Good for small backups. GeekSpace backups are ~70MB total."
  echo ""
  echo "  1. Run: rclone config"
  echo "     - New remote -> name: offsite"
  echo "     - Type: drive"
  echo "     - Follow the OAuth flow (needs browser or --headless)"
  echo "  2. Note: For headless servers, use:"
  echo "     rclone authorize drive"
  echo "     on a machine with a browser, then paste the token."
  echo ""
  echo "--------------------------------------------"
  echo "  Option 4: SFTP (any remote server)"
  echo "--------------------------------------------"
  echo "  Sync to another VPS or NAS."
  echo ""
  echo "  1. Run: rclone config"
  echo "     - New remote -> name: offsite"
  echo "     - Type: sftp"
  echo "     - Host: <remote-ip>"
  echo "     - User: <ssh-user>"
  echo "     - Key file or password"
  echo ""
  echo "============================================"
  echo ""
}

print_verification() {
  echo "After configuring, verify with:"
  echo ""
  echo "  rclone listremotes                           # should show 'offsite:'"
  echo "  rclone lsd offsite:                          # list remote directories"
  echo "  $OFFSITE_SCRIPT --dry-run     # test without uploading"
  echo "  $OFFSITE_SCRIPT               # run actual sync"
  echo ""
}

print_cron_info() {
  echo "Recommended cron job (runs 30 min after the main 03:00 backup):"
  echo ""
  echo "  $CRON_SCHEDULE $OFFSITE_SCRIPT >> $LOG_FILE 2>&1"
  echo ""
  echo "To install it, run:"
  echo "  $0 --cron"
  echo ""
}

install_cron() {
  local CRON_LINE="$CRON_SCHEDULE $OFFSITE_SCRIPT >> $LOG_FILE 2>&1"
  local CRON_COMMENT="# Off-site backup sync (30 min after main backup)"

  # Check if already installed
  if crontab -l 2>/dev/null | grep -qF "$OFFSITE_SCRIPT"; then
    echo "Cron job already installed:"
    crontab -l 2>/dev/null | grep -A1 "offsite-backup"
    echo ""
    echo "No changes made."
    return 0
  fi

  # Add to crontab
  (crontab -l 2>/dev/null; echo ""; echo "$CRON_COMMENT"; echo "$CRON_LINE") | crontab -

  echo "Cron job installed:"
  echo "  $CRON_COMMENT"
  echo "  $CRON_LINE"
  echo ""
  echo "Current crontab:"
  crontab -l
}

# Main
case "${1:-}" in
  --interactive)
    print_header
    if ! command -v rclone &>/dev/null; then
      echo "ERROR: rclone is not installed."
      echo "Run: curl https://rclone.org/install.sh | bash"
      exit 1
    fi
    echo "Starting rclone config..."
    echo "IMPORTANT: Name the remote 'offsite'"
    echo ""
    rclone config
    ;;
  --cron)
    install_cron
    ;;
  --help|-h)
    echo "Usage: $0 [--interactive | --cron | --help]"
    echo ""
    echo "  (no args)      Print setup instructions"
    echo "  --interactive   Run rclone config interactively"
    echo "  --cron          Install the cron job for automatic off-site sync"
    echo "  --help          Show this help"
    ;;
  *)
    print_header
    print_provider_instructions
    print_verification
    print_cron_info
    ;;
esac
