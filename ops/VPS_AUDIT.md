# VPS Audit & Optimization — Agentin
**Date:** 2026-03-11
**VPS:** Hostinger srv1317618, Ubuntu 24.04, 16GB RAM / 200GB disk
**Stack:** Node.js (GeekSpace2.0), Redis, Caddy, Docker, Ollama

## Checkpoint System
Each phase is written here immediately after completion.
This file persists across conversation compaction — resume from last ✅ checkpoint.

---

## Status
- [x] Phase 1 — Inventory
- [x] Phase 2 — Disk Cleanup
- [x] Phase 3 — RAM Analysis
- [x] Phase 4 — RAM Optimizations
- [x] Phase 5 — Qwen3 Model Selection & Pull
- [x] Phase 6 — Final State + LLM Tier Wiring

---
## Phase 1 - Inventory ✅
**Timestamp:** 2026-03-11

### RAM (free -h)
```
               total        used        free      shared  buff/cache   available
Mem:            15Gi        12Gi       2.0Gi        15Mi       2.0Gi       3.6Gi
Swap:            9Gi       5.3Gi       4.7Gi
```
⚠️ CRITICAL: 12GB used, 5.3GB swap active — heavy swapping in progress

### Disk (df -h)
- Root /dev/sda1: 142GB used / 193GB (74%)
- /tmp: many geekspace test DB WAL files

### Docker Disk (docker system df)
```
Images:       18 total, 116.2GB, 115.9GB reclaimable (99%)
Containers:   17 active, 106.2MB
Volumes:      20 total, 10.79GB, 8.952MB reclaimable
Build Cache:  307 entries, 86.52GB — ALL RECLAIMABLE ⚠️ BIGGEST WIN
```

### Ollama Models
```
qwen2.5-coder:1.5b   986 MB    (3 weeks old — REMOVE)
llama3.1:8b          4.9 GB    (3 weeks old — REMOVE)
qwen2.5-coder:7b     4.7 GB    (current default — REMOVE after pulling qwen3)
```

### Top Memory Consumers
- Ollama runner #1 (PID 2926334): 26.2% RAM = ~4.3GB — qwen2.5-coder:7b loaded
- Ollama runner #2 (PID 3233): 25.5% RAM = ~4.2GB — llama3.1:8b loaded ⚠️ STALE
- dockerd: 7.3% = ~1.2GB
- claude process: 3.4% = ~560MB
- openclaw-gateway: 2.2% = ~362MB
- Node.js workers (4x): ~0.9% each = ~640MB total
- Windmill postgres: multiple processes, ~87-96MB each

### Key Issues Found
1. TWO Ollama models loaded in RAM simultaneously = ~8.5GB wasted
2. Docker build cache = 86.52GB to reclaim
3. /tmp full of leftover test DB WAL files
4. 5.3GB swap usage = performance degradation


## Phase 2 - Disk Cleanup ✅
**Timestamp:** 2026-03-11

| Step | Action | Before | After | Freed |
|------|--------|--------|-------|-------|
| 2.1 | docker builder prune -f (build cache) | 86.52GB | 0B | **~82GB** |
| 2.2 | ollama rm llama3.1:8b + qwen2.5-coder:1.5b | 10.6GB models | 4.7GB | **~5.9GB** |
| 2.3 | npm cache clean --force | ~small | 0 | <1GB |
| 2.4 | Log files | none >100MB | n/a | 0 |
| 2.5 | /tmp cleanup (test DB WAL files) | 1.6GB | 68MB | **~1.5GB** |
| 2.6 | apt-get clean | small | 0 | <1GB |

**Disk: 142GB → 60GB used (74% → 32%). Freed ~82GB total.**

---

## Phase 3 - RAM Analysis ✅
**Timestamp:** 2026-03-11

### Docker Container RAM Usage
| Container | RAM Used | Limit |
|-----------|----------|-------|
| geekspace-app | 260MB | 1GB |
| geekspace-staging-app | 249MB | 512MB |
| openclaw-gateway | 341MB | unlimited |
| windmill-db (postgres) | 563MB | unlimited |
| ollama | 4.23GB | unlimited (model loaded) |
| geekspace-redis | 2.2MB | 256MB |
| geekspace-staging-redis | 2.6MB | 128MB |

### Redis maxmemory
- geekspace-redis: 128MB, allkeys-lru ✅ (already set)
- geekspace-staging-redis: 128MB, allkeys-lru ✅

### Ollama loaded model
- qwen2.5-coder:7b loaded in RAM = 4.8GB, expires in ~4 min from check time

### Node.js flags
- No --max-old-space-size set (Node defaults to ~1.5GB per process, 4 workers = 6GB theoretical max)

### RAM after Phase 2 cleanup
- Used: 8.2GB (was 12GB) — freed 3.8GB by removing stale llama3.1:8b from model store
- Swap: 2.9GB (was 5.3GB) — improving
- Available: 7.4GB

---

## Phase 4 - RAM Optimizations ✅
**Timestamp:** 2026-03-11

| Action | Result |
|--------|--------|
| Redis maxmemory check | Already set: 128MB, allkeys-lru ✅ No change needed |
| Ollama model unloaded | `ollama stop qwen2.5-coder:7b` → freed 4.3GB RAM |
| Zombie process check | None found ✅ |
| RAM after unload | Used: 4.1GB (was 12GB), Available: 11GB, Swap: 2.0GB (was 5.3GB) |

---

## Phase 5 - Qwen3 Model Selection & Pull ✅
**Timestamp:** 2026-03-11

**Decision:** Available RAM = 11GB → pull qwen3:8b full quality (needs ~5.2GB) ✅

| Action | Result |
|--------|--------|
| Removed qwen2.5-coder:7b from disk | Freed ~4.7GB |
| Removed qwen2.5-coder:1.5b (Phase 2) | Freed ~986MB |
| Removed llama3.1:8b (Phase 2) | Freed ~4.9GB |
| Pulled qwen3:8b | 5.2GB ✅ |
| Updated OLLAMA_MODEL in .env | qwen3:8b |
| Updated /root/.agentin-secrets | OLLAMA_MODEL=qwen3:8b |

---

## Phase 6 - Final State ✅
**Timestamp:** 2026-03-11

### Before vs After

| Metric | Before | After |
|--------|--------|-------|
| RAM used | 12GB / 15GB (80%) | 4.2GB / 15GB (28%) |
| Swap used | 5.3GB | 2.0GB |
| RAM available | 3.6GB | 11GB |
| Disk used | 142GB / 193GB (74%) | 54GB / 193GB (28%) |
| Ollama models | 3 (llama3.1:8b, qwen2.5-coder:1.5b, qwen2.5-coder:7b) | 1 (qwen3:8b) |
| Docker build cache | 86.52GB | 0B |
| Geekspace health | ok | ok ✅ |

### Disk freed: ~88GB  |  RAM freed: ~7.8GB  |  Swap reduced: 3.3GB

### Current Ollama model
```
qwen3:8b   5.2 GB   (pulled 2026-03-11)
```

### Health check
- http://localhost:3001/api/health → status: ok, ollama: reachable ✅
- geekspace restarted with OLLAMA_MODEL=qwen3:8b ✅

---

## Next: LLM Waterfall Redesign
Per user spec (see session notes), the new waterfall is being implemented.
See server/src/services/llm.ts for implementation.

