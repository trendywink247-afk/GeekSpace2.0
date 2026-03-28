# Agentin Platform -- API Reference

> See also: `openapi/openapi.yaml` for the machine-readable spec (when available).
>
> This is the authoritative API reference for the Agentin platform.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Authentication Guide](#2-authentication-guide)
3. [Rate Limiting](#3-rate-limiting)
4. [Error Responses](#4-error-responses)
5. [Core Endpoints](#5-core-endpoints)
   - [Auth](#51-auth)
   - [Users](#52-users)
   - [Agent / Chat](#53-agent--chat)
   - [Goals & Workspace](#531-goals--workspace-agentic-experience)
   - [Notifications](#532-notifications)
   - [Billing](#54-billing)
   - [Reminders](#55-reminders)
   - [Automations](#56-automations)
   - [Portfolio](#57-portfolio)
   - [Integrations](#58-integrations)
   - [Health](#59-health)
   - [Models](#510-models)
6. [SSE Streaming Protocol](#6-sse-streaming-protocol)
7. [Webhook Integration Guide](#7-webhook-integration-guide)
8. [Pagination](#8-pagination)
9. [OpenAPI Specification](#9-openapi-specification)
10. [Maintenance Guide](#10-maintenance-guide)

---

## 1. Overview

### Base URLs

| Environment | Base URL |
|-------------|----------|
| Development | `http://localhost:3001/api` |
| Production  | `https://api.agentin.chat/api` |

### Content Type

All request and response bodies use `application/json` unless otherwise noted. Mutation endpoints (`POST`, `PUT`, `PATCH`) that send a body **must** include the `Content-Type: application/json` header. Exceptions: webhook endpoints (raw body), file uploads (`multipart/form-data`), and voice endpoints.

### Authentication

Authenticated endpoints require a JSON Web Token passed via the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

Tokens are signed with HS256. See [Section 2](#2-authentication-guide) for the full token lifecycle.

### Request ID Correlation

Every response includes an `X-Request-Id` header. If the client sends this header on the request, the server echoes it back; otherwise the server generates a UUID. Use this value when reporting issues or correlating logs.

### Request Timeout

All routes have a 30-second server-side timeout. If the server cannot produce a response within that window, it returns `503 Request timeout`.

### Request Body Limit

The maximum request body size is configured per deployment (default 1 MB for JSON). Webhook endpoints that require raw bodies (Stripe, Razorpay) use their own parsers.

---

## 2. Authentication Guide

### Obtaining a Token

**Step 1 -- Sign up or log in.**

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your_password"
}
```

**Response (200):**

```json
{
  "token": "eyJhbG...",
  "refreshToken": "a1b2c3d4...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "username",
    "name": "Display Name",
    "plan": "free",
    "credits": 15000
  }
}
```

**Step 2 -- Attach the token to every authenticated request.**

```
Authorization: Bearer eyJhbG...
```

### Token Lifecycle

| Token Type     | Lifetime | Storage Recommendation |
|----------------|----------|------------------------|
| Access token   | 15 minutes | In-memory only |
| Refresh token  | 30 days    | Secure, HttpOnly cookie or encrypted local storage |

Access tokens are short-lived JWTs containing `sub` (user ID), `jti` (unique ID for blocklist support), `iat`, and `exp` claims.

Refresh tokens are opaque, single-use strings stored server-side. Each use rotates the token: the old one is revoked and a new pair (access + refresh) is issued. If a revoked refresh token is presented again, the server treats it as a potential theft and revokes the entire token family.

### Refreshing Tokens

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "a1b2c3d4..."
}
```

**Response (200):**

```json
{
  "token": "eyJhbG...(new access token)",
  "refreshToken": "e5f6g7h8...(new refresh token)"
}
```

### Logout

```http
POST /api/auth/logout
Authorization: Bearer <token>
```

The server adds the token's `jti` to a blocklist. Subsequent requests with that token receive `401`.

### OAuth Flows

Agentin supports OAuth 2.0 login via Google and GitHub. The flow is server-driven:

1. **Google:** Redirect the user to `GET /api/oauth/google`. The server redirects to Google's consent screen. After approval, Google redirects back to the callback URL, and the server issues a JWT.
2. **GitHub:** Redirect the user to `GET /api/oauth/github`. The flow mirrors Google's.

Both providers auto-create an account on first login and link subsequent logins to the existing account by email match.

### Admin Token Usage

Admin endpoints under `/api/admin` require an additional `X-Admin-Password` header containing the server-configured admin password. Admin routes are rate-limited to 10 requests per minute.

---

## 3. Rate Limiting

Rate limiting is enforced per IP address using a sliding window algorithm. Rate limit headers follow the IETF draft standard (`RateLimit-*`). Legacy `X-RateLimit-*` headers are not sent.

### Per-Endpoint Limits

| Endpoint | Window | Max Requests | Notes |
|----------|--------|-------------|-------|
| All `/api/*` (global) | 15 min | 500 | Skips `/health` and `/health/stream` |
| `POST /api/auth/login` | 15 min | 10 | Skips successful requests (only failures count) |
| `POST /api/auth/demo` | 15 min | 10 | Skips successful requests |
| `POST /api/auth/signup` | 15 min | 5 | All requests count (prevents account spam) |
| `POST /api/auth/refresh` | 15 min | 10 | Prevents token farming |
| `POST /api/agent/chat` | 15 min | 60 | ~4 per minute |
| `POST /api/agent/chat/stream` | 15 min | 60 | Shares limit with `/agent/chat` |
| `POST /api/agent/chat/public` | 15 min | 10 | Public portfolio chat |
| `POST /api/dashboard/contact` | 15 min | 10 | Public contact form |
| `POST /api/billing/upgrade` | 1 hour | 5 | Billing mutations |
| `POST /api/billing/checkout` | 1 hour | 5 | Billing mutations |
| `POST /api/billing/day-pass` | 1 hour | 5 | Billing mutations |
| `POST /api/billing/razorpay/order` | 1 hour | 5 | Billing mutations |
| `POST /api/billing/razorpay/verify` | 1 hour | 5 | Billing mutations |
| `PATCH /api/users/me/change-password` | 1 hour | 3 | Security-sensitive |
| `/api/admin/*` | 1 min | 10 | Admin operations |

Additionally, login is protected by a brute-force guard: 5 failed attempts from the same IP within 15 minutes triggers a temporary lockout with a `Retry-After` header.

### Response Headers

When rate limiting is active, responses include:

| Header | Description |
|--------|-------------|
| `RateLimit-Limit` | Maximum requests allowed in the current window |
| `RateLimit-Remaining` | Requests remaining in the current window |
| `RateLimit-Reset` | Unix epoch seconds when the window resets |
| `Retry-After` | Seconds to wait before retrying (only on 429 responses) |

### Policy Discovery

All rate-limited endpoints include an `X-RateLimit-Policy` header (e.g., `60;w=900`) so clients can discover limits even when rate limiting is disabled in development.

### Behavior When Exceeded

When the rate limit is exceeded, the server returns:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 342
Content-Type: application/json

{
  "error": "Too many requests. Please slow down."
}
```

---

## 4. Error Responses

### Standard Format

All errors return a JSON body with an `error` field containing a human-readable message:

```json
{
  "error": "Human-readable error message"
}
```

Validation errors include a `details` array:

```json
{
  "error": "Validation failed",
  "details": [
    { "path": "email", "message": "Invalid email format" },
    { "path": "password", "message": "Must be at least 8 characters" }
  ]
}
```

### Error Types

The server uses a typed error hierarchy. Each error carries a machine-readable `code` and an HTTP `statusCode`:

| Error Class | HTTP Status | Code | Default Message |
|-------------|-------------|------|-----------------|
| `ValidationError` | 400 | `VALIDATION_ERROR` | Validation failed |
| `UnauthorizedError` | 401 | `UNAUTHORIZED` | Unauthorized |
| `PaymentRequiredError` | 402 | `PAYMENT_REQUIRED` | Payment required |
| `ForbiddenError` | 403 | *(standard)* | Forbidden |
| `NotFoundError` | 404 | `NOT_FOUND` | Not found |
| `QuotaExceededError` | 429 | `QUOTA_EXCEEDED` | Quota exceeded |

### Example Error Responses

**401 -- Missing or invalid token:**

```json
{ "error": "Missing auth token" }
```

**401 -- Expired token:**

```json
{ "error": "Token expired" }
```

**402 -- Credits exhausted:**

```json
{ "error": "You've used all your credits for this billing cycle." }
```

**404 -- Resource not found:**

```json
{ "error": "User not found" }
```

**409 -- Conflict:**

```json
{ "error": "Email or username already taken" }
```

---

## 5. Core Endpoints

### 5.1 Auth

#### `POST /api/auth/signup`

Create a new account with a free subscription (15,000 credits).

- **Auth:** None
- **Rate limit:** 5 / 15 min

| Request Field | Type | Required | Description |
|---------------|------|----------|-------------|
| `email` | string | Yes | Valid email address |
| `password` | string | Yes | Minimum 8 characters |
| `username` | string | Yes | Alphanumeric, dashes allowed |
| `name` | string | No | Display name |
| `invite_code` | string | Conditional | Required when invite-gated registration is enabled |

**Response (200):** `{ token, user: { id, email, username, name, plan, credits, createdAt } }`

---

#### `POST /api/auth/login`

Authenticate with email and password. Returns access token + refresh token.

- **Auth:** None
- **Rate limit:** 10 / 15 min (failures only) + brute-force guard (5 failures / 15 min per IP)

| Request Field | Type | Required |
|---------------|------|----------|
| `email` | string | Yes |
| `password` | string | Yes |

**Response (200):** `{ token, refreshToken, user: { id, email, username, name, avatar, plan, credits, ... } }`

---

#### `POST /api/auth/demo`

Log in as the demo user with seed data. Non-production environments only.

- **Auth:** None
- **Rate limit:** 10 / 15 min

**Response (200):** `{ token, user: { ... } }`

---

#### `GET /api/auth/me`

Return the authenticated user's profile.

- **Auth:** Bearer JWT
- **Cache:** Redis-backed, 30s TTL. `X-Cache: HIT|MISS` header indicates cache status.

**Response (200):** `{ id, email, username, name, avatar, plan, credits, onboardingCompleted, ... }`

---

#### `POST /api/auth/forgot-password`

Request a password reset. Always returns success to prevent user enumeration.

- **Auth:** None

| Request Field | Type | Required |
|---------------|------|----------|
| `email` | string | Yes |
| `channel` | string | No | Delivery channel; defaults to `"auto"` |

**Response (200):** `{ success: true, message: "If that email is registered, you'll receive a reset link." }`

---

#### `POST /api/auth/verify-reset-otp`

Verify a one-time password from the reset email.

- **Auth:** None

| Request Field | Type | Required |
|---------------|------|----------|
| `email` | string | Yes |
| `otp` | string | Yes |

**Response (200):** `{ success: true, resetToken: "..." }`

---

#### `POST /api/auth/reset-password`

Set a new password using the reset token from OTP verification.

- **Auth:** None

| Request Field | Type | Required |
|---------------|------|----------|
| `resetToken` | string | Yes |
| `newPassword` | string | Yes |

**Response (200):** `{ success: true, message: "Password reset successfully" }`

---

#### `POST /api/auth/refresh`

Rotate a refresh token. The old refresh token is revoked; a new access + refresh pair is returned.

- **Auth:** None (refresh token acts as credential)
- **Rate limit:** 10 / 15 min

| Request Field | Type | Required |
|---------------|------|----------|
| `refreshToken` | string | Yes |

**Response (200):** `{ token, refreshToken }`

---

#### `POST /api/auth/logout`

Invalidate the current access token by adding its `jti` to the server-side blocklist.

- **Auth:** Bearer JWT

**Response (200):** `{ success: true }`

---

#### `GET /api/auth/sessions`

List all active sessions for the authenticated user (up to 20).

- **Auth:** Bearer JWT

**Response (200):**

```json
{
  "sessions": [
    {
      "id": "session-hash",
      "created_at": "2026-03-20T10:00:00Z",
      "last_seen": "2026-03-27T14:30:00Z",
      "device": "Chrome Desktop",
      "ip_masked": "192.168.1.***",
      "is_active": 1
    }
  ]
}
```

---

#### `DELETE /api/auth/sessions/:id`

Revoke a specific session (marks it inactive).

- **Auth:** Bearer JWT

**Response (200):** `{ success: true }`

---

#### `DELETE /api/auth/sessions`

Revoke all sessions for the authenticated user ("sign out everywhere").

- **Auth:** Bearer JWT

**Response (200):** `{ success: true }`

---

#### `POST /api/auth/delete-account`

Permanently delete the user's account and all associated data. Requires password confirmation.

- **Auth:** Bearer JWT

| Request Field | Type | Required |
|---------------|------|----------|
| `password` | string | Yes |

**Response (200):** `{ success: true, message: "Your account and all associated data have been permanently deleted." }`

---

### 5.2 Users

#### `GET /api/users/me`

Return the authenticated user's full profile including notifications and privacy settings.

- **Auth:** Bearer JWT
- **Cache:** Redis-backed, 60s TTL.

**Response (200):**

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "geekuser",
  "name": "Display Name",
  "avatar": "url",
  "bio": "...",
  "tags": ["react", "node"],
  "theme": { "mode": "dark", "accentColor": "#7B61FF" },
  "plan": "free",
  "credits": 15000,
  "timezone": "Asia/Kolkata",
  "notifications": {
    "email": true,
    "push": false,
    "agentUpdates": true,
    "reminders": true,
    "weeklyDigest": false,
    "proactiveEnabled": false
  },
  "privacy": {
    "showProfile": true,
    "showActivity": true,
    "allowAgentChat": true,
    "showLocation": false
  },
  "createdAt": "2026-01-15T10:00:00Z"
}
```

---

#### `PATCH /api/users/me`

Update the authenticated user's profile. Send only the fields to change.

- **Auth:** Bearer JWT

Updatable fields: `name`, `username`, `bio`, `avatar`, `location`, `website`, `role`, `company`, `tags` (array), `theme` (object with `mode` and `accentColor`), `notifications` (object), `privacy` (object).

**Response (200):** Updated user object.

---

#### `PATCH /api/users/me/change-password`

Change the authenticated user's password.

- **Auth:** Bearer JWT
- **Rate limit:** 3 / hour

| Request Field | Type | Required |
|---------------|------|----------|
| `currentPassword` | string | Yes |
| `newPassword` | string | Yes |

**Response (200):** `{ success: true }`

---

### 5.3 Agent / Chat

#### `GET /api/agent/config`

Get the authenticated user's agent configuration.

- **Auth:** Bearer JWT

**Response (200):**

```json
{
  "id": "agent-uuid",
  "user_id": "user-uuid",
  "name": "Geek",
  "display_name": "Geek's AI",
  "mode": "builder",
  "voice": "friendly",
  "personality": "jarvis",
  "system_prompt": "Custom instructions...",
  "creativity": 70,
  "formality": 50,
  "status": "online"
}
```

---

#### `PATCH /api/agent/config`

Update agent configuration. Send only fields to change.

- **Auth:** Bearer JWT

Allowed fields: `name`, `displayName`, `mode`, `voice`, `personality`, `systemPrompt`, `primaryModel`, `fallbackModel`, `creativity`, `formality`, `responseSpeed`, `monthlyBudgetUSD`, `avatarEmoji`, `accentColor`, `bubbleStyle`, `status`.

---

#### `POST /api/agent/chat`

Primary AI chat endpoint. Multi-engine routed with automatic intent classification and credit tracking.

- **Auth:** Bearer JWT
- **Rate limit:** 60 / 15 min
- **Max message length:** 4,000 characters

| Request Field | Type | Required | Description |
|---------------|------|----------|-------------|
| `message` | string | Yes | User message (max 4000 chars) |

**Prefix routing:**
- `"/premium ..."` -- Forces premium reasoning model (costs credits)
- `"/local ..."` -- Forces local Ollama (free)
- No prefix -- Auto-routes based on intent classification

**Response (200):**

```json
{
  "text": "The AI response text...",
  "route": "premium",
  "tier": "premium",
  "latencyMs": 1250,
  "provider": "openrouter",
  "model": "llama3.1:8b",
  "creditsUsed": 0,
  "creditsRemaining": 4990
}
```

Returns `402` if credits are exhausted.

---

#### `POST /api/agent/chat/stream`

Streaming SSE endpoint for token-by-token LLM responses. See [Section 6](#6-sse-streaming-protocol) for the full protocol.

- **Auth:** Bearer JWT
- **Rate limit:** 60 / 15 min

| Request Field | Type | Required |
|---------------|------|----------|
| `message` | string | Yes |
| `personality` | string | No | Override personality (e.g., `"weebo"`, `"edith"`) |

---

#### `POST /api/agent/chat/public/:username`

Public portfolio chat. No auth required. Uses free models. Personality-aware -- uses the portfolio owner's agent personality.

- **Auth:** None
- **Rate limit:** 10 / 15 min

| Request Field | Type | Required |
|---------------|------|----------|
| `message` | string | Yes |

**Response (200):** `{ reply, agentName, ownerName }`

---

#### `POST /api/agent/command`

Execute an agent command (natural language or structured).

- **Auth:** Bearer JWT

| Request Field | Type | Required |
|---------------|------|----------|
| `command` | string | Yes |

**Response (200):** `{ output, isError }`

---

#### `GET /api/agent/personalities`

List all available agent personality definitions.

- **Auth:** None

**Response (200):** Array of `{ id, name, subtitle, description, emoji, greeting }`

---

#### `POST /api/agent/deploy-premium`

Deploy a specialist premium agent session. Requires a paid plan. Costs 100 credits.

- **Auth:** Bearer JWT

| Request Field | Type | Required |
|---------------|------|----------|
| `task` | string | Yes |

**Response (201):** `{ session: { id, agent_codename, task, status, model_used }, message, creditsUsed }`

Returns `403` for free users, `402` for insufficient credits.

---

#### `POST /api/agent/premium-chat/:sessionId`

Chat within a premium specialist session.

- **Auth:** Bearer JWT

| Request Field | Type | Required |
|---------------|------|----------|
| `message` | string | Yes |

**Response (200):** `{ text, creditsUsed, creditsRemaining }`

---

#### `DELETE /api/agent/premium-session/:sessionId`

End a premium specialist session.

- **Auth:** Bearer JWT

**Response (200):** `{ success: true }`

---

#### `GET /api/agent/conversations`

List the authenticated user's conversation history.

- **Auth:** Bearer JWT

---

#### `DELETE /api/agent/conversations`

Clear the authenticated user's conversation history.

- **Auth:** Bearer JWT

---

#### `GET /api/agent/memory`

List memory entries for the authenticated user.

- **Auth:** Bearer JWT

---

#### `POST /api/agent/memory`

Store a new memory entry.

- **Auth:** Bearer JWT

---

#### `DELETE /api/agent/memory/:id`

Delete a specific memory entry.

- **Auth:** Bearer JWT

---

### 5.3.1 Goals & Workspace (Agentic Experience)

#### `GET /api/agent/goals`

List user's goals.

- **Auth:** Bearer JWT
- **Query:** `status` (active|paused|completed|failed|archived), `limit` (1-100, default 50)

**Response (200):** `{ "goals": [Goal] }`

---

#### `POST /api/agent/goals`

Create a new goal. Auto-triggers AI planning (Cal decomposes into steps).

- **Auth:** Bearer JWT

**Body:**
```json
{
  "title": "Launch my SaaS by April",
  "description": "Build and ship the MVP",
  "category": "technical",
  "target_date": "2026-04-30",
  "priority": 8
}
```

**Response (201):** `{ "goal": Goal }`

Categories: `general`, `career`, `health`, `finance`, `learning`, `creative`, `technical`, `personal`

---

#### `GET /api/agent/goals/:id`

Get goal with steps and event count.

- **Auth:** Bearer JWT (ownership enforced)

**Response (200):** `{ "goal": GoalWithSteps }`

---

#### `PATCH /api/agent/goals/:id`

Update goal fields (title, description, status, priority, category, target_date, assigned_agent).

- **Auth:** Bearer JWT (ownership enforced)

---

#### `DELETE /api/agent/goals/:id`

Delete a goal and all associated steps/events.

- **Auth:** Bearer JWT (ownership enforced)

---

#### `POST /api/agent/goals/:id/plan`

AI-decompose a goal into actionable steps assigned to specialist agents. Cal analyzes the goal and creates 3-8 steps. Re-planning replaces existing pending steps atomically.

- **Auth:** Bearer JWT

**Response (200):** `{ "plan": { "goal": Goal, "steps": [GoalStep], "estimated_agents": [...], "estimated_effort": "..." } }`

---

#### `POST /api/agent/goals/:id/execute`

Execute the next available step on a goal. The assigned specialist agent works on it autonomously. Step claim is atomic (prevents concurrent execution).

- **Auth:** Bearer JWT

**Response (200):** `{ "step": GoalStep }`

---

#### `GET /api/agent/goals/:id/steps`

List steps for a goal ordered by step_order.

---

#### `POST /api/agent/goals/:id/steps`

Manually add a step to a goal.

**Body:** `{ "title": "...", "description": "...", "assigned_agent": "forge", "effort": "medium", "depends_on": ["step-uuid"] }`

---

#### `PATCH /api/agent/goals/:goalId/steps/:stepId`

Update step status. Validates step belongs to the goal.

**Body:** `{ "status": "completed", "result": "..." }`

Status values: `pending`, `in_progress`, `completed`, `failed`, `skipped`, `blocked`

---

#### `GET /api/agent/goals/:id/events`

Goal event timeline (agent check-ins, step completions, progress updates).

---

#### `GET /api/agent/goals/stats`

Goal statistics: total, active, completed, paused, avgProgress, topAgent.

---

#### `GET /api/agent/goals/actionable`

Goals with executable next steps (all dependencies met).

---

#### `GET /api/agent/workspace`

List workspace artifacts. Query: `goal_id` (filter by goal), `limit`.

---

#### `POST /api/agent/workspace`

Create an artifact. Validates goal ownership if `goal_id` provided.

**Body:** `{ "title": "...", "content": "...", "artifact_type": "note|draft|research|code|plan|analysis", "goal_id": "optional" }`

---

#### `PATCH /api/agent/workspace/:id`

Update artifact content. Increments version.

---

#### `DELETE /api/agent/workspace/:id`

Delete an artifact.

---

### 5.3.2 Notifications

#### `GET /api/agent/notifications`

List agent-initiated notifications.

- **Auth:** Bearer JWT
- **Query:** `unread=true` (filter unread only), `limit` (1-200, default 50, clamped to positive values)

**Response (200):** `{ "notifications": [AgentNotification], "unreadCount": number }`

---

#### `GET /api/agent/notifications/count`

Get unread notification count.

**Response (200):** `{ "count": number }`

---

#### `PATCH /api/agent/notifications/:id/read`

Mark a notification as read.

---

#### `POST /api/agent/notifications/read-all`

Mark all notifications as read.

**Response (200):** `{ "markedRead": number }`

---

#### `DELETE /api/agent/notifications/:id`

Delete a notification.

---

### 5.4 Billing

#### `GET /api/billing/plans`

List all available subscription plans with pricing.

- **Auth:** None
- **Cache:** 1 hour

**Response (200):**

```json
[
  {
    "id": "free",
    "name": "Free",
    "credits": 15000,
    "priceUsd": 0,
    "priceInr": 0,
    "intervalDays": 0
  },
  {
    "id": "pilot",
    "name": "Pilot",
    "credits": 100000,
    "priceUsd": 10,
    "priceInr": 499,
    "intervalDays": 30
  }
]
```

---

#### `GET /api/billing/plan`

Get the authenticated user's current subscription details.

- **Auth:** Bearer JWT

**Response (200):** `{ plan, credits_remaining, monthly_credits, billing_cycle_start, billing_cycle_end, price_usd, price_inr, currency }`

---

#### `POST /api/billing/upgrade`

Change subscription plan. When Stripe is configured, this endpoint returns `403` and directs to `/api/billing/checkout`. In dev/test mode (no Stripe), it performs a direct plan switch.

- **Auth:** Bearer JWT
- **Rate limit:** 5 / hour

| Request Field | Type | Required |
|---------------|------|----------|
| `plan` | string | Yes | Plan ID |
| `currency` | string | No | `"usd"` or `"inr"` (default: `"usd"`) |

---

#### `POST /api/billing/checkout`

Create a Stripe Checkout session for upgrading to a paid plan.

- **Auth:** Bearer JWT
- **Rate limit:** 5 / hour

| Request Field | Type | Required |
|---------------|------|----------|
| `plan` | string | Yes | One of: `pilot`, `intro`, `halfyear`, `yearly` |

**Response (200):** `{ url: "https://checkout.stripe.com/..." }`

---

#### `POST /api/billing/webhook`

Stripe webhook endpoint. See [Section 7](#7-webhook-integration-guide).

- **Auth:** None (Stripe signature verification)

---

#### `GET /api/billing/usage`

Get daily usage data for the current billing cycle (last 30 days).

- **Auth:** Bearer JWT

**Response (200):** Array of `{ day, total_cost, calls, total_tokens }`

---

#### `GET /api/billing/events`

Get the last 20 usage events for the credit history table.

- **Auth:** Bearer JWT

**Response (200):** Array of `{ id, provider, model, tokens_in, tokens_out, cost_usd, channel, tool, created_at }`

---

#### `GET /api/billing/status`

Get the current Stripe subscription status and expiry.

- **Auth:** Bearer JWT

---

#### `POST /api/billing/day-pass`

Activate a 24-hour day pass for free-plan users (grants 2,000 bonus credits).

- **Auth:** Bearer JWT
- **Rate limit:** 5 / hour

**Response (200):** `{ message, expiresAt }`

---

#### `GET /api/billing/day-pass`

Check whether the user has an active day pass.

- **Auth:** Bearer JWT

**Response (200):** `{ active: true|false, expiresAt: "..." | null }`

---

#### `POST /api/billing/razorpay/order`

Create a Razorpay order for INR payment.

- **Auth:** Bearer JWT
- **Rate limit:** 5 / hour

| Request Field | Type | Required |
|---------------|------|----------|
| `plan` | string | Yes | One of: `pilot`, `intro`, `halfyear`, `yearly` |

**Response (200):** `{ orderId, amount, currency: "INR", keyId }`

---

#### `POST /api/billing/razorpay/verify`

Verify a Razorpay payment and upgrade the subscription.

- **Auth:** Bearer JWT
- **Rate limit:** 5 / hour

| Request Field | Type | Required |
|---------------|------|----------|
| `razorpay_order_id` | string | Yes |
| `razorpay_payment_id` | string | Yes |
| `razorpay_signature` | string | Yes |
| `plan` | string | Yes |

**Response (200):** `{ success: true, plan }`

---

#### `POST /api/billing/razorpay/webhook`

Razorpay webhook endpoint. See [Section 7](#7-webhook-integration-guide).

- **Auth:** None (HMAC-SHA256 signature verification)

---

### 5.5 Reminders

All reminder endpoints require `Bearer JWT` auth.

#### `GET /api/reminders`

List all reminders for the authenticated user.

| Query Param | Type | Default | Description |
|-------------|------|---------|-------------|
| `status` | string | `all` | Filter: `all`, `pending`, `completed` |
| `category` | string | -- | Filter: `personal`, `work`, `health`, `other`, `general` |

---

#### `POST /api/reminders`

Create a new reminder.

| Request Field | Type | Required |
|---------------|------|----------|
| `text` | string | Yes |
| `datetime` | string | Yes | ISO 8601 format |
| `channel` | string | No | Delivery channel (e.g., `"push"`) |
| `category` | string | No | `personal`, `work`, `health`, `other`, `general` |
| `recurring` | string | No | `daily`, `weekly`, `monthly` |

---

#### `PATCH /api/reminders/:id`

Update a reminder. Send only fields to change.

---

#### `DELETE /api/reminders/:id`

Delete a reminder.

---

#### `POST /api/reminders/:id/snooze`

Snooze a reminder to a later time.

| Request Field | Type | Required |
|---------------|------|----------|
| `until` | string | Yes | New datetime (ISO 8601) |

---

### 5.6 Automations

All automation endpoints require `Bearer JWT` auth.

#### `GET /api/automations`

List all automations for the authenticated user.

---

#### `POST /api/automations`

Create a new automation.

| Request Field | Type | Required | Description |
|---------------|------|----------|-------------|
| `name` | string | Yes | Automation name |
| `description` | string | No | Human-readable description |
| `triggerType` | string | Yes | e.g., `"time"`, `"event"` |
| `actionType` | string | Yes | e.g., `"portfolio-update"` |
| `config` | object | Yes | Trigger config (e.g., `{ "cron": "0 9 * * *" }`) |
| `enabled` | boolean | No | Default `true` |

---

#### `PATCH /api/automations/:id`

Update an automation. Send only fields to change.

---

#### `DELETE /api/automations/:id`

Delete an automation.

---

### 5.7 Portfolio

#### `GET /api/portfolio`

Get the authenticated user's portfolio.

- **Auth:** Bearer JWT

---

#### `GET /api/portfolio/:username`

Get any user's public portfolio.

- **Auth:** None

---

#### `PATCH /api/portfolio`

Update the authenticated user's portfolio.

- **Auth:** Bearer JWT

Updatable fields: `headline`, `about`, `skills`, `projects`, `milestones`, `social`, `layout`, `agentEnabled`, `visibility`.

---

### 5.8 Integrations

#### `GET /api/integrations`

List all integrations (connected and disconnected) for the authenticated user.

- **Auth:** Bearer JWT

---

#### `PATCH /api/integrations/:id`

Update integration settings (status, config, credentials).

- **Auth:** Bearer JWT

---

#### Telegram Custom Bot

##### `POST /api/integrations/telegram/custom`

Register a custom Telegram bot for the user's account.

- **Auth:** Bearer JWT

##### `GET /api/integrations/telegram/custom`

Get the user's custom Telegram bot configuration.

- **Auth:** Bearer JWT

##### `DELETE /api/integrations/telegram/custom`

Remove the user's custom Telegram bot.

- **Auth:** Bearer JWT

---

### 5.9 Health

#### `GET /api/health`

Basic health check. Returns the server status. Unauthenticated by design.

- **Auth:** None

**Response (200):** `{ "status": "ok" }`
**Response (503):** `{ "status": "degraded" }` (database unreachable)

---

#### `GET /api/ready`

Readiness probe for orchestrators (e.g., Kubernetes). Returns `200` when the database is reachable.

- **Auth:** None

**Response (200):** `{ status: "ready", db: "ok", automations: 42 }`
**Response (503):** `{ status: "not ready", db: "error", message: "..." }`

---

#### `GET /api/version`

Application version and build metadata. Unauthenticated by design.

- **Auth:** None

**Response (200):**

```json
{
  "version": "3.1.0",
  "gitSha": "ddb017f",
  "env": "production",
  "buildTime": "2026-03-27T10:00:00Z",
  "nodeVersion": "20.11.0"
}
```

---

### 5.10 Models

#### `GET /api/models/free`

List all active and new free models available on the platform.

- **Auth:** None

**Response (200):**

```json
{
  "models": [
    {
      "id": "meta-llama/llama-3.1-8b-instruct:free",
      "displayName": "Llama 3.1 8B",
      "provider": "openrouter",
      "summary": "Fast, capable general-purpose model",
      "contextLength": 131072,
      "parameters": "8B",
      "status": "active",
      "curated": true,
      "isNew": false
    }
  ],
  "lastUpdated": "2026-03-27T10:00:00Z"
}
```

---

#### `GET /api/models/changelog`

Model change log for the last 30 days (additions, removals, status changes).

- **Auth:** None

**Response (200):**

```json
{
  "entries": [
    {
      "modelId": "meta-llama/llama-3.1-8b-instruct:free",
      "displayName": "Llama 3.1 8B",
      "event": "added",
      "timestamp": "2026-03-15T08:00:00Z"
    }
  ]
}
```

---

## 6. SSE Streaming Protocol

### Endpoint

```
POST /api/agent/chat/stream
Authorization: Bearer <token>
Content-Type: application/json
Accept: text/event-stream

{ "message": "Your message here" }
```

### Connection Setup

The server responds with:

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

### Event Types

The stream emits named SSE events using the `event:` field:

#### `delta` -- Incremental token chunk

Emitted as each token is generated. Concatenate `text` fields to build the full response.

```
event: delta
data: {"text":"Hello"}

event: delta
data: {"text":" world"}
```

#### `done` -- Stream complete

Emitted once when the response is fully generated. Contains metadata about the request.

```
event: done
data: {"requestId":"uuid","provider":"openrouter","model":"llama3.1:8b","creditsUsed":5}
```

#### `error` -- Fatal error

Emitted when the stream cannot continue. The connection closes after this event.

```
event: error
data: {"message":"Credits exhausted"}
```

#### `action` -- Deferred action result

Emitted when the agent executes a tool or action (code generation, image generation, etc.) as part of the response.

```
event: action
data: {"action":"generateImage","result":{"url":"https://..."}}
```

### Intent Routing

The streaming endpoint classifies intent and routes accordingly:

1. **Complex / coding / planning** -- ReAct loop with visible thinking steps
2. **Simple + Ollama available** -- Direct Ollama stream
3. **Simple + Ollama unavailable** -- Cloud fallback (openrouter-free tier)
4. **`@council` prefix** -- Multi-agent orchestration

### Reconnection

If the connection drops, the client should wait 5 seconds before reconnecting. The SSE protocol's built-in `retry:` field is not currently set by the server; implement your own backoff.

### Client Example

```javascript
const response = await fetch('/api/agent/chat/stream', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ message: 'Explain microservices' }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      // Handle based on preceding event: line
    }
  }
}
```

---

## 7. Webhook Integration Guide

Webhooks are **unauthenticated** endpoints called by external services. Each uses its own verification mechanism. All webhook routes are excluded from the global `Content-Type: application/json` enforcement.

### 7.1 Telegram Webhook

**Endpoint:** `POST /api/webhooks/telegram`

#### Verification

Telegram sends a secret token in the `X-Telegram-Bot-Api-Secret-Token` header. The server compares this against the configured `TELEGRAM_WEBHOOK_SECRET`. If the secret is not configured on the server, all requests are rejected with `401`.

```
X-Telegram-Bot-Api-Secret-Token: <configured_secret>
```

| Verification Result | HTTP Status |
|---------------------|-------------|
| Secret not configured on server | 401 |
| Invalid or missing token | 403 |
| Valid token | 200 (immediate) |

#### Processing Model

The server responds with `200` **immediately** upon successful verification, before processing the message. This is required by Telegram's webhook contract (fast ACK). Message processing happens asynchronously after the response.

#### Rate Limiting

Per-chat rate limit: 20 requests per 60 seconds per `chat_id`. When exceeded, the update is silently dropped (Telegram already received the 200 ACK). This limit uses Redis-backed counters.

#### Payload Format

The request body is a standard [Telegram Update object](https://core.telegram.org/bots/api#update). The server handles:

- Text messages
- Callback queries (inline button clicks)
- Voice messages
- Bot commands (`/start`, `/help`, etc.)

#### Retry Expectations

Telegram retries failed webhooks with exponential backoff. Since the server always responds `200` before processing, Telegram retries are only triggered by network-level failures.

---

### 7.2 Stripe Webhook

**Endpoint:** `POST /api/billing/webhook`

#### Verification

Stripe signs each webhook payload. The server uses `stripe.webhooks.constructEvent()` with the `Stripe-Signature` header and the configured webhook secret to verify authenticity and integrity.

```
Stripe-Signature: t=1234567890,v1=abc123...
```

The request body must be the raw (unparsed) buffer. The endpoint uses `express.raw({ type: 'application/json' })` to ensure the body is not parsed before signature verification.

| Verification Result | HTTP Status |
|---------------------|-------------|
| Missing `Stripe-Signature` header | 400 |
| Invalid signature | 400 |
| Valid signature | 200 |

#### Event Types Handled

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Upgrade user subscription, set credits, set billing cycle |
| `customer.subscription.updated` | Update plan details and cycle dates |
| `customer.subscription.deleted` | Downgrade to free plan |

#### Idempotency

Stripe may deliver the same event multiple times. The handler is idempotent: re-processing a `checkout.session.completed` event for the same user and plan results in the same database state (upsert semantics via `ON CONFLICT ... DO UPDATE`).

#### Security Notes

- The webhook endpoint is excluded from JWT auth and CSRF protection.
- The raw body parser is scoped only to this route.
- The webhook secret should be configured via the `STRIPE_WEBHOOK_SECRET` environment variable.

---

### 7.3 Razorpay Webhook

**Endpoint:** `POST /api/billing/razorpay/webhook`

#### Verification

Razorpay signs webhook payloads using HMAC-SHA256 with the key secret. The signature is sent in the `X-Razorpay-Signature` header.

The server verifies by:
1. Computing `HMAC-SHA256(raw_body, razorpay_key_secret)`.
2. Comparing the hex digest against the `X-Razorpay-Signature` header using `crypto.timingSafeEqual()` to prevent timing attacks.

```
X-Razorpay-Signature: <hex_hmac_digest>
```

| Verification Result | HTTP Status |
|---------------------|-------------|
| Missing `X-Razorpay-Signature` header | 400 |
| Razorpay not configured | 503 |
| Invalid signature | 400 |
| Valid signature | 200 |

#### Event Types Handled

| Event | Action |
|-------|--------|
| `payment.captured` | Upgrade user subscription, set credits (reads `userId` and `plan` from `payment.notes`) |
| `payment.failed` | Log warning (no user-facing action) |

#### Order Flow

1. Client calls `POST /api/billing/razorpay/order` to create an order.
2. Client opens the Razorpay checkout widget with the `orderId`.
3. On success, client calls `POST /api/billing/razorpay/verify` with the payment details.
4. Independently, Razorpay sends a webhook to `POST /api/billing/razorpay/webhook` for server-side confirmation.

#### Signature Format for Client-Side Verification

The client-side verification endpoint (`/razorpay/verify`) checks:

```
HMAC-SHA256(razorpay_order_id + "|" + razorpay_payment_id, razorpay_key_secret)
```

This is compared against the `razorpay_signature` field sent by the client.

---

### Dead Letter Handling

The platform does not implement a dead letter queue for failed webhook processing. If asynchronous processing fails (e.g., Telegram message handling after the 200 ACK), the error is logged but not retried. For Stripe and Razorpay, the webhook handlers themselves are synchronous and return error status codes on failure, allowing the payment provider to retry.

---

## 8. Pagination

List endpoints that return potentially large collections support pagination via `limit` and `offset` query parameters.

### Standard Parameters

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `limit` | integer | 25 | 100 | Number of items to return |
| `offset` | integer | 0 | -- | Number of items to skip |

### Response Format

Paginated responses include a `total` field for the total count:

```json
{
  "activity": [ ... ],
  "total": 142
}
```

### Endpoints Using Pagination

- `GET /api/activity` -- `limit`, `offset`, `q` (search), `type`, `from`, `to`
- `GET /api/reminders` -- `status`, `category` filters
- `GET /api/agent/conversations` -- `limit`, `offset`
- `GET /api/billing/events` -- Fixed to last 20 events
- `GET /api/auth/sessions` -- Fixed to last 20 active sessions
- `GET /api/models/changelog` -- Fixed to last 100 entries within 30 days

### Cursor-Based Pagination

Currently, no endpoints use cursor-based pagination. All list endpoints use limit/offset.

---

## 9. OpenAPI Specification

### Status

An OpenAPI 3.1 specification file is planned at `openapi/openapi.yaml`. When available, it will provide:

- Machine-readable endpoint definitions
- Request/response schemas with JSON Schema validation
- Auto-generated client SDKs

### Using with Swagger UI

Once the spec is available, you can view it interactively:

```bash
# Using Docker
docker run -p 8080:8080 -e SWAGGER_JSON=/spec/openapi.yaml \
  -v $(pwd)/openapi:/spec swaggerapi/swagger-ui

# Or via npx
npx @redocly/cli preview-docs openapi/openapi.yaml
```

### Using with Redocly

```bash
npx @redocly/cli lint openapi/openapi.yaml   # Validate the spec
npx @redocly/cli build-docs openapi/openapi.yaml  # Generate static HTML docs
```

---

## 10. Maintenance Guide

### When Adding a New Endpoint

1. **Register the route** in the appropriate router file under `server/src/routes/`.
2. **Mount the router** in `server/src/app.ts` if it is a new router.
3. **Add rate limiting** in `server/src/app.ts` if the endpoint is security-sensitive or resource-intensive.
4. **Update this document** (`docs/API_REFERENCE.md`):
   - Add the endpoint to the appropriate domain section.
   - Document method, path, auth requirement, request fields, and response format.
   - Update the rate limiting table if applicable.
5. **Update the OpenAPI spec** (`openapi/openapi.yaml`) when available.
6. **Add or update tests** under `server/src/__tests__/` or `tests/`.

### When Changing an Existing Endpoint

1. **Check for breaking changes.** If request/response schemas change, consider versioning.
2. **Update this document** with the new behavior.
3. **Update the OpenAPI spec** when available.
4. **Search for client usage** in `client/src/` to ensure the frontend handles the change.

### When Deprecating an Endpoint

1. Add a `Deprecation` header to the endpoint response.
2. Log usage of the deprecated endpoint so you can track when it is safe to remove.
3. Add a deprecation notice to this document and the OpenAPI spec.
4. Set a removal date and communicate it to API consumers.

### When Changing Rate Limits

1. Update the rate limiter configuration in `server/src/app.ts`.
2. Update the `X-RateLimit-Policy` middleware for the affected endpoint.
3. Update the rate limiting table in this document.

---

## Related Documents

| Document | Description |
|----------|-------------|
| [Solution Architecture](SOLUTION_ARCHITECTURE.md) | System architecture and component overview |
| [Developer Guide](DEVELOPER_GUIDE.md) | Setup, local development, and contribution workflow |
| [Solution Architecture](SOLUTION_ARCHITECTURE.md) | Detailed technical design and data flows |
| [Environment Variables](ENV_VARS.md) | All configuration variables including JWT secrets, API keys, and webhook secrets |
| [Deployment](DEPLOYMENT.md) | Production deployment procedures |
| [Testing](TESTING.md) | Test strategy, running tests, and coverage |
| [Troubleshooting](TROUBLESHOOTING.md) | Common issues and debugging procedures |
| [Business Features](BUSINESS_FEATURES.md) | Feature overview for product and business context |
