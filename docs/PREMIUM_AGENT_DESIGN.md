# Premium Agent System — Design Document

> Future feature. Not yet implemented.
> Last updated: 2026-02-15

---

## Problem

The current three-agent system (Edith/Jarvis/Weebo) gives all users the same agents with the same capabilities. There is no differentiation between free and paying users beyond credit limits. We need a premium tier that justifies a $4/month subscription with tangible agent upgrades.

## Goals

1. Give premium users meaningfully better AI capabilities
2. Create a clear upgrade path that feels worth paying for
3. Maintain the three-agent persona system
4. Keep the "included" tier genuinely useful (not a crippled demo)

## Proposed Tiers

### Starter (Included)

What users get today:
- **Weebo** (Ollama local) — unlimited
- **Jarvis** (OpenRouter free-tier) — 5 cr/1K tokens, 15,000 credit starting balance
- **Edith** — not available on starter

### Premium ($4/month)

- **Weebo** (Ollama local) — unlimited (same)
- **Jarvis** (OpenRouter paid models) — upgraded to Claude Sonnet or GPT-4o-mini
- **Edith** (OpenClaw/Moonshot) — full premium reasoning, 50,000 credits/month
- **Agent Memory** — conversation history persists across sessions
- **Custom Personas** — modify agent personality, voice, and system prompts
- **Priority Routing** — premium users' requests are queued ahead of starter users
- **Portfolio AI** — Edith-powered portfolio chat instead of Jarvis

## Agent Memory System

### Design

Each user gets a memory store scoped to their agent:

```
memories table:
  id TEXT PRIMARY KEY
  user_id TEXT FK -> users
  agent TEXT  -- 'edith' | 'jarvis' | 'weebo'
  key TEXT
  value TEXT
  category TEXT  -- 'preference' | 'context' | 'fact' | 'instruction'
  created_at TIMESTAMP
  updated_at TIMESTAMP
  UNIQUE(user_id, agent, key)
```

### Memory Operations

- **Auto-extract**: After each conversation, extract key facts and preferences
- **Inject**: Prepend relevant memories to system prompt (max 500 tokens)
- **Manage**: Dashboard UI for viewing, editing, deleting memories
- **Decay**: Memories unused for 90 days are flagged for cleanup

### Memory Categories

| Category | Example | Injected When |
|----------|---------|---------------|
| `preference` | "User prefers TypeScript over JavaScript" | Always |
| `context` | "User is building a SaaS product called Acme" | Always |
| `fact` | "User's timezone is PST" | When relevant |
| `instruction` | "Always suggest tests when reviewing code" | Always |

## Agent Slots (Future)

Premium users could eventually create multiple agent configurations:

```
agent_slots table:
  id TEXT PRIMARY KEY
  user_id TEXT FK -> users
  slot_name TEXT  -- 'default', 'coding', 'writing'
  persona TEXT  -- 'edith' | 'jarvis' | 'weebo' | 'custom'
  system_prompt TEXT
  voice TEXT
  creativity INTEGER
  formality INTEGER
  monthly_budget_credits INTEGER
```

Each slot gets its own memory, system prompt, and credit budget. User can switch between slots or auto-route based on intent.

## Credit System Changes

| Tier | Monthly Credits | Rollover | Top-up |
|------|----------------|----------|--------|
| Starter | 15,000 (one-time) | N/A | Purchase packs |
| Premium | 50,000/month | No | Included in plan |

Credit packs for starter users:
- 10,000 credits = $1
- 50,000 credits = $4
- 200,000 credits = $12

## Implementation Phases

### Phase A: Billing Integration
- Stripe Checkout for $4/month subscription
- Webhook handler for subscription events
- `users.plan` field: `'starter' | 'premium'`
- Credit reset on billing cycle

### Phase B: Model Upgrades
- Premium Jarvis routes to paid OpenRouter models
- Edith enabled only for premium users
- Credit check before premium model calls

### Phase C: Agent Memory
- Memory table + CRUD API
- Auto-extraction after conversations
- Memory injection into system prompts
- Dashboard memory manager UI

### Phase D: Agent Slots
- Slot CRUD API
- Slot picker in dashboard
- Per-slot credit budgets
- Auto-routing with slot preferences

## Open Questions

1. Should starter users get a taste of Edith (e.g., 5 premium queries/month)?
2. How to handle users who exceed their credit limit mid-conversation?
3. Should memory extraction use a local model (Weebo) or cloud model (Jarvis)?
4. What happens to memories if a user downgrades from premium?
