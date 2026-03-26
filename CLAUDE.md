# Agentin — Claude Code Configuration

## Behavioral Rules

- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary — prefer editing existing files
- NEVER proactively create documentation (*.md) or README files unless explicitly asked
- NEVER save working files, text/mds, or tests to the root folder
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or .env files
- ALWAYS create PRs for changes — never push directly to main

## File Organization

- `/src` — React frontend (Vite + TypeScript)
- `/server` — Express backend (TypeScript)
- `/docs` — documentation
- `/ops` — operational scripts, test harnesses, AI handoff docs
- `/scripts` — utility scripts
- `/e2e` — Playwright E2E test specs
- `/agents` — agent YAML configs
- `/caddy` — Caddyfile (reverse proxy config)
- `/picoclaw` — PicoClaw local LLM service
- `/browser-agent` — headless browser Docker service
- `/bridge` — Edith bridge service
- `/geekos` — GeekOS Docker service

## Build & Test

```bash
npm run build              # frontend (tsc -b && vite build)
cd server && npm run build # backend (0 TS errors)
npm test                   # server unit tests (2552 pass)
npm run lint               # ESLint
npx tsc --noEmit           # typecheck frontend
```

- ALWAYS verify `npx tsc --noEmit` passes before committing
- Docker build uses `tsc -b` which is stricter than `--noEmit` — unused imports will fail

## Git Workflow

```bash
# 1. Create feature branch
git checkout -b feat/my-change main

# 2. Make changes, verify build
npx tsc --noEmit && npm run build

# 3. Commit, push, create PR
git push -u origin feat/my-change
gh pr create --title "feat: description" --body "..."

# 4. CI runs: static checks → unit tests → staging deploy (PRs) or production deploy (main)
# 5. Merge after CI green
gh pr merge <number> --squash --delete-branch --admin
```

## Deploy (CI handles this automatically)

**PR merge to main triggers:** static checks → unit tests → staging deploy → production deploy → branch promotion

```bash
# Manual deploy (if needed)
docker compose up -d --build geekspace        # backend
docker cp geekspace-app:/app/dist/assets/. /srv/assets/
docker cp geekspace-app:/app/dist/index.html /srv/index.html
docker cp geekspace-app:/app/dist/office /srv/office 2>/dev/null || true
curl localhost:3001/api/health                 # 12 services
```

**NOTE:** Caddy serves static files from `/srv`, NOT from Docker container.

## Security Gotchas

- **Gate cookie**: value in `GATE_COOKIE_VALUE` env var, NOT hardcoded
- **JWT**: 15m access / 30d refresh. Do not increase access token expiry
- **Health**: `/api/health` is public (status only). `/api/health/detailed` requires admin token
- **TTS**: uses `execFile()` not `exec()`. Never use `exec()` with user input
- **Docker**: all containers have `no-new-privileges`. Do not remove it
- **Passwords**: all in `.env`, NOT in `docker-compose.yml`. Never add defaults
- **sshd**: keys-only, no password auth
- **n8n**: bound to `127.0.0.1` only
- **Caddy**: standalone host process, NOT Docker. Config at `/etc/caddy/Caddyfile`, repo copy at `caddy/Caddyfile`

## Backups

- **Daily**: 3 AM via `/root/geekspace-backup.sh` (SQLite WAL, Postgres dump, Docker volumes, `.env`)
- **Off-site**: `scripts/offsite-backup.sh` (requires rclone remote)
- **Encrypted**: set `GPG_PASSPHRASE` env var

## Architecture

- React 19 + Vite + TypeScript frontend
- Express + TypeScript backend
- SQLite (primary) + Redis (cache)
- Docker Compose (15 services)
- Caddy reverse proxy (host process)
- LLM routing: cloud-first waterfall (OpenRouter → PicoClaw → Ollama → Groq → Together)
- 9 AI personalities with auto-delegation
- Telegram bot: @agentinchatbot
