# Infrastructure Skill — Docker + Caddy + CI/CD + Deployment

## Docker Services Table
| Service | Container | Port | Purpose |
|---------|-----------|------|---------|
| geekspace | geekspace-app | 3001 | Main API + frontend |
| redis | geekspace-redis | 6379 | Cache + sessions |
| picoclaw | geekspace-picoclaw | 8080 | Fast AI triage (qwen2.5-coder:3b) |
| n8n | geekspace-n8n | 5678 | Workflow automation |
| uptime-kuma | geekspace-uptime-kuma | 3100 | Status monitoring |
| searxng | geekspace-searxng | 8888 | Search aggregation |
| meilisearch | geekspace-meilisearch | 7700 | Full-text search |
| qdrant | geekspace-qdrant | 6333 | Vector database |
| browser | geekspace-browser | 3000 | Browserless automation |
| kokoro-tts | geekspace-kokoro-tts | 5101 | TTS service |
| piper-tts | geekspace-piper-tts | 5100 | TTS service |
| whisper-stt | geekspace-whisper-stt | 5102 | Speech-to-text |

## Caddy Configuration
**Production domains:**
- `ai.agentin.chat` → geekspace:3001 (SPA + API)
- `api.agentin.chat` → geekspace:3001 (API only) 
- `status.agentin.chat` → uptime-kuma:3100

**Staging domains:**
- `ai.geekspace.space` → staging:3001
- `staging.agentin.chat` → staging:3001

### Static File Serving
```
/srv/                     # Static frontend files
├── index.html           # SPA entry point
├── assets/              # JS/CSS bundles (1-year cache)
├── gate.html           # Auth gate page
└── [other routes]      # Try files → index.html
```

### Auth Flow
1. **Public pages**: `/`, `/privacy`, `/terms`, `/login`, `/explore` served directly
2. **Assets**: Long-lived cache (`max-age=31536000`) with compression
3. **Authenticated**: Cookie `gs_auth == $GATE_COOKIE_VALUE` → serve SPA
4. **Unauthenticated**: Redirect to `/gate.html`

## CI/CD Pipeline

### GitHub Actions (`.github/workflows/`)
```bash
# Build + test workflow
- TypeScript compilation (frontend + backend)
- Unit tests (Vitest) 
- E2E tests (Playwright)
- Docker build + push to registry
- Deploy to staging
- Manual production deployment trigger
```

### Deployment Flow
1. **Local development**: `docker-compose up -d`
2. **Staging**: Auto-deploy from `main` branch 
3. **Production**: Manual deployment via GitHub Actions
4. **Rollback**: Previous Docker image + database backup restore

## Operations Commands

### Local Development
```bash
docker-compose up -d              # Start all services
docker-compose logs -f geekspace  # Follow main app logs
docker-compose down               # Stop all services
docker-compose exec geekspace sh  # Shell into main container
```

### Production Deployment
```bash
# Deploy latest
docker-compose pull
docker-compose up -d --remove-orphans

# View logs
docker logs geekspace-app --tail 100 -f
docker logs geekspace-redis --tail 100 -f

# Health checks
curl https://api.agentin.chat/api/health
curl https://status.agentin.chat
```

### Database Management
```bash
# Backup SQLite
docker exec geekspace-app sqlite3 /app/data/geekspace.db ".backup /app/data/backup_$(date +%Y%m%d_%H%M%S).db"

# Migrate database
docker exec geekspace-app npm run migrate

# Access Redis
docker exec -it geekspace-redis redis-cli -a $REDIS_PASSWORD
```

## File System Layout
```
/srv/                    # Static frontend (served by Caddy)
/app/data/              # SQLite database + uploads  
/app/apminsightdata/    # APM monitoring data
/data/                  # Persistent volumes (redis, qdrant, etc.)
```

## Security Features
- **No-new-privileges** for all containers
- **DROP ALL** capabilities + minimal additions
- **Memory/CPU limits** on all services
- **Health checks** with auto-restart
- **Security headers** via Caddy (CSP, HSTS, etc.)
- **Log rotation** (50MB max, 5 files)

## Monitoring & Logging
```bash
# Application logs
docker logs geekspace-app -f

# Resource usage
docker stats

# Health endpoints
/api/health              # Main app health
/api/health/stream       # SSE health stream
```

## External Dependencies
- **Ollama containers**: Managed externally via `geekspace-shared` network
- **Domain DNS**: Points to Hostinger server
- **SSL certificates**: Auto-managed by Caddy
- **Backups**: Automated daily SQLite + Redis dumps