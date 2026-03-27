# Agentin -- Bounded Context Map

> 13 bounded contexts. Last updated: 2026-03-27
>
> Contexts 1-5 are original. Contexts 6-13 were extracted from audit of
> `server/src/routes/` (65+ route files), `server/src/services/` (98+ service
> files), and `server/src/db/index.ts` (~90 tables).

---

## 1. Auth Context

**Core responsibility:** Identity, sessions, tokens, OAuth flows, password reset, login guards

Aggregates: `User`, `Session`, `OAuthToken`, `InviteCode`, `RefreshToken`
Events: `UserRegistered`, `UserLoggedIn`, `OAuthLinked`, `SessionExpired`, `PasswordReset`
External: Google OAuth, GitHub OAuth
**Anti-corruption layer:** All OAuth tokens normalized to internal `OAuthToken` before crossing boundary

Owns tables: `users` (identity columns: email, password_hash, role, is_active), `sessions`, `user_sessions`, `oauth_tokens`, `invite_codes`, `password_reset_tokens`, `password_reset_rate_limits`, `password_reset_audit`, `refresh_tokens`, `token_blocklist`
Key services: `services/login-guard.ts`, `services/passwordReset.ts`, `services/refresh-token.ts`
Routes: `/api/auth/*`, `/api/oauth/*`

---

## 2. LLM Routing Context

**Core responsibility:** Provider selection, waterfall fallback, intent classification, budget enforcement

Aggregates: `RoutingDecision`, `ProviderBudget`, `IntentClassification`
Events: `ProviderSelected`, `FallbackTriggered`, `BudgetExceeded`, `DailyCapHit`
External: Ollama, Groq, Together AI, OpenRouter, Kimi (Moonshot), Edith

**Policy: No direct DB access** -- reads only `config` and Redis budget keys
**Tiers (Phase 111):**
  - T0 PicoClaw (simple/code-micro) -> T1 Ollama -> T2 Groq -> T3 Together Qwen3.5 9B
  - Premium only: T4 Together Maverick -> T5 Kimi K2 -> T6 Edith

Owns: `src/services/llm.ts`, `src/services/picoclaw.ts`, `src/services/token-budget.ts`, `src/services/edith.ts`, `src/services/openrouter-models.ts`, `src/services/pico-kimi-bridge.ts`, `src/services/llm-queue.ts`, `src/services/llm-tool-normalizer.ts`
Owns tables: `free_models`, `model_changelog`
**Cross-boundary rule:** Billing Context deducts credits AFTER LLM Context returns a response

---

## 3. Agent Context

**Core responsibility:** Chat orchestration, tool execution, ReAct loop, multi-agent orchestration, persona engine, action parsing

Aggregates: `Agent`, `Conversation`, `ToolExecution`, `ActionPlan`, `Persona`, `Delegation`
Events: `MessageReceived`, `ToolExecuted`, `ActionCompleted`, `AgentDelegated`
External: Tavily (web search), vector DB (Qdrant)

Owns tables: `agent_messages`, `agent_tasks`, `agent_comms`, `training_examples`, `conversation_log`, `premium_sessions`, `smart_recommendations`, `delegation_counts`, `user_agents`
Key services: `services/message-router.ts` (2103 lines -- decomposition target), `services/react-loop.ts`, `services/agent-chat.ts`, `services/agent-registry.ts`, `services/unified-agent-router.ts`, `services/multi-agent-orchestrator.ts`, `services/agent-state-bus.ts`, `services/action-parser.ts`, `services/action-executor.ts`, `services/persona-engine.ts`, `services/pico-fleet.ts`, `services/pico-context.ts`, `services/agent-task-queue.ts`, `services/agent-comms.ts`, `services/delegation.ts`, `services/director-mode.ts`, `services/browser-agent.ts`
Routes: `/api/agent/*`, `/api/agent-tasks/*`, `/api/agent-comms/*`, `/api/pico/*`, `/api/skills/*`, `/api/sandbox/*`, `/api/models/*`
**Cross-boundary rule:** Agent Context calls LLM Routing Context via `routeChat()` -- never calls providers directly

---

## 4. Billing Context

**Core responsibility:** Credits, plans, Stripe, Razorpay, usage tracking, spend caps, day passes, rewards

