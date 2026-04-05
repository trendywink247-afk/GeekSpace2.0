# GeekSpace 2.0 — Full System Audit
**Date**: 2026-04-05T23:02Z
**VPS**: 8 cores, 31GB RAM (17GB used, 13GB available), 387GB disk (27% used — 284GB free)
**Reclaimed**: 127GB Docker build cache this session

---

## KNOWN BUGS

### BUG 1: Ollama gemma4 slow on CPU (33-45s for tool-use)
- **Mitigated**: Simple intents now route to Groq 70B first (0.2s)
- Complex/coding still uses Ollama (10-45s) — acceptable with streaming
- **Fully fixed when**: GPU inference or faster local model

### BUG 2: Docker sandbox unavailable on staging
- Docker socket not mounted (by design — security)
- Sandbox features disabled in staging
- **Status**: Won't fix (security tradeoff)

### BUG 3: Prometheus node-exporter networking broken
- Container can serve metrics on localhost but unreachable from other containers on bridge network
- **Mitigated**: Using cAdvisor for all host+container metrics (provides 4800+ metrics)
- Node-exporter removed from stack

---

## Infrastructure — 22 Containers

| Service | Container | Port | Status | Purpose |
|---------|-----------|------|--------|---------|
| **Production** | geekspace-app | 127.0.0.1:3001 | ✅ healthy | Main API + frontend |
| **Staging** | geekspace-staging | 127.0.0.1:3002 | ✅ healthy | Staging (auto-deploy on main push) |
| **Redis (prod)** | geekspace-redis | 127.0.0.1:6379 | ✅ healthy | Cache + sessions + queue |
| **Redis (staging)** | geekspace-staging-redis | internal | ✅ healthy | Staging cache (isolated) |
| **PicoClaw** | geekspace-picoclaw | 127.0.0.1:8080 | ✅ healthy | AI triage (qwen2.5-coder:3b) |
| **Browser** | geekspace-browser | internal:3010 | ✅ healthy | Playwright automation |
| **Meilisearch** | geekspace-meilisearch | internal:7700 | ✅ healthy | Full-text search |
| **Qdrant** | geekspace-qdrant | internal:6333 | ✅ healthy | Vector DB (semantic memory) |
| **SearXNG** | geekspace-searxng | internal:8080 | ✅ healthy | Metasearch engine |
| **Uptime Kuma** | geekspace-uptime-kuma | 127.0.0.1:3100 | ✅ healthy | Status monitoring |
| **Ollama** | ollama-qtzz-ollama-1 | 127.0.0.1:11434 | ✅ healthy | LLM (gemma4:e4b, nomic-embed-text, qwen2.5-coder:3b) |
| **Grafana** | grafana | 127.0.0.1:3000 | ✅ running | Dashboards (2 datasources, 2 dashboards) |
| **Prometheus** | prometheus | 127.0.0.1:9090 | ✅ running | Metrics (2/2 targets up) |
| **Loki** | loki | 127.0.0.1:3101 | ✅ running | Log aggregation |
| **Promtail** | promtail | — | ✅ running | Log shipping |
| **cAdvisor** | cadvisor | 127.0.0.1:8081 | ✅ healthy | Container + host metrics |
| **Agent Zero** | agent-zero-e5ng | 127.0.0.1:32769 | ✅ running | AI agent (browser UI) |
| **Claude Bridge** | claude-bridge | 127.0.0.1:8787 | ✅ running | Claude Code HTTP sidecar |
| **Cronicle** | cronicle-ngym | 127.0.0.1:3012 | ✅ running | Job scheduler (3 active jobs) |
| **Crawl4AI** | crawl4ai-ykgs | 127.0.0.1:11235 | ✅ healthy | Web scraping (v0.5.1) |
| **Healthchecks** | healthchecks-kraj | 127.0.0.1:63730 | ✅ healthy | Cron monitoring |
| **Postgres (HC)** | healthchecks-postgres | internal:5432 | ✅ healthy | Healthchecks DB |

## Networks
| Network | Type | Connects |
|---------|------|----------|
| geekspace-net | internal bridge | All GeekSpace services |
| geekspace-shared | external bridge | GeekSpace ↔ Ollama ↔ external stacks |
| monitoring_monitoring | internal bridge | Grafana, Prometheus, Loki, Promtail, cAdvisor |

## Domains (Caddy)
| Domain | Target | Purpose |
|--------|--------|---------|
| ai.agentin.chat | geekspace:3001 | Production |
| api.agentin.chat | geekspace:3001 | Production API |
| staging.agentin.chat | localhost:3002 | Staging |
| ai.geekspace.space | localhost:3002 | Staging (alt) |
| status.agentin.chat | localhost:3100 | Uptime Kuma |
| agent.agentin.chat | localhost:32769 | Agent Zero |
| monitor.geekspace.space | localhost:3000 | Grafana |

## Cron Jobs
| Source | Schedule | What |
|--------|----------|------|
| crontab | 0 3 * * * | geekspace-backup.sh |
| crontab | 0 */4 * * * | health-check.sh |
| Cronicle | Sun 9:30 | Docker space report |
| Cronicle | Daily 9:10 | Staging smoke test |
| Cronicle | Daily 3:30 | Autonomy audit |

## Security
- ✅ UFW active: only 22, 80, 443 open
- ✅ All Docker ports bound to 127.0.0.1
- ✅ SSH: PermitRootLogin prohibit-password (key only)
- ✅ fail2ban active
- ⚠️ Agent Zero: privileged + Docker socket + full host mount (by design)
- ⚠️ 4 containers mount Docker socket (Agent Zero, Promtail, cAdvisor, Cronicle)

## Git State
- Branch: main
- Last commits: b14fb80 (monitoring/skills/sidebar) ← ddb0e84 (LLM routing) ← 029915d (test fixes) ← df77d5a (agentic v2)
- CI: ✅ Green — staging deployed
- Production: ready for manual deploy

## Ollama Models
| Model | Size | Purpose |
|-------|------|---------|
| gemma4:e4b | 9.6GB | Complex/coding (local Tier 1) |
| qwen2.5-coder:3b | 1.9GB | PicoClaw triage |
| nomic-embed-text | 0.3GB | Embeddings |

## LLM Routing (current)
```
Simple/automation → Groq 70B (0.2s, free) → Ollama → OpenRouter-free
Complex/coding    → Ollama gemma4 (local) → Groq → OpenRouter-free
Triage           → PicoClaw (qwen2.5-coder:3b)
Embeddings       → nomic-embed-text (local)
```
