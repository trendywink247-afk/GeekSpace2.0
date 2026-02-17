# GeekSpace 2.0 — Codebase Cleanup Audit Report

**Date**: 2026-02-16
**Branch**: `live-production`
**Scope**: Dead code, unused dependencies, stale artifacts, structural issues

---

## Impact Ratings

| Rating | Meaning |
|--------|---------|
| **Critical** | Actively causes confusion, bloat in production builds, or potential bugs |
| **High** | Significant dead weight; removing it simplifies maintenance |
| **Medium** | Minor bloat or naming issue; low urgency |
| **Low** | Cosmetic or informational; fix when convenient |

---

## 1. Unused UI Components (shadcn/ui Library)

**Impact: Medium** — These ship in the frontend bundle but are never rendered.

Of the **53** files in `src/components/ui/`, only **11** are imported outside the `ui/` directory. The remaining **42** are dead code — installed via `npx shadcn-ui` but never wired into the app.

### Used Components (11)
badge, button, card, dialog, input, skeleton, slider, switch, table, tabs, textarea

### Unused Components (42)

| File | File |
|------|------|
| accordion.tsx | alert-dialog.tsx |
| alert.tsx | aspect-ratio.tsx |
| avatar.tsx | breadcrumb.tsx |
| button-group.tsx | calendar.tsx |
| carousel.tsx | chart.tsx |
| checkbox.tsx | collapsible.tsx |
| command.tsx | context-menu.tsx |
| drawer.tsx | dropdown-menu.tsx |
| empty.tsx | field.tsx |
| form.tsx | hover-card.tsx |
| input-group.tsx | input-otp.tsx |
| item.tsx | kbd.tsx |
| label.tsx | menubar.tsx |
| navigation-menu.tsx | pagination.tsx |
| popover.tsx | progress.tsx |
| radio-group.tsx | resizable.tsx |
| scroll-area.tsx | select.tsx |
| separator.tsx | sheet.tsx |
| sidebar.tsx | sonner.tsx |
| spinner.tsx | toggle.tsx |
| toggle-group.tsx | tooltip.tsx |

> **Note**: `separator.tsx`, `sheet.tsx`, and `sidebar.tsx` import each other internally, but none of them are imported by any application code — the entire chain is dead.

**Recommendation**: Delete all 42 files. They can be re-added in seconds via `npx shadcn-ui add <component>` if ever needed.

---

## 2. Unused npm Dependencies

**Impact: Critical** — These inflate `node_modules`, slow installs, and increase frontend bundle size.

### Directly Unused (5 packages)

| Package | Version | Notes |
|---------|---------|-------|
| `@hookform/resolvers` | ^5.2.2 | Zero imports anywhere in `src/` |
| `date-fns` | ^4.1.0 | Zero imports anywhere in `src/` |
| `zod` | ^4.3.5 | Used in `server/` only — should not be a frontend dependency |
| `next-themes` | ^0.4.6 | Only imported by `ui/sonner.tsx`, which is itself unused |
| `sonner` | ^2.0.7 | Wrapper exists at `ui/sonner.tsx` but never imported; BillingPage uses inline toast instead |

### Transitively Unused via Dead UI Components (18 packages)

These are only imported by unused `ui/` component wrappers:

| Package | Version | Used By (dead component) |
|---------|---------|--------------------------|
| `embla-carousel-react` | ^8.6.0 | carousel.tsx |
| `react-resizable-panels` | ^4.2.2 | resizable.tsx |
| `input-otp` | ^1.4.2 | input-otp.tsx |
| `@radix-ui/react-accordion` | ^1.2.12 | accordion.tsx |
| `@radix-ui/react-alert-dialog` | ^1.1.15 | alert-dialog.tsx |
| `@radix-ui/react-aspect-ratio` | ^1.1.8 | aspect-ratio.tsx |
| `@radix-ui/react-avatar` | ^1.1.11 | avatar.tsx |
| `@radix-ui/react-checkbox` | ^1.3.3 | checkbox.tsx |
| `@radix-ui/react-collapsible` | ^1.1.12 | collapsible.tsx |
| `@radix-ui/react-context-menu` | ^2.2.16 | context-menu.tsx |
| `@radix-ui/react-dropdown-menu` | ^2.1.16 | dropdown-menu.tsx |
| `@radix-ui/react-hover-card` | ^1.1.15 | hover-card.tsx |
| `@radix-ui/react-label` | ^2.1.8 | label.tsx |
| `@radix-ui/react-menubar` | ^1.1.16 | menubar.tsx |
| `@radix-ui/react-navigation-menu` | ^1.2.14 | navigation-menu.tsx |
| `@radix-ui/react-popover` | ^1.1.15 | popover.tsx |
| `@radix-ui/react-progress` | ^1.1.8 | progress.tsx |
| `@radix-ui/react-radio-group` | ^1.3.8 | radio-group.tsx |
| `@radix-ui/react-scroll-area` | ^1.2.10 | scroll-area.tsx |
| `@radix-ui/react-select` | ^2.2.6 | select.tsx |
| `@radix-ui/react-separator` | ^1.1.8 | separator.tsx |
| `@radix-ui/react-toggle` | ^1.1.10 | toggle.tsx |
| `@radix-ui/react-toggle-group` | ^1.1.11 | toggle-group.tsx |
| `@radix-ui/react-tooltip` | ^1.2.8 | tooltip.tsx |

