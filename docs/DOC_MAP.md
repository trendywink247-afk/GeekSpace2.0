# Agentin — Documentation Map

> Master index of all project documentation. Updated 2026-03-27.

---

## Core Documentation

These are the primary documents for understanding, operating, and contributing to the platform.

| Document | Path | Audience | Status |
|----------|------|----------|--------|
| **Project README** | [`README.md`](../README.md) | Everyone | Active |
| **Solution Architecture** | [`docs/SOLUTION_ARCHITECTURE.md`](SOLUTION_ARCHITECTURE.md) | Engineers, Architects | Active |
| **Developer Guide** | [`docs/DEVELOPER_GUIDE.md`](DEVELOPER_GUIDE.md) | Engineers | Active |
| **API Reference** | [`docs/API_REFERENCE.md`](API_REFERENCE.md) | Engineers, Integrators | Active |
| **OpenAPI Specification** | [`openapi/openapi.yaml`](../openapi/openapi.yaml) | Engineers, Integrators | Active |
| **Business Features** | [`docs/BUSINESS_FEATURES.md`](BUSINESS_FEATURES.md) | PMs, BAs, QA | Active |
| **Testing Guide** | [`docs/TESTING.md`](TESTING.md) | Engineers, QA | Active |
| **DevOps Guide** | [`docs/DEVOPS.md`](DEVOPS.md) | DevOps, SREs | Active |
| **Microservices Roadmap** | [`docs/MICROSERVICES_ROADMAP.md`](MICROSERVICES_ROADMAP.md) | Architects, Leads | Active |
| **Infrastructure** | [`infra/README.md`](../infra/README.md) | DevOps, SREs | Active |

## Operational Documentation

| Document | Path | Purpose |
|----------|------|---------|
| Environment Variables | [`docs/ENV_VARS.md`](ENV_VARS.md) | Complete env var reference with defaults |
| Deployment Guide | [`docs/DEPLOYMENT.md`](DEPLOYMENT.md) | Production deployment procedures |
| Troubleshooting | [`docs/TROUBLESHOOTING.md`](TROUBLESHOOTING.md) | Common issues and solutions |

## Architecture Decision Records

| ADR | Path | Decision |
|-----|------|----------|
| ADR-001 | [`docs/adr/ADR-001-llm-waterfall-phase111.md`](adr/ADR-001-llm-waterfall-phase111.md) | 7-tier LLM waterfall with intent-based routing |

## Domain-Driven Design

| Document | Path | Purpose |
|----------|------|---------|
| Bounded Context Map | [`docs/ddd/domains.md`](ddd/domains.md) | 13 bounded contexts with extraction guidance |

## Internal / Historical

These are development-time documents preserved for context. Not authoritative for current state.

| Category | Path | Contents |
|----------|------|----------|
| Active Plans | `docs/plans/` | Current phase plans (react-loop, full-site-audit, revamp-p0) |
| Superpowers Plans | `docs/superpowers/plans/` | Agent office redesign (Mar 2026) |
| Superpowers Specs | `docs/superpowers/specs/` | 3 design specs (agent office, activity stream) |
| Audit Reports | `docs/internal/audit/` | Integrity baselines, final reports |

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

## Cross-Linking Conventions

All documents in this project follow these conventions:

1. **Paths** — Use repo-root-relative paths (e.g., `docs/SOLUTION_ARCHITECTURE.md`)
2. **Section links** — Use Markdown heading anchors (e.g., `docs/DEVOPS.md#docker-services`)
3. **Related docs** — Every document ends with a "Related Documents" section
4. **Bidirectional** — If doc A links to doc B, doc B links back to doc A

## Related Documents

- [README.md](../README.md) — Project overview and quick start
- [docs/SOLUTION_ARCHITECTURE.md](SOLUTION_ARCHITECTURE.md) — System architecture
- [docs/API_REFERENCE.md](API_REFERENCE.md) — API endpoint documentation
- [docs/ENV_VARS.md](ENV_VARS.md) — Environment variable reference
- [docs/DEPLOYMENT.md](DEPLOYMENT.md) — Deployment procedures
