# GeekSpace 2.0 — Documentation Map

> Master index of all project documentation. Refreshed 2026-04-06 as part of `chore/repo-cleanup-2026-04`.
>
> The `docs/plans/`, `docs/superpowers/`, and `docs/internal/` trees were archived in this cleanup. Historical context now lives in git history; only the canonical, current documents below are tracked.

---

## Quick Start by Role

| You are a... | Start with |
|--------------|-----------|
| **New developer** | [DEVELOPER_GUIDE](DEVELOPER_GUIDE.md) → [REPO_WORKFLOW](REPO_WORKFLOW.md) |
| **Architect** | [SOLUTION_ARCHITECTURE](SOLUTION_ARCHITECTURE.md) → [../ARCHITECTURE.md](../ARCHITECTURE.md) → [MICROSERVICES_ROADMAP](MICROSERVICES_ROADMAP.md) |
| **API integrator** | [API_REFERENCE](API_REFERENCE.md) |
| **DevOps / SRE** | [DEVOPS](DEVOPS.md) → [DEPLOYMENT](DEPLOYMENT.md) → [TROUBLESHOOTING](TROUBLESHOOTING.md) |
| **Product / QA** | [BUSINESS_FEATURES](BUSINESS_FEATURES.md) → [TESTING](TESTING.md) |
| **Billing / payments** | [INTEGRATIONS](INTEGRATIONS.md) → [BUSINESS_FEATURES](BUSINESS_FEATURES.md) |

---

## Getting Started

| Document | Path | Purpose |
|----------|------|---------|
| Project README | [`../README.md`](../README.md) | Overview, install, quick start |
| Developer Guide ⭐ | [`DEVELOPER_GUIDE.md`](DEVELOPER_GUIDE.md) | Zero-to-first-PR walkthrough (refreshed 2026-04-06) |
| Repo Workflow | [`REPO_WORKFLOW.md`](REPO_WORKFLOW.md) | Branching, PR, pre-push hook conventions |
| Naming Conventions | [`NAMING_CONVENTIONS.md`](NAMING_CONVENTIONS.md) | File / symbol / route naming standards |
| Changelog ⭐ | [`CHANGELOG.md`](CHANGELOG.md) | Release history (refreshed 2026-04-06) |

⭐ = recently refreshed in this cleanup pass.

## Architecture

| Document | Path | Purpose |
|----------|------|---------|
| Architecture (root) | [`../ARCHITECTURE.md`](../ARCHITECTURE.md) | Top-level system diagram & module map |
| Solution Architecture | [`SOLUTION_ARCHITECTURE.md`](SOLUTION_ARCHITECTURE.md) | Detailed component design and data flow |
| Microservices Roadmap | [`MICROSERVICES_ROADMAP.md`](MICROSERVICES_ROADMAP.md) | Path from monolith to extracted services |
| Bounded Contexts (DDD) | [`ddd/domains.md`](ddd/domains.md) | 13 bounded contexts and extraction guidance |
| Design System | [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) | UI tokens, components, accessibility rules |

## API & Integrations

| Document | Path | Purpose |
|----------|------|---------|
| API Reference | [`API_REFERENCE.md`](API_REFERENCE.md) | REST endpoints, request/response schemas |
| Integrations | [`INTEGRATIONS.md`](INTEGRATIONS.md) | Third-party services (Stripe, Razorpay, Telegram, LLMs) |
| Business Features | [`BUSINESS_FEATURES.md`](BUSINESS_FEATURES.md) | Functional capability inventory |

## Operations

| Document | Path | Purpose |
|----------|------|---------|
| DevOps Guide | [`DEVOPS.md`](DEVOPS.md) | Docker stack, CI/CD, monitoring |
| Deployment Guide | [`DEPLOYMENT.md`](DEPLOYMENT.md) | Production deploy procedures |
| Backend Config | [`BACKEND_CONFIG.md`](BACKEND_CONFIG.md) | Server runtime configuration |
| Environment Variables | [`ENV_VARS.md`](ENV_VARS.md) | Complete env var reference with defaults |
| Troubleshooting | [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) | Common issues and fixes |

## Testing

| Document | Path | Purpose |
|----------|------|---------|
| Testing Guide | [`TESTING.md`](TESTING.md) | Vitest, Supertest, Playwright workflows |

## Architecture Decision Records

ADRs are immutable historical records of significant technical decisions.

| ADR | Path | Decision |
|-----|------|----------|
| ADR-001 | [`adr/ADR-001-llm-waterfall-phase111.md`](adr/ADR-001-llm-waterfall-phase111.md) | 7-tier LLM waterfall with intent-based routing |

## Assets

| Path | Purpose |
|------|---------|
| [`assets/banner.svg`](assets/banner.svg) | Project banner image used in README |

---

## Cross-Linking Conventions

1. **Paths** — Use repo-root-relative links (e.g. `docs/SOLUTION_ARCHITECTURE.md`).
2. **Section anchors** — Use Markdown heading anchors for deep links.
3. **Related Documents** — Every long-form doc ends with a "Related Documents" section.
4. **Bidirectional** — If doc A links to doc B, doc B should link back.
5. **No dead links** — Run `grep -r "docs/plans\|docs/superpowers\|docs/internal" docs/` should return zero results after the cleanup.

## Recently Archived (2026-04-06)

The following directories were removed from `docs/` and now live only in git history. Do not re-create them — propose a focused doc in `docs/` instead.

- `docs/plans/` — phase plans (react-loop, full-site-audit, revamp-p0)
- `docs/superpowers/` — agent office redesign specs and plans
- `docs/internal/` — routing audit, sandbox security, benchmark findings

## Related Documents

- [README.md](../README.md) — Project overview
- [ARCHITECTURE.md](../ARCHITECTURE.md) — Top-level architecture
- [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) — Build, test, ship
- [SOLUTION_ARCHITECTURE.md](SOLUTION_ARCHITECTURE.md) — System design
- [API_REFERENCE.md](API_REFERENCE.md) — REST API
- [DEVOPS.md](DEVOPS.md) — Operations
