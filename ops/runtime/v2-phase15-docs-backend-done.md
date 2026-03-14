# Phase 15 — Agentin Docs: Database + Backend
**Status:** COMPLETE
**Date:** 2026-03-15

## What Was Built

### Database Tables (in `server/src/db/index.ts`)
- `documents` — Main docs table (id, user_id, title, content, content_text, icon, cover_url, folder_id, parent_id, is_published, public_slug, word_count, source, tags, pinned, archived, timestamps)
- `doc_folders` — Folder organization (id, user_id, name, icon, parent_id, sort_order)
- `document_versions` — Version history snapshots (id, document_id, content, word_count, saved_at)

### API Routes (`server/src/routes/docs.ts`)
```
GET    /api/docs              — List docs (filter: folder_id, search, pinned, archived)
POST   /api/docs              — Create document
GET    /api/docs/:id          — Get single doc (user ownership check)
PUT    /api/docs/:id          — Full update (auto-calc word_count)
PATCH  /api/docs/:id          — Partial update (title, tags, pinned, archived)
DELETE /api/docs/:id          — Delete (hard or soft with ?soft=true)
GET    /api/docs/:id/versions — List version history
POST   /api/docs/:id/versions — Save version snapshot
POST   /api/docs/:id/publish  — Generate slug, publish
DELETE /api/docs/:id/publish  — Unpublish
GET    /api/docs/share/:slug  — Public doc view (no auth)
POST   /api/docs/:id/ai       — AI action endpoint (stub)
GET    /api/docs/folders       — List folders with doc counts
POST   /api/docs/folders       — Create folder
PUT    /api/docs/folders/:id   — Rename/move
DELETE /api/docs/folders/:id   — Delete folder
POST   /api/docs/quick-capture — Fast capture
GET    /api/docs/search        — Full-text search
```

### Tests (30/30 PASS)
- CRUD operations with auth isolation
- List with filters (pinned, archived, search)
- Folder operations (create, rename, delete)
- Version history (save, list)
- Publishing (slug generation, public access)
- Quick capture
- AI action endpoint shape
- Auth isolation (user A can't see user B's docs)

## Files Created
- `server/src/routes/docs.ts` — NEW
- `server/src/test/api/docs.test.ts` — NEW (30 tests)

## Files Modified
- `server/src/db/index.ts` — 47 lines (3 new tables)
- `server/src/app.ts` — 2 lines (route registration)
- `server/src/test/setup.ts` — 3 lines (test table creation)

## Verification
- Server TypeScript: 0 errors
- Server build: SUCCESS
- Docs tests: 30/30 PASS
- Full test suite: 2253/2253 PASS (up from 2223)
