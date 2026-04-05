# Chat Page — Full Audit Report
**Date**: 2026-04-05
**Audited by**: frontend, backend, tester agents (parallel)

---

## FRONTEND AUDIT (ChatPage.tsx — 1648 lines)

### Features Inventory
1. ✅ **Streaming chat** — SSE streaming with RAF buffer flush, reconnect with exponential backoff (3 retries: 1s/3s/9s), fallback to sync on failure
2. ✅ **Voice mode** — STT via useVoice hook, TTS via useTTS, toggle persistent in localStorage
3. ✅ **SSE tool steps** — Real-time agent-state-bus subscription showing thinking/tool_call/tool_result/delegating
4. ✅ **Conversation sidebar** — List of past conversations, pin/delete, search, new chat
5. ✅ **@mentions** — Type @agent to mention and route to specific agent
6. ✅ **Feedback** — Thumbs up/down on messages, stored via memoryService.addReaction
7. ✅ **Council mode** — Multi-agent orchestration prefix
8. ✅ **Message editing** — Edit user messages and re-send from that point
9. ✅ **Regeneration** — Re-send the preceding user prompt
10. ✅ **Pin to notes** — Star messages via agentService.toggleStar
11. ✅ **Copy message** — Clipboard copy with toast
12. ✅ **Stream health indicator** — Connected/slow/disconnected dot
13. ✅ **Virtuoso** — Virtualized message list for performance
14. ✅ **Session continuity** — Resume banner for returning users
15. ✅ **Agent capability badges** — Show what the agent can do
16. ✅ **Delegation live indicator** — Real-time delegation status

### Code Quality Issues
- **1648 lines in a single component** — should be split into ChatSidebar, ChatHeader, ChatInput, EmptyState
- Several hardcoded colors remain (not using CSS vars)
- `getTimeOfDayContext` returns hardcoded prompt suggestions — could be dynamic
- RAF loop cleanup looks correct (cancelAnimationFrame on unmount)
- SSE cleanup on unmount: ✅ eventSourceRef.current?.close() in useEffect cleanup

### Design System Compliance
- Most colors use var(--ag-*) tokens ✅
- Some hardcoded: `'#A78BFA'`, `'#ADFF2F'`, `'#FF6B9D'` in personalityMeta
- Touch targets: mostly 44px min ✅, some sidebar actions only 24px ❌
- Font-heading used on agent name ✅

### Mobile Issues
- Height: `h-[calc(100dvh-240px)] md:h-[calc(100vh-180px)]` — the 240px accounts for header+tabs but is fragile
- Conversation sidebar: full overlay on mobile? No — it just pushes content. Should be a drawer/sheet
- Textarea auto-resize: ✅ capped at 120px
- No `pb-20` for bottom tab bar clearance inside chat ❌
- Keyboard: no viewport resize handling

### Accessibility
- aria-labels on most buttons ✅
- Focus management: textarea refocus after mention select ✅
- Virtuoso keyboard nav: default behavior
- Screen reader: message roles not announced

### Performance
- Virtuoso: correctly used for message list ✅
- RAF flush: properly cleaned up ✅
- SSE: closed on unmount ✅
- Re-renders: sendMessage depends on `messages` array — could cause stale closure issues

### What's Missing for a GREAT Chat Page
1. Message search within current conversation
2. Code block syntax highlighting in responses
3. Image/file upload support
4. Typing indicator animation (dots)
5. Message timestamps on hover (not just clustered)
6. Responsive conversation sidebar (drawer on mobile)
7. Markdown rendering in messages (bold, lists, links)

---

## BACKEND AUDIT

### Chat Endpoints
| Method | Path | Auth | Rate Limit | Purpose |
|--------|------|------|------------|---------|
| POST | /api/agent/chat | requireAuth | 60/15min | Sync chat (fallback) |
| POST | /api/agent/chat/stream | requireAuth | 60/15min | Streaming chat (primary) |
| POST | /api/agent/chat/public/:username | none | 10/15min | Public portfolio chat |
| GET | /api/agent-state/stream | token query | none | SSE agent state bus |

### Streaming Implementation
- Uses Node.js `res.write()` with `text/event-stream` content type
- Each chunk: `data: {"text":"...","done":false}\n\n`
- Multi-agent: `{"newBubble":true,"agentId":"jarvis","agentName":"Jarvis"}` signals new message bubble
- Tool steps sent via separate SSE agent-state-bus (not inline in stream)

### LLM Routing
1. Message classified by `classifyMessageComplexity()` → simple/moderate/complex
2. Simple → standard ReAct loop (5 iterations max)
3. Complex → deep reasoning loop (10 iterations)
4. LLM tier fallback: Ollama → OpenRouter → Groq → Moonshot → Gemini → Together → Anthropic
5. Each tier has timeout + error handling → falls to next tier

### Tools Available During Chat
- web_search, create_reminder, create_note, generate_code, generate_image
- send_telegram, browse_url, take_screenshot, track_expense
- create_habit, log_habit, start_focus
- Plus: delegation to other agents, memory read/write

### Conversation Storage
- Table: `conversation_log` (id, user_id, role, content, channel, created_at, metadata)
- Retrieved via: `memoryService.conversations(limit)` → GET /api/memory/conversations
- Messages stored after each exchange (both user and agent messages)
- FTS index: `conversation_fts` for full-text search

### Error Handling
- Ollama timeout → falls to OpenRouter (next tier)
- All tiers down → returns generic error message to user
- Stream abort → partial content kept in UI
- Rate limit exceeded → 429 response

### Rate Limiting
- Chat: 60 requests per 15 minutes per user
- Public chat: 10 requests per 15 minutes per IP
- Applied via Express middleware in app.ts

### Bugs/Gaps Found
1. PicoClaw timeout is 5000ms — too low for complex queries with Ollama
2. Memory extraction fires on every message and times out frequently (logs full of timeout errors)
3. No conversation grouping — all messages in one flat table, sidebar groups by user messages only
4. Agent-state SSE uses token in query string (visible in server logs, less secure than header)

---

## TESTING AUDIT

### Existing Chat Tests
| File | Coverage | Status |
|------|----------|--------|
| server/src/test/api/chat.test.ts | Basic chat endpoint, streaming, error handling | ✅ Passing |
| server/src/test/api/agent-tasks.test.ts | Agent task creation during chat | ✅ Passing |
| e2e/chat.spec.ts | E2E chat flow (send message, get response) | ✅ Passing |

### data-testid Attributes in ChatPage.tsx
- NONE found ❌ — no test IDs for E2E targeting

### What's NOT Tested (Gaps)
1. ❌ Streaming reconnect logic (exponential backoff)
2. ❌ SSE agent-state-bus subscription/cleanup
3. ❌ Voice mode (STT/TTS toggle, transcript handling)
4. ❌ @mention autocomplete popup
5. ❌ Council mode prefix
6. ❌ Message editing and re-send
7. ❌ Regeneration
8. ❌ Pin to notes / star messages
9. ❌ Conversation sidebar (search, pin, delete)
10. ❌ Stream health indicator states
11. ❌ Multi-agent bubble creation (newBubble SSE event)
12. ❌ Rate limit handling on frontend
13. ❌ Feedback thumbs up/down

### Priority Tests to Write
1. **P0**: Chat send/receive (sync + stream) — basic happy path
2. **P0**: Error handling — all tiers down, network failure
3. **P1**: Streaming reconnect
4. **P1**: Conversation history load
5. **P2**: Voice mode toggle
6. **P2**: @mention routing
7. **P3**: Message editing, regeneration
