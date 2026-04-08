# Phase Y — Agentin Aurora Dashboard Revamp Plan

> **Status:** Planning  
> **Foundation PR:** `feat/aurora-foundation`  
> **Base branch:** `ui/office-page-revamp`  
> **Author:** Frontend Agent  
> **Date:** 2026-04-08

---

## 1. Executive Summary

Phase Y is a full-sweep visual revamp of the ~36 remaining dashboard pages. Following the `feat/aurora-foundation` PR (palette tokens + shared UI primitives), each subsequent lane upgrades a group of pages to the **Agentin Aurora** design language — glassmorphism surfaces, the new violet/indigo/amber/coral palette, and the shared primitives from `src/components/ui/agentin/`.

**Goal:** Every dashboard page should feel cohesive, modern, and production-grade using a unified component vocabulary, while remaining backward-compatible until each lane lands.

**Key constraints:**

- All changes must be incremental (no big-bang rewrites).
- Each wave can ship and merge independently.
- CI must stay green at every commit.
- Pages not yet revamped continue rendering with the old styles (backward-compat aliases ensure no visual regression).

---

## 2. Page Consolidation Map

Some pages are conceptually overlapping and will be combined into tabbed super-pages. This reduces sidebar clutter and aligns with the mental model of "one place per concern."

| New Consolidated Page | Route                   | Source Pages (tabs)                                                          |
| --------------------- | ----------------------- | ---------------------------------------------------------------------------- |
| **Studio**            | `/dashboard/studio`     | `CreativeStudioPage`, `ImageCreatorPage`, `VideoGenPage`                     |
| **Media**             | `/dashboard/media`      | `ImageCreatorPage`, `TemplateGalleryPage` (overflow from Studio)             |
| **Analytics**         | `/dashboard/analytics`  | `AnalyticsPage`, `UsageAnalyticsPage`                                        |
| **Comms**             | `/dashboard/comms`      | `InboxPage`, `GmailPage`, `ConnectInboxPage`, `ConnectionsPage`              |
| **Automation Hub**    | `/dashboard/automation` | `WorkflowsPage`, `AutomationsPage`, `RecipesPage`                            |
| **Agent Hub**         | `/dashboard/agents`     | `PicoFleetPage`, `AgentSettingsPage`, `AISpecialistPage`, `CapabilitiesPage` |
| **Planner**           | `/dashboard/planner`    | `PlannerPage`, `RoadmapPage`, `GoalsPage`                                    |
| **Social**            | `/dashboard/social`     | `SocialMediaPage`, `TemplateGalleryPage`                                     |

> Pages not in this table stay standalone.

---

## 3. Wave Plan

Each wave targets a logical domain. Lanes within a wave run in **parallel** and can be reviewed simultaneously. Waves are **sequential** (W2 starts after W1 merges).

### Wave 1 — Productivity

| Lane  | Pages                                  | Key Components Used                                      |
| ----- | -------------------------------------- | -------------------------------------------------------- |
| W1-L1 | `CalendarPage`                         | `PageHeader`, `StatCard`, `TabBar`, `GlassCard`          |
| W1-L2 | `PlannerPage` → `Planner` consolidated | `PageHeader`, `TabBar`, `ListItem`, `SectionHeader`      |
| W1-L3 | `RemindersPage`, `FocusPage`           | `GlassCard`, `PillButton`, `Chip`, `ListItem`            |
| W1-L4 | `GoalsPage`, `RoadmapPage`             | `StatCard`, `GlassCard`, `SectionHeader`, `KeyValueList` |

### Wave 2 — Memory & Data

| Lane  | Pages                                 | Key Components Used                               |
| ----- | ------------------------------------- | ------------------------------------------------- |
| W2-L1 | `MemoryHubPage`, `ActivityPage`       | `PageHeader`, `TabBar`, `ListItem`, `LoadingBeam` |
| W2-L2 | `PortfolioPage`                       | `StatCard`, `GlassCard`, `SectionHeader`          |
| W2-L3 | `BillingPage`                         | `StatCard`, `KeyValueList`, `GlassCard`, `Chip`   |
| W2-L4 | `OverviewPage`, `HealthDashboardPage` | `StatCard`, `TabBar`, `GlassCard`, `LoadingBeam`  |

