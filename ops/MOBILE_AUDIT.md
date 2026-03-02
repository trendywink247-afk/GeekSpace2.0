# Mobile Audit — Phase 84
**Date:** 2026-03-02
**Branch:** ai/phase-20260302-phase84
**Breakpoints tested:** 375px (iPhone SE), 390px (iPhone 14), 430px (iPhone 14 Plus), 360px (Android), 768px (tablet), 1280px (desktop)

---

## Global Infrastructure

| Check | Status | Notes |
|-------|--------|-------|
| `body { overflow-x: hidden }` in index.css | ✅ | Line 53 |
| `safe-area-pb/pt/pl/pr` CSS classes | ✅ | Lines 360-370 in index.css |
| `viewport-fit=cover` in index.html | ✅ | Meta viewport tag |
| `apple-mobile-web-app-capable=yes` | ✅ | index.html |
| `apple-touch-icon` | ✅ | index.html |
| manifest.json linked | ✅ | index.html |
| App.tsx root div overflow-x | ⚠️ | No explicit `overflow-x-hidden` on root div (body CSS covers it) |

---

## Component: Navigation.tsx

| Issue | Severity | Location |
|-------|----------|----------|
| Mobile hamburger button `p-2` = ~32px tap target | ❌ HIGH | Line ~95, needs `p-3` for 44px |
| Mobile menu overlay z-index OK | ✅ | |
| Nav links in open mobile menu adequate size | ✅ | |

---

## Component: AgentChatPanel.tsx

| Issue | Severity | Location |
|-------|----------|----------|
| Header icon buttons `p-2` (32px) - RotateCcw, Download, Search, X | ❌ HIGH | Lines 909, 918, 927, 935, 942 |
| Scroll-to-bottom button `w-8 h-8` (32px) | ❌ HIGH | Line 1352 |
| Persona pills `px-2.5 py-0.5` < 44px tap target | ❌ HIGH | Input area persona selector |
| Input area icon buttons `p-2` (attachment, voice, etc.) | ❌ HIGH | Lines 1476, 1496, 1525 |
| Header `safe-area-pt` ✅ | ✅ | |
| Input area `safe-area-pb` ✅ | ✅ | |
| Full-screen on mobile `fixed inset-0` ✅ | ✅ | |
| Swipe down to close ✅ | ✅ | |

---

## Component: DashboardApp.tsx (Mobile Tab Bar)

| Check | Status | Notes |
|-------|--------|-------|
| Bottom tab bar `h-16` (64px) | ✅ | |
| `safe-area-pb` on tab bar | ✅ | Line 836 |
| `fixed bottom-3 left-3 right-3` positioning | ✅ | |
| Max 5 tabs for thumb reach | ✅ | |
| Floating Alex orb clears tab bar | ✅ | Line 897 |

---

## Page: ImageGalleryPage.tsx

| Issue | Severity | Notes |
|-------|----------|-------|
| Grid `grid-cols-2` on mobile | ✅ | Already responsive |
| Download button hidden in hover overlay | ❌ HIGH | Hover = invisible on touch. Needs always-visible action on mobile |
| Bottom prompt label always visible | ✅ | |
| lazy loading on images | ✅ | |

---

## Page: LoginPage.tsx

| Check | Status | Notes |
|-------|--------|-------|
| Full-width layout on mobile (`flex-1 px-4 py-8`) | ✅ | |
| Inputs use `Input` component (h-11=44px, text-base=16px) | ✅ | |
| Submit button `h-12` (48px) | ✅ | |
| Mobile logo shown (md:hidden) | ✅ | |
| Left panel hidden on mobile (hidden md:flex) | ✅ | |
| Toggle sign-in/up `min-h-[44px]` | ✅ | |

---

## Page: InvitePage.tsx

| Check | Status | Notes |
|-------|--------|-------|
| `p-4` padding ✅ | ✅ | |
| `max-w-md w-full` ✅ | ✅ | |
| Inputs use `Input` component ✅ | ✅ | |
| "change" invite code button is tiny text link | ⚠️ LOW | `text-[10px]` with no min-height |

---

## manifest.json

| Issue | Severity | Notes |
|-------|----------|-------|
| Icon paths mismatch | ❌ HIGH | manifest references `icon-192x192.png` but actual file is `icon-192.png` |
| | | manifest references `icon-512x512.png` but actual file is `icon-512.png` |
| Smaller icon sizes (72-144) reference non-existent files | ❌ MED | Only icon-192.png and icon-512.png exist in public/ |
| `display: standalone` | ✅ | |
| `theme_color`, `background_color` | ✅ | |
| `name`, `short_name` | ✅ | |

---

## Summary of Required Fixes

### HIGH Priority (84.3–84.9)
1. `AgentChatPanel.tsx` — All icon buttons `p-2` → `p-2.5` + `min-w-[44px] min-h-[44px]`
2. `AgentChatPanel.tsx` — Scroll-to-bottom `w-8 h-8` → `w-10 h-10`
3. `AgentChatPanel.tsx` — Persona pills: add `min-h-[44px]` or use larger pill padding
4. `Navigation.tsx` — Mobile hamburger `p-2` → `p-3`
5. `ImageGalleryPage.tsx` — Download button: show always on mobile (not hover-only)
6. `manifest.json` — Fix icon paths to match actual files

### LOW Priority
7. `InvitePage.tsx` — "change" button: add min-h-[44px]
8. `App.tsx` — Add `overflow-x-hidden` to root div as defense

---

## Files to Change (84.3–84.10)

```
src/components/Navigation.tsx
src/components/AgentChatPanel.tsx
src/dashboard/pages/ImageGalleryPage.tsx
src/pages/InvitePage.tsx
src/App.tsx
public/manifest.json
```