Aggregates: `UserCredits`, `Subscription`, `TokenUsage`, `SpendCap`, `DayPass`, `Reward`
Events: `CreditsDeducted`, `SubscriptionUpgraded`, `BudgetCapReached`, `StripeWebhookReceived`, `RazorpayPaymentCaptured`
External: Stripe, Razorpay

**Daily budget keys (Redis):** `system:together:spend:{date}`, `system:kimi:spend:{date}`
Owns tables: `token_usage`, `subscriptions`, `day_passes`, `usage_events`, `expenses`, `budget_limits`
Key services: `services/credit-service.ts`, `services/stripe.ts`, `services/razorpay.ts`, `services/token-budget.ts`, `services/rewards.ts`, `services/receipts.ts`, `repositories/SubscriptionRepository.ts`
Routes: `/api/billing/*`, `/api/usage/*`

---

## 5. Messaging Context (now part of Integrations, context 11)

**Core responsibility:** Channel integrations (Telegram, WhatsApp), inbound routing, outbound delivery

> **Note:** This context has been subsumed by the Integrations context (section 11)
> as the platform grew to include Gmail, Calendar, social media, and custom bots.
> Retained here for historical continuity.

Aggregates: `ChannelLink`, `InboundMessage`, `OutboundMessage`
Events: `TelegramMessageReceived`, `MessageDelivered`, `ChannelLinked`
External: Telegram Bot API, WhatsApp Business API

Owns tables: `channel_links`, `link_codes`, `telegram_onboarding`, `telegram_messages`
Routes: `/api/telegram/*`, `/api/whatsapp/*`
**Cross-boundary rule:** Messaging Context hands off to Agent Context for AI responses -- never calls LLM directly

---

## 6. Users Context

**Core responsibility:** User profiles, preferences, connections, directory, onboarding, API key management, feature flags

Aggregates: `UserProfile`, `UserConnection`, `ApiKey`, `FeatureFlag`, `AgentConfig`
Events: `ProfileUpdated`, `ConnectionRequested`, `ConnectionAccepted`, `OnboardingCompleted`, `ApiKeyCreated`
External: None

Owns tables: `users` (profile columns: display_name, avatar_url, bio, preferences, locale, timezone), `user_connections`, `connection_invites`, `api_keys`, `features`, `agent_configs`, `notification_settings`, `blocked_users`
Key services: `services/onboarding.ts`, `repositories/UserRepository.ts`
Routes: `/api/users/*`, `/api/directory/*`, `/api/api-keys/*`, `/api/features/*`

**Shared table: `users`** -- Auth owns identity columns (email, password_hash, role). Users owns profile columns (display_name, avatar, preferences). Both domains read the full row within the monolith; ownership split becomes enforced at extraction time.

---

## 7. Portfolio Context

**Core responsibility:** Public portfolio pages, templates, visit analytics, contact forms, portfolio suggestions

Aggregates: `Portfolio`, `PortfolioVisit`, `PortfolioContact`, `Template`
Events: `PortfolioPublished`, `PortfolioVisited`, `ContactFormSubmitted`
External: None

Owns tables: `portfolios`, `portfolio_visits`, `portfolio_contacts`, `templates`
Key services: `services/portfolio-suggestions.ts`, `services/website-templates.ts`
Routes: `/api/portfolio/*`, `/api/templates/*`

**Cross-boundary rule:** Portfolio suggestions may call LLM Routing for AI-generated content -- must go through Agent context, not directly.

---

## 8. Automations Context

**Core responsibility:** User-defined automation rules, workflow engine, workflow runner, scheduled task execution

Aggregates: `Automation`, `AutomationLog`, `Workflow`, `WorkflowRun`
Events: `AutomationTriggered`, `AutomationCompleted`, `AutomationFailed`, `WorkflowStarted`, `WorkflowCompleted`
External: None (triggers come from other contexts via events)

Owns tables: `automations`, `automation_logs_new`, `user_workflows`, `user_workflow_runs`
Key services: `services/automations-engine.ts`, `services/workflow-engine.ts`, `services/workflow-runner.ts`
Routes: `/api/automations/*`, `/api/workflows/*`

