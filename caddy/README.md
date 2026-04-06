# Caddy

The reverse proxy / TLS terminator for everything served on the VPS.

## ⚠️ Source of truth

**`caddy/Caddyfile` in this repo IS the canonical config.**

Caddy itself runs as a **systemd service on the host** (not in Docker),
reading from **`/etc/caddy/Caddyfile`**. Those two files MUST stay in
sync, but they are physically separate copies — anyone who hand-edits
`/etc/caddy/Caddyfile` is making an undocumented change that will be
silently overwritten on the next deploy.

**Always edit `caddy/Caddyfile` here in the repo, then run:**

```bash
sudo ./scripts/deploy-caddy.sh
```

That script:
1. Validates the new file with `caddy validate`
2. Backs up `/etc/caddy/Caddyfile` to a timestamped `.bak`
3. Copies repo → `/etc/caddy/Caddyfile`
4. Reloads caddy via systemd
5. Auto-restores the backup if reload fails
6. Smoke-tests the key hostnames

## Why this is structured weirdly

Historically the repo `caddy/Caddyfile` was a separate copy that drifted
~30 lines from `/etc/caddy/Caddyfile` over a couple of months. Routes
were added to the host file (Agent Zero, Grafana, logo-picker CSP,
modern auth flow without gate.html) without ever being committed to the
repo, while the repo file kept its old gate-mode logic from a beta
phase that no longer exists. On 2026-04-06 the two were reconciled and
this `deploy-caddy.sh` script was added to prevent it from happening
again.

## What this Caddyfile serves

| Hostname | Upstream | Purpose |
|---|---|---|
| `agentin.chat`, `www.agentin.chat` | (308 redirect) | → `https://ai.agentin.chat` |
| `ai.agentin.chat` | `geekspace:3001` (production app, Docker) | Main app, gated by Express auth |
| `api.agentin.chat` | `geekspace:3001` | API only (admin blocked here) |
| `staging.agentin.chat` | `localhost:3002` (staging container) | Staging app |
| `api.geekspace.space` | `localhost:3002` | Operator API + **Mission Control** at `/admin` |
| `ai.geekspace.space` | `localhost:3002` | Staging app, alternate domain |
| `status.agentin.chat` | `localhost:3100` | Uptime Kuma |
| `agent.agentin.chat` | `127.0.0.1:32769` | Agent Zero |
| `monitor.geekspace.space` | `localhost:3000` | Grafana |

## Common operations

```bash
# Edit the config
$EDITOR caddy/Caddyfile

# Preview the diff vs live (no changes)
./scripts/deploy-caddy.sh --diff

# Validate without deploying
./scripts/deploy-caddy.sh --dry-run

# Deploy
sudo ./scripts/deploy-caddy.sh

# Watch logs (cert provisioning, request errors)
journalctl -u caddy -f

# Roll back to a previous backup
ls /etc/caddy/Caddyfile.bak.*
sudo install -m 0644 /etc/caddy/Caddyfile.bak.<timestamp> /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## TLS

Certs are obtained automatically via Let's Encrypt (TLS-ALPN-01 challenge).
Caddy renews them itself in the background — nothing to do.

The `email admin@agentin.chat` line at the top of the Caddyfile is the
ACME account email; renewals fail silently to that address.

## Networking gotcha

Caddy on the host can reach:

- ✅ `localhost:<port>` → host services (Grafana, Uptime Kuma, Agent Zero, staging container's published port `3002`)
- ✅ Docker container hostnames like `geekspace:3001` and `staging:3001`
  **only because the geekspace-net Docker network has been attached to
  Caddy's network namespace.** This is fragile — if Caddy is reinstalled
  fresh, you'll need to recreate that attachment, or migrate everything
  to `localhost:<published-port>` style.

If a `reverse_proxy` block can't reach its upstream after a deploy, that
attachment is the first thing to check.


## ⚠️ Critical: where the SPA bundle lives

**Caddy serves the static frontend from `/srv` on the host filesystem.**
NOT from `/app/dist` inside the staging or production Docker containers.

This means:

- `docker compose up -d --build staging` rebuilds the API server in the
  container but does **not** update the static frontend bundle Caddy
  serves to users. Users keep hitting the previous bundle from `/srv`.
- After every frontend build you MUST do:
  ```bash
  npx vite build
  rsync -a --delete dist/ /srv/
  ```
- `./scripts/staging.sh` and the CI deploy workflow do this automatically
  (since 2026-04-06 — see commit history). If you write a new deploy
  path, replicate the rsync step.

How this happened: Caddy runs as a host-level systemd service (not in
Docker), and the staging/production containers were originally set up
to serve their own `/app/dist` via Express's static middleware as a
backup, but the actual user-facing path is Caddy → /srv. The two diverged
silently and a 30-hour-stale bundle was being served on staging while
"fixes" were being shipped to the API container with no visible effect.
Found during the navigation-bug debug session 2026-04-06.