### Wave 3 — Studio (Consolidated)

| Lane  | Pages                                                                            | Key Components Used                                      |
| ----- | -------------------------------------------------------------------------------- | -------------------------------------------------------- |
| W3-L1 | `Studio` consolidated (`CreativeStudioPage`, `ImageCreatorPage`, `VideoGenPage`) | `PageHeader`, `TabBar`, `GlassCard`, `Toolbar`           |
| W3-L2 | `DesignAssistantPage`, `WebsiteBuilderPage`                                      | `PageHeader`, `GlassCard`, `SectionHeader`, `PillButton` |
| W3-L3 | `TemplateGalleryPage`, `SocialMediaPage`                                         | `GlassCard`, `Chip`, `ListItem`, `SectionHeader`         |

### Wave 4 — Agents & Automation

| Lane  | Pages                                                              | Key Components Used                             |
| ----- | ------------------------------------------------------------------ | ----------------------------------------------- |
| W4-L1 | `PicoFleetPage` + `AgentSettingsPage` → Agent Hub                  | `PageHeader`, `TabBar`, `ListItem`, `StatCard`  |
| W4-L2 | `WorkflowsPage`, `AutomationsPage`, `RecipesPage` → Automation Hub | `PageHeader`, `TabBar`, `Toolbar`, `ListItem`   |
| W4-L3 | `AISpecialistPage`, `CapabilitiesPage`                             | `GlassCard`, `KeyValueList`, `Chip`, `StatCard` |
| W4-L4 | `ProactivePage`                                                    | `GlassCard`, `SectionHeader`, `ListItem`        |

### Wave 5 — Ops & Terminal

| Lane  | Pages                                                                                  | Key Components Used                                |
| ----- | -------------------------------------------------------------------------------------- | -------------------------------------------------- |
| W5-L1 | `Analytics` consolidated (`AnalyticsPage`, `UsageAnalyticsPage`)                       | `StatCard`, `TabBar`, `GlassCard`, `SectionHeader` |
| W5-L2 | `ArtifactsPage`, `DocsWorkspacePage`                                                   | `PageHeader`, `GlassCard`, `Toolbar`, `ListItem`   |
| W5-L3 | `TerminalPage`                                                                         | `PageHeader`, `GlassCard`, `LoadingBeam`           |
| W5-L4 | `Comms` consolidated (`InboxPage`, `GmailPage`, `ConnectInboxPage`, `ConnectionsPage`) | `PageHeader`, `TabBar`, `ListItem`, `Chip`         |

---

## 4. Shared Components Matrix

Which primitives each page category uses:

| Primitive       | Productivity | Memory/Data | Studio | Agents | Ops |
| --------------- | :----------: | :---------: | :----: | :----: | :-: |
| `PageHeader`    |      ✅      |     ✅      |   ✅   |   ✅   | ✅  |
| `SectionHeader` |      ✅      |     ✅      |   ✅   |   ✅   | ✅  |
| `StatCard`      |      ✅      |     ✅      |   —    |   ✅   | ✅  |
| `GlassCard`     |      ✅      |     ✅      |   ✅   |   ✅   | ✅  |
| `TabBar`        |      ✅      |     ✅      |   ✅   |   ✅   | ✅  |
| `ListItem`      |      ✅      |     ✅      |   ✅   |   ✅   | ✅  |
| `PillButton`    |      ✅      |      —      |   ✅   |   —    |  —  |
| `Chip`          |      ✅      |     ✅      |   ✅   |   ✅   | ✅  |
| `Toolbar`       |      —       |      —      |   ✅   |   ✅   | ✅  |
| `KeyValueList`  |      ✅      |     ✅      |   —    |   ✅   | ✅  |
| `LoadingBeam`   |      —       |     ✅      |   ✅   |   ✅   | ✅  |
| `EmptyState`    |      ✅      |     ✅      |   ✅   |   ✅   | ✅  |

