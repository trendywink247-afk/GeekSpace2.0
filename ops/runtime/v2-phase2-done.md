# Phase 2 — Critical Bugs: Image Gallery + Video Gen
**Status:** COMPLETE (with reality check)
**Date:** 2026-03-15

## Audit Reality Check
- **Image Gallery disconnected:** FALSE — Gallery correctly calls `/api/images`. Working fine.
- **Video credits on failure:** CONFIRMED BUG — Fixed.

## Fix Applied: Video Credits Deducted on Failure
**Root cause:** Credits deducted BEFORE `generateVideo()` / `callOpenRouterVideo()` in `POST /api/videos/generate`.

**Fix:**
- OpenRouter video: Added success check BEFORE credit deduction. Returns 502 with clear error on failure.
- Premium video: Same pattern — credits deducted only AFTER successful generation.
- Director Mode: Already correct (deducts after async completion).
- Error responses now include `code: 'VIDEO_GENERATION_UNAVAILABLE'` for frontend handling.

## Files Changed
- `server/src/routes/videos.ts` — 14 lines changed (13 insertions, 1 deletion)

## Verification
- Server TypeScript: 0 errors
- Server tests: 2253/2253 PASS
