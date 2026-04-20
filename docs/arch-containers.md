# VPS Container Architecture

<!-- snapshot: 2026-04-20T00:30:00Z -->

> Parent: [AGE-64](/AGE/issues/AGE-64) — Architecture audit + knowledge capture.
> See also: `ARCHITECTURE.md` (umbrella index, authored by CTO in [AGE-68](/AGE/issues/AGE-68)).

---

## 1. Hardware Snapshot

**VPS provider:** Hostinger. **Public IP:** `72.61.253.224`.

<!-- snapshot: 2026-04-20T00:15:00Z — gathered from /proc inside agent container (same host) -->

### CPU

```
Architecture:    x86_64
Model name:      AMD EPYC 9354P 32-Core Processor
Hypervisor:      KVM (full virtualization)
vCPUs (visible): 8
Cores/socket:    8   Thread(s)/core: 1
BogoMIPS:        6499.96
L3 cache:        128 MiB
```

### Memory

```
MemTotal:      32865132 kB  (~31.3 GiB)
MemFree:        2419904 kB
MemAvailable:  18887504 kB  (~18 GiB headroom at snapshot time)
SwapCached:       99848 kB
```

### Disk

```
Filesystem      Size  Used  Avail  Use%  Mounted on
/dev/sda1       387G  116G   272G   30%  / (host root)
overlay         387G  116G   272G   30%  / (container overlay view)
```

### Network

- **Public egress IP:** `72.61.253.224`
- Primary interface on the host: `eth0` (Hostinger VPS NIC; confirmed UP — `72.61.253.224/24`, IPv6 `2a02:4780:12:5853::1/48`) <!-- snapshot: 2026-04-20T20:00:07Z -->
- Container-internal address seen by this agent: `172.28.0.3/16`

---

## 2. Container Inventory

<!-- snapshot: 2026-04-20T00:20:00Z -->

> **Verified against host snapshot.** Live `docker ps` and `docker stats` output captured by the host ops-snapshot script and mounted at `/host-snapshots/containers.txt` and `/host-snapshots/stats.txt`. <!-- snapshot: 2026-04-20T20:00:07Z -->

### 2.1 Container Count Reconciliation

| Source | Count | Notes |
|--------|-------|-------|
| `CLAUDE.md` (last edited ≈ Apr 2026) | 22 | Groups: GeekSpace 10, Monitoring 5, External 4, Utility 3. Miscounts: Ollama is Docker (not systemd); TTS sidecars missing; Paperclip stack not included. |
| `.pi/FULL_AUDIT.md` (2026-04-06) | 23 | Monitoring counted as 6 (adds Alertmanager explicitly). |
| Issue AGE-66 acceptance target | 27 | Target expected by the CTO when this task was filed. |
| **Live `docker ps` (snapshot 2026-04-20T20:00:07Z)** | **27** | Authoritative. Paperclip stack = 2 containers (no `docker-redis-1`). Ollama = Docker, not systemd. `agent-zero` not running. |

**Reconciliation verdict:** <!-- snapshot: 2026-04-20T20:00:07Z -->

- Live `docker ps` confirms **27 running containers**: GeekSpace 13, Monitoring 6, External AI+Automation 3 (`ollama-qtzz-ollama-1`, `claude-bridge`, `cronicle-ngym-cronicle-1`), Utility 3, Paperclip 2 (`docker-server-1`, `docker-db-1`).
- Earlier compose-file count of 28 over-counted because `docker-redis-1` (Paperclip Redis) does not exist as a Docker container — Paperclip uses no separate Redis container. The "27" acceptance target was exactly right.

### 2.2 GeekSpace Stack — `docker-compose.yml`

All containers share the `geekspace20_geekspace-net` bridge network. `geekspace-app` and `geekspace-staging` also join `geekspace-shared` (external, for Ollama access).

