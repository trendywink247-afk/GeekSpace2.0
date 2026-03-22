# Agentin — Bounded Context Map

## 1. Auth Context
**Core responsibility:** Identity, sessions, tokens, OAuth flows

Aggregates: `User`, `Session`, `OAuthToken`, `InviteCode`
Events: `UserRegistered`, `UserLoggedIn`, `OAuthLinked`, `SessionExpired`
External: Google OAuth, GitHub OAuth
**Anti-corruption layer:** All OAuth tokens normalized to internal `OAuthToken` before crossing boundary

Owns tables: `users`, `sessions`, `oauth_tokens`, `invite_codes`
Routes: `/api/auth/*`, `/api/oauth/*`

---

## 2. LLM Routing Context
**Core responsibility:** Provider selection, waterfall fallback, intent classification, budget enforcement

Aggregates: `RoutingDecision`, `ProviderBudget`, `IntentClassification`
Events: `ProviderSelected`, `FallbackTriggered`, `BudgetExceeded`, `DailyCapHit`
External: Ollama, Groq, Together AI, OpenRouter, Kimi (Moonshot), Edith

**Policy: No direct DB access** — reads only `config` and Redis budget keys
**Tiers (Phase 111):**
  - T0 PicoClaw (simple/code-micro) → T1 Ollama → T2 Groq → T3 Together Qwen3.5 9B
  - Premium only: T4 Together Maverick → T5 Kimi K2 → T6 Edith

Owns: `src/services/llm.ts`, `src/services/picoclaw.ts`, `src/services/token-budget.ts`
**Cross-boundary rule:** Billing Context deducts credits AFTER LLM Context returns a response

---

## 3. Agent Context
**Core responsibility:** Chat orchestration, memory, tool execution, ReAct loop

Aggregates: `Agent`, `Conversation`, `Memory`, `ToolExecution`, `ActionPlan`
Events: `MessageReceived`, `ToolExecuted`, `MemoryStored`, `ActionCompleted`
External: Tavily (web search), Telegram bot, vector DB (Qdrant)

Owns tables: `conversations`, `messages`, `agent_memory`, `user_memories`, `agent_tasks`, `agent_comms`
Routes: `/api/agent/*`
**Cross-boundary rule:** Agent Context calls LLM Routing Context via `routeChat()` — never calls providers directly

---

## 4. Billing Context
**Core responsibility:** Credits, plans, Stripe, usage tracking, spend caps

Aggregates: `UserCredits`, `Subscription`, `TokenUsage`, `SpendCap`
Events: `CreditsDeducted`, `SubscriptionUpgraded`, `BudgetCapReached`, `StripeWebhookReceived`
External: Stripe

**Daily budget keys (Redis):** `system:together:spend:{date}`, `system:kimi:spend:{date}`
Owns tables: `token_usage`, `stripe_customers`, `stripe_subscriptions`
Routes: `/api/billing/*`, `/api/stripe/*`

---

## 5. Messaging Context
**Core responsibility:** Channel integrations (Telegram, WhatsApp), inbound routing, outbound delivery

Aggregates: `ChannelLink`, `InboundMessage`, `OutboundMessage`
Events: `TelegramMessageReceived`, `MessageDelivered`, `ChannelLinked`
External: Telegram Bot API, WhatsApp Business API

Owns tables: `channel_links`
Routes: `/api/telegram/*`, `/api/whatsapp/*`
**Cross-boundary rule:** Messaging Context hands off to Agent Context for AI responses — never calls LLM directly

---

## Cross-Boundary Rules (enforced)

| From | To | Allowed? | Interface |
|------|----|----------|-----------|
| Agent | LLM Routing | ✅ | `routeChat()` |
| Billing | LLM Routing | ✅ read-only | `shouldDegradeRouting()`, `isOverDailyBudget()` |
| Messaging | Agent | ✅ | HTTP POST to `/api/agent/chat` |
| LLM Routing | DB | ❌ | Use Redis only for budgets |
| LLM Routing | Billing | ❌ | Billing reads token counts from response |
| Any | Auth internals | ❌ | Use `requireAuth` middleware only |
