# CAPABILITIES BLOCKERS
**Date:** 2026-03-13 (Audit v3.1 -- Opus 4.6)
**Previous Update:** 2026-03-13 (Audit v3.0 -- Opus 4.6)

## Active Blockers

## BLOCKER-001: MOONSHOT_API_KEY missing
- Impact: T3 Kimi K2 waterfall tier unavailable -- falls through to T4 (Together AI)
- Severity: Medium (T4 compensates for free users)
- Fix: Add MOONSHOT_API_KEY to .env

## BLOCKER-002: FAL_KEY missing
- Impact: Seedance video generation disabled
- Severity: Low (video gen marked as unavailable in UI)
- Fix: Get FAL_KEY from fal.ai, add to .env

## BLOCKER-004: Ollama CPU-only (no GPU)
- Impact: PicoClaw bridge always times out (qwen3:8b can't generate in <10s on CPU)
- Severity: Medium (mitigated by 10s timeout + Groq fallback)
- Evidence: Every bridge call hits PICOCLAW_TIMEOUT_MS=10000 then falls back to Groq
- Fix: GPU passthrough if VPS supports it, or accept bridge-miss pattern with fast-paths

## BLOCKER-006: Explicit memory storage ("remember X") not working
- Impact: Users who say "remember I prefer TypeScript" get a confirmation but no persistent memory
- Severity: Low (auto-extracted memories still work for names/roles)
- Root cause: "remember X" doesn't match hasToolTrigger patterns -> goes through pico-kimi bridge -> no tool execution
- Fix: Add remember pattern to hasToolTrigger or detectTaskIntent

## BLOCKER-008: Video generation blocked
- Impact: Video generation completely unavailable
- Severity: Low (documented limitation, UI shows disabled state)
- Details: image.pollinations.ai returns 530 from VPS; video.pollinations.ai times out; FAL_KEY missing
- Fix: Get FAL_KEY (fal.ai) or find alternative VPS-friendly video generation API

## BLOCKER-009: /api/usage/stats and /api/usage/history return 404
- Impact: Frontend usage stats API misrouted
- Severity: Low (correct endpoint /api/usage works)
- Fix: Add route aliases in billing router or update frontend to use /api/usage

## BLOCKER-012: WINDMILL_TOKEN missing, containers stopped
- Impact: Workflow trigger tool returns error; Windmill UI inaccessible
- Severity: Low (Windmill containers stopped to save ~670MB RAM)
- Fix: Start Windmill containers + add WINDMILL_TOKEN to .env when workflow automation is needed

## Resolved Blockers

## BLOCKER-003: create_note unreliable via free LLMs [RESOLVED 2026-03-13]
- Impact: Telegram users on free tier cannot reliably save notes via natural language
- Status: RESOLVED -- intermittent; audit v3.0 confirmed create_note working (Note #12 created)

## BLOCKER-004-old: Portfolio Visitor Chat FOREIGN KEY crash [FIXED 2026-03-13]
- Impact: /api/agent/chat with guest JWT token -> SqliteError: FOREIGN KEY constraint failed
- Fix applied: Guard logConversation, upsertMemory, recordTokenUsage, deductSubscriptionCredits with `userId.startsWith('guest:')` check
- Status: FIXED and verified in v2.0 audit

## BLOCKER-005: PicoClaw consistent 60s timeout [FIXED 2026-03-13]
- Impact: 60s extra latency before groq fallback for automation-intent messages
- Previous: 12 timeouts observed in audit v3.0 session, slash commands took 64-68s
- Fix applied: PICOCLAW_TIMEOUT_MS=60000 -> 10000 in .env; total bridge miss latency now 11s (was 60s)
- Status: FIXED -- 5.5x improvement

## BLOCKER-007: Hinglish expense track_expense not persisting [RESOLVED 2026-03-13]
- Impact: "swiggy pe 350 rupay kharch kiye" -> action:completed but no DB row
- Status: RESOLVED -- v3.0 audit confirmed working (200 INR Swiggy expense created)

## BLOCKER-010: Free LLM tool compliance for expense/focus [FIXED 2026-03-13]
- Impact: English expense and focus session messages didn't trigger tool actions on free LLM
- Previous: stepfun/step-3.5-flash:free didn't emit <<<ACTION>>> blocks for these tool types
- Fix applied: Regex fast-paths in message-router.ts -- parseExpenseIntent() and parseFocusIntent()
- Status: FIXED -- expense 660ms, focus 700ms, 0 credits consumed

## BLOCKER-011: Portfolio visitor chat 30s timeout [FIXED 2026-03-13]
- Impact: Portfolio visitor chat returned 503 on free-tier LLM
- Previous: POST /api/portfolio/:username/chat -> 503 after 30002ms
- Fix applied: res.setTimeout(120000) + Groq-first routing with openrouter-free fallback
- Status: FIXED -- 4.8s response time
