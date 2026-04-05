# Agent Task Board

Last updated by: MASTER
Last updated: 2026-04-05T22:00:00Z
Sprint goal: Infrastructure hardening + monitoring + orchestration v2

---

## COMPLETED (this session)
- TASK-19: useChatStream hook extraction ✅ (done before session)
- TASK-20: Chat design polish ✅ (done before session)
- TASK-21: Markdown rendering ✅ (done before session)
- TASK-22: Agentic Experience v2 ✅ (conversation threading, confirmation, file upload, feedback, agent theater, channel badges, autonomy fix, observer upgrade, telegram sync)
- TASK-23: LLM routing optimization ✅ (simple→Groq 0.2s, complex→Ollama local)
- TASK-24: CI fix ✅ (lint errors, 16 pre-existing test failures fixed, all 3592 tests green)
- TASK-25: Monitoring fix ✅ (recreated compose, fixed ports, Grafana dashboards, Prometheus targets)
- TASK-26: Security fix ✅ (all 5 monitoring ports rebound to 127.0.0.1)
- TASK-27: Cleanup ✅ (Dozzle removed, Windmill removed, build cache reclaimed 127GB)
- TASK-28: Pre-push hook ✅ (lint + typecheck + build before push)

## PENDING

### TASK-29 | AGENT:frontend | STATUS:PENDING
**Goal**: Wire ChatSidebar to real conversation thread list with conversation switching
Replace current message-grouping logic with `conversationThreadsService.list()` API call. When user clicks a conversation in sidebar, load its messages via `conversationThreadsService.getMessages(id)` and set `conversationId` state in ChatPage. Add "New Conversation" button that creates a fresh thread.
**Files in scope**: src/dashboard/pages/chat/ChatSidebar.tsx, src/dashboard/pages/ChatPage.tsx
**Files OFF LIMITS**: server/*

### TASK-30 | AGENT:infra | STATUS:PENDING
**Goal**: Wire Cronicle → Claude Bridge for nightly automated audit
Create a Cronicle job that calls /root/GeekSpace2.0/scripts/nightly-ai-audit.sh daily at 3:00 AM. The script already exists and calls Claude Bridge to run lint + typecheck.
**Files in scope**: Cronicle web UI (localhost:3012), scripts/nightly-ai-audit.sh

### TASK-31 | AGENT:backend | STATUS:PENDING
**Goal**: Add Prometheus metrics endpoint to GeekSpace API
Install prom-client, create /api/metrics endpoint exposing: request count, latency histogram, LLM provider usage, active SSE connections, credit deductions. This enables Prometheus to scrape the app directly.
**Files in scope**: server/src/middleware/metrics.ts, server/src/app.ts, server/package.json

### TASK-32 | AGENT:infra | STATUS:PENDING
**Goal**: Wire Prometheus alerts to Telegram
Set up Alertmanager (or a simple webhook) that sends firing alerts to the Agentin Telegram bot. Use the existing TELEGRAM_BOT_TOKEN.
**Files in scope**: /root/docker/monitoring/
