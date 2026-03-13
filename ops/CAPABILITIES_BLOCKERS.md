# CAPABILITIES BLOCKERS
**Date:** 2026-03-13

## Active Blockers

## BLOCKER-001: MOONSHOT_API_KEY missing
- Impact: T3 Kimi K2 waterfall tier unavailable — falls through to T4 (Together AI)
- Severity: Medium (T4 compensates for free users)
- Fix: Add MOONSHOT_API_KEY to .env

## BLOCKER-002: FAL_KEY missing
- Impact: Seedance video generation disabled
- Severity: Low (video gen marked in previous audits)
- Fix: Get FAL_KEY from fal.ai, add to .env

## BLOCKER-003: create_note unreliable via free LLMs
- Impact: Telegram users on free tier cannot reliably save notes via natural language
- Severity: Medium — "save a note" messages go to react loop (correct routing) but stepfun model hallucinates confirmation without emitting ACTION blocks
- Evidence: Conversation log shows "Done! I've saved your note: ..." but DB has no new note rows; no action:executing log for create_note
- Root cause: Free LLM (stepfun/step-3.5-flash:free) doesn't reliably follow tool format instructions
- Fix options:
  1. Use a model-specific few-shot example in the system prompt for note saving
  2. Try with groq (llama-3.3-70b) which is better at following format
  3. Strengthen tool instructions: "YOU MUST output ACTION block, never just say you saved it"

## BLOCKER-004: Portfolio Visitor Chat FOREIGN KEY crash [FIXED 2026-03-13]
- Impact: /api/agent/chat with guest JWT token → SqliteError: FOREIGN KEY constraint failed
- Severity: High (visitor chat completely broken)
- Fix applied:
  - memory.ts: logConversation + upsertMemory skip for guest: prefix
  - token-budget.ts: recordTokenUsage skip for guest: prefix
  - llm.ts: deductSubscriptionCredits skip for guest: prefix
  - agent.ts: /chat route returns 403 for guest users
- Status: FIXED and hot-patched in production 2026-03-13 00:04

## BLOCKER-005: PicoClaw consistent timeout
- Impact: 60s extra latency before groq fallback for automation-intent messages
- Severity: Low (groq fallback works correctly)
- Evidence: error:"The operation was aborted due to timeout" → llm:starting_fallback_chain → groq response
- Fix: Check PicoClaw container health, reduce PicoClaw timeout from 60s to 15s

## BLOCKER-006: Explicit memory storage ("remember X") not working
- Impact: Users who say "remember I prefer TypeScript" get a confirmation but no persistent memory
- Severity: Low (auto-extracted memories still work for names/roles)
- Root cause: "remember X" doesn't match hasToolTrigger patterns → goes through pico-kimi bridge → no tool execution
- Fix: Add remember pattern to hasToolTrigger or detectTaskIntent

## BLOCKER-007: Hinglish expense track_expense not persisting
- Impact: "swiggy pe 350 rupay kharch kiye" → action:completed success:true but no DB row
- Severity: Medium
- Evidence: actionType:track_expense, success:true in logs but expense not in DB
- Root cause: Possible mismatch in amount/category parsing from Hinglish-translated input
- Fix: Debug action-executor track_expense for translated Hinglish inputs

## BLOCKER-008: Video generation blocked
- Impact: Video generation completely unavailable
- Severity: Low (documented limitation)
- Details: image.pollinations.ai returns 530 from VPS; video.pollinations.ai times out; FAL_KEY missing
- Fix: Get FAL_KEY (fal.ai) or find alternative VPS-friendly video generation API

## BLOCKER-009: /api/usage/stats and /api/usage/history return 404
- Impact: Frontend usage stats API misrouted
- Severity: Low (correct endpoint /api/usage works)
- Fix: Add route aliases in billing router or update frontend to use /api/usage
