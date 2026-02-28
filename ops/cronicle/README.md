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

All jobs notify `trendywink247@gmail.com` on failure (requires SMTP relay to be configured).