---

## 5. Testing Approach

### Unit / Component tests

- Each new primitive in `src/components/ui/agentin/` should have a Vitest test in `__tests__/` verifying:
  - It renders without crashing
  - Accent variants don't throw
  - onClick/onChange callbacks fire
  - ARIA attributes are present on interactive elements

### E2E via browser-tools (Playwright)

- **Session token:** Use Aliya's session token (`VITE_TEST_USER_TOKEN`) injected via env.
- **Chat smoke test (12 queries):** For each revamped page, navigate to it and send at least one query to the AI chat to verify the page still integrates with the LLM layer.
- **Visual regression:** Screenshot each revamped page before/after and diff.
- **Mobile viewport:** All E2E tests run at 393×852 (iPhone 14) and 1440×900 (desktop).

### Smoke checklist per wave

- [ ] `npm run typecheck` → 0 errors
- [ ] `npm run lint` → 0 errors (including TS6133 unused imports)
- [ ] `npm run build` → bundle size doesn't exceed +10% vs baseline
- [ ] `npm test` → all existing tests pass
- [ ] Manually visit `/dev/ui-agentin` to verify showcase renders
- [ ] Navigate through revamped pages in dev server

---

## 6. Risks & Rollback

### Known Breakage Points

| Risk                                                                                  | Mitigation                                                                                        |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Existing pages reference `var(--ag-cyan)` or `var(--ag-pink)`                         | Backward-compat aliases in `agentin-tokens.css` route them to `--ag-indigo` and `--ag-coral`      |
| Consolidated pages remove old routes                                                  | Keep old routes as redirects until all inbound links are updated                                  |
| `DesignSystem.tsx` exports `GlassCard`, `EmptyState`, `SectionHeader` with same names | New `src/components/ui/agentin/` exports are namespaced differently; page lanes pick the new ones |
| Agent colors (`--ag-nova`, `--ag-aria`) mapped to new coral color                     | Visual check per agent bubble; if objectionable, restore original hex in `--ag-nova` etc.         |
| `src/dashboard/DashboardRouter.tsx` uses string-based routing                         | Consolidation requires new `PageType` values — must be added atomically with new page components  |
| Mobile tab bar doesn't know about consolidated pages                                  | `MobileTabBar.tsx` should be updated in the same lane as consolidation                            |

### Rollback Plan

1. Each wave branch is independent — a broken wave can be reverted without affecting others.
2. CSS aliases mean reverting `agentin-tokens.css` to pre-Aurora values instantly restores old colors.
3. Consolidated pages keep old page files in place until the wave is confirmed stable in staging.
4. All page revamp PRs target `ui/office-page-revamp`, not `main` — integration is one step.

---

## 7. File Structure After Phase Y

```
src/
  components/
    ui/
      agentin/         ← New Aurora primitives (this PR)
        StatCard.tsx
        PageHeader.tsx
        SectionHeader.tsx
        GlassCard.tsx
        EmptyState.tsx
        PillButton.tsx
        Chip.tsx
        ListItem.tsx
        TabBar.tsx
        LoadingBeam.tsx
        KeyValueList.tsx
        Toolbar.tsx
        index.ts
    agentin/           ← Existing layout primitives (unchanged)
    mobile/            ← Phase 0 primitives (unchanged)
  dashboard/
    pages/             ← Revamped by waves W1–W5
    DashboardRouter.tsx ← Updated per consolidation
    types.ts           ← New PageType values per consolidation
  styles/
    agentin-tokens.css ← Aurora palette (this PR)
docs/
  phase-y-plan.md      ← This file
```

---

_Last updated: 2026-04-08 by feat/aurora-foundation_
