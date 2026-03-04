# Design: Media Model Picker + Mobile Orientation Fix
**Date:** 2026-03-04
**Scope:** Image Gen page, Video Gen page, media-generation service, agent_configs schema, mobile layout

---

## Problem Summary

1. **Image generation 530 errors** — Pollinations.AI CDN returns 530 from Hostinger's BOM datacenter IP. Single-provider dependency means any Pollinations outage = total failure.

2. **No persistent model preference** — Image and video model selection is per-generation only (dropdown in the panel). Agents always default to `auto`/Pollinations regardless of user preference. No way to say "always use HuggingFace for my images."

3. **No model discovery UI** — Users can't see all available models, their status (live/down), or set a preferred one without actively generating.

4. **Mobile auto-rotate from Google Search** — `manifest.json` has `orientation: portrait-primary` but this only applies to installed PWAs. When opening from a browser tab (Google Search), the device freely rotates and the layout reflows awkwardly.

---

## Design

### Part 1: Multi-Provider Image Generation Fallback

**File:** `server/src/services/media-generation.ts`

Replace single Pollinations call with a waterfall:

```
generateImage(prompt, options):
  1. Pollinations FLUX — HEAD check, timeout 10s
     → if ok: return URL
     → if 530/timeout: fall through

  2. HuggingFace Inference API — FLUX.1-schnell (free, no key required)
     POST https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell
     Body: { inputs: prompt }
     Returns: binary blob
     → Save to /app/data/img-cache/{id}.jpg (create dir if missing)
     → Return URL: /api/images/cache/{id}.jpg (served via express.static)
     → Timeout: 45s (model may be warming up)

  3. If both fail → return { success: false, error: 'All image providers unavailable' }
```

HuggingFace notes:
- Free tier: ~10 req/min without token, ~30/min with `HF_TOKEN` env var
- Returns `application/octet-stream` binary → write to disk, serve statically
- Cache files auto-deleted after 24h (same cleanup job as user_images)

New env var (optional): `HF_TOKEN` — if present, passed as `Authorization: Bearer {HF_TOKEN}` header for higher rate limits.

New static route: `GET /api/images/cache/:file` → serves `/app/data/img-cache/` directory.

**Video fallback:** Same pattern — Pollinations video → if fail → return error with clear message (no free video alternative as reliable as HF for images).

---

### Part 2: Persistent Model Preference in agent_configs

**Schema change** (`server/src/db/index.ts`):
```sql
ALTER TABLE agent_configs ADD COLUMN preferred_image_model TEXT DEFAULT 'auto';
ALTER TABLE agent_configs ADD COLUMN preferred_video_model TEXT DEFAULT 'auto';
```

**API:** Existing `PATCH /api/agent/config` already accepts arbitrary fields — no new endpoint needed. Frontend sends `{ preferred_image_model: 'huggingface-flux' }`.

**Agent action integration** (`server/src/services/action-executor.ts`):
When `generate_image` action fires, look up `agent_configs.preferred_image_model` for the user and pass it to `generateImage()` so the fallback chain respects user preference.

---

### Part 3: Available Models Section (Image Gen Page)

**Location:** Bottom of `ImageGenPage.tsx`, below the gallery, above the usage info footer.

**Section title:** "Available Image Models"

**Model cards** (horizontal scroll on mobile, grid on desktop):

| Model ID | Display Name | Provider | Cost | Notes |
|----------|-------------|----------|------|-------|
| `auto` | Auto Select | System | Free | Picks best available |
| `pollinations` | Pollinations FLUX | Pollinations.AI | Free | Fast when online |
| `huggingface-flux` | HuggingFace FLUX | HuggingFace | Free | Fallback, slightly slower |
| `black-forest-labs/flux-1-schnell:free` | FLUX Schnell | OpenRouter | Free | If OR key configured |
| `black-forest-labs/flux-1-schnell` | FLUX Schnell Pro | OpenRouter | 15cr | Higher quality |
| `premium` | Premium Enhanced | Kimi + Pollinations | 20cr | Prompt-enhanced |

**Each card shows:**
- Model name + provider badge
- Short description
- `Free` / `15cr` / `20cr` tag
- **Live status dot** — green (✓) / red (✗) / grey (checking)
  - Status fetched from new endpoint `GET /api/images/models/status` (backend does HEAD pings at request time, cached 60s)
- **"Set as default"** button → calls `PATCH /api/agent/config` with `preferred_image_model`
- Checkmark if this is the current default

**Default badge:** small "Your default" label on the active card.

---

### Part 4: Available Models Section (Video Gen Page)

Same pattern in `VideoGenPage.tsx`, below the video gallery.

**Video models:**

| Model ID | Display Name | Cost | Notes |
|----------|-------------|------|-------|
| `auto` | Auto Select | Free | Default |
| `pollinations-video` | Pollinations Video | Free | SDXL-based video, async |
| `seedance-lite` | Seedance Lite | Free | Director Mode integration |

---

### Part 5: Mobile Orientation Lock

**File:** `src/App.tsx` (or `src/main.tsx`)

On app mount, attempt to lock orientation to portrait:

```typescript
// Attempt portrait lock — works on Chrome Android 111+, no-ops on iOS
if (typeof screen !== 'undefined' && screen.orientation?.lock) {
  screen.orientation.lock('portrait-primary').catch(() => {
    // Not supported or user hasn't interacted — ignore silently
  });
}
```

Also add `touch-action: manipulation` and `overflow-x: hidden` globally to prevent horizontal scroll from triggering landscape reflow.

**File:** `src/index.css`
```css
html, body {
  overflow-x: hidden;
  touch-action: pan-y;
}
```

`touch-action: pan-y` allows vertical scroll but tells the browser we don't need horizontal — reduces jank and helps some browsers not trigger landscape mode for overflow.

---

## File Impact Summary

| File | Change |
|------|--------|
| `server/src/services/media-generation.ts` | Add HuggingFace fallback, disk cache write |
| `server/src/db/index.ts` | ADD COLUMN preferred_image_model, preferred_video_model |
| `server/src/routes/images.ts` | Add `/models/status` endpoint, add static cache route |
| `server/src/routes/agent.ts` | Accept new agent_configs fields (already works via existing PATCH) |
| `server/src/services/action-executor.ts` | Read preferred_image_model when generate_image fires |
| `server/src/config.ts` | Add optional HF_TOKEN |
| `src/dashboard/pages/ImageGenPage.tsx` | Add Available Models section |
| `src/dashboard/pages/VideoGenPage.tsx` | Add Available Models section |
| `src/services/api.ts` | Add modelService.getImageModelStatus(), agentService.setMediaModel() |
| `src/App.tsx` | Screen orientation lock on mount |
| `src/index.css` | overflow-x: hidden, touch-action: pan-y on html/body |

---

## Success Criteria

- [ ] Image generation works even when Pollinations returns 530
- [ ] HuggingFace fallback returns a real image URL (not a data URI)
- [ ] Users can see all image models + live status on the Image Gen page
- [ ] "Set as default" persists and agent uses preferred model on next generate_image action
- [ ] Same for video models on Video Gen page
- [ ] Mobile device opening from Google Search does not auto-rotate
- [ ] No TypeScript errors, all 1652 tests still pass
