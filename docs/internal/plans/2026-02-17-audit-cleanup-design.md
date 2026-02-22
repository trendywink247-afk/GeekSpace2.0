# Audit & Cleanup — Design Document

**Date:** 2026-02-17
**Status:** Approved
**Scope:** UI naming cleanup, dead code removal, bug fixes, StatusPage live data

---

## 1. Pico Naming Cleanup (server/src/routes/agent.ts)

Replace all user-visible "Pico" / "PicoClaw" strings with "Weebo Engine" branding.

### 1a. Chat provider string
- Change `provider: 'picoclaw'` in the routing response to `provider: 'weebo-engine'`
- Update `AgentChatPanel.tsx`: add a provider label map so `'weebo-engine'` displays as `"Weebo Engine"` (same pattern as `HealthDashboardPage` `componentLabels`)

### 1b. Terminal help text
- Change `"/pico <msg>               Force PicoClaw"` → `"/pico <msg>               Force Weebo Engine"`

### 1c. Terminal gs pico command responses
- `"No Pico agents found."` → `"No Weebo agents found."`
- `"Pico Agents:\n..."` → `"Weebo Agents:\n..."`
- `"Created Pico agent \"${name}\""` → `"Created Weebo agent \"${name}\""`

---

## 2. Dead UI Cleanup & Bug Fixes (src/components/AgentChatPanel.tsx + src/pages/ExplorePage.tsx)

### 2a. Mic button → Implement browser SpeechRecognition
- Use `window.SpeechRecognition || window.webkitSpeechRecognition` (no backend needed)
- Add `isListening` boolean state and `recognitionRef` ref
- On click: create instance, set `continuous: false`, `interimResults: true`, attach `onresult` to populate input field, call `.start()`
- Second click / `onend`: call `.stop()`, set `isListening` to false
- Mic icon turns accent color while listening
- Hide button entirely if `SpeechRecognition` unsupported in browser
- Add `declare global` for TypeScript types (no package install needed)

### 2b. Paperclip button → Remove
- Remove the `<button>` with `title="Attach file"` and `Paperclip` icon entirely
- Remove `Paperclip` from lucide-react imports if no longer used

### 2c. agentOwner prop → Fix real bug
**Problem:** `agentOwner` is declared in the interface but dropped in the function destructure. When ExplorePage opens the chat panel for another user's agent, the panel silently calls the viewer's own `/api/agent/chat` instead of `/api/agent/chat/public/:username`. Additionally, ExplorePage passes `profile.name.split(' ')[0]` (display first name) instead of `profile.username`, which would 404 the server lookup.

**Fix:**
- Accept `agentOwner` in `AgentChatPanel` function destructure
- In `sendMessage`, branch on `agentOwner`: if set, call `publicAgentService.chat(agentOwner, content)`; if not, call `agentService.chat(content)` as now
- Streaming path falls back to non-streaming `publicAgentService.chat` when `agentOwner` is set (no public streaming endpoint exists)
- Hide premium session deploy button and suggested owner-centric prompts when `agentOwner` is set
- In `ExplorePage.tsx`: change `setChatOwner(profile.name.split(' ')[0])` to `setChatOwner(profile.username)`

### 2d. useOptimistic.ts hook → Delete
- `src/hooks/useOptimistic.ts` is exported but imported nowhere — delete the file

---

## 3. StatusPage — Wire to Real API (src/pages/StatusPage.tsx)

**Problem:** `/status` displays entirely hardcoded fake data. Users see fabricated latency numbers and simulated refresh regardless of actual server state.

**Fix:**
- On mount and on "Check Now" button click, call `GET /api/health` (unauthenticated, already public)
- Map response `components` object to status cards (green = ok/configured/active, yellow = degraded, red = down/unreachable/disabled)
- Map `picoclaw` component key → display label `"Weebo Engine"` (same pattern as HealthDashboardPage)
- Show real `uptime`, `version`, `timestamp` from response
- Remove all hardcoded mock data and `setTimeout` simulation

---

## Implementation Order

1. Pico naming cleanup — server only, rebuild
2. AgentChatPanel: mic implementation + paperclip removal + agentOwner bug fix
3. useOptimistic.ts deletion
4. StatusPage live data wiring
5. Build both, deploy, smoke test