**Recommendation**: Remove all 29 packages from `package.json` and run `npm install`. The 5 kept Radix packages (`react-dialog`, `react-slider`, `react-slot`, `react-switch`, `react-tabs`) are the only ones actively used.

---

## 3. Legacy Bridge Directory

**Impact: High** — Entire directory is dead code from the old OpenClaw WebSocket bridge, now replaced by direct Moonshot API calls.

```
bridge/edith-bridge/
├── Dockerfile
├── index.js          (14 KB — WebSocket-to-HTTP bridge)
├── package.json
└── package-lock.json
```

- No file in `server/src/` imports or references this bridge
- The bridge is defined in `docker-compose.yml` as the `edith-bridge` service but is no longer needed
- Server now uses `callOpenRouterWithModel()` for premium/Moonshot calls directly

**Recommendation**: Delete `bridge/edith-bridge/` directory. Remove the `edith-bridge` service from `docker-compose.yml`.

---

## 4. Dead Config Variables

**Impact: Medium** — Two config vars in `server/src/config.ts` that serve no functional purpose.

**File**: `server/src/config.ts:67-69`
```typescript
// EDITH / OpenClaw — via edith-bridge (WS→HTTP bridge) [legacy, unused]
edithGatewayUrl: process.env.EDITH_GATEWAY_URL || '',
edithToken: process.env.EDITH_TOKEN || '',
```

**References found**:
| File | Line | Usage |
|------|------|-------|
| `server/src/config.ts` | 67-69 | Definition |
| `server/src/index.ts` | ~144 | Health check status display only |

These are not used by any LLM routing, chat handler, or service. The health check reference just reports "not_configured" since the vars default to empty strings.

**Recommendation**: Remove both vars from `config.ts`. Update the health check in `index.ts` to remove the `edith` status field.

---

## 5. Orphaned Component: ErrorBoundary.tsx

**Impact: Medium** — Exists but is never imported or rendered.

**File**: `src/components/ErrorBoundary.tsx`

This React Error Boundary component with a "Reload Page" fallback UI is defined but never imported anywhere in the application. It's untracked dead code.

**Recommendation**: Either delete it, or wire it into `App.tsx` / `DashboardApp.tsx` to actually catch React errors in production (the latter would be a useful improvement).

---

## 6. Stale Database Artifact

**Impact: Low** — Confusing but not harmful; the server always uses the correct path.

| Path | Size | Status |
|------|------|--------|
| `server/data/geekspace.db` | 276 KB | **Active** — used by the server |
| `data/geekspace.db` | 220 KB | **Stale** — leftover from early development |

The server resolves the DB path from `__dirname` which always points to `server/data/`.

**Recommendation**: Delete `data/geekspace.db` (the root-level stale copy).

---

## 7. Console.log Should Use Logger

**Impact: Low** — One instance of `console.log` in server code where `logger` should be used.

**File**: `server/src/db/index.ts:500`
```typescript
console.log('Demo data seeded successfully');
```

**Recommendation**: Replace with `logger.info('Demo data seeded successfully')`.

---

## 8. Naming Issue: AlexButton

**Impact: Low** — Cosmetic; the name leaks a demo user's name into component naming.

**File**: `src/components/AlexButton.tsx`
**Used in**: `src/dashboard/DashboardApp.tsx` (imported and rendered)

The component is the floating AI chat orb button. "Alex" is a demo user name — the component should have a generic name.

**Recommendation**: Rename to `AgentChatButton.tsx` or `AiChatOrb.tsx`. Update the import in `DashboardApp.tsx`.

---

## 9. Directory Structure Notes

**Impact: Low** — Informational observations, no action required.

### `src/sections/` (7 files)
Landing page sections: ActivitySection, ConstellationSection, ContactSection, EngineSection, HeroSection, PersonaSection, SecuritySection.

These could live under `src/landing/sections/` for clearer grouping, but this is purely cosmetic.

### `src/pages/` vs `src/dashboard/pages/`
- `src/pages/` — Static public pages (DocsPage, PrivacyPage, StatusPage, TermsPage)
- `src/dashboard/pages/` — Authenticated dashboard pages

These serve different purposes and are **not** duplicated. No action needed.

### TODO/FIXME/HACK Comments
**None found** across the entire codebase. The codebase is clean of stale comment markers.

---

## Summary

| # | Issue | Files/Packages | Impact | Action |
|---|-------|---------------|--------|--------|
| 1 | Unused UI components | 42 files | Medium | Delete |
| 2 | Unused npm deps | 29 packages | Critical | `npm uninstall` |
| 3 | Legacy bridge directory | 4 files | High | Delete directory |
| 4 | Dead config vars | 2 vars in 2 files | Medium | Remove |
| 5 | Orphaned ErrorBoundary | 1 file | Medium | Delete or wire up |
| 6 | Stale DB artifact | 1 file (220 KB) | Low | Delete |
| 7 | console.log in DB seed | 1 line | Low | Use logger |
| 8 | AlexButton naming | 1 file + 1 import | Low | Rename |
| 9 | Directory structure | — | Low | No action |

**Estimated cleanup savings**: ~42 UI files, ~29 npm packages, ~14 KB bridge code, 1 stale DB file.
