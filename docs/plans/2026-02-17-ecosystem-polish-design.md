# GeekSpace Ecosystem Polish — Design Document

**Goal:** Remove internal name leaks, activate Telegram bot, build a live API health dashboard, prep WhatsApp architecture, and smoke test the entire system.

**Approach:** Modular feature blocks, deployed incrementally.

---

## 1. Cleanup — Remove Internal Names

- Replace `"OPENCLAW POWERED"` badge in `src/landing/sections/EngineSection.tsx` with `"WEEBO ENGINE"`
- Scan for any other user-facing references to "pico", "openclaw", or "PicoClaw" in frontend text/labels

**Scope:** 1 file, 1 string change.

---

## 2. Telegram Bot Setup

No code changes — the integration is already fully built:
- Bot commands (/start, /link, /unlink, /credits, /status, /help)
- Secure account linking (one-time 6-char codes, 10-min expiry)
- Message routing through LLM pipeline with personality support
- Credit checking and usage tracking
- Frontend UI in Connections page

**Setup steps:**
1. Create bot via @BotFather in Telegram
2. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` in `.env`
3. Restart server (auto-registers webhook)
4. Verify bot responds to `/start` and `/help`

---

## 3. Live API Health Dashboard

### Backend: SSE Endpoint + Metrics Collector

**New middleware** (`server/src/middleware/metrics.ts`):
- In-memory request counter, error counter, latency tracker
- Per-endpoint stats with rolling window
- No DB writes — lightweight process-memory counters
- Exported functions: `getMetricsSnapshot()`, `resetMetrics()`

**New SSE endpoint** (`GET /api/health/stream`):
- Pushes health snapshot every 5 seconds
- Payload includes:
  - Component status (db, Ollama, PicoClaw, Edith, bridge, OpenRouter)
  - Request count and error count (since last push)
  - Average response latency (rolling 5-min window)
  - Process uptime, memory usage
  - Active SSE connections count
- Auto-closes after 30 minutes (client reconnects)

### Frontend: HealthDashboardPage

**New page** (`src/dashboard/pages/HealthDashboardPage.tsx`):
- Real-time component status grid (green/yellow/red indicators)
- Request rate sparkline (live updating)
- Error rate indicator with count
- Latency gauge (current avg)
- Uptime counter
- SSE EventSource connection with auto-reconnect on disconnect

**Dashboard integration:**
- Sidebar entry: "Health" with `Activity` icon, after Settings
- Lazy-loaded page, added to PageType union

---

## 4. WhatsApp Architecture Prep

- Extend `message-router.ts` to handle `channel: 'whatsapp'` (same pipeline as Telegram)
- Add WhatsApp integration card in Connections page with "Coming Soon" badge
- Add `WHATSAPP_BUSINESS_ID`, `WHATSAPP_TOKEN`, `WHATSAPP_VERIFY_TOKEN` to `.env.example`
- No actual Meta API integration — just routing scaffolding and UI placeholder

---

## 5. Smoke Test Suite

### Automated Script (`scripts/smoke-test.sh`)

Hits key API endpoints with curl, reports colored pass/fail:
- `GET /api/health` — all components reachable
- `POST /api/auth/login` — auth returns JWT
- `GET /api/agent/config` — agent config loads
- `POST /api/agent/chat` — LLM responds
- `GET /api/billing/plan` — subscription data
- `POST /api/briefings/trigger` — briefing generates
- `GET /api/recipes` — recipes list
- `GET /api/pico/agents` — fleet agents
- `GET /api/health/stream` — SSE connects

### Manual Walkthrough

After automated tests, visually verify each dashboard page and portfolio chat in the browser.

---

## Tech Stack

- **SSE**: Native EventSource API (no WebSocket library needed)
- **Metrics**: In-memory counters (no Prometheus/external deps)
- **Frontend**: Same React + Lucide + Recharts stack
- **Tests**: Bash + curl (no test framework needed)

## Priority Order

1. Cleanup (quick win)
2. Telegram setup (configuration only)
3. Live health dashboard (most complex, highest value)
4. WhatsApp prep (scaffolding)
5. Smoke tests (validates everything)
