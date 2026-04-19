# Litestream — Continuous SQLite Replication to R2

Litestream streams `geekspace.db` WAL changes to a Cloudflare R2 bucket
every second, giving us ~1s effective RPO. Nightly `scripts/backup-db.sh`
remains as a secondary RPO-24h fallback.

Scoped to issue [AGE-15](/AGE/issues/AGE-15).

## Architecture

```
app container
  └─ writes /var/lib/docker/volumes/geekspace20_geekspace-data/_data/geekspace.db
        │
host systemd
  └─ litestream.service  (runs on the VPS as root)
        │   reads /etc/litestream.yml (env-substituted from /etc/default/litestream)
        ▼
Cloudflare R2
  └─ bucket: geekspace-backups
        └─ path: litestream/geekspace/
```

- `retention: 72h` — R2 keeps 3 days of WAL + snapshots.
- `snapshot-interval: 6h` — full snapshot every 6h; WAL every `sync-interval: 1s`.
- `scripts/backup-db.sh` continues to run at 03:00 for an independent
  point-in-time tarball (kept 30 days local).

## Files in the repo

| Path | Purpose |
|------|---------|
| `ops/litestream/litestream.yml` | Config template installed to `/etc/litestream.yml`. |
| `ops/litestream/litestream.service` | systemd unit installed to `/etc/systemd/system/litestream.service`. |
| `ops/litestream/install-litestream.sh` | Idempotent installer — package, config, env file, unit. |
| `.github/workflows/ops-remote-exec.yml` | `litestream-install`, `litestream-status`, `litestream-restore-drill` arms. |

## Required secrets (GitHub → `production-ops` environment)

| Secret | Source |
|--------|--------|
| `R2_ACCOUNT_ID` | Cloudflare R2 → *S3 API* → account ID prefix of the endpoint URL. |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 → *API tokens* → new Object Read+Write token. |
| `R2_SECRET_ACCESS_KEY` | Same token as above. |
| `R2_BUCKET` | Optional; defaults to `geekspace-backups`. |

These live only in the `production-ops` GitHub Environment and get forwarded
into the SSH session by `ops-remote-exec.yml`. They do not leak into
non-litestream dispatch runs — each case reads only what it needs.

## First-time activation

Prerequisites:

1. R2 bucket `geekspace-backups` exists (empty is fine).
2. API token with *Object Read & Write* on that bucket.
3. The four secrets above set in the `production-ops` GitHub Environment.

Run, in order, from GitHub Actions → **Ops: Remote Exec**:

1. `action: litestream-install` — installs the `.deb`, writes
   `/etc/litestream.yml`, `/etc/default/litestream` (mode 0600), and the
   systemd unit. Restarts `litestream.service`.
2. `action: litestream-status` (~1 minute later) — confirms `active (running)`,
   lists the database, and shows the first snapshot landing in R2.
3. `action: litestream-restore-drill` — restores the latest snapshot to
   `/tmp/litestream-drill-<ts>/geekspace.db` (never touches the live DB),
   runs `PRAGMA integrity_check`, and prints a smoke row count from `users`.

All three dispatches require an approval on the `production-ops` environment
(existing human gate — see `.github/workflows/ops-remote-exec.yml`).

## Monitoring

Quick check from a dev workstation with VPS SSH:

```bash
systemctl status litestream.service
journalctl -u litestream.service --since '-10 min' --no-pager
litestream snapshots -config /etc/litestream.yml \
  /var/lib/docker/volumes/geekspace20_geekspace-data/_data/geekspace.db
```

From GitHub Actions: dispatch `litestream-status`.

Red flags:

- `litestream.service` in `failed` state — check `journalctl`; most common
  cause is R2 credentials expired or revoked.
- `litestream snapshots` returns empty — check R2 bucket permissions.
- Snapshot timestamp older than 7 minutes during active write traffic —
  check for WAL contention (see *Coexistence* below).

## Restore procedures

### Routine drill (non-destructive — run monthly)

Dispatch `litestream-restore-drill`. It restores to `/tmp`, runs
`PRAGMA integrity_check`, and cleans up after itself. No impact on prod.

### Disaster recovery — VPS still alive, DB corrupted

```bash
# On the VPS, as root:
docker compose stop geekspace
mv /var/lib/docker/volumes/geekspace20_geekspace-data/_data/geekspace.db \
   /var/lib/docker/volumes/geekspace20_geekspace-data/_data/geekspace.db.corrupt
litestream restore -config /etc/litestream.yml \
  -o /var/lib/docker/volumes/geekspace20_geekspace-data/_data/geekspace.db \
  /var/lib/docker/volumes/geekspace20_geekspace-data/_data/geekspace.db
sqlite3 /var/lib/docker/volumes/geekspace20_geekspace-data/_data/geekspace.db \
  'PRAGMA integrity_check;'
docker compose start geekspace
curl -sf http://localhost:3001/api/health
```

RPO: ~1s. RTO: ~5 min including container restart.

### Disaster recovery — VPS lost, rebuild from scratch

Follows `scripts/BACKUP-SETUP.md` §*Disaster Recovery Runbook*, with the DB
restore step swapped for the Litestream path above. On a fresh host:

1. Provision Ubuntu 24.04, install Docker + Caddy, clone the repo.
2. Install Litestream (`ops/litestream/install-litestream.sh` with R2 env).
3. Run `litestream restore` targeting the Docker volume path *before*
   `docker compose up -d` — Litestream must write the DB before the app
   opens it.
4. Start containers.

RPO: ~1s. RTO: ~1h (host provisioning dominates).

## Coexistence with existing backup tooling

- `scripts/backup-db.sh` uses `sqlite3 .backup` (online backup API). It does
  **not** issue `PRAGMA wal_checkpoint`, so it coexists safely with
  Litestream. Keep it running.
- `scripts/offsite-backup.sh` (rclone tarball sync) is independent — can be
  re-enabled when rclone is configured against the same R2 bucket.
- The warning in `scripts/LITESTREAM-SETUP.md` about "don't also have the
  app doing WAL checkpoints" referred to an older backup path; the current
  `backup-db.sh` does not checkpoint, so no action needed.

## Rotating R2 credentials

1. Mint a new token in Cloudflare R2.
2. Update the three secrets in the `production-ops` GitHub Environment.
3. Dispatch `litestream-install` again — the script overwrites
   `/etc/default/litestream` and restarts the unit.
4. Revoke the old token in Cloudflare R2.

## Uninstalling

If we ever switch off Litestream:

```bash
systemctl disable --now litestream.service
rm -f /etc/litestream.yml /etc/default/litestream /etc/systemd/system/litestream.service
systemctl daemon-reload
apt-get purge -y litestream
```

## History

- 2026-04-19 — AGE-15 landed the activation path. Board approval
  [147d62ad](/AGE/approvals/147d62ad-fa24-42fd-ad46-e98e9c04a3bc) covers
  the initial R2 provisioning + spend.
