# Full Site Audit Design — GeekSpace 2.0 / Agentin Chat
Date: 2026-03-05
Status: Approved

## Objective
Comprehensive audit of every page and element on ai.geekspace.space covering:
- What is working vs broken vs placeholder vs UI-only
- Desktop and mobile view analysis
- Logic correctness and wiring to real APIs
- Actionable improvement suggestions per page

## Scope
42 pages total — public routes + all dashboard pages.

## Output Structure
```
GeekSpace2.0/audit/
├── AUDIT_SUMMARY.md
└── pages/
    ├── 00-landing.txt
    ├── 01-login.txt
    ... (one file per page)
    └── 38-dashboard-ai-tools.txt
```

## Per-Page File Format
```
PAGE: <name>
ROUTE: <url>
STATUS: WORKING | PARTIAL | BROKEN | PLACEHOLDER | UI-ONLY

=== DESKTOP VIEW ===
=== MOBILE VIEW ===
=== FUNCTIONALITY CHECK ===
=== LOGIC ISSUES ===
=== IMPROVEMENTS ===
=== SERVER ROUTES ===
```

## Agent Groups (6 parallel agents)
| Agent | Pages |
|-------|-------|
| 1 | Public: Landing, Login, ForgotPassword, Explore, Portfolio public, Privacy, Terms |
| 2 | Auth + Utility: Onboarding (all steps), Status, Docs, Connect, Invite |
| 3 | Dashboard core: Overview, Chat, Connections, Agent Settings, Memory |
| 4 | AI features: Image Gen, Video Gen, Gallery, Website Builder, AI Tools, Capabilities |
| 5 | Productivity: Reminders, Automations, Recipes, Planner, Social Media, Proactive AI, Focus |
| 6 | Communication + Insights + Account: Inbox, Gmail, Analytics, Usage, Billing, Settings, Terminal, Health, Activity, Roadmap, Fleet |

## Master Summary Contents
- Status table for all 42 pages
- Top 10 critical issues
- Mobile-specific issues
- Pure placeholder pages list
- Recommended fix priority order
