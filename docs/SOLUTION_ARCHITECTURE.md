# Agentin — Solution Architecture

> Authoritative technical reference for the Agentin platform architecture. Updated 2026-03-27.

---

## Table of Contents

- [System Context (C4 Level 1)](#system-context-c4-level-1)
- [Container View (C4 Level 2)](#container-view-c4-level-2)
- [Component View (C4 Level 3)](#component-view-c4-level-3)
- [Request Lifecycle](#request-lifecycle)
- [LLM Routing Architecture](#llm-routing-architecture)
- [Agent Architecture](#agent-architecture)
- [Authentication & Authorization](#authentication--authorization)
- [Data Architecture](#data-architecture)
- [Event Architecture](#event-architecture)
- [Integration Architecture](#integration-architecture)
- [Security Architecture](#security-architecture)
- [Credit & Billing Architecture](#credit--billing-architecture)
- [Domain Boundary Map](#domain-boundary-map)
- [Future State Architecture](#future-state-architecture)
- [Related Documents](#related-documents)

---

## System Context (C4 Level 1)

The platform serves end users via web and Telegram, orchestrates AI across local and cloud providers, and processes payments through Stripe/Razorpay.

```mermaid
graph TB
    User[Web User] --> Platform["Agentin Platform"]
    TGUser[Telegram User] --> Platform
    Admin[Admin] --> Platform

    Platform --> Ollama["Ollama (Local LLM)"]
    Platform --> Cloud["Cloud LLM Providers<br/>OpenRouter, Groq, Together, Kimi"]
    Platform --> Stripe["Stripe / Razorpay"]
    Platform --> Google["Google OAuth<br/>Calendar, Gmail"]
    Platform --> GitHub["GitHub OAuth"]
    Platform --> TG["Telegram Bot API"]
    Platform --> Search["SearXNG / Tavily<br/>Web Search"]
    Platform --> VectorDB["Qdrant<br/>Vector Search"]
    Platform --> SearchEngine["Meilisearch<br/>Instant Search"]
```

### Actors

| Actor | Description | Access |
|-------|-------------|--------|
| **Web User** | Browser-based access to dashboard, chat, portfolio | JWT authenticated |
| **Telegram User** | Chat via Telegram bot with voice, photos, keyboards | Telegram channel link |
| **Admin** | Ops dashboard, health monitoring | Admin token |
| **Webhook Caller** | Stripe, Razorpay, Telegram, n8n | Signed payloads |
| **Public Visitor** | Portfolio pages, public chat, docs | No auth required |

---

## Container View (C4 Level 2)

```mermaid
graph TB
    subgraph Client
        Browser[React SPA<br/>React 19, Vite 7]
        TGApp[Telegram Client]
    end

    subgraph Platform["Agentin Platform (Docker)"]
        Caddy[Caddy<br/>Reverse Proxy<br/>:443]
        Express[Express API<br/>:3001]
        SQLite[(SQLite<br/>WAL mode)]
        Redis[(Redis<br/>:6379)]
        PicoClaw[PicoClaw<br/>:8080]
        SearXNG[SearXNG<br/>:8080]
        Meili[Meilisearch<br/>:7700]
        Qdrant[Qdrant<br/>:6333]
        BrowserSvc[Browser Agent<br/>:3010]
    end

    subgraph External
        Ollama[Ollama :11434]
        CloudLLM[Cloud LLMs]
        PaymentGW[Stripe / Razorpay]
        TGBot[Telegram Bot API]
    end

    Browser --> Caddy
    TGApp --> TGBot --> Caddy
    Caddy --> Express
    Express --> SQLite
    Express --> Redis
    Express --> PicoClaw
    Express --> SearXNG
    Express --> Meili
    Express --> Qdrant
    Express --> BrowserSvc
    Express --> Ollama
    Express --> CloudLLM
    Express --> PaymentGW
    PicoClaw --> Ollama
```

---

## Component View (C4 Level 3)

The Express backend follows a layered architecture:

```
Request → Middleware Stack → Route Handler → Service Layer → Repository / DB → Response
```

### Middleware Stack (applied in order)

| Order | Middleware | Source | Purpose |
|-------|-----------|--------|---------|
| 1 | `helmet()` | helmet | Security headers (CSP, HSTS, X-Frame-Options) |
| 2 | Permissions-Policy | custom | Restrict browser APIs (camera, mic, geo) |
| 3 | HSTS | custom | 1-year strict transport security (prod) |
| 4 | X-Robots-Tag | custom | Block API from search engines |
| 5 | CORS | cors | Whitelist origins, credentials allowed |
| 6 | `compression()` | compression | gzip/deflate (skips SSE streams) |
| 7 | Request ID | custom | `X-Request-Id` propagation for log correlation |
| 8 | Body parser | express.json | JSON parsing (1MB limit) |
| 9 | Content-Type guard | custom | Reject non-JSON mutations (CSRF prevention) |
| 10 | Passport | passport | OAuth2 strategy initialization |
| 11 | Request timeout | custom | 30-second default timeout |
| 12 | Request logger | pino | Structured request logging |
| 13 | Rate limiter | express-rate-limit | Global: 500/15min, Redis-backed |
| 14 | Metrics | custom | Request/response metrics collection |
| 15 | `errorHandler()` | custom | Catch-all error handler (last) |

### Route Layer

65+ route files in `server/src/routes/`, organized by domain. Each file defines Express router with:
- Path-specific rate limiting
- Zod schema validation (`validateBody`, `validateQuery`)
- Auth middleware (`requireAuth`, `optionalAuth`, `requireAdminToken`)
- Response formatting

### Service Layer

98 service files in `server/src/services/`, each handling one domain concern. Services:
- Contain business logic
- Access the database via `db.prepare()` (direct SQL) or repositories
- Call external APIs (LLM providers, Telegram, Stripe)
- Are imported by route handlers

### Repository Layer

5 repository classes in `server/src/repositories/`:

| Repository | Table(s) | Purpose |
|------------|----------|---------|
| `UserRepository` | users | User CRUD, preferences, plan management |
| `AgentConfigRepository` | agent_configs | Agent personality and model settings |
| `ConversationRepository` | conversations, messages | Chat history persistence |
| `SubscriptionRepository` | subscriptions | Billing subscription state |
| `ArtifactRepository` | artifacts, artifact_deployments | Generated artifact storage |

> Most services bypass repositories and use `db.prepare()` directly. See [`docs/MICROSERVICES_ROADMAP.md`](MICROSERVICES_ROADMAP.md) for the plan to expand repository coverage.

### Error Hierarchy

```
AgentinError (base)
├── NotFoundError (404)
├── UnauthorizedError (401)
├── ForbiddenError (403)
├── ValidationError (400)
└── PaymentRequiredError (402)
```

Defined in `server/src/errors/index.ts`. The `errorHandler` middleware catches these and returns structured JSON responses with request ID correlation.

---

## Request Lifecycle

### Web Chat Request

```mermaid
sequenceDiagram
    participant B as Browser
    participant C as Caddy
    participant M as Middleware
    participant R as Route
    participant S as Service
    participant L as LLM Router
    participant P as Provider
    participant D as Database

    B->>C: POST /api/agent/chat/stream
    C->>M: Reverse proxy
    M->>M: JWT verify + rate limit
    M->>R: agent/chat handler
    R->>S: classifyIntent(message)
    S-->>R: intent: coding
    R->>L: routeChat(messages, intent)
    L->>L: Check budget, cache
    L->>P: Call provider (waterfall)
    P-->>L: Response stream
    L-->>R: LLMResponse
    R->>D: Log conversation
    R->>D: Extract memories
    R-->>B: SSE stream (delta events)
```

### Telegram Webhook Flow

```mermaid
sequenceDiagram
    participant T as Telegram
    participant C as Caddy
    participant W as Webhook Handler
    participant MR as Message Router
    participant A as Agent Service
    participant L as LLM Router

    T->>C: POST /api/webhooks/telegram
    C->>W: Secret token verification
    W-->>T: 200 OK (immediate)
    W->>MR: handleIncomingMessage()
    MR->>MR: Check fast-paths
    alt Fast-path match
        MR->>T: Direct response (0 credits)
    else Normal chat
        MR->>A: Build context + system prompt
        A->>L: routeChat()
        L->>L: Provider waterfall
        L-->>A: LLMResponse
        A->>MR: Formatted response
        MR->>T: sendTelegramMessage()
    end
```

---

## LLM Routing Architecture

The LLM router (`server/src/services/llm.ts`) implements a multi-tier waterfall with intent-based routing.

### Intent Classification

```mermaid
graph TD
    Msg[User Message] --> WC{Word Count}
    WC -->|"> 80"| Complex[complex]
    WC -->|"<= 80"| KW{Keyword Match}
    KW -->|"2+ code keywords"| Coding[coding]
    KW -->|"1+ auto keywords"| Auto[automation]
    KW -->|"1+ plan keywords"| Plan[planning]
    KW -->|"short, simple"| Simple[simple]
    KW -->|"code snippet"| Micro[code-micro]
```

### Provider Waterfall

```mermaid
graph TD
    Start[Chat Request] --> Intent[Classify Intent]
    Intent --> Budget{Budget OK?}
    Budget -->|No| Degraded[Free providers only]
    Budget -->|Yes| T0{PicoClaw<br/>simple/code-micro}
    T0 -->|Success| Done[Return]
    T0 -->|Fail/Skip| T1[Ollama hermes3:8b]
    T1 -->|Fail| T15[OpenRouter Free<br/>Qwen3 235B / Llama 3.3]
    T15 -->|Fail| T2[Groq Llama 3.3 70B]
    T2 -->|Fail| T3[Together Qwen3.5 9B]
    T3 -->|Fail| Premium{Premium User?}
    Premium -->|No| Builtin[Static fallback]
    Premium -->|Yes| T4[Together Maverick 17B]
    T4 -->|Fail| T5[Kimi K2]
    T5 -->|Fail| T6[Edith/K2.5]
    T6 -->|Fail| Builtin

    Degraded --> T1
```

### Caching

| Layer | Storage | TTL | Max Entries | Key |
|-------|---------|-----|-------------|-----|
| L1 | In-memory Map | 5 min | 100 | MD5(messages + systemPrompt + userId) |
| L2 | Redis | 5 min | Unlimited | `llm:resp:{hash}` |

Cache is checked before provider calls. On hit, returns immediately with `provider: "cache"`.

### Budget Enforcement

| Check | Source | Effect |
|-------|--------|--------|
| Per-user monthly budget | `shouldDegradeRouting()` | Skip paid tiers, use free only |
| Together daily cap ($2.00) | `isOverDailyBudget()` | Skip Tier 3/4 for the day |
| Kimi per-user cap (3/day) | `kimiCalls` counter | Skip Tier 5 after 3 calls |
| Credit balance | `credit-service.ts` | Deduct credits post-response |

---

## Agent Architecture

### Personality System

9 agent personalities defined in `server/src/prompts/personalities.ts`:

| Agent | Domain | Fast-Path Triggers |
|-------|--------|--------------------|
| **Weebo** | General orchestrator | Default (delegates to others) |
| **Edith** | Expert knowledge | "edith", "@edith" |
| **Jarvis** | Task automation | "jarvis", "@jarvis" |
| **Aria** | Creative writing | "aria", "@aria" |
| **Forge** | Code generation | "forge", "@forge" |
| **Pulse** | Health/fitness | "pulse", "@pulse" |
| **Echo** | Memory recall | "echo", "@echo" |
| **Cal** | Calendar/scheduling | "cal", "@cal" |
| **Nova** | Research/analysis | "nova", "@nova" |

User messages containing agent names are routed directly via fast-path (`FASTPATH_AGENT_MAP` in `message-router.ts`).

### ReAct Loop

The ReAct loop (`server/src/services/react-loop.ts`) enables multi-step reasoning:

```
Think → Act → Observe → Think → Act → Observe → ... → Answer
```

The agent has 17 tools available for autonomous action execution, including web search, code execution, reminders, expenses, focus sessions, and more.

### Multi-Agent Council

When triggered ("launch mode"), the orchestrator (`multi-agent-orchestrator.ts`) fans out to 3 parallel specialists:
1. Each specialist processes the query independently
2. Results are collected and synthesized
3. A unified response is returned to the user

Cost: 6 credits (2 per specialist).

---

## Authentication & Authorization

### JWT Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant A as Auth Route
    participant DB as SQLite

    C->>A: POST /api/auth/login {email, password}
    A->>DB: Find user by email
    DB-->>A: User record
    A->>A: bcrypt.compare(password, hash)
    A->>A: Sign JWT (HS256, 15min, JTI)
    A-->>C: {token, refreshToken, user}

    Note over C,A: Subsequent requests
    C->>A: GET /api/agent/chat (Bearer token)
    A->>A: Verify JWT signature
    A->>DB: Check token_blocklist (JTI)
    A->>DB: Check password_changed_at > token.iat
    A->>DB: Update last_active
    A-->>C: Authorized request proceeds
```

### Auth Methods

| Method | Provider | Usage |
|--------|----------|-------|
| JWT (HS256) | Internal | All API requests (15-min expiry) |
| Refresh Token | Internal | 30-day session renewal |
| OAuth 2.0 | Google, GitHub | Social login + Calendar/Gmail |
| Admin Token | Internal | Ops dashboard (`Authorization: Bearer <ADMIN_TOKEN>`) |
| Gate Cookie | Internal | Pre-login gate page (SHA-256 hash + `timingSafeEqual`) |
| Webhook Secret | Telegram | Bot webhook verification |
| Webhook Signature | Stripe/Razorpay | HMAC signature verification |

### Authorization Middleware

| Middleware | Effect |
|------------|--------|
| `requireAuth` | Validates JWT, checks blocklist, checks password change, updates last_active |
| `optionalAuth` | Same as requireAuth but proceeds as guest if no token |
| `requireAdminToken` | Validates admin Bearer token with timing-safe comparison |

---

## Data Architecture

### Database: SQLite with WAL

| Configuration | Value | Purpose |
|---------------|-------|---------|
| Journal mode | WAL | Concurrent reads + single writer |
| Cache size | 32MB | Page cache |
| Memory-mapped I/O | 256MB | Fast access |
| Busy timeout | 5s | Wait for locks before failing |
| Foreign keys | ON | Referential integrity |
| ANALYZE | On startup | Query plan optimization |

### Key Table Groups

```mermaid
erDiagram
    users ||--o{ agent_configs : "1:1"
    users ||--o{ conversations : has
    users ||--o{ reminders : has
    users ||--o{ automations : has
    users ||--o{ integrations : has
    users ||--o{ portfolios : has
    users ||--o{ memory_entries : has
    users ||--o{ activities : has
    users ||--o{ subscriptions : has
    users ||--o{ api_keys : has
    users ||--o{ habits : has

    conversations ||--o{ messages : contains

    users {
        text id PK
        text email UK
        text username UK
        text password_hash
        text plan
        int credits
        text timezone
        timestamp last_active
    }

    conversations {
        text id PK
        text user_id FK
        text title
        text context
        timestamp created_at
    }

    reminders {
        text id PK
        text user_id FK
        text title
        text recurrence
        text delivery_channel
        timestamp fire_at
    }
```

### Storage Services

| Service | Type | Purpose | Backend |
|---------|------|---------|---------|
| SQLite | Relational | Primary data store (users, conversations, reminders, etc.) | better-sqlite3 |
| Redis | Cache | Rate limits, LLM cache (L2), job queue, daily budgets | ioredis |
| Qdrant | Vector DB | Semantic memory search (768-dim embeddings) | REST API |
| Meilisearch | Search | Typo-tolerant instant search (notes, reminders, habits) | REST API |

---

## Event Architecture

### SSE Streaming

The platform uses Server-Sent Events for real-time communication:

| Stream | Endpoint | Events |
|--------|----------|--------|
| Chat | `/api/agent/chat/stream` | `delta` (text chunk), `done` (completion), `error`, `action` |
| Activity | `/api/activity/stream` | User actions, system events |
| Agent State | `/api/agent-state/stream` | Agent thinking, delegation, task progress |

### Internal Event Bus

`agent-state-bus.ts` provides in-memory pub/sub for agent collaboration events:

- `agent:thinking` -- Agent is processing
- `agent:delegated` -- Task delegated to specialist
- `agent:task_started` / `agent:task_completed` -- Background task lifecycle
- `agent:meeting` -- Multi-agent council session

> Current limitation: in-memory only (Map-based). Does not persist across PM2 workers. See [`docs/MICROSERVICES_ROADMAP.md`](MICROSERVICES_ROADMAP.md) for Redis pub/sub migration plan.

### Background Schedulers

| Scheduler | Interval | Purpose |
|-----------|----------|---------|
| Reminder Scheduler | 5s poll | Deliver due reminders via Telegram/email/push |
| Proactive Engine | 30min preview | Reminder previews, habit nudges at 11:00 IST |
| Morning Operator | Timezone-based | Daily briefing generation |
| Cleanup Service | Periodic | Delete old artifacts, logs, expired tokens |
| Job Queue | Event-driven | Async jobs (voice, image, video generation) |

---

## Integration Architecture

```mermaid
graph LR
    subgraph Inbound
        TG[Telegram Webhook]
        StripeWH[Stripe Webhook]
        RazorWH[Razorpay Webhook]
        GoogleCB[Google OAuth Callback]
        GitHubCB[GitHub OAuth Callback]
    end

    subgraph Platform
        WHRouter[Webhook Router]
        OAuthRouter[OAuth Router]
        AgentSvc[Agent Service]
        BillingSvc[Billing Service]
    end

    subgraph Outbound
        TGBot[Telegram Bot API]
        Email[Resend / SMTP]
        StripeAPI[Stripe API]
        RazorAPI[Razorpay API]
        SearchAPI[SearXNG / Tavily]
        CrawlAPI[Crawl4ai]
    end

    TG --> WHRouter --> AgentSvc
    StripeWH --> WHRouter --> BillingSvc
    RazorWH --> WHRouter --> BillingSvc
    GoogleCB --> OAuthRouter
    GitHubCB --> OAuthRouter

    AgentSvc --> TGBot
    AgentSvc --> Email
    AgentSvc --> SearchAPI
    AgentSvc --> CrawlAPI
    BillingSvc --> StripeAPI
    BillingSvc --> RazorAPI
```

### Webhook Security

| Source | Verification Method |
|--------|-------------------|
| Telegram | `X-Telegram-Bot-API-Secret-Token` header comparison |
| Stripe | `stripe.webhooks.constructEvent()` with `STRIPE_WEBHOOK_SECRET` |
| Razorpay | HMAC-SHA256 signature verification with `timingSafeEqual` |

All webhook handlers return 200 immediately and process asynchronously.

---

## Security Architecture

### Defense in Depth

| Layer | Controls |
|-------|----------|
| **Network** | Caddy TLS termination, ports bound to 127.0.0.1, Docker network isolation |
| **Transport** | HSTS (1yr), TLS 1.3, auto-HTTPS via Let's Encrypt |
| **Application** | Helmet headers, CSP, CORS whitelist, Content-Type guard |
| **Authentication** | JWT HS256 (15min), bcrypt (cost 12), token blocklist, password-change invalidation |
| **Authorization** | Role-based (user/admin), per-endpoint rate limiting |
| **Data** | AES-256-GCM API key encryption (scrypt KDF), no plaintext secrets |
| **Infrastructure** | `no-new-privileges` on all containers, `cap_drop: ALL`, memory limits |
| **Validation** | Zod schemas on all mutating endpoints |
| **Monitoring** | Security audit logging, request ID correlation, Uptime Kuma alerts |

### Rate Limiting

| Scope | Limit | Window | Applies To |
|-------|-------|--------|-----------|
| Global | 500 req | 15 min | All endpoints |
| Auth | 10 req | 15 min | `/api/auth/*` |
| Signup | 5 req | 15 min | `/api/auth/signup` |
| Chat | 60 req | 15 min | `/api/agent/chat/*` |
| Public chat | 10 req | 15 min | `/api/agent/chat/public/*` |
| Billing | 5 req | 1 hour | `/api/billing/*` |
| Password change | 3 req | 1 hour | `/api/users/me/change-password` |
| Admin | 10 req | 1 min | `/api/admin/*` |

Rate limiting is Redis-backed (falls back to in-memory when Redis is unavailable).

---

## Credit & Billing Architecture

### Credit Economy

```mermaid
graph LR
    User[User Action] --> Classify[Classify Intent]
    Classify --> Route[Route to Provider]
    Route --> Response[LLM Response]
    Response --> Cost[Compute Credit Cost]
    Cost --> Deduct[Deduct from Balance]
    Deduct --> Track[Record Usage]
```

| Provider | Credit Cost |
|----------|-------------|
| Ollama | 1 credit flat |
| PicoClaw | 1 credit flat |
| OpenRouter Free | 2 credits flat |
| Groq | 2 credits flat |
| Together (budget) | 5 credits flat |
| Premium (Together/Edith) | 10 credits per 1K tokens (min 10) |
| Multi-Agent Council | 6 credits (2 per specialist) |
| Cache hit | 0 credits |

### Payment Gateways

| Gateway | Currency | Integration |
|---------|----------|-------------|
| Stripe | USD | Checkout sessions, subscription webhooks |
| Razorpay | INR | Order creation, signature verification |

### Subscription Tiers

| Tier | Credits/Month | LLM Access |
|------|--------------|------------|
| Free | 100 | Tiers 0-3 only |
| Pilot | 500 | Tiers 0-3 |
| Intro | 2,000 | Tiers 0-3 |
| Monthly | 10,000 | Tiers 0-6 (premium) |
| Half-Year | 50,000 | Tiers 0-6 (premium) |
| Yearly | 50,000 | Tiers 0-6 (premium) |

---

## Domain Boundary Map

The platform is organized into 13 bounded contexts. See [`docs/ddd/domains.md`](ddd/domains.md) for the formal bounded context definitions and cross-boundary rules.

```mermaid
graph TB
    subgraph Core
        Auth[Auth & Identity]
        AI[AI & Agent]
        LLM[LLM Routing]
    end

    subgraph Business
        Billing[Billing & Credits]
        Reminders[Reminders]
        Automations[Automations]
        Portfolio[Portfolio]
        Memory[Memory]
    end

    subgraph Integration
        Integrations[Integrations]
        Webhooks[Webhooks]
        Media[Media Generation]
    end

    subgraph Platform
        Admin[Admin & Ops]
        Health[Health & Monitoring]
    end

    AI --> LLM
    AI --> Memory
    Webhooks --> AI
    Billing --> LLM
    Integrations --> AI
    Admin --> Health
```

See [`docs/MICROSERVICES_ROADMAP.md`](MICROSERVICES_ROADMAP.md) for extraction plans per domain.

---

## Future State Architecture

### Near-Term (Modular Monolith)

- Enforce module boundaries via barrel exports (`server/src/modules/`)
- Expand repository coverage (move from direct `db.prepare()` to domain repositories)
- Migrate agent-state-bus to Redis pub/sub
- Add OpenAPI spec validation in CI

### Mid-Term (Service Extraction)

- Extract low-coupling domains first: health, media, portfolio, reminders
- Introduce event-driven communication via Redis Streams
- API versioning for extracted services

### Long-Term (Microservices)

- Independent deployment per domain
- PostgreSQL migration for multi-instance support
- Service mesh for observability
- Event sourcing for critical domains (billing, agent)

See [`docs/MICROSERVICES_ROADMAP.md`](MICROSERVICES_ROADMAP.md) for the detailed roadmap.

---

## Constraints & Known Limitations

| Constraint | Impact | Mitigation |
|------------|--------|-----------|
| SQLite single-writer | Cannot scale horizontally | WAL mode, Redis caching, future PostgreSQL migration |
| In-memory event bus | Events lost on restart, not shared across PM2 workers | Future Redis pub/sub migration |
| 32GB VPS | Resource-constrained for all services | Container memory limits, OOM protection, Ollama model size limits |
| `message-router.ts` (2050 LOC) | High coupling, difficult to test | Target for domain extraction (see Microservices Roadmap) |

---

## Related Documents

- [`README.md`](../README.md) -- Project overview and quick start
- [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) -- Legacy architecture doc (LLM routing focus)
- [`docs/DEVELOPER_GUIDE.md`](DEVELOPER_GUIDE.md) -- Development setup and conventions
- [`docs/API_REFERENCE.md`](API_REFERENCE.md) -- API endpoint documentation
- [`docs/DEVOPS.md`](DEVOPS.md) -- Infrastructure and operations
- [`docs/MICROSERVICES_ROADMAP.md`](MICROSERVICES_ROADMAP.md) -- Domain extraction strategy
- [`docs/ddd/domains.md`](ddd/domains.md) -- Bounded context definitions
- [`docs/adr/ADR-001-llm-waterfall-phase111.md`](adr/ADR-001-llm-waterfall-phase111.md) -- LLM waterfall decision
- [`docs/BUSINESS_FEATURES.md`](BUSINESS_FEATURES.md) -- Feature inventory and credit economy
