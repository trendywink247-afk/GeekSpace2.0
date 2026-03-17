# AI Risk Register — GeekSpace 2.0

> Updated each phase. Tracks medium/high risks and mitigation status.
> Last updated: Session 5 (2026-03-18)

## Risk Levels
- 🔴 High — may break production or user data
- 🟠 Medium — degrades user experience or reliability
- 🟡 Low — minor impact, acceptable short-term

| ID | Risk | Level | Area | Mitigation | Status | Raised Phase |
|---|---|---|---|---|---|---|
| R01 | JWT token not invalidated on session revoke (only DB record deleted) | 🟠 | Auth | Accept: document; Redis blacklist needed for true revocation | Open | Phase 32 |
| R02 | Ollama cold-start 50-70s causes chat 500s on VPS | 🟡 | AI | Accept: known timeout; retry once after 5s | Open | Phase 1 |
| R03 | SQLite write contention under PM2 cluster (2 workers) | 🟠 | DB | Mitigated: WAL mode + sequential tests | Monitored | Phase 3 |
| R04 | Telegram webhook secret not validated in dev | 🟡 | Security | Mitigated: warned in logs; enforced in prod | Mitigated | Phase 2 |
| R05 | Portfolio bio/project descriptions not HTML-sanitized | 🟠 | Security | Fixed: Phase 43.8 — XSS hardening via DOMPurify + server-side sanitization | Resolved Phase 43 | Phase 43 |
| R06 | remind_before_sent_at not reset on reminder reschedule | 🟠 | Reliability | Fixed: Phase 43.3 — reset on reschedule | Resolved Phase 43 | Phase 43 |
| R07 | 401 token expiry may leave UI in broken/hanging state | 🟠 | UX/Auth | Fixed: Phase 43.2 — Axios interceptor redirects to /login on 401 | Resolved Phase 43 | Phase 43 |
| R08 | Portfolio view_count double-counts same browser session | 🟡 | Accuracy | Fixed: Phase 43.7 — session dedup via IP + user agent fingerprint | Resolved Phase 43 | Phase 43 |
| R09 | Large number of worktrees (30+) consuming disk space | 🟡 | Ops | Action: prune old merged worktrees | Open | Phase 43 |
| R10 | WhatsApp integration is a stub | 🟡 | Feature | Accept: documented; not advertised as working | Open | Phase 1 |
| R11 | CSP still uses unsafe-inline for scripts | 🟠 | Security | Plan: nonce-based policy in dedicated security phase | Open | Phase 3 |
| R11 | CSP still uses unsafe-inline for scripts | 🟠 | Security | Partially mitigated: `frame-ancestors 'none'` in CSP + `X-Frame-Options: DENY` via Helmet frameguard (Phase 46.7 confirmed). Script nonce still pending. | Partially Mitigated | Phase 3 |
| R12 | No rate limiting on admin endpoints (/admin/*) | 🟠 | Security | Mitigated: adminLimiter added in app.ts (10 req/min), confirmed Phase 46.1 audit | Mitigated | Phase 43 |
| R13 | Missing DB indexes on high-frequency query paths | 🟡 | Performance | Fixed Session 5: idx_reminders_user_scheduled, idx_memories_user added | Resolved Session 5 | Phase 43 |
| R17 | Image/video generation had no rate limits — abuse risk | 🟠 | Security | Fixed Session 5: Redis hourly rate limits (20 img/hr, 5 vid/hr per user) | Resolved Session 5 | Session 5 |
| R18 | Health monitor sending alert spam (same alert repeated) | 🟡 | Ops | Fixed Session 5: Redis-backed 5-min dedup + ADMIN_TELEGRAM_CHAT_ID target | Resolved Session 5 | Session 5 |
| R19 | Redis OOM under high load (128MB limit) | 🟠 | Ops | Fixed Session 5: maxmemory 128MB → 256MB, allkeys-lru eviction | Resolved Session 5 | Session 5 |
| R20 | conversation_log unbounded content size (large tool outputs) | 🟡 | DB | Fixed Session 5: logConversation now slices content to 8000 chars | Resolved Session 5 | Session 5 |
| R14 | Clickjacking risk from iframeable content | 🟡 | Security | Mitigated: Helmet frameguard({ action: 'deny' }) sends X-Frame-Options: DENY; CSP frame-ancestors: none also in production. Double-mitigation confirmed Phase 46.7. | Mitigated | Phase 46 |
| R15 | Contact request rate-limit SQL had missing parameter (RangeError on every POST /contact/request) | 🟠 | Reliability | Fixed: Phase 74 — added missing `windowStart` param to `checkRateLimit` query | Resolved Phase 74 | Phase 74 |
| R16 | 27+ routes lacked dedicated unit tests (apiKeys, integrations, contact, oauth, webhooks) | 🟠 | Quality | Fixed: Phase 74 — 45 new tests across 5 route test files | Resolved Phase 74 | Phase 74 |