**Cross-boundary rule:** Automations must not call Agent functions directly. Use command events for "ask AI" workflow steps.

---

## 9. Reminders Context

**Core responsibility:** Scheduled reminders, snooze management, dead-letter recovery, notification delivery

Aggregates: `Reminder`, `SnoozeEntry`, `DeadLetter`
Events: `ReminderCreated`, `ReminderFired`, `ReminderSnoozed`, `ReminderDeadLettered`
External: None

Owns tables: `reminders`, `snooze_log`, `reminder_dead_letters`
Key services: `services/reminder-scheduler.ts`, `services/durable-scheduler.ts`
Routes: `/api/reminders/*`

**Cross-boundary rule:** Reminders emits `reminder.created` on the event bus. Does not call Agent or LLM directly.

---

## 10. Memory Context

**Core responsibility:** User memories, agent memory, graph memory (entities + relations), memory summarization, vector search

Aggregates: `UserMemory`, `AgentMemory`, `MemoryEntity`, `MemoryRelation`
Events: `MemoryStored`, `MemorySummarized`, `EntityExtracted`, `RelationCreated`
External: Qdrant (vector DB)

Owns tables: `user_memories`, `agent_memory`, `memory_entities`, `memory_relations`
Key services: `services/memory.ts`, `services/graph-memory.ts`, `services/memory-summarizer.ts`, `services/search-vector.ts`, `services/search-index.ts`
Routes: `/api/memory/*`

**Cross-boundary rule:** Memory calls LLM for summarization and entity extraction. This creates a circular dependency with Agent context (Agent writes memory, Memory calls LLM). Must be broken with async events before extraction: Agent emits `memory.write.requested`, Memory processes and emits `memory.stored`.

---

## 11. Integrations Context

**Core responsibility:** Third-party service connections, Gmail sync, calendar sync, social media, Telegram, WhatsApp, custom bots, Geekos bridge

Aggregates: `Integration`, `ChannelLink`, `GmailMessage`, `CalendarEvent`, `SocialPost`, `CustomBot`
Events: `IntegrationConnected`, `IntegrationDisconnected`, `MessageReceived`, `CalendarSynced`, `GmailSynced`
External: Telegram Bot API, WhatsApp Business API, Gmail API, Google Calendar, social media APIs

Owns tables: `integrations`, `channel_links`, `link_codes`, `telegram_onboarding`, `telegram_messages`, `gmail_messages`, `calendar_events`
Key services: `services/telegram.ts`, `services/whatsapp.ts`, `services/gmail-sync.ts`, `services/calendar-sync.ts`, `services/social-media.ts`, `services/telegram-cards.ts`, `services/agentmail.ts`
Routes: `/api/integrations/*`, `/api/telegram/*`, `/api/whatsapp/*`, `/api/gmail/*`, `/api/calendar/*`, `/api/social-media/*`, `/api/custom-bot/*`, `/api/geekos-bridge/*`

**Cross-boundary rule:** All integration channels hand off to Agent Context for AI responses -- never call LLM directly. Subsumes the original Messaging Context (section 5).

---

## 12. Media Context

**Core responsibility:** Image generation, video generation, file uploads, artifacts, artifact deployment, logo AI, voice

Aggregates: `Image`, `Video`, `VideoJob`, `Artifact`, `ArtifactDeployment`, `UploadedFile`, `GeneratedOutput`
Events: `ImageGenerated`, `VideoGenerated`, `ArtifactDeployed`, `FileUploaded`
External: fal.ai (video), image generation providers, TTS providers

Owns tables: `user_images`, `user_videos`, `video_jobs`, `generated_artifacts`, `artifact_domains`, `artifact_deployments`, `uploaded_files`, `generated_outputs`
Key services: `services/media-generation.ts`, `services/fal-video.ts`, `services/voice.ts`, `repositories/ArtifactRepository.ts`
Routes: `/api/images/*`, `/api/image/*`, `/api/videos/*`, `/api/artifacts/*`, `/api/files/*`, `/api/logo-ai/*`, `/api/voice/*`

**Cross-boundary rule:** Media generation may request AI-generated prompts. Must call through Agent context's public interface, not import LLM internals.

---

## 13. Admin Context

