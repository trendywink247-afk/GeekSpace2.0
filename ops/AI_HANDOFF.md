# AI Handoff -- Post-Phase 97 (AI Inbox)

**Date:** 2026-03-03
**Branch:** `ai/phase-20260303-phase97-ai-inbox`
**Tests:** 93 server unit test files | 1476 tests (Phase 97: 53/53 passing)

---

## Completed This Phase

### Phase 97 -- AI Inbox (unified message feed with AI triage)

1. DB: `inbox_messages` table (user_id, source, sender, content, summary, priority, read, archived, suggested_reply, related_reminder_id, received_at)
2. `server/src/services/inbox.ts` -- addInboxMessage, triageMessage, getInbox, getUnreadCount, markRead, archiveMessage, deleteMessage, getMessageById
3. `server/src/routes/inbox.ts` -- CRUD + reply endpoint (inboxRouter)
4. `server/src/app.ts` -- inboxRouter at /api/inbox
5. `server/src/services/message-router.ts` -- addInboxMessage side-effect after logConversation
6. `src/dashboard/pages/InboxPage.tsx` -- filter tabs, message cards, suggested reply, reply input, action buttons
7. `src/dashboard/DashboardApp.tsx` -- InboxPage lazy import, inbox PageType, nav item (Productivity), bell icon + badge
8. `server/src/test/phase97.test.ts` -- 53 tests (all passing)

---

## Files Changed

```
server/src/db/index.ts                 -- inbox_messages table + index
server/src/services/inbox.ts           -- NEW: inbox service
server/src/routes/inbox.ts             -- NEW: inbox routes
server/src/services/message-router.ts  -- inbox side-effect added
server/src/app.ts                      -- inboxRouter registered
server/src/test/phase97.test.ts        -- NEW: 53 tests
src/dashboard/pages/InboxPage.tsx      -- NEW: inbox UI page
src/dashboard/DashboardApp.tsx         -- InboxPage + nav + bell icon
```

---

## Test / Gate Status

- **Phase 97 tests:** 53/53
- **Total tests:** 1476 (1447 passing + 29 phase87 env-specific skips)
- **TypeScript:** 0 errors (frontend + server)
- **Brand guard:** N/A (no brand-visible changes)
- **Branch:** `ai/phase-20260303-phase97-ai-inbox` (pushed, NOT merged to main)

---

## Inbox Service Details

### API Routes
| Method | Route | Purpose |
|--------|-------|---------|
| GET | /api/inbox | List messages (params: limit, offset, source, unreadOnly) |
| GET | /api/inbox/count | Unread count |
| POST | /api/inbox | Create message (internal/system use) |
| PATCH | /api/inbox/:id/read | Mark as read |
| PATCH | /api/inbox/:id/archive | Archive |
| DELETE | /api/inbox/:id | Delete |
| POST | /api/inbox/:id/reply | Send reply via telegram/whatsapp |

### Triage
- Synchronous: classifyPriority (urgent/high/normal by keyword)
- Async: LLM triage for summary + suggested_reply (fire-and-forget in prod)
- TEST_MODE: deterministic keyword stubs, no real LLM calls

---

## Next Phase

Phase 98: next in queue -- `./scripts/queue.sh next`

---

## FACTORY MODE LIVE
- 1476 tests (1447 passing)
- Phase 97 complete
