# Contributing to GeekSpace

Thanks for your interest in contributing! This guide will get you up and running.

## Prerequisites

- **Node.js 20+** and npm
- **Docker & Docker Compose** (for production builds)
- **Git**

## Dev Setup

```bash
git clone https://github.com/trendywink247-afk/GeekSpace2.0.git
cd GeekSpace2.0

# Install frontend + backend deps
npm install
cd server && npm install && cd ..

# Environment
cp .env.example .env
# Edit .env — set JWT_SECRET and ENCRYPTION_KEY at minimum

# Frontend (port 5173)
npm run dev

# Backend (port 3001, separate terminal)
cd server && npm run dev
```

## Coding Standards

### TypeScript
- Frontend enforces `noUnusedLocals` and `noUnusedParameters` — unused imports **break Docker builds**
- Server uses ES modules — all imports need `.js` extensions (e.g., `import { db } from '../db/index.js'`)
- Frontend path alias: `@/*` maps to `./src/*`

### Styling
- **Tailwind CSS** for all styling
- **shadcn/ui** (New York style) for components — add via `npx shadcn@latest add <component>`
- Brand colors: Purple `#7B61FF`, Green `#61FF7B`, Pink `#FF61DC`, Dark BG `#05050A`

### Security
- Use `addEventListener` instead of inline `onclick` (Helmet CSP blocks `script-src-attr`)
- Never commit `.env` files or secrets
- Validate inputs with Zod on the server

## Git Conventions

### Branches
```
feature/short-description
fix/short-description
docs/short-description
```

### Commits
Use [Conventional Commits](https://www.conventionalcommits.org/):
```
feat: add forgot password flow
fix: correct OTP expiry calculation
docs: update API reference
refactor: extract LLM routing logic
test: add billing endpoint tests
```

## Pull Request Process

1. Branch from `main`
2. Make your changes
3. Run checks:
   ```bash
   npm run lint                          # Frontend lint
   cd server && npm test                 # Unit tests
   npx playwright test                   # E2E tests (needs dev servers running)
   ```
4. Push and open a PR against `main`
5. Describe what changed and why
6. Link related issues with `Closes #123`

## Testing

| Type | Command | Location |
|------|---------|----------|
| Unit tests | `cd server && npm test` | `server/src/test/api/*.test.ts` |
| Single test | `cd server && npx vitest run src/test/api/auth.test.ts` | |
| E2E tests | `npx playwright test` | `e2e/*.spec.ts` |
| Lint | `npm run lint` | |
| Typecheck | `npx tsc --noEmit` (frontend) / `cd server && npx tsc --noEmit` (server) | |

## Important Notes

- **Database files** (`server/data/*.db`) are gitignored — don't commit them
- **Three DB files** can exist: Docker volume (`/app/data/`), local dev (`server/data/`), test (temp)
- Tests run with `TEST_MODE=true` which mocks LLM calls and Telegram
- E2E tests seed a test user via `/api/test/seed` endpoint

## Formatting

This project uses [Prettier](https://prettier.io/) for consistent code formatting:

```bash
npx prettier --check .          # Check formatting
npx prettier --write .          # Auto-fix formatting
```

Configuration lives in `.prettierrc` at the repo root.

## Deeper Reading

- [`docs/DEVELOPER_GUIDE.md`](docs/DEVELOPER_GUIDE.md) — Annotated repo walkthrough and architecture deep dive
- [`docs/TESTING.md`](docs/TESTING.md) — Full testing guide with patterns and CI integration
- [`docs/CHANGELOG.md`](docs/CHANGELOG.md) — Version history and release notes

## Questions?

Open an issue or reach out to [@trendywink247-afk](https://github.com/trendywink247-afk).