**Core responsibility:** Admin dashboard, moderation, reports, blocked users, dev tools, analytics, activity stream, security events

Aggregates: `ActivityEntry`, `AuditEntry`, `SecurityEvent`, `Report`, `ModerationAction`
Events: `UserBlocked`, `UserUnblocked`, `ReportFiled`, `ModerationActionTaken`
External: None

Owns tables: `activity_log`, `dev_audit_log`, `security_events`, `reports`, `moderation_log`
Key services: `services/analytics.ts`, `services/activity-stream.ts`, `services/activity-log.ts`, `services/dev-audit.ts`, `services/dev-github.ts`, `services/dev-runner.ts`, `services/security-log.ts`
Routes: `/api/admin/*`, `/api/dashboard/*`, `/api/analytics/*`, `/api/activity/*`, `/api/report/*`, `/api/dev/*`

**Cross-boundary rule:** Admin is read-only across other domains. Must access other domain data through their public query interfaces, not via direct table reads.

---

## 14. Health Context

**Core responsibility:** System health checks, service status, uptime monitoring, page monitors, metrics collection

Aggregates: `HealthCheck`, `PageMonitor`, `ServiceStatus`
Events: `HealthCheckFailed`, `ServiceDegraded`, `ServiceRecovered`
External: None (observes other services)

Owns tables: `page_monitors`
Key services: `services/health-monitor.ts`
Routes: `/api/health/*`

**Cross-boundary rule:** Health is purely observational. No writes to other domains. Checks service status via health endpoints, not direct DB queries.

---

## Cross-Boundary Rules (enforced)

| From | To | Allowed? | Interface |
|------|----|----------|-----------|
| Agent | LLM Routing | Yes | `routeChat()` |
| Billing | LLM Routing | Yes (read-only) | `shouldDegradeRouting()`, `isOverDailyBudget()` |
| Messaging / Integrations | Agent | Yes | HTTP POST to `/api/agent/chat` |
| LLM Routing | DB | No | Use Redis only for budgets |
| LLM Routing | Billing | No | Billing reads token counts from response |
| Any | Auth internals | No | Use `requireAuth` middleware only |
| Automations | Agent | Yes (events only) | Publish command event; Agent subscribes |
| Automations | Agent (direct call) | No | Must not import Agent functions directly |
| Memory | LLM Routing | Yes (async) | Event-driven summarization requests |
| Memory | Agent (direct call) | No | Break circular dependency with events |
| Admin | Any domain tables | No | Use domain query interfaces |
| Health | Any domain tables | No | Use HTTP health endpoints |
| Portfolio | LLM Routing | No | Request AI content through Agent context |
| Media | LLM Routing | No | Request AI prompts through Agent context |
| Integrations | LLM Routing | No | Hand off to Agent context |
| Webhooks | Any domain | Yes (events only) | Verify signature, publish raw event to bus |
| Users | Agent tables | No | Emit `user.onboarding.completed` event |
| Any | `users` table (identity cols) | No | Use Auth context interface |
| Any | `users` table (profile cols) | No | Use Users context interface |

---

## Shared Kernel

The following concerns are shared across all contexts and are not owned by any single domain:

| Concern | Location | Notes |
|---------|----------|-------|
| Auth middleware | `middleware/auth.ts` | `requireAuth` -- used by all authenticated routes |
| Error handling | `middleware/errors.ts` | Common error types and response format |
| Logging | `logger.ts` | Pino logger, shared format |
| Config | `config.ts` | Environment variable access |
| Event bus | `services/event-bus.ts` | In-memory typed event bus (future: Redis Streams) |
| Rate limiting | `express-rate-limit` | Applied globally in `app.ts` |

---

## Related Documents

- [Microservices Readiness Roadmap](../MICROSERVICES_ROADMAP.md) -- Extraction waves, database decomposition, event-driven migration plan
- [Solution Architecture](../SOLUTION_ARCHITECTURE.md) -- System-level architecture overview
- [API Reference](../API_REFERENCE.md) -- REST API endpoints and webhook integration
- [ADR-001: LLM Waterfall](../adr/ADR-001-llm-waterfall-phase111.md) -- LLM routing tier decision
- [Developer Guide](../DEVELOPER_GUIDE.md) -- Getting started and development practices
