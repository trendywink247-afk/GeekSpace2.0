# Agentin — Documentation Map

> Master index of all project documentation. Updated 2026-03-27.

---

## Core Documentation

These are the primary documents for understanding, operating, and contributing to the platform.

| Document | Path | Audience | Status |
|----------|------|----------|--------|
| **Project README** | [`README.md`](../README.md) | Everyone | Active |
| **Solution Architecture** | [`docs/SOLUTION_ARCHITECTURE.md`](SOLUTION_ARCHITECTURE.md) | Engineers, Architects | Planned |
| **Developer Guide** | [`docs/DEVELOPER_GUIDE.md`](DEVELOPER_GUIDE.md) | Engineers | Planned |
| **API Reference** | [`docs/API_REFERENCE.md`](API_REFERENCE.md) | Engineers, Integrators | Planned |
| **OpenAPI Specification** | [`openapi/openapi.yaml`](../openapi/openapi.yaml) | Engineers, Integrators | Planned |
| **Business Features** | [`docs/BUSINESS_FEATURES.md`](BUSINESS_FEATURES.md) | PMs, BAs, QA | Planned |
| **Testing Guide** | [`docs/TESTING.md`](TESTING.md) | Engineers, QA | Planned |
| **DevOps Guide** | [`docs/DEVOPS.md`](DEVOPS.md) | DevOps, SREs | Planned |
| **Microservices Roadmap** | [`docs/MICROSERVICES_ROADMAP.md`](MICROSERVICES_ROADMAP.md) | Architects, Leads | Planned |
| **Infrastructure** | [`infra/README.md`](../infra/README.md) | DevOps, SREs | Planned |

## Operational Documentation

| Document | Path | Purpose |
|----------|------|---------|
| Architecture (legacy) | [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) | LLM routing, request lifecycle, intent classification |
| API (legacy) | [`docs/API.md`](API.md) | Endpoint reference (auth, agent, billing, portfolio) |
| Environment Variables | [`docs/ENV_VARS.md`](ENV_VARS.md) | Complete env var reference with defaults |
| Deployment Guide | [`docs/DEPLOYMENT.md`](DEPLOYMENT.md) | Production deployment procedures |
| Operations Runbook | [`docs/RUNBOOK.md`](RUNBOOK.md) | First deploy, updates, backup/restore, monitoring |
| Troubleshooting | [`docs/TROUBLESHOOTING.md`](TROUBLESHOOTING.md) | Common issues and solutions |

## Architecture Decision Records

| ADR | Path | Decision |
|-----|------|----------|
| ADR-001 | [`docs/adr/ADR-001-llm-waterfall-phase111.md`](adr/ADR-001-llm-waterfall-phase111.md) | 7-tier LLM waterfall with intent-based routing |

## Domain-Driven Design

| Document | Path | Purpose |
|----------|------|---------|
| Bounded Context Map | [`docs/ddd/domains.md`](ddd/domains.md) | 5 bounded contexts (Auth, LLM, Agent, Billing, Messaging) |

## Internal / Historical

These are development-time documents preserved for context. Not authoritative for current state.

| Category | Path | Contents |
|----------|------|----------|
| Design Plans | `docs/internal/plans/` | 20 session design/implementation plans (Feb 2026) |
| Design Plans | `docs/plans/` | 12 phase plans (Feb-Mar 2026) |
| Superpowers Plans | `docs/superpowers/plans/` | 5 sprint/feature plans (Mar 2026) |
| Superpowers Specs | `docs/superpowers/specs/` | 3 design specs (agent office, activity stream) |
| Audit Reports | `docs/internal/audit/` | Security audits, integrity baselines, mobile UI fixes |
| Archive | `docs/internal/archive/` | Legacy release notes, handoffs, cleanup reports |

## Operations (ops/)

| Document | Path | Purpose |
|----------|------|---------|
| AI Handoff | `ops/AI_HANDOFF.md` | Session-by-session development history (Sessions 1-10) |
| AI Phase Plan | `ops/AI_PHASE_PLAN.md` | Master phase roadmap (Phases 1-89+) |
| AI Lessons | `ops/AI_LESSONS.md` | Lessons learned across development sessions |
| Feature Matrix | `ops/AI_FEATURE_MATRIX.md` | Feature availability by subscription tier |
| Risk Register | `ops/AI_RISK_REGISTER.md` | Known risks and mitigations |
| Master Audit | `ops/MASTER_AUDIT_2026.md` | Comprehensive component audit |
| Capabilities Audit | `ops/CAPABILITIES_AUDIT.md` | Feature capability assessment |
| Launch Checklist | `ops/LAUNCH_CHECKLIST.md` | Production launch verification |
| Mobile Audit | `ops/MOBILE_AUDIT.md` | Mobile responsiveness audit |
| VPS Audit | `ops/VPS_AUDIT.md` | VPS infrastructure audit |
| Decisions Log | `ops/DECISIONS.md` | Architecture/product decisions |
| Test Reports | `ops/TEST_REPORT_20260319.md` | Test execution results |
| Cronicle Config | `ops/cronicle/README.md` | Scheduled job configuration |

---

## Gap Analysis

| Deliverable | Current Coverage | Gap |
|-------------|-----------------|-----|
| Root README | Exists (promotional, 500+ lines) | Needs enterprise rewrite: quick-start, arch diagram, doc map |
| Solution Architecture | `ARCHITECTURE.md` covers LLM routing well | Missing: C4 diagrams, full request lifecycle, domain boundaries, ER diagram, security architecture |
| Developer Guide | None | Fully missing: local setup, recipes, conventions, debugging |
| API Reference | `API.md` covers ~15 endpoints | Missing: 50+ endpoints, error schemas, webhook payloads, rate limits |
| OpenAPI Spec | None | Fully missing |
| Business Features | Scattered across README, Feature Matrix | Missing: unified feature doc with credit economy, personalities, tiers |
| Testing Guide | None (test reports exist) | Fully missing: inventory, coverage, patterns, CI integration |
| DevOps Guide | `DEPLOYMENT.md` + `RUNBOOK.md` | Missing: Docker service inventory, network topology, CI/CD pipeline, monitoring setup |
| Infrastructure | No `infra/` directory | Fully missing: Caddy, PicoClaw, SearXNG, GeekOS docs |
| Microservices Roadmap | `ddd/domains.md` defines 5 contexts | Missing: 8 more domains, extraction waves, dependency graph, anti-patterns |
| Code Comments | Minimal TSDoc/JSDoc | Missing across 98 services and 66 route files |
| Domain Boundaries | 5 bounded contexts | Need expansion to 13 domains with extraction guidance |

## Cross-Linking Conventions

All documents in this project follow these conventions:

1. **Paths** — Use repo-root-relative paths (e.g., `docs/ARCHITECTURE.md`)
2. **Section links** — Use Markdown heading anchors (e.g., `docs/DEVOPS.md#docker-services`)
3. **Related docs** — Every document ends with a "Related Documents" section
4. **Bidirectional** — If doc A links to doc B, doc B links back to doc A

## Related Documents

- [README.md](../README.md) — Project overview and quick start
- [docs/ARCHITECTURE.md](ARCHITECTURE.md) — Current architecture reference
- [docs/ENV_VARS.md](ENV_VARS.md) — Environment variable reference
- [docs/DEPLOYMENT.md](DEPLOYMENT.md) — Deployment procedures