| Container | Image / Build | Role | Host→Container Port | Mem limit | CPU limit | Restart | depends_on |
|-----------|--------------|------|---------------------|-----------|-----------|---------|------------|
| `geekspace-app` | `./Dockerfile` | Production API + frontend bundle | `127.0.0.1:3001→3001` | 2 GiB | 1.0 | `unless-stopped` | redis (healthy), picoclaw (healthy) |
| `geekspace-redis` | `redis:7-alpine` | Production Redis (job queue + cache) | `127.0.0.1:6379→6379` | 1 GiB | 0.25 | `unless-stopped` | — |
| `geekspace-picoclaw` | `./picoclaw/Dockerfile` | Weebo fast-triage AI sidecar (qwen2.5-coder:3b) | `127.0.0.1:8080→8080` | 64 MiB | 0.25 | `unless-stopped` | — |
| `geekspace-uptime-kuma` | `louislam/uptime-kuma:1` | Status monitoring UI | `127.0.0.1:3100→3001` | 128 MiB | 0.25 | `unless-stopped` | — |
| `geekspace-searxng` | `searxng/searxng:2026.3.12-…` | Free metasearch engine (replaces Tavily) | internal only | 256 MiB | 0.25 | `unless-stopped` | — |
| `geekspace-meilisearch` | `getmeili/meilisearch:v1.12` | Full-text search (`:7700`) | internal only | 128 MiB | 0.25 | `unless-stopped` | — |
| `geekspace-qdrant` | `qdrant/qdrant:v1.13.2` | Vector DB for semantic memory (`:6333`) | internal only | 256 MiB | 0.5 | `unless-stopped` | — |
| `geekspace-browser` | `./browser-agent/Dockerfile` | Browser automation sidecar (`:3010`) | internal only | 1.5 GiB | 1.0 | `unless-stopped` | — |
| `geekspace-staging` | `./Dockerfile` | Staging API + frontend | `127.0.0.1:3002→3001` | 2 GiB | 0.5 | `unless-stopped` | staging-redis (healthy), picoclaw (healthy) |
| `geekspace-staging-redis` | `redis:7-alpine` | Staging Redis (isolated from prod) | internal only | 64 MiB | 0.1 | `unless-stopped` | — |
| `geekspace-kokoro-tts` | `./kokoro-tts/Dockerfile` | Neural TTS sidecar — Kokoro ONNX (`:5101`) | internal only | 1 GiB | 1.0 | `unless-stopped` | — |
| `geekspace-piper-tts` | `./piper-tts/Dockerfile` | Fallback TTS sidecar — Piper CPU (`:5100`) | internal only | 1 GiB | 0.5 | `unless-stopped` | — |
| `geekspace-whisper-stt` | `./whisper-stt/Dockerfile` | Speech-to-text sidecar — whisper.cpp (`:5102`) | internal only | 1 GiB | 1.0 | `unless-stopped` | — |
| ~~geekspace-n8n~~ | ~~n8nio/n8n:1.78.1~~ | ~~Workflow automation~~ | ~~`127.0.0.1:5678→5678`~~ | ~~512 MiB~~ | ~~0.5~~ | profile `n8n` — **not running by default** | — |

**GeekSpace stack total: 13 running containers** (n8n excluded, geekos/geekos-postgres disabled/commented out).

### 2.3 Monitoring Stack — `docker-compose.logging.yml` + Prometheus (external)

