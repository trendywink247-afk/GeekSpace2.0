# ADR-001: LLM Waterfall Redesign — Phase 111

**Status:** Accepted
**Date:** 2026-03-21
**Deciders:** Platform team

---

## Context

Agentin needs to serve ~1000 DAU at <$50/month AI cost while maintaining response quality. The previous waterfall (Ollama → OpenRouter-free race → Edith) had three problems:
1. `openrouter-free` racing with Ollama added latency and wasted free quota
2. No cheap cloud tier for when Ollama was down
3. No distinction between free and premium user routing paths

---

## Decision

Replace the racing architecture with a strict sequential waterfall with per-tier budget enforcement.

### Tiers (all users)

| Tier | Provider | Model | Cost | Condition |
|------|----------|-------|------|-----------|
| 0 | PicoClaw | qwen2.5-coder:1.5b | $0 | `simple` or `code-micro` intent (≤2 word coding) |
| 1 | Ollama | hermes3:8b | $0 | Local healthy |
| 2 | Groq | Llama 3.3 70B | $0 | Free quota (14,400 req/day × 3 keys) |
| 3 | Together Qwen | Qwen3.5 9B | $0.10/$0.15/1M | All users, within $2/day system cap |

### Tiers (premium only, after T2 fails)

| Tier | Provider | Model | Cost |
|------|----------|-------|------|
| 4 | Together Maverick | Llama 4 Maverick 17B×128E | $0.27/$0.85/1M |
| 5 | Kimi K2 | kimi-k2 | ~$0.15/$0.60/1M, $5/mo cap |
| 6 | Edith | kimi-k2-thinking | Reasoning model, last resort |

### Intent Classification

- `simple` → conversational, no coding keywords
- `code-micro` → coding intent with ≤2 words (e.g. "debug error") → PicoClaw
- `coding` → 2+ coding keywords, 3+ words → Ollama+
- `automation` → workflow keywords → Ollama+
- `planning` → 2+ planning keywords → Ollama+
- `complex` → 2+ complex keywords or >40 words → Ollama+

### Budget Enforcement

- **Monthly user budget:** `shouldDegradeRouting(userId)` → degrades to free tiers only
- **Daily system cap (Together):** Redis key `system:together:spend:{date}`, default $2.00/day
- **Monthly Kimi cap:** Redis key `system:kimi:spend:{month}`, default $5.00/month
- **Budget exceeded:** forced path = `['ollama', 'groq']` only, no paid providers

---

## Consequences

### Positive
- **$7-10/month** realistic cost for 1000 DAU (vs $50 budget = 5-7x headroom)
- Zero racing overhead — one provider attempt at a time
- Free users capped at T3 (Qwen3.5 9B) — still excellent quality
- Premium users get Maverick + Kimi reasoning when needed
- Daily budget cap prevents runaway Together AI spend

### Negative
- If Ollama + Groq both down AND Together budget exhausted → free users get `builtin` fallback
- Together Qwen3.5 9B thinking tokens enabled by default (latency ~3-5s, can be disabled per-request)
- No `openrouter-free` in free-user chain (removed — adds complexity for marginal benefit)

### Neutral
- pm2 ReDoS CVE (LOW) — no upstream fix; pm2 is deploy-only, not in request path

---

## Alternatives Considered

**A. Keep racing (T1+T6):** Rejected — racing burns free quota faster and adds P99 latency variance
**B. Together AI as primary:** Rejected — $0.10/1M still costs $7-15/month at scale without Groq buffer
**C. Add OpenRouter-free between Groq and Together:** Deferred — adds value only with $10 deposit; revisit at 500 DAU

---

## Implementation

- `server/src/services/llm.ts` — complete provider selection rewrite
- `server/src/config.ts` — Together AI config (`TOGETHER_API_KEY`, `TOGETHER_DAILY_BUDGET_CENTS`)
- `server/src/test/api/llm-router.test.ts` — updated Step 2 test (Groq fallback, not openrouter-free)
