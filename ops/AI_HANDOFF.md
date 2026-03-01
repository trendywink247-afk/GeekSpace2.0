# AI Handoff — Post-Phase 80 (Voice Pipeline: STT + TTS)

**Date:** 2026-03-01
**Branch:** `main`
**Tests:** 80 server unit test files | 977 tests (all passing)

---

## Completed This Phase

### Phase 80 — Voice Pipeline (STT + TTS)

**80.1** — CI baseline established; worktree created at `.worktrees/phase-80` on branch `ai/phase-20260302-phase80`; baseline 944/944 tests confirmed clean.

**80.2** — `server/src/routes/voice.ts`: POST `/api/voice/transcribe` endpoint. Accepts raw audio body (audio/*, video/*, octet-stream), parses up to 10MB via per-route middleware, stores as `req.rawBody`. Validates audio present, checks daily cap, enqueues `voice:transcribe` job, returns `202 { jobId }`.

**80.3** — `server/src/routes/voice.ts`: POST `/api/voice/speak` endpoint. Accepts JSON `{ text, voice? }`, validates text required, checks daily cap, enqueues `voice:synthesize` job, returns `202 { jobId }`.

**80.4** — Daily voice cap enforcement: `getVoiceCap()` queries `usage_events` table (`tool LIKE 'voice:%'`). Free tier: 5/day. Paid tiers: intro/monthly=30, halfyear=60, yearly/team=100, pro=50. Returns `429 { error: 'Voice limit reached', used, limit }` when exceeded. `logVoiceUsage()` records to `usage_events` with `voice.stt` / `voice.tts` tools.

**80.5** — `src/components/AgentChatPanel.tsx`: MediaRecorder-based voice recording. States: idle → recording → uploading → transcribing. Duration badge shown while recording. Falls back to Web Speech API if MediaRecorder unavailable (`mediaRecorderSupported` check).

**80.6** — `src/components/AgentChatPanel.tsx`: TTS speaker icon (Volume2) on each agent message. `handleTTS()` calls `voiceService.speak`, polls `jobsService.pollUntilDone`, plays base64 audio via `new Audio()`. Loader2 spinner while loading.

**80.7** — Voice UX states fully wired: recording duration badge, uploading/transcribing state indicators, `voiceError` toast showing `'Voice limit reached — upgrade for more'` for 429 cap hits.

**80.8** — `server/src/routes/jobs.ts`: GET `/api/jobs/:id`. Returns job status (pending/processing/done/failed), user isolation enforced (`job.userId !== userId` → 404), result exposed only when `status === 'done'`, error only when `status === 'failed'`. Job handlers for `voice:transcribe` (calls `transcribeVoice`) and `voice:synthesize` (calls `textToSpeech`) registered in `voice.ts`. TODO stubs for local Whisper / piper-tts.

**80.9** — `server/src/test/api/phase80.test.ts`: 33 tests covering all new endpoints, cap enforcement, job handlers, route registrations, and frontend integration.

**80.10** — Brand guard: 0 violations. Phase gate: 7/7 passed. TypeScript: clean (frontend + server).

**80.11** — Staging smoke: 11/11 passed.

**80.12** — Ops files updated; committed; merged to `main`.

---

## Files Changed (Phase 80)

| File | Change |
|------|--------|
| `server/src/routes/voice.ts` | NEW — STT + TTS endpoints, cap enforcement, job handlers |
| `server/src/routes/jobs.ts` | NEW — GET /api/jobs/:id polling endpoint |
| `server/src/app.ts` | Added voiceRouter + jobsRouter imports and registrations |
| `src/services/api.ts` | Added voiceService + jobsService exports |
| `src/components/AgentChatPanel.tsx` | MediaRecorder recording, TTS playback, UX states |
| `server/src/test/api/phase80.test.ts` | NEW — 33 phase80 tests |

---

## Current State

- **Branch:** `main`
- **Tests:** 977/977 passing
- **Build:** clean (frontend + server)
- **Brand guard:** 0 violations
- **Next phase:** Phase 81

---

## Next Phase Suggestions

- **Phase 81** — Voice UX polish: waveform animation, language selector, voice-model selector, error retry with backoff, accessibility labels on voice buttons
- Or pivot to: Seedance Director Mode (per CLAUDE.md policy, task 13)

---

## Exact Resume Command

```bash
cd ~/GeekSpace2.0
git log --oneline -5
cat ops/AI_PHASE_PLAN.md
```
