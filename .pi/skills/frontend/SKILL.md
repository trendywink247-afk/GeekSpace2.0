# Frontend Skill — React 19 + Vite 7 + TypeScript

## Stack
- **React 19** with concurrent features, suspense, and new hooks
- **Vite 7** for dev server and build system 
- **TypeScript 5.9** with strict mode
- **Tailwind CSS 3.4** + CSS variables from `agentin-tokens.css`
- **Zustand** for global state (authStore, dashboardStore, themeStore)
- **React Router 7** for client-side routing
- **shadcn/ui + Radix UI** for component library
- **Framer Motion** for animations

## Feature Directories
```
src/
├── components/          # Shared UI components
│   ├── agentin/        # Dashboard wrappers (DashboardPageWrapper, PageHeader, SectionCard)
│   └── ui/             # shadcn/ui components
├── dashboard/          # Dashboard shell + routing
│   ├── DashboardApp.tsx     # Main shell (sidebar + tabs + page router)
│   ├── DashboardRouter.tsx  # Page routing via switch/case
│   └── DashboardSidebar.tsx # Navigation sidebar
├── pages/              # Page components (lazy-loaded)
├── stores/             # Zustand stores
├── services/           # API layer (src/services/api.ts)
├── hooks/              # Custom React hooks
├── utils/              # Utilities (cn, formatters, etc.)
└── types/              # TypeScript definitions
```

## Build Commands
```bash
# Development
npm run dev                    # Start Vite dev server
npm run typecheck             # TypeScript check (MUST pass)
npm run build                 # Production build

# Testing  
npm run test                  # Vitest unit tests
npm run test:watch           # Vitest watch mode
npm run test:coverage        # Coverage report
npm run e2e                  # Playwright E2E tests
```

## Key Patterns

### Page Components
- All pages lazy-loaded via `lazyRetry()` wrapper
- Export pattern: `.then(m => ({ default: m.PageName }))`
- Use `DashboardPageWrapper` for consistent layout
- Page structure: `PageHeader` + content in `PageShell` + `SectionCard`

### State Management  
- Zustand stores in `src/stores/`
- authStore: user auth state + JWT token
- dashboardStore: UI state, selected tabs
- themeStore: light/dark theme toggle

### API Integration
- All API calls through `src/services/api.ts`
- Axios instance with JWT auth headers
- Error handling with toast notifications

## Critical Rules
- **NO unused imports** — Docker treats TS6133 as fatal error
- **CSS variables only** — use agentin-tokens.css, never hardcode colors  
- **Mobile-first design** — 393px base width, min 44px touch targets
- **Lazy loading** — all page imports must use lazyRetry wrapper

## Common Files
- `src/App.tsx` — top-level router (BrowserRouter + Routes)
- `src/dashboard/DashboardApp.tsx` — dashboard shell (571 lines)
- `src/components/agentin/` — shared dashboard components
- `src/stores/` — Zustand state management
- `src/utils/cn.ts` — Tailwind class merging utility

## Debug Commands
```bash
# Fix common issues
npx tsc -b --noEmit          # Check for TypeScript errors
npm run lint                 # ESLint check
npm run build               # Test production build
```