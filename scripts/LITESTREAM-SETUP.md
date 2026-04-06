# Litestream Setup (Continuous SQLite Replication)

## What It Does
Litestream streams WAL changes from your SQLite database to S3/R2/filesystem
every second. If the VPS dies, you can restore to within ~1 second of data loss.

**Compare with nightly backups:**
- Nightly backup: RPO 24h, RTO 1h
- Litestream: RPO 1s, RTO 5min

## Install
```bash
# Ubuntu/Debian
wget https://github.com/benbjohnson/litestream/releases/download/v0.3.13/litestream-v0.3.13-linux-amd64.deb
dpkg -i litestream-v0.3.13-linux-amd64.deb
```

## Configure
Create `/etc/litestream.yml`:
```yaml
dbs:
  - path: /var/lib/docker/volumes/geekspace20_geekspace-data/_data/geekspace.db
    replicas:
      - type: s3
        bucket: geekspace-backups
        path: litestream
        endpoint: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
        access-key-id: <R2_ACCESS_KEY>
        secret-access-key: <R2_SECRET>
        region: auto
        retention: 72h
        snapshot-interval: 6h
        sync-interval: 1s
```

## Start
```bash
systemctl enable litestream
systemctl start litestream
systemctl status litestream
```

## Restore
```bash
# Stop app
docker compose stop geekspace

# Restore latest DB from R2
litestream restore -o /tmp/restored.db \
  s3://geekspace-backups/litestream/geekspace.db

# Verify
sqlite3 /tmp/restored.db 'PRAGMA integrity_check'

# Replace prod DB
mv /var/lib/docker/volumes/geekspace20_geekspace-data/_data/geekspace.db{,.bak}
mv /tmp/restored.db /var/lib/docker/volumes/geekspace20_geekspace-data/_data/geekspace.db

# Start app
docker compose start geekspace
```

## Why Not Yet?
Same reason as offsite backups: needs R2 credentials. Once Cloudflare R2 is 
configured per `scripts/BACKUP-SETUP.md`, both can use the same bucket.

## Compatibility with Our Setup
- ✅ Works with SQLite WAL mode (we use it)
- ✅ No app changes needed (reads WAL directly)
- ✅ Survives app restarts
- ⚠️ Must only run ONE litestream process against a DB
- ⚠️ Don't also have the app doing WAL checkpoints (our backup script does — 
  let litestream handle checkpoints instead)
