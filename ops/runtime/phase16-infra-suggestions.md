# Phase 16 — Infrastructure Suggestions
**Date:** 2026-03-15

## Already Present (No Changes Needed)
| Service | Container | Status |
|---------|-----------|--------|
| Redis 7 Alpine | geekspace-redis | Running, 128MB maxmemory, password auth |
| Meilisearch v1.12 | geekspace-meilisearch | Running, instant search |
| Qdrant v1.13.2 | geekspace-qdrant | Running, semantic search |
| SearXNG | geekspace-searxng | Running, free metasearch |
| Uptime Kuma | geekspace-uptime-kuma | Running, status monitoring |
| Browser Agent | geekspace-browser | Running, Playwright headless |
| PicoClaw | geekspace-picoclaw | Running, AI triage sidecar |
| Caddy | geekspace-caddy | Running, reverse proxy |

## Suggested Additions

### 1. MinIO (S3-compatible Object Storage)
**Priority:** Medium
**Why:** Currently generated images, voice files, and user uploads likely hit external APIs or use local disk. MinIO provides durable local S3 storage with web console.
```yaml
minio:
  image: minio/minio:latest
  container_name: geekspace-minio
  restart: unless-stopped
  command: server /data --console-address ":9001"
  environment:
    MINIO_ROOT_USER: ${MINIO_USER:-agentin-minio}
    MINIO_ROOT_PASSWORD: ${MINIO_PASS:-agentin-minio-2026}
  volumes:
    - minio_data:/data
  ports:
    - "127.0.0.1:9000:9000"
    - "127.0.0.1:9001:9001"
  networks:
    - geekspace-net
  deploy:
    resources:
      limits:
        memory: 256M
```

### 2. Crawl4AI (Web Scraping Service)
**Priority:** Low (may already be managed externally)
**Why:** Complements browser-agent for structured web scraping with AI-powered extraction.

### 3. Loki + Grafana Stack (Observability)
**Priority:** Low (nice-to-have, not critical)
**Why:** Centralized logging and metrics visualization. Currently using file-based json-file logging driver.
**Consideration:** Adds ~512MB memory overhead. Only recommended if VPS has >8GB RAM.

## NOT Recommended
- **BullMQ/Valkey job queue:** The existing `durable-scheduler.ts` (SQLite-backed, restart-safe) already fills this role well. Adding BullMQ would be redundant.
- **Additional Redis instance:** Current Redis handles sessions, rate limiting, and caching. One instance is sufficient for current scale.

## Current Docker Resource Allocation
| Service | Memory Limit |
|---------|-------------|
| geekspace-app | 1GB |
| geekspace-browser | 1.5GB |
| n8n | 512MB |
| redis | 256MB |
| qdrant | 256MB |
| searxng | 256MB |
| caddy | 128MB |
| meilisearch | 128MB |
| uptime-kuma | 128MB |
| picoclaw | 64MB |
| **Total** | **~3.2GB** |

Adding MinIO would bring total to ~3.5GB. VPS should have at least 8GB RAM.