Prometheus, Alertmanager, and cAdvisor are managed separately (not in this repo's compose files). They join `geekspace20_geekspace-net` as external containers.

| Container | Image | Role | Host Port | Mem limit | Restart |
|-----------|-------|------|-----------|-----------|---------|
| `geekspace-loki` | `grafana/loki:3.0.0` | Log aggregation (`:3100` internal only) | internal | 256 MiB | `unless-stopped` |
| `geekspace-grafana` | `grafana/grafana:11.0.0` | Dashboards and visualization | `127.0.0.1:3000→3000` | 256 MiB | `unless-stopped` |
| `geekspace-promtail` | `grafana/promtail:3.0.0` | Log shipper → Loki | internal | 128 MiB | `unless-stopped` |
| `prometheus` | `prom/prometheus:latest` (external) | Metrics scraper — scrapes `/api/metrics`, cAdvisor | `127.0.0.1:9090→9090` <!-- snapshot: 2026-04-20T20:00:07Z --> | — | `unless-stopped` |
| `alertmanager` | `prom/alertmanager:latest` (external) | Prometheus alert routing → Telegram | `127.0.0.1:9093→9093` <!-- snapshot: 2026-04-20T20:00:07Z --> | — | `unless-stopped` |
| `cadvisor` | `gcr.io/cadvisor/cadvisor:latest` (external) | Container resource metrics → Prometheus | `127.0.0.1:8081→8080` <!-- snapshot: 2026-04-20T20:00:07Z --> | — | `unless-stopped` |

**Monitoring stack total: 6 containers.**

### 2.4 External AI + Automation

| Container | Image | Role | Host Port | Notes |
|-----------|-------|------|-----------|-------|
| `ollama-qtzz-ollama-1` | `ollama/ollama:latest` | Local LLM host — gemma4:e4b + nomic-embed-text | `127.0.0.1:11434→11434` | **Docker container**, NOT a systemd service. `ollama.service` is not running. GeekSpace reaches it via `geekspace-shared` network. <!-- snapshot: 2026-04-20T20:00:07Z --> |
| `agent-zero` | (external compose) | Browser-accessible AI agent for ad-hoc VPS tasks | `127.0.0.1:32769→?` | **Not running** per live snapshot. Exposed at `agent.agentin.chat` via Caddy when up. <!-- snapshot: 2026-04-20T20:00:07Z --> |
| `claude-bridge` | `claude-bridge` | HTTP wrapper around Claude Code CLI. `POST /run {prompt,cwd,timeout}` | `127.0.0.1:8787→8787` | Used by Cronicle for nightly automation. Referenced in `.env` as `EDITH_GATEWAY_URL`. <!-- snapshot: 2026-04-20T20:00:07Z --> |
| `cronicle-ngym-cronicle-1` | `soulteary/cronicle:0.9` | Web job scheduler — 4 defined jobs (see §4) | `127.0.0.1:3012→3012` | Has GeekSpace mounted at `/host/GeekSpace2.0:ro`. Mounts `/var/run/docker.sock`. <!-- snapshot: 2026-04-20T20:00:07Z --> |

**External AI + Automation Docker containers: 3 running** (`ollama-qtzz-ollama-1`, `claude-bridge`, `cronicle-ngym-cronicle-1`). `agent-zero` not running at snapshot time.

### 2.5 Utility Stack

| Container | Image | Role | Host Port | Notes |
|-----------|-------|------|-----------|-------|
| `crawl4ai-ykgs-crawl4ai-1` | `unclecode/crawl4ai:latest` | Web scraping for agent research | `127.0.0.1:11235→11235` | <!-- snapshot: 2026-04-20T20:00:07Z --> |
| `healthchecks-kraj-healthchecks-1` | `healthchecks/healthchecks:v3.8` | Cron monitoring / dead-man's switch | `127.0.0.1:63730→8000` | <!-- snapshot: 2026-04-20T20:00:07Z --> |
| `healthchecks-kraj-postgres-1` | `postgres:17-alpine` | Postgres backend for healthchecks container | internal only | <!-- snapshot: 2026-04-20T20:00:07Z --> |

**Utility stack total: 3 containers.**

### 2.6 Paperclip Orchestrator Stack

See `docs/arch-paperclip.md` for detailed coverage. Summary:

| Container | Image | Role | Volume mounts | Host Port |
|-----------|-------|------|---------------|-----------|
| `docker-server-1` | `docker-server` (built locally) | Paperclip server (Node.js) — API at `:3200` (internal), serves UI | `paperclip-data:/paperclip`; bind mounts: `/etc/caddy/Caddyfile→/host/Caddyfile`, `/etc/docker/daemon.json→/host/docker-daemon.json`, `/etc/systemd/system→/host/systemd`, `/root/ops-snapshots→/host-snapshots` <!-- snapshot: 2026-04-20T20:00:07Z --> | `127.0.0.1:3200→3100` |
| `docker-db-1` | `postgres:17-alpine` | Paperclip primary datastore | `pgdata:/var/lib/postgresql/data` | internal only (5432) |

**Paperclip stack total: 2 containers.** (`docker-redis-1` does **not** exist — confirmed by live `docker ps` snapshot 2026-04-20T20:00:07Z. Paperclip uses no separate Redis container.)

### Summary Table

| Stack | Containers | Notes |
|-------|-----------|-------|
| GeekSpace (main compose) | 13 | |
| Monitoring | 6 | |
| External AI + Automation | 3 | Ollama is Docker (not systemd); `agent-zero` not running at snapshot time |
| Utility | 3 | |
| Paperclip | 2 | No `docker-redis-1` |
| **Total** | **27** | Confirmed by live `docker ps` <!-- snapshot: 2026-04-20T20:00:07Z --> |

---

## 3. Caddy Routing Map

<!-- snapshot: 2026-04-20T00:20:00Z — source: caddy/Caddyfile -->

Caddy runs as a **systemd service** on the host (`caddy.service` confirmed active/running; not a Docker container). <!-- snapshot: 2026-04-20T20:00:07Z --> TLS is managed automatically via Let's Encrypt (`email admin@agentin.chat`).

| Public Hostname | Upstream | Notes |
|-----------------|----------|-------|
| `agentin.chat`, `www.agentin.chat` | `→ https://ai.agentin.chat{uri}` (308 redirect) | Permanent redirect; DNS A records must point to `72.61.253.224` |
| `ai.agentin.chat` | `/api/*`, SSE streams → `geekspace:3001`; static assets → `/srv` (file_server) | Admin routes blocked with `403`. Long-lived asset cache (`max-age=31536000, immutable`). SSE uses `flush_interval -1`. |
| `api.agentin.chat` | `geekspace:3001` (all traffic) | Admin routes blocked. Express (Helmet) handles response headers. |
| `staging.agentin.chat` | `/api/*` → `localhost:3002`; assets → `/srv` | No-cache headers for assets. |
| `ai.geekspace.space` | `/api/*` → `localhost:3002`; assets → `/srv` | Legacy staging domain. No-cache. |
| `api.geekspace.space` | `localhost:3002` | Staging API domain. |
| `status.agentin.chat` | `localhost:3100` | Uptime Kuma UI. |
| `agent.agentin.chat` | `127.0.0.1:32769` | Agent Zero. |
| `monitor.geekspace.space` | `localhost:3000` | Grafana. |

**Security headers (applied via `common_headers` snippet):**

| Header | Value |
|--------|-------|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `HSTS` | `max-age=31536000; includeSubDomains; preload` |
| `Content-Security-Policy` | `default-src 'self'`; narrow exceptions for fonts + images |

CSP is set by Caddy (`common_headers`). Helmet CSP is disabled in the Express app (`server/src/app.ts`) to avoid duplication.

---

## 4. systemd Units + Cron

<!-- snapshot: 2026-04-20T00:25:00Z — source: ops/systemd/ and ops/cronicle-jobs/ -->

### 4.1 systemd Services

Live `systemctl list-units --type=service --state=running` captured in `/host-snapshots/systemd-running.txt` (snapshot 2026-04-20T20:00:07Z). <!-- snapshot: 2026-04-20T20:00:07Z -->

| Unit file | Container / Process | Purpose | On-reboot behavior |
|-----------|--------------------|---------|--------------------|
| `geekspace-autostart.service` | `docker compose up -d --remove-orphans` in `/root/GeekSpace2.0` | Auto-starts full GeekSpace stack (main compose) after `docker.service` is ready. `RemainAfterExit=yes` | `WantedBy=multi-user.target` — starts every boot |
| `paperclip-watchdog.service` | `ops/systemd/paperclip-watchdog.sh` (bash loop) | Polls `http://localhost:3033/health` every 30s. If unreachable for >5 min, runs `docker restart docker-server-1`. | Starts with `multi-user.target`; `Restart=always` so the watcher itself auto-recovers |
| `caddy.service` | Caddy binary (systemd-managed) | Reverse proxy — TLS termination, routing, static file serving. Confirmed active/running at snapshot time. | Standard systemd unit; not in this repo. |
| `litestream.service` | Litestream binary | Continuously replicates `/var/lib/docker/volumes/geekspace20_geekspace-data/_data/geekspace.db` → Cloudflare R2 (`sync-interval: 1s`, `snapshot-interval: 6h`, `retention: 72h`). Config: `/etc/litestream.yml` (installed from `ops/litestream/litestream.yml`). | Auto-starts; secrets injected from `/etc/default/litestream` (mode 0600) |
| `agentin-openclaw-alias.service` + `.timer` | `agentin-openclaw-alias-fix.sh` | Ensures the OpenClaw container has the required network alias. One-shot, triggered by timer. | Runs after `docker.service` |

> **Note on Ollama:** `ollama.service` is **not** in systemd-running.txt — Ollama runs as Docker container `ollama-qtzz-ollama-1` (`ollama/ollama:latest`), not via systemd. See §2.4. <!-- snapshot: 2026-04-20T20:00:07Z -->

### 4.2 Cronicle Jobs

Cronicle runs at `localhost:3012` (Docker container). Jobs are configured via the web UI; job definitions are version-controlled in `ops/cronicle-jobs/`.

| Job | Schedule (IST) | Command | Timeout | Status |
|-----|----------------|---------|---------|--------|
| `daily-health.json` — Daily Health Check | Daily 9:00 AM | `./scripts/smoke-staging.sh 2>&1 \| tail -5` | 5 min | enabled |
| `factory-daily.json` — Factory 5 Phases Nightly | Daily 2:00 AM | `scripts/factory-run.sh` | 4 hours | enabled |
| `weekly-audit.json` — Weekly Improvement Audit | Sunday 10:00 AM | `scripts/weekly-audit.sh` | 60 min | enabled |
| `openclaw-auto.json` — OpenClaw Auto Session | Daily 2:00 AM | `scripts/openclaw-auto.sh` | — | **disabled** — enable manually when a phase prompt is ready; auto-disables after one run |

**Paperclip routines** (separate from Cronicle — see `docs/arch-paperclip.md`): `age-secret-rotation-90d` fires every 90 days and creates a rotation issue assigned to CTO.

---

## 5. Secret Surface

<!-- snapshot: 2026-04-20T00:25:00Z — paths and shapes only; no values -->

> **Policy:** No secret values in this file. Paths, file modes, and readers only. Rotation policy: `docs/SSH-ACCESS.md`.

### 5.1 GeekSpace Application Secrets

| Location | File mode | Owner | Contents (shape) | Read by |
|----------|-----------|-------|-----------------|---------|
| `/root/GeekSpace2.0/.env` | `0600` (expected) | root | `JWT_SECRET`, `ENCRYPTION_KEY` (64 hex chars), `DB_PATH`, `REDIS_PASSWORD`, `MEILI_MASTER_KEY`, `ADMIN_TOKEN`, `GATE_COOKIE_VALUE`, `GATE_PASSWORD_HASH`, `STRIPE_SECRET_KEY`, `RAZORPAY_KEY_SECRET`, `TELEGRAM_BOT_TOKEN`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `TOGETHER_API_KEY`, `BROWSER_SECRET`, `GITHUB_DEV_TOKEN` | `geekspace-app` container (env_file injection at runtime) |
| `/root/GeekSpace2.0/.env.staging` | `0600` (expected) | root | Same shape as `.env` plus `STAGING_REDIS_PASSWORD` (no fallback — must be set) | `geekspace-staging` container |

### 5.2 Litestream Secrets

| Location | File mode | Owner | Contents | Read by |
|----------|-----------|-------|---------|---------|
| `/etc/default/litestream` | `0600` | root | `R2_BUCKET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | `litestream.service` (systemd unit env-file) |
| `/etc/litestream.yml` | `0644` | root | Config template with `${VAR}` substitutions; no raw secrets | `litestream` binary at startup |

### 5.3 Paperclip Secrets

| Location | File mode | Owner | Contents | Read by |
|----------|-----------|-------|---------|---------|
| `/paperclip/instances/default/secrets/master.key` | `0600` (observed) | `node` (UID in container) | 44-byte AES master key for the `local_encrypted` secrets provider | Paperclip server (`docker-server-1`) at startup |
| `/paperclip/instances/default/config.json` | `0600` (expected) | root | Postgres connection string (contains password), `BETTER_AUTH_SECRET` reference, S3/R2 creds (shape only) | Paperclip server |
| Paperclip `company_secrets` table (Postgres) | — | Paperclip DB | Per-company encrypted secret blobs; decrypted at runtime using `master.key` | Paperclip server; surfaced to agent adapters via env injection |

### 5.4 CI / GitHub Secrets

| GitHub Secret | Environment | Purpose |
|--------------|-------------|---------|
| `DEPLOY_SSH_KEY` | `production-ops` | VPS SSH key used by `ci.yml` + `deploy.yml` |
| `DEPLOY_HOST` | `production-ops` | VPS hostname / IP |
| `GH_TOKEN` (agent) | Paperclip company_secrets | GitHub PAT for `Agentinopsbot` — used by all agent adapters. Note: lacks `Actions:write` scope; cannot dispatch workflows from agent context (see [AGE-52](/AGE/issues/AGE-52)). |
| `R2_*` | `production-ops` | Cloudflare R2 credentials for Litestream |

### 5.5 Access Model for Agents

Agents have **no direct SSH** to the VPS. Two privileged paths exist:

1. **CI deploy pipelines** (`ci.yml`, `deploy.yml`) — `appleboy/ssh-action` with `DEPLOY_SSH_KEY`. Scoped to build + container restart.
2. **Sanctioned remote-exec** (`ops-remote-exec.yml`) — closed whitelist, dispatch-only, gated by `production-ops` GitHub environment (human approval required per dispatch).

See `docs/SSH-ACCESS.md` for the full access model and human key inventory.

---

## 6. Follow-up Findings

> Per task scope: no fixes here. Follow-up issues filed under [AGE-64](/AGE/issues/AGE-64).

| Finding | Severity | Status |
|---------|----------|--------|
| TTS containers (kokoro, piper, whisper) absent from `CLAUDE.md` group counts | Low | Open — `CLAUDE.md` count still says 22; follow-up to update CLAUDE.md |
| Ollama miscounted in `CLAUDE.md` (says systemd; actually Docker `ollama-qtzz-ollama-1`) | Low | Open — follow-up to update CLAUDE.md |
| `agent-zero` not running at snapshot time (2026-04-20T20:00:07Z) | Low | Open — may be intermittently down; confirm before removing Caddy route |
| Live `heartbeat_runs` psql query not captured (no psql access from agent container) | Low | Open — needs operator to run on VPS host |
