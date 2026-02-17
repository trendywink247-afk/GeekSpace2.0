# Remaining Features — Design Document

**Date:** 2026-02-17
**Status:** Approved
**Scope:** Four remaining items from ecosystem-polish and weebo-ecosystem design docs

---

## 1. OPENCLAW Badge Rename

**File:** `src/landing/sections/EngineSection.tsx`

Replace the string `"OPENCLAW POWERED"` with `"WEEBO ENGINE"`. One line change.

---

## 2. WhatsApp Scaffolding

No actual Meta API integration — routing scaffolding and UI consistency only.

**Backend:** `server/src/services/message-router.ts`
- Add `channel: 'whatsapp'` handling in `handleIncomingMessage()` — same LLM pipeline as Telegram
- Stub handler returns early with a "WhatsApp not yet configured" log (no actual send)

**Frontend:** Connections page already has a WhatsApp card with "Coming Soon" badge — no change needed.

**Env:** Confirm `WHATSAPP_BUSINESS_ID`, `WHATSAPP_TOKEN`, `WHATSAPP_VERIFY_TOKEN` are in `.env.example` (already added in previous pass — just verify).

---

## 3. Portfolio Intelligence

Enhances the visitor chat flow (`POST /chat/public/:username`) with intent detection and abuse protection.

### Intent Detection
- On the visitor's **first message**, send a short PicoClaw classification call:
  - Prompt: `"Classify this message as one of: recruiter, collaborator, curious. Message: <text>. Reply with one word."`
  - Store result in `activity_log` (`action: 'portfolio_visit_intent'`, `details: intent`)
  - Cache in session context (pass as extra field in conversation history)

### Dynamic Response Tuning
`buildPortfolioVisitorPrompt()` gains a `visitorIntent` parameter that adds an intent-specific instruction block:
- `recruiter`: emphasise skills, years of experience, notable projects, availability
- `collaborator`: emphasise open source, tech stack, GitHub repos, communication style
- `curious`: friendly overview, keep it light and welcoming

### Abuse Protection
- Track message count per visitor session in memory (keyed by `username + sessionId`)
- After **20 messages**: replace LLM call with a fixed polite response directing to contact info
- Session map is in-process (no DB writes needed — resets on server restart, which is fine)

### Analytics
- `activity_log` entries for intent + visit count already queryable
- No new DB tables needed

---

## 4. Memory Enhancements

### Relevance-Scored Injection
`buildMemoryContext()` in `server/src/services/memory.ts`:
- Extract keywords from the current user message (split on spaces, filter stop-words, lowercase)
- Score each stored memory by keyword overlap count
- Inject top 5 highest-scoring memories (currently injects all, which wastes tokens)
- If no keyword overlap, fall back to 3 most recent memories

### MemoryManagerPage UI
`src/dashboard/pages/MemoryManagerPage.tsx`:
- Add category filter tabs: All / Preference / Fact / Project / Pattern
- Per-memory row: add Edit button (inline text input, Save/Cancel) and Delete button (confirmation prompt inline, no modal)
- Wire to existing `PATCH /api/agent/memory/:id` and `DELETE /api/agent/memory/:id` endpoints (check if they exist; add if not)

---

## Implementation Order

1. OPENCLAW rename (30 seconds)
2. WhatsApp scaffolding (30 minutes)
3. Memory enhancements (1–2 hours)
4. Portfolio intelligence (1–2 hours)
