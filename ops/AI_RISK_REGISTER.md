# AI Risk Register — GeekSpace 2.0

> Updated each phase. Tracks medium/high risks and mitigation status.
> Last updated: Phase 43 (2026-02-25)

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
| R05 | Portfolio bio/project descriptions not HTML-sanitized | 🟠 | Security | Fix: Phase 43.8 | In Progress | Phase 43 |
| R06 | remind_before_sent_at not reset on reminder reschedule | 🟠 | Reliability | Fix: Phase 43.3 | In Progress | Phase 43 |
| R07 | 401 token expiry may leave UI in broken/hanging state | 🟠 | UX/Auth | Fix: Phase 43.2 | In Progress | Phase 43 |
| R08 | Portfolio view_count double-counts same browser session | 🟡 | Accuracy | Fix: Phase 43.7 | In Progress | Phase 43 |
| R09 | Large number of worktrees (30+) consuming disk space | 🟡 | Ops | Action: prune old merged worktrees | Open | Phase 43 |
| R10 | WhatsApp integration is a stub | 🟡 | Feature | Accept: documented; not advertised as working | Open | Phase 1 |
| R11 | CSP still uses unsafe-inline for scripts | 🟠 | Security | Plan: nonce-based policy in dedicated security phase | Open | Phase 3 |
| R12 | No rate limiting on admin endpoints (/admin/*) | 🟠 | Security | Plan: add rate limit to admin router in Phase 44 | Open | Phase 43 |
| R13 | Missing DB indexes on high-frequency query paths | 🟡 | Performance | Fix: Phase 43.9 | In Progress | Phase 43 |
