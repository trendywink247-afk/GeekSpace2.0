# Modular Monolith — Domain Barrel Exports

> Convention for the modular monolith extraction strategy described in
> [`docs/MICROSERVICES_ROADMAP.md`](../../../docs/MICROSERVICES_ROADMAP.md).

## What This Is

Each subdirectory is a **barrel export** (`index.ts`) that re-exports all public
symbols from a single bounded context. No logic lives here — only re-exports.

## Why

1. **Discoverability** — `import { signToken } from '../modules/auth'` is
   self-documenting; `import { signToken } from '../middleware/auth'` leaks
   infrastructure details.
2. **Extraction boundary** — When a domain is extracted to a separate service,
   only this barrel file needs to change (swap local imports for RPC/HTTP
   client calls).
3. **Dependency tracking** — Static analysis tools can trace cross-domain
   coupling by scanning barrel imports.

## Current Domains (Wave 1 + Wave 2)

| Domain | Extraction Wave | Contents |
|--------|----------------|----------|
| `auth/` | Wave 2 | JWT, OAuth, sessions, password reset, brute-force guard |
| `billing/` | Wave 2 | Stripe, Razorpay, credits, subscriptions |
| `health/` | Wave 1 | Health probes, service monitoring |
| `reminders/` | Wave 1 | Scheduling, recurrence, multi-channel delivery |
| `media/` | Wave 1 | Image/video generation, voice STT/TTS |
| `portfolio/` | Wave 1 | Public pages, analytics, AI editing |

## Rules

- **Additive only** — barrel files re-export; they never contain logic.
- **No circular imports** — a domain barrel must not import from another
  domain barrel. Cross-domain dependencies go through the original paths
  until an anti-corruption layer is introduced.
- **New code** should export from the domain barrel when possible, but
  existing imports are not required to migrate.

## Adding a New Domain

1. Create `server/src/modules/<domain>/index.ts`
2. Add re-exports for all public symbols (routes, services, repositories, types)
3. Update this README's domain table
4. Update `docs/MICROSERVICES_ROADMAP.md` if it affects extraction planning
