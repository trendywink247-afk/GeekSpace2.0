# Billing & LLM Routing

> **Branch:** `feat/llm-hybrid-routing-guardrails`  
> **Last updated:** 2026-04-07

This document describes the tier-based LLM provider routing, cost model, rate limits, and tool metering introduced in this branch.

---

## Tier → Provider Map

Each subscription plan maps to a preferred LLM provider. When no explicit `forceProvider` is set and the user is on a paid plan, `selectProviderForTier()` in `server/src/services/tier-routing.ts` is consulted.

| Plan                        | Primary | Complex primary | Fallbacks                 |
| --------------------------- | ------- | --------------- | ------------------------- |
| `free`                      | ollama  | —               | picoclaw, builtin         |
| `pilot` ($4/mo)             | groq    | —               | ollama, picoclaw          |
| `monthly` (alias for pilot) | groq    | —               | ollama, picoclaw          |
| `intro` ($12/2mo)           | groq    | —               | ollama, picoclaw          |
| `halfyear` ($35/6mo)        | groq    | openrouter      | openrouter-free, ollama   |
| `yearly` ($60/yr)           | groq    | openrouter      | openrouter-free, ollama   |
| `pro`                       | groq    | openrouter      | openrouter-free           |
| `team`                      | groq    | openrouter      | openrouter-free, together |

**Rules:**

- Free users always stay on `ollama` (local, zero cost).
- Paid users route to `groq` for simple/automation intents and to `openrouter` for complex/coding intents (halfyear+).
- If the preferred provider is unavailable, the system falls back via the waterfall defined in `routeChat()`.
- `forceProvider` in the request always overrides tier preferences.

---

## Plan Economics

| Plan     | Price               | Credits   | Token budget | Daily msg cap | Cost/user estimate       |
| -------- | ------------------- | --------- | ------------ | ------------- | ------------------------ |
| free     | $0                  | 5,000     | 50K          | 20/day        | ~$0 (local ollama)       |
| pilot    | $4/mo               | 100,000   | 300K         | 200/day       | ~$0.50 (Groq free quota) |
| intro    | $12/2mo             | 100,000   | 300K         | 200/day       | ~$0.50/mo                |
| halfyear | $35/6mo (~$5.83/mo) | 700,000   | 750K         | 500/day       | ~$1-2/mo (Groq + OR)     |
| yearly   | $60/yr (~$5/mo)     | 1,500,000 | 1M           | 1000/day      | ~$2-4/mo                 |
| pro      | custom              | unlimited | 2M           | 2000/day      | ~$3-6/mo                 |
| team     | custom              | unlimited | 5M           | 5000/day      | ~$10-20/mo               |

**Groq (Llama 3.3 70B):** Free tier — 14,400 req/day per API key × 3 keys = 43,200 req/day total. Effectively $0 for most workloads.

**OpenRouter (paid):** ~$0.27–$2.50/M tokens depending on model. Used only for `halfyear+` complex intents.

---

## Daily Message Caps

Per-tier daily caps are stored in the `daily_message_counts` SQLite table (`user_id`, `date`, `count`) and enforced by `server/src/middleware/daily-rate-limit.ts`.

| Plan            | Cap      |
| --------------- | -------- |
| free            | 20/day   |
| pilot / monthly | 200/day  |
| intro           | 200/day  |
| halfyear        | 500/day  |
| yearly          | 1000/day |
| pro             | 2000/day |
| team            | 5000/day |

**Applies to:** `POST /api/agent/chat` and `POST /api/agent/chat/stream`, only when `channel: 'web'`.  
**Does NOT apply to:** Telegram bot messages, automations, webhooks, background jobs.

On cap exceeded, the API returns HTTP 429:

```json
{
  "error": "daily_limit",
  "limit": 20,
  "remaining": 0,
  "resetAt": "2026-04-07T23:59:59Z"
}
```

Counts reset automatically at midnight UTC (date change triggers a new row).

---

## Tool Call Metering

In addition to base LLM credit costs, successful tool executions deduct extra credits from the user's subscription. This reflects real infrastructure costs (web scraping, screenshot services, media generation).

| Tool              | Extra credits |
| ----------------- | ------------- |
| `web_search`      | 5             |
| `crawl_url`       | 10            |
| `web_fetch`       | 5             |
| `take_screenshot` | 10            |
| `get_links`       | 3             |
| `generate_code`   | 20            |
| `generate_image`  | 100           |
| `generate_video`  | 500           |

Metering happens in `server/src/modules/agent/services/action-executor.ts` inside `executeAction()`, after a successful tool run. Credits are deducted via the existing `deductSubscriptionCredits()` helper.

Failed tool executions are NOT metered.

---

## Response Cache

A 2-layer cache (in-memory L1 + Redis L2) deduplicates identical chat requests:

- **TTL:** 10 minutes
- **Max entries:** 1000 (in-memory LRU per process)
- **Cache key:** `sha256(systemPrompt + '::' + lastUserMessage)`
- **Cache hit response:** `{ provider: 'cache', model: 'lru', creditCost: 0 }` — **no credits billed**

**Cache is SKIPPED for:**

1. Requests with tool calls (`<<<ACTION>>>` in system prompt)
2. Free-tier users (ollama is local/free, caching adds no benefit)
3. Requests with `forceProvider` set (explicit overrides bypass cache)
4. Trivial greetings (`hi`, `hello`, `ok`, etc.)

---

## Disabling Guardrails (Dev / CI)

Set `DISABLE_RATE_LIMITS=1` in your environment to short-circuit:

- Daily message caps (middleware returns immediately)
- Tool metering (no credits deducted)
- Response caching (`isCacheable` is always false)

```bash
DISABLE_RATE_LIMITS=1 npm run dev
```

This is automatically active when `TEST_MODE=true` is used via Vitest (the test config sets this env var).

---

## Architecture

```
POST /api/agent/chat
  → requireAuth
  → dailyRateLimit (web channel only)   ← NEW
  → aiSecurityMiddleware
  → validateBody
  → chat handler
      → runReactLoop / runDeepReasoning
          → routeChat(messages, { userPlan })
              → selectProviderForTier(userPlan, intent)  ← NEW
              → [check cache]                             ← UPGRADED
              → [call provider]
              → [store in cache if paid tier]
          → executeAction(userId, action)
              → runAction(tool, params)
              → deductSubscriptionCredits(toolCredits)   ← NEW
```
