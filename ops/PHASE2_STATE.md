## SESSION VARS
DB_PATH=/var/lib/docker/volumes/geekspace20_geekspace-data/_data/geekspace.db
ALIYA_USER_ID=6813ac58-98fc-438b-88bb-4a8ef96fda53
ALIYA_CHAT_ID=5337185054
TELEGRAM_BOT_TOKEN=from /root/.agentin-secrets
NEXT_STEP: Phase 1 — Fix 5 Bugs

## BASELINE
- Date: 2026-03-12 08:23 UTC
- RAM: 10Gi / 15Gi used
- Disk: 60G / 193G used (134G free)
- Health: ok=true, DB users=50
- Containers: 15 running (geekspace-app ✅, picoclaw ✅, caddy ✅, redis ✅, ollama ✅)
- Services: 69 TypeScript files in server/src/services/
- DB Tables: 85

## API KEYS
✅ TELEGRAM_BOT_TOKEN (46 chars)
✅ TELEGRAM_WEBHOOK_SECRET
✅ GROQ API keys (x3)
✅ OPENROUTER_API_KEY
✅ TOGETHER_API_KEY
✅ RESEND_API_KEY
✅ TAVILY_API_KEY
✅ WINDMILL (container running)
❌ FAL_KEY (needed for director mode / video)
❌ FIRECRAWL_API_KEY (better scraping)
