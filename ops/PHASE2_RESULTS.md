# Phase 1 Results — Bug Fixes (2026-03-12)

## Status: ✅ COMPLETE

## Bugs Fixed

| Bug | Description | File | Status |
|-----|-------------|------|--------|
| P1-1 | `<tool_call>` XML leaking to Telegram users | `telegram.ts` | ✅ Fixed |
| P1-2 | Cache collision — different users got same cached response | `llm.ts` | ✅ Fixed |
| P1-3 | `list_reminders` not in action-executor → hallucinated lists | `action-executor.ts`, `action-parser.ts`, `message-router.ts` | ✅ Fixed |
| P1-4 | Hardcoded `'Geek'` personality name instead of configured agent name | `message-router.ts` | ✅ Fixed |
| P1-5 | 🔍 emoji on non-search responses (math, greetings, simple questions) | `tavily.ts` | ✅ Fixed |

## Verification

- P1-1: XML tags stripped before Telegram send ✅
- P1-2: Cache key now includes userId ✅
- P1-3: `list_reminders` fast-path executed (log: "Reminder list fast-path executed" count:1) ✅
- P1-4: `resolveAgentName()` helper reads agentConfig.name or personality ✅
- P1-5: isSearchIntent("what is your name?")=false, ("15 times 7")=false, ("latest AI news")=true ✅

## Files Modified
- `server/src/services/telegram.ts` — XML strip at start of sanitizeForTelegram()
- `server/src/services/llm.ts` — makeCacheKey includes userId; NEVER_CACHE patterns
- `server/src/services/action-executor.ts` — list_reminders case added
- `server/src/services/action-parser.ts` — listRemindersSchema registered
- `server/src/services/message-router.ts` — resolveAgentName helper, list_reminders fast-path, TOOL_INSTRUCTIONS updated
- `server/src/services/tavily.ts` — 8 new isSearchIntent() guard patterns

## Hot-Patched Files
All 6 files hot-patched into geekspace-app container via docker cp + docker restart.
