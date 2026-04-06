# Backup System Setup

## Current State
- **Daily backup** (03:00): `/root/geekspace-backup.sh` runs SQLite WAL checkpoint + tars .env, Caddy certs, Docker volumes into `/root/backups/`
- **Daily offsite sync** (03:30): `scripts/offsite-backup.sh` — requires rclone remote configured (currently no-op)
- **Weekly verification** (Sun 04:00): `scripts/backup-drill.sh` — restores backup to temp DB and runs `PRAGMA integrity_check`
- **Retention**: 7 days local, ∞ offsite (when configured)

## Enabling Offsite Backups (Cloudflare R2)

R2 is free up to 10GB with **zero egress fees** — ideal for backups.

### 1. Create R2 bucket
1. Sign up at https://dash.cloudflare.com/
2. Go to **R2** → **Create bucket** → name it `geekspace-backups`
3. **R2 API Tokens** → Create API token with "Object Read & Write" permissions

### 2. Configure rclone on the VPS
```bash
rclone config
```

Walk through the prompts:
- `n` for new remote
- Name: `offsite` (must be exact — scripts depend on it)
- Storage type: `s3`
- Provider: `Cloudflare` (option 10 or so)
- Access key ID: (from R2 token)
- Secret access key: (from R2 token)
- Endpoint: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
- Region: `auto`

### 3. Verify
```bash
rclone listremotes             # Should show: offsite:
rclone lsd offsite:             # Should list buckets
./scripts/offsite-backup.sh --dry-run   # Preview what would sync
./scripts/offsite-backup.sh             # Actually sync
```

### 4. The cron job is already configured
`scripts/offsite-backup.sh` runs nightly at 03:30 via cron. Check logs:
```bash
tail -f /var/log/offsite-backup.log
```

## Restoring from Backup

### From local
```bash
cd /root/backups
ls -la agentin-*.tar.gz
tar xzf agentin-20260406_030000.tar.gz -C /tmp/restore/
# SQLite db is at /tmp/restore/geekspace.db
```

### From R2 (after configuring)
```bash
rclone copy offsite:geekspace-backups/agentin-20260406_030000.tar.gz /tmp/
```

## Disaster Recovery Runbook

### Scenario: VPS is lost, spinning up fresh
1. New VPS with Ubuntu 24.04
2. Install Docker, rclone, caddy
3. Configure rclone: `rclone config` (use R2 credentials)
4. Download latest backup: `rclone copy offsite:geekspace-backups/ /tmp/restore/`
5. Clone repo: `git clone git@github.com:trendywink247-afk/GeekSpace2.0.git`
6. Restore `.env`: `tar xzf /tmp/restore/env-latest.tar.gz -C /root/GeekSpace2.0/`
7. Restore DB: `mkdir -p /var/lib/docker/volumes/geekspace20_geekspace-data/_data/ && tar xzf /tmp/restore/agentin-latest.tar.gz -C /var/lib/docker/volumes/geekspace20_geekspace-data/_data/`
8. `docker compose up -d`
9. Verify: `curl http://localhost:3001/api/health`

### RTO target: 1 hour (with practiced runbook)
### RPO target: 24 hours (daily backup)
