# Cronicle Configuration

## Authoritative Path

The live Cronicle compose file is at `/docker/cronicle-ngym/docker-compose.yml` on the server. The copy in this directory is a tracked reference — edits must be applied to the server file and then copied back here.

## Network: geekspace20_geekspace-net

Cronicle is connected to the GeekSpace internal Docker network so that scheduled jobs (e.g. staging smoke tests) can reach `staging-app:3001` directly without going through external DNS/TLS.

## Required Volume Mounts

| Mount | Purpose |
|-------|---------|
| `/var/run/docker.sock` | Lets Cronicle jobs run `docker` commands (inspect, exec, ps) |
| `/root/GeekSpace2.0:/host/GeekSpace2.0:ro` | Read-only repo mount so jobs can execute audit and smoke scripts |

## Scheduled Jobs

| ID | Schedule (IST) | Description |
|----|---------------|-------------|
| `gs_autonomy_audit` | 03:30 daily | Health, containers, disk, tests, SSL |
| `gs_staging_smoke` | 09:10 daily | Staging endpoint smoke tests |
| `gs_docker_space` | 09:30 Sunday | Docker disk usage report |
| `gs_prelaunch_check` | 08:00 daily | Pre-launch readiness: 35+ checks → Telegram |

### gs_prelaunch_check (Phase 83 — new)

**Purpose:** Runs `scripts/cronicle-launch-check-wrapper.sh` to verify launch readiness every morning. Posts pass/fail summary to Telegram.

**Cronicle config:**
```json
{
  "id": "gs_prelaunch_check",
  "title": "Pre-Launch Daily Check",
  "plugin": "shellplug",
  "params": {
    "script": "cd /host/GeekSpace2.0 && bash scripts/cronicle-launch-check-wrapper.sh http://localhost:3001"
  },
  "timing": { "hours": [2], "minutes": [30] },
  "enabled": true,
  "timeout": 300,
  "notify_fail": "trendywink247@gmail.com"
}
```

**To add via Cronicle UI:**
1. Open Cronicle → Schedule → Add Job
2. Plugin: Shell Script
3. Script: `cd /host/GeekSpace2.0 && bash scripts/cronicle-launch-check-wrapper.sh`
4. Schedule: `02:30 UTC daily` (= 08:00 IST)
5. Timeout: 5 minutes
6. Save

All jobs notify `trendywink247@gmail.com` on failure (requires SMTP relay to be configured).
