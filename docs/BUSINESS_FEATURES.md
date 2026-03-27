# Agentin Business Features

> Comprehensive product and feature reference for PMs, BAs, QA, and stakeholders.
> All features documented here are verified against the current codebase.

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Agent Personalities](#2-agent-personalities)
3. [Credit Economy](#3-credit-economy)
4. [Subscription Tiers](#4-subscription-tiers)
5. [Core Features](#5-core-features)
6. [Telegram Integration](#6-telegram-integration)
7. [Automation Engine](#7-automation-engine)
8. [Portfolio System](#8-portfolio-system)
9. [Multi-Agent Council](#9-multi-agent-council)
10. [Hinglish and India Support](#10-hinglish-and-india-support)
11. [Feature Matrix](#11-feature-matrix)

---

## 1. Platform Overview

Agentin is an AI-powered personal productivity platform that gives every user a team of nine specialist AI agents. Users interact through a web dashboard or Telegram bot to manage reminders, track habits, log expenses, run focus sessions, build a public portfolio, automate workflows, and conduct web research -- all through natural conversation.

The platform is designed around three principles:

- **Conversational-first**: Users type or speak naturally; the system figures out what to do. There are no forms to fill out for common tasks.
- **Multi-agent specialization**: Instead of one generic assistant, nine distinct agents each own a domain. The system automatically delegates to the right specialist based on what the user says.
- **Cost-efficient AI routing**: A tiered LLM waterfall starts with free local models and only escalates to paid providers when needed, keeping costs near zero for most interactions while preserving quality for complex requests.

**Primary channels**: Web dashboard (React SPA) and Telegram bot (webhook-based).

**Target users**: Individual professionals, students, freelancers, and small teams -- with a strong focus on the Indian market (Hinglish support, Razorpay payments, Indian festival calendar).

---

## 2. Agent Personalities

Agentin ships with nine distinct agent personalities. Each has a defined domain, communication style, and set of triggers that cause the system to delegate work to it.

### 2.1 Personality Roster

| Agent | Role | Domain | Emoji | Communication Style |
|-------|------|--------|-------|-------------------|
| **Weebo** | The Darling | Default orchestrator / general | ✨ | Enthusiastic, warm, playful. Gets excited about helping. Uses minimal emoji. |
| **Edith** | The Boss | Deep reasoning, complex analysis, premium | 🔷 | CTO energy -- decisive, authoritative, efficient. Never sounds uncertain. |
| **Jarvis** | The Helper | Tasks, productivity, workflow, planning | 🤖 | Classic butler -- warm, competent, dry humor, always composed. |
| **Aria** | The Creative | Writing, design, brainstorming, social media | 🎨 | Imaginative, inspiring. Asks questions to understand vision before diving in. |
| **Forge** | The Builder | Code, technical, debugging, automation | ⚙️ | Engineering-focused, precise. Values working code over theory. |
| **Pulse** | The Analyst | Data, metrics, analytics, reporting | 📊 | Data-driven, objective. Presents structured lists, key findings. |
| **Echo** | The Coach | Habits, focus, personal goals, accountability | 💬 | Empathetic, motivating. Celebrates wins, pushes gently. |
| **Cal** | The Organizer | Calendar, reminders, scheduling, time management | 📅 | Calm, structured. Brings order to chaos. Concise and action-oriented. |
| **Nova** | The Explorer | Research, learning, news, fact-checking | 🚀 | Curious, knowledge-hungry. Synthesizes rather than dumps info. |

### 2.2 How Agent Switching Works

There are three mechanisms for routing a message to a specific agent:

**Named routing (explicit)**: The user mentions an agent by name (e.g., "Hey Forge, review this code") or uses a `/switch` command. The system routes directly to the named agent.

**Auto-delegation (implicit)**: When the user sends a message without naming an agent, the delegation service (`delegation.ts`) runs the message through a set of regex-based intent patterns. Each pattern maps to a specialist agent:

| Trigger Pattern (examples) | Target Agent | Reason |
|---|---|---|
| "schedule", "calendar", "meeting", "appointment" | Cal | Calendar and scheduling |
| "remind me", "set a reminder", "alarm" | Cal | Reminders |
| "remember when", "what did I say", "search my memory" | Echo | Memory recall |
| "save this", "note this", "keep this in mind" | Echo | Memory storage |
| "write a function", "debug", "fix this code", "refactor" | Forge | Code and technical |
| "html", "css", "javascript", "python", "react", "docker" | Forge | Programming |
| "write a story", "brainstorm", "ideas for", "draft" | Aria | Creative writing |
| "design", "color scheme", "UI", "brand", "logo" | Aria | Design |
| "analyze", "metrics", "dashboard", "trend", "report" | Pulse | Analytics and data |
| "research", "explain", "what is", "compare", "teach me" | Nova | Research and learning |
| "plan my", "prioritize", "todo", "workflow", "sprint" | Jarvis | Productivity and planning |

If no pattern matches, Weebo handles the message directly.

**Fast-path routing**: For specific fast-path operations (research, expense, reminder, etc.), the system also emits collaboration events so the office canvas visualization shows which agents are working. The fast-path agent map is:

| Fast-Path | Agent |
|-----------|-------|
| research | Nova |
| expense | Pulse |
| reminder | Cal |
| focus | Jarvis |
| memory | Edith |
| website | Forge |
| briefing | Edith |
| image | Aria |
| screenshot | Forge |
| habit | Echo |
| doc | Edith |
| links | Nova |
| workflow | Jarvis |
| notification | Cal |

### 2.3 Delegation Limits by Tier

Automatic delegation is gated by subscription tier to control costs:

| Tier | Delegations per Day |
|------|-------------------|
| Free | 10 |
| Intro | 50 |
| Pilot | 50 |
| Monthly | 200 |
| Half-Year | 200 |
| Yearly | 200 |
| Pro | 500 |
| Team | Unlimited |

---

## 3. Credit Economy

### 3.1 How Credits Work

Every AI operation costs credits. Credits are deducted from the user's balance after each LLM call completes. The cost depends on which provider handled the request.

The system uses a **waterfall routing strategy** that always tries the cheapest provider first:

1. **PicoClaw** (local, instant) -- 1 credit
2. **Ollama** (local hermes3:8b) -- 1 credit
3. **OpenRouter Free** (Qwen3 235B, Llama 3.3 70B rotation) -- 2 credits
4. **Groq** (Llama 3.3 70B, free quota) -- 2 credits
5. **Together Qwen3.5** ($0.10-0.15/1M tokens) -- 3 credits flat
6. **Together Maverick** ($0.27-0.85/1M tokens, premium only) -- 8+ credits (token-based)
7. **Kimi K2** ($5/mo system cap, premium only) -- 5 credits flat
8. **Edith / Kimi K2.5** (last resort, premium only) -- 10+ credits (token-based)

### 3.2 Credit Cost Table

| Provider | Cost Model | Credits |
|----------|-----------|---------|
| PicoClaw (local WASM) | Flat per call | 1 |
| Ollama (local) | Flat per call | 1 |
| OpenRouter Free | Flat per call | 2 |
| Groq | Flat per call | 2 |
| Together Qwen | Flat per call | 3 |
| OpenRouter (paid) | Token-based (5 per 1K tokens) | 10+ |
| Together (paid) | Token-based (8 per 1K tokens) | 10+ |
| Kimi K2 | Flat per call | 5 |
| Edith | Token-based (10 per 1K tokens) | 10+ |
| Cache hit | No cost | 0 |
| Built-in responses | No cost | 0 |

For token-based providers, the formula is: `ceil((tokensIn + tokensOut) / 1000 * rate)`, with a minimum of 10 credits per premium call.

### 3.3 Budget Enforcement

- **Per-user credits**: Deducted from the `subscriptions.credits_remaining` column after each call. Guest/visitor users are exempt.
- **Together daily budget**: A system-wide $2.00/day cap (configurable via `TOGETHER_DAILY_BUDGET_CENTS`). When exhausted, Tier 3 and 4 providers are skipped for all users.
- **Kimi per-user cap**: Maximum 3 calls per user per day, with a $5/month system-wide cap.
- **Degradation**: When the user is over budget or the daily system budget is exceeded, routing degrades to free providers only (Ollama, Groq, builtin).

### 3.4 Default Credit Allocations

- **Free tier legacy users**: 5,000 credits/month (from `users.credits` column)
- **Paid plans**: Credits stored in the `subscriptions` table with `monthly_credits` and `credits_remaining` columns, reset each billing cycle
- **Premium monthly credits**: 50,000/month (configurable via `PREMIUM_MONTHLY_CREDITS`)
- **Trial credits**: 10,000 credits during a 3-day trial period (configurable via `TRIAL_PREMIUM_CREDITS`, `TRIAL_DAYS`)

---

## 4. Subscription Tiers

### 4.1 Plan Overview

| Plan | Label | Billing | Key Benefits |
|------|-------|---------|-------------|
| **Free** | Free | No charge | Basic AI chat, 5,000 credits/month, free-tier LLM providers, 10 agent delegations/day |
| **Pilot** | Pilot | Monthly | Expanded credits, all free-tier providers + priority routing, 50 delegations/day |
| **Intro** | Intro | Monthly | Same tier as Pilot -- entry-level paid plan, 50 delegations/day |
| **Monthly** | Monthly | Monthly | Full access to premium providers (Together Maverick, Kimi K2, Edith), 200 delegations/day, 50,000 credits/month |
| **Half-Year** | Half-Year | Every 6 months | Same features as Monthly with discounted rate, 200 delegations/day |
| **Yearly** | Yearly | Annual | Same features as Monthly with best price, 200 delegations/day |

Legacy aliases `basic` and `pro` are preserved for backward compatibility.

### 4.2 LLM Access by Tier

| LLM Tier | Free Users | Paid Users |
|----------|-----------|-----------|
| Tier 0: PicoClaw (local WASM) | Yes | Yes |
| Tier 1: Ollama hermes3:8b | Yes | Yes |
| Tier 1.5: OpenRouter Free (Qwen3 235B, Llama 3.3 70B) | Yes | Yes |
| Tier 2: Groq Llama 3.3 70B | Yes | Yes |
| Tier 3: Together Qwen3.5 9B | Yes | Yes |
| Tier 4: Together Maverick 17Bx128E | No | Yes |
| Tier 5: Kimi K2 | No | Yes |
| Tier 6: Edith / Kimi K2.5 | No | Yes |

### 4.3 Billing Infrastructure

- **Stripe**: Primary payment processor for USD-based plans. Supports checkout sessions, webhook-based status sync, and automatic reversion to free on subscription cancellation.
- **Razorpay**: Secondary payment processor for INR-based plans targeting the Indian market. Supports order creation and HMAC signature verification.
- **Webhook events handled**: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
- **Feature gating**: The `isPaidPlan()` function checks `subscription_plan` and `subscription_status` to gate premium features (image generation, voice, premium LLMs).

---

## 5. Core Features

### 5.1 Chat

| Attribute | Detail |
|-----------|--------|
| **User goal** | Converse naturally with AI agents to get answers, advice, and task completion |
| **Business value** | Core product engagement loop; every other feature is accessible through chat |
| **Primary actors** | All users (web + Telegram) |
| **Main flow** | User sends message -> intent detection -> system prompt assembly (personality + memory context) -> LLM waterfall routing -> response with optional action blocks -> credit deduction |
| **Dependencies** | LLM service, memory service, personality engine, credit service |
| **Current limitations** | Streaming support exists but is provider-dependent; very long conversations are trimmed to fit context windows |

### 5.2 Reminders

| Attribute | Detail |
|-----------|--------|
| **User goal** | Set time-based reminders through natural language ("remind me to call the dentist Friday 3pm") |
| **Business value** | High-retention feature; daily touchpoint that brings users back |
| **Primary actors** | All users |
| **Main flow** | Natural language or `/remind` command -> date/time parsing -> stored in `reminders` table -> Telegram notification at trigger time |
| **Dependencies** | Proactive engine (for delivery), Telegram channel link |
| **Current limitations** | Time parsing relies on LLM extraction; timezone handling defaults to Asia/Kolkata |

### 5.3 Automations

| Attribute | Detail |
|-----------|--------|
| **User goal** | Set up trigger-action workflows without writing code |
| **Business value** | Power-user retention; moves users from chat to platform dependency |
| **Primary actors** | Paid users (feature gated) |
| **Main flow** | User creates automation via API -> trigger registered (cron timer, keyword watch, webhook endpoint, health monitor) -> on trigger, action executes (API call, Telegram message, reminder creation, portfolio update) |
| **Dependencies** | Automations engine, Telegram service, webhook infrastructure |
| **Current limitations** | Cron triggers use simplified interval_minutes (not full cron expressions); health checks need external URL targets |

See [Section 7: Automation Engine](#7-automation-engine) for detailed trigger/action documentation.

### 5.4 Portfolio

| Attribute | Detail |
|-----------|--------|
| **User goal** | Build and share a public professional profile with AI-powered visitor interaction |
| **Business value** | Viral growth channel; public profiles drive organic traffic and new signups |
| **Primary actors** | All users (creation); public visitors (viewing) |
| **Main flow** | User configures portfolio (headline, about, skills, projects, milestones, social links) -> public URL generated -> visitors can view and optionally chat with user's AI agent -> view tracking with IP-based dedup |
| **Dependencies** | Portfolio routes, LLM service (for visitor chat), media generation |
| **Current limitations** | Agent-powered visitor chat uses guest tokens; no custom domain support yet |

See [Section 8: Portfolio System](#8-portfolio-system) for detailed documentation.

### 5.5 Integrations (Web Research)

| Attribute | Detail |
|-----------|--------|
| **User goal** | Search the web, extract content from URLs, get summaries of web pages |
| **Business value** | Differentiator from basic chatbots; users stay in Agentin instead of switching to a browser |
| **Primary actors** | All users |
| **Main flow** | Research intent detected -> Tavily search or crawl4ai extraction -> results formatted and delivered |
| **Providers** | Tavily (API search), SearXNG (self-hosted meta-search), crawl4ai (URL extraction with fallback to raw HTML strip), Firecrawl (additional URL extraction) |
| **Dependencies** | External API keys (Tavily), or self-hosted services (SearXNG, crawl4ai) |
| **Current limitations** | Tavily requires an API key; crawl4ai depends on a local Docker container |

### 5.6 Memory

| Attribute | Detail |
|-----------|--------|
| **User goal** | The AI remembers personal facts, preferences, and past conversations |
| **Business value** | Personalization creates switching cost; users feel understood over time |
| **Primary actors** | All users (automatic) |
| **Main flow** | After each conversation, the system extracts facts (via LLM or local Ollama) -> stored in `agent_memory` table with category, key, value, confidence -> memory context injected into future system prompts |
| **Memory types** | Short-term (session context), long-term (persistent facts in agent_memory), episodic (full conversation log) |
| **Dependencies** | Memory service, LLM (for extraction), vector search (for semantic recall) |
| **Current limitations** | Memory extraction quality depends on provider; vector search requires index maintenance |

### 5.7 Media Generation

| Attribute | Detail |
|-----------|--------|
| **User goal** | Generate images and videos from text prompts |
| **Business value** | Premium feature that justifies paid tiers; creative use cases |
| **Primary actors** | Paid users (feature gated for generation) |
| **Main flow** | User provides a text prompt -> Pollinations.AI (free, no API key) with HuggingFace FLUX.1-schnell fallback -> image saved to cache directory -> URL returned |
| **Providers** | Pollinations.AI (primary, free), HuggingFace FLUX (fallback) |
| **Dependencies** | External API availability, file system for image cache |
| **Current limitations** | Video generation is limited by Pollinations availability; no inpainting or editing |

### 5.8 Voice

| Attribute | Detail |
|-----------|--------|
| **User goal** | Send voice messages instead of typing; receive spoken responses |
| **Business value** | Accessibility and mobile-first UX; critical for Indian market adoption |
| **Primary actors** | Telegram users |
| **Main flow** | (STT) Voice note sent in Telegram -> file downloaded -> transcribed via Groq Whisper Large v3 Turbo -> text processed normally. (TTS) Response text -> edge-tts (Microsoft neural voices) -> audio file sent back via Telegram |
| **Dependencies** | Groq API key (for STT), edge-tts binary (for TTS), Telegram bot |
| **Current limitations** | Requires at least one Groq API key; voice is Telegram-only (no web dashboard voice yet) |

### 5.9 Billing and Credits

| Attribute | Detail |
|-----------|--------|
| **User goal** | Manage subscription, view credit balance, upgrade/downgrade plan |
| **Business value** | Revenue generation; clear credit visibility reduces support tickets |
| **Primary actors** | All users |
| **Main flow** | User selects plan -> Stripe/Razorpay checkout session -> webhook confirms payment -> subscription activated -> credits allocated -> feature gates unlocked |
| **Dependencies** | Stripe, Razorpay, credit-service |
| **Current limitations** | Plan changes mid-cycle handled by Stripe; no in-app credit purchase (credits are subscription-tied) |

### 5.10 Analytics

| Attribute | Detail |
|-----------|--------|
| **User goal** | Understand personal productivity patterns and AI usage |
| **Business value** | Engagement metric; helps users see value from the product |
| **Primary actors** | All users |
| **Main flow** | Read-only queries aggregating data from reminders, conversation_log, inbox_messages, focus_sessions, habit_logs, notes, and user_workflow_runs tables |
| **Key metrics** | Daily snapshots (tasks completed, reminders created, messages, focus minutes, habits logged, agent calls, notes created), weekly summaries (top agent, total focus hours, task completion rate, longest habit streak, most active day), activity heatmap, agent usage breakdown |
| **Dependencies** | Analytics service, all feature tables |
| **Current limitations** | AI insight generation is rule-based (not LLM-powered); heatmap intensity is normalized to 0-4 scale |

### 5.11 Focus Sessions

| Attribute | Detail |
|-----------|--------|
| **User goal** | Start a timed focus/pomodoro session with tracking |
| **Business value** | Productivity habit formation; daily engagement driver |
| **Primary actors** | All users |
| **Main flow** | `/focus <minutes>` command or natural language -> session created in `focus_sessions` table -> timer tracked -> completion logged |
| **Dependencies** | Telegram cards (for inline controls) |
| **Current limitations** | Timer enforcement is client-side; server records start/end only |

### 5.12 Habit Tracking

| Attribute | Detail |
|-----------|--------|
| **User goal** | Create habits, log daily completions, track streaks |
| **Business value** | Daily return loop; streak mechanics create retention |
| **Primary actors** | All users |
| **Main flow** | Create habit -> daily logging via Telegram inline buttons or chat -> streak calculation -> morning briefing shows unlogged habits |
| **Dependencies** | Habit tables, Telegram cards, morning briefing |
| **Current limitations** | Habits are binary (done/not done); no partial or quantified tracking |

### 5.13 Expense Tracking

| Attribute | Detail |
|-----------|--------|
| **User goal** | Log expenses through natural language or receipt photos |
| **Business value** | Financial awareness feature; differentiator for Indian market |
| **Primary actors** | All users |
| **Main flow** | User says "spent 500 on groceries" or sends a receipt photo -> amount, category, and merchant extracted -> stored in expenses table -> monthly reports available |
| **Dependencies** | Action parser, Telegram (for receipt photos), Pulse agent |
| **Current limitations** | Receipt OCR depends on LLM vision capabilities; merchant categorization is semi-automated |

### 5.14 Notes and Inbox

| Attribute | Detail |
|-----------|--------|
| **User goal** | Quick-capture notes and manage incoming messages |
| **Business value** | Low-friction capture increases daily touchpoints |
| **Primary actors** | All users |
| **Main flow** | `/note <text>` or natural language -> stored in notes table -> searchable via memory system |
| **Dependencies** | Notes table, memory service, inbox service |
| **Current limitations** | No rich text or attachments in notes |

---

## 6. Telegram Integration

### 6.1 Architecture

The Telegram bot operates via webhooks (not polling). When Telegram sends an update to the registered webhook URL, the server normalizes the message and routes it through the unified message router.

Supported update types: text messages, voice notes, photos (for receipt OCR), documents, callback queries (inline button taps), and bot commands.

### 6.2 Bot Commands

| Command | Description |
|---------|------------|
| `/start` | Begin onboarding flow; supports deep links (`/start link_XXXXXX`) |
| `/link` | Link Telegram account to Agentin web account |
| `/unlink` | Disconnect Telegram from web account |
| `/help` | Show all available commands |
| `/credits` | Check current credit balance |
| `/status` | View connection status |
| `/remind <text>` | Set a reminder (e.g., `/remind call dentist Friday 3pm`) |
| `/note <text>` | Save a quick note |
| `/focus <minutes>` | Start a timed focus session |
| `/habit <name>` | Log a habit completion |
| `/brief` | Get personalized daily briefing |
| `/search <query>` | Search across all user data |
| `/habits` | View all habits with current streaks |
| `/notes` | View recent notes |
| `/expenses` | Monthly expense report |
| `/study` | Study dashboard |

### 6.3 Inline Keyboards

Telegram messages include interactive inline keyboard buttons for quick actions. These are used in:

- **Reminder cards**: Buttons to mark complete, snooze, or delete
- **Habit cards**: Buttons to log completion for each habit
- **Expense cards**: Buttons to confirm, edit category, or discard
- **Focus cards**: Buttons to start, pause, or end focus sessions
- **Morning briefing**: Quick-action buttons for the day's priorities
- **Onboarding flow**: Step-by-step setup with button-based choices

Card state is tracked in the `telegram_messages` table (chat_id, message_id, entity_type, entity_id) so buttons can update the original message on tap.

### 6.4 Voice Notes

Users send voice messages directly in Telegram. The flow:

1. Telegram sends the voice file metadata (file_id, duration, mime_type)
2. Server downloads the audio via Telegram Bot API (`getFile` -> download URL)
3. Audio sent to Groq Whisper Large v3 Turbo for transcription (round-robin across up to 3 Groq API keys)
4. Transcribed text processed as a normal message through the message router
5. Response can optionally be spoken back via edge-tts (Microsoft neural voices, zero API cost)

### 6.5 Receipt OCR

When a user sends a photo in Telegram, the system checks if it looks like a receipt or expense document. The photo is downloaded, and the LLM extracts structured expense data (amount, merchant, category, date).

### 6.6 Proactive Nudges

The proactive engine (`proactive-engine.ts`) sends messages to users without being prompted. Types of proactive messages:

| Type | Trigger | Content |
|------|---------|---------|
| `daily_briefing` | 8am user-local time | Personalized morning briefing with reminders, habits, calendar |
| `overdue_alert` | Reminder past due | Notification about overdue reminders |
| `idle_check_in` | Extended inactivity | Gentle re-engagement message |
| `weekly_report` | End of week | Summary of productivity metrics |
| `streak_milestone` | Habit streak milestone | Celebration of habit streak achievements |
| `expense_spike` | Unusual spending detected | Alert about spending patterns |

Proactive messages respect:
- User's `proactive_enabled` setting (opt-out)
- Agent config `autonomy_level` (manual = no proactive messages)
- Quiet hours (`quiet_start`, `quiet_end` in agent_configs)

### 6.7 Daily Briefing

The morning briefing (`morning-brief.ts`) assembles a rich message including:

1. Today's reminders (sorted by time)
2. Overdue reminder count
3. Upcoming reminders this week (next 7 days, max 5)
4. Habit status with current streaks (highlights unlogged habits)
5. Time-appropriate greeting (alternating Hinglish/English)
6. Indian festival greeting when applicable
7. Inline keyboard buttons for quick actions (log habits, start focus)

---

## 7. Automation Engine

### 7.1 Overview

The automations engine (`automations-engine.ts`) turns user-defined trigger-action rules into an execution platform. Automations are stored in the database and activated based on their trigger type.

### 7.2 Trigger Types

| Trigger | How It Works | Configuration |
|---------|-------------|--------------|
| **cron / time** | Interval-based timer (registered via `setInterval`) | `interval_minutes`: how often to fire |
| **keyword** | Message text matching | `keyword`: string to match in user messages |
| **webhook** | External HTTP POST to automation endpoint | Automation ID used as webhook path |
| **health_down** | URL health monitoring | `target_url`: URL to check; fires when endpoint returns non-200 |
| **manual** | User-triggered on demand | No config needed; fired via API call |
| **portfolio_visit** | Fires when someone visits user's public portfolio | Automatic based on portfolio view events |

### 7.3 Action Types

| Action | What It Does | Configuration |
|--------|-------------|--------------|
| **call_api / n8n-webhook** | HTTP request to external URL with exponential backoff retry (3 attempts) | `url`, `method`, `headers`, `body` |
| **telegram-message** | Send a message to user's linked Telegram account | `message` |
| **whatsapp-message** | Send a message via WhatsApp channel | `message` |
| **log** | Record to automation execution log | `message` |
| **send_message** | Generic message delivery | `message` |
| **create_reminder** | Automatically create a reminder | `reminder_text` |
| **portfolio-update** | Update portfolio fields programmatically | `field` (headline/about), `value` |

### 7.4 Execution Details

- **Retry logic**: API calls use exponential backoff (1s, 2s delays) with max 3 attempts. Only 5xx errors and network errors are retried; 4xx client errors fail immediately.
- **Dead letter queue**: Failed webhook/API calls are logged to `webhook_dead_letters` table for debugging.
- **Execution tracking**: Every run records success/failure, output text, and duration in `automation_runs`. The automation's `run_count`, `last_run`, and `last_status` are updated.
- **Channel context**: When a trigger fires from a specific channel (e.g., Telegram keyword match), the channel context is injected into the webhook payload.

---

## 8. Portfolio System

### 8.1 What It Is

Every Agentin user can create a public portfolio -- a professional profile page accessible via a public URL. The portfolio serves as a personal website with AI-powered visitor interaction.

### 8.2 Portfolio Components

| Component | Description |
|-----------|------------|
| **Headline** | One-line professional title |
| **About** | Extended bio/description |
| **Skills** | Array of skill tags (max 30, stored as JSON) |
| **Projects** | Showcase of work with title, description, tags, live URL, repo URL (stored as JSON) |
| **Milestones** | Career or personal achievements (stored as JSON) |
| **Social links** | External profile links (stored as JSON) |
| **Visibility settings** | Per-section visibility controls (stored as JSON) |
| **Theme** | Accent color (hex code) |

### 8.3 AI-Powered Visitor Chat

When `agent_enabled` is true on a portfolio, public visitors can chat with the user's AI agent. The agent uses the portfolio owner's personality, memory, and context to respond on their behalf. Visitors receive a guest JWT token for the session.

### 8.4 Portfolio Analytics

- **View tracking**: `view_count` with IP-based deduplication (same IP within 1 hour does not increment)
- **Contact tracking**: `contact_count` for visitor inquiries
- **Project count**: Number of showcase projects
- **Last viewed**: Timestamp of most recent visit
- **30-day daily breakdown**: Daily view stats for the trailing 30 days

### 8.5 Portfolio Actions via Chat

Users can manage their portfolio through conversation. The action parser supports:

- `portfolio_add_project` -- Add a new project (title, description, tags, URLs)
- `portfolio_update_bio` -- Update the about/bio section
- `portfolio_update_skills` -- Replace the skills array
- `portfolio_remove_project` -- Remove a project by title
- `portfolio_update_theme` -- Change the accent color

### 8.6 Security

- HTML sanitization on all portfolio fields (script tags, iframes, javascript: URIs, event handlers stripped)
- Safe HTML whitelist: b, i, em, strong, p, br, ul, ol, li, a
- Authenticated routes for editing (`requireAuth` middleware)
- Public routes for viewing (no auth required)
- Cache-Control: `private, no-store` on authenticated portfolio data

---

## 9. Multi-Agent Council

### 9.1 What It Is

The Multi-Agent Council (also called "Launch Mode") allows users to get parallel responses from multiple specialist agents on a single question. Instead of one agent answering, 2-3 agents each contribute their domain expertise, and the results are merged into a unified response.

### 9.2 Trigger Phrases

Users activate council mode by saying:

- "launch mode", "all agents", "multi-agent", "parallel agents"
- "get all perspectives", "team response", "agent team"
- "agent council", "council mode", "war room"
- "brainstorm with all agents", "what do all agents think"
- Hinglish: "sab kuch plan karo", "sab agents bulao", "mera plan bana do", "full analysis karo", "deep dive karo"

The system also auto-detects council-worthy queries:
- "research X and create/write/draft Y"
- "compare", "pros and cons", "advantages and disadvantages"
- "should I X or Y" (complex decision queries)
- "analyze X and recommend/suggest"
- "plan my X strategy/approach/roadmap"

### 9.3 Agent Task Planning

Based on the query domain, the system selects the right specialist combination:

| Query Domain | Agents Selected | Roles |
|-------------|-----------------|-------|
| Website / Marketing / Product | Forge + Aria + Pulse | Technical Architect, Creative Director, Data Analyst |
| Learning / Research | Nova + Pulse + Echo | Research Lead, Analyst, Learning Coach |
| Finance / Budgeting | Edith + Jarvis + Pulse | Financial Analyst, Expense Tracker, Metrics Expert |
| Health / Fitness / Wellness | Nova + Echo + Cal | Research Lead, Coaching, Scheduling |

### 9.4 Execution Flow

1. User message detected as council-worthy
2. `planAgentTasks()` selects 2-3 agents and generates specialized sub-prompts for each
3. All agent tasks run in parallel via `Promise.all`
4. Each agent gets the user's message plus its own role-specific prompt and personality prompt
5. Results collected into `OrchestratorResult` with per-agent outputs
6. Agent state bus emits thinking/responding/done events for office canvas visualization
7. Merged response delivered to user with agent attribution

---

## 10. Hinglish and India Support

### 10.1 Language Routing

The system supports Hinglish (Hindi-English mix) throughout:

- **Greetings**: Time-appropriate greetings alternate between Hindi ("Suprabhat!", "Namaste!", "Shubh Sandhya!") and English, chosen randomly with 50% probability
- **Launch mode triggers**: Hindi phrases like "sab kuch plan karo" and "sab agents bulao" are recognized
- **Festival greetings**: Hindi festival names included alongside English (e.g., "Diwali / Deepavali")

### 10.2 Indian Festival Calendar

A comprehensive calendar (`festival-calendar.ts`) covers 2026 events:

| Date | Festival | Type | Proactive Action |
|------|---------|------|-----------------|
| Jan 26 | Republic Day | National | Block in calendar |
| Mar 6 | Holi | Religious | Gifting reminder 3 days before |
| Mar 15 | IPL 2026 Start | Sports | Ask about match reminders |
| Mar 30 | Eid ul-Fitr | Religious | -- |
| Mar 31 | Financial Year End | Business | Tax filing reminder from Feb 1 |
| Apr 14 | Ambedkar Jayanti | National | -- |
| Apr 14 | Baisakhi | Regional (North) | -- |
| Apr 15 | Good Friday | National | -- |
| Jul 31 | ITR Filing Deadline | Business | Countdown from July 1 |
| Aug 15 | Independence Day | National | Flag hoisting reminder |
| Oct 2 | Gandhi Jayanti | National | -- |
| Oct 20 | Dussehra | Religious | Shopping budget check 5 days before |
| Nov 8 | Diwali | Religious | Gifting list + budget 2 weeks before |
| Nov 9 | Govardhan Puja | Regional (North) | -- |
| Dec 25 | Christmas | National | -- |

Each festival includes: English name, Hindi name, type (religious/national/business/regional/sports), region scope, agent context string, and optional proactive action.

### 10.3 Razorpay Integration

For Indian users paying in INR:

- **Order creation**: `createRazorpayOrder(amountINR, userId, plan)` creates a Razorpay order with amount in paise (INR * 100)
- **Signature verification**: HMAC-SHA256 with constant-time comparison (`timingSafeEqual`) to prevent timing attacks
- **Receipt format**: `agentin_{userId}_{plan}_{timestamp}`
- **Feature flag**: `razorpayEnabled` checks for `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` environment variables

### 10.4 Locale Defaults

- Default timezone: `Asia/Kolkata`
- Date formatting: `en-IN` locale (e.g., "27 Mar 2026")
- Currency: INR via Razorpay; USD via Stripe

---

## 11. Feature Matrix

### Availability by Subscription Tier

| Feature | Free | Pilot | Intro | Monthly+ |
|---------|:----:|:-----:|:-----:|:--------:|
| AI Chat (free-tier LLMs) | Yes | Yes | Yes | Yes |
| AI Chat (premium LLMs) | -- | -- | -- | Yes |
| Agent Personalities (switching) | Yes | Yes | Yes | Yes |
| Auto-Delegation | 10/day | 50/day | 50/day | 200/day |
| Reminders | Yes | Yes | Yes | Yes |
| Notes | Yes | Yes | Yes | Yes |
| Habit Tracking | Yes | Yes | Yes | Yes |
| Focus Sessions | Yes | Yes | Yes | Yes |
| Expense Tracking | Yes | Yes | Yes | Yes |
| Web Research (Tavily/SearXNG) | Yes | Yes | Yes | Yes |
| Memory (auto-extraction) | Yes | Yes | Yes | Yes |
| Voice (STT via Groq Whisper) | Yes | Yes | Yes | Yes |
| Voice (TTS via edge-tts) | Yes | Yes | Yes | Yes |
| Image Generation | -- | Yes | Yes | Yes |
| Video Generation | -- | Yes | Yes | Yes |
| Portfolio (public profile) | Yes | Yes | Yes | Yes |
| Portfolio AI Visitor Chat | Yes | Yes | Yes | Yes |
| Automations Engine | -- | Yes | Yes | Yes |
| Multi-Agent Council | Yes | Yes | Yes | Yes |
| Morning Briefing | Yes | Yes | Yes | Yes |
| Proactive Nudges | Yes | Yes | Yes | Yes |
| Analytics Dashboard | Yes | Yes | Yes | Yes |
| Gate API (external access) | -- | -- | -- | Yes |
| Telegram Bot | Yes | Yes | Yes | Yes |
| Indian Festival Calendar | Yes | Yes | Yes | Yes |
| Razorpay (INR payments) | -- | Yes | Yes | Yes |
| Stripe (USD payments) | -- | Yes | Yes | Yes |
| Monthly Credits | 5,000 | Tier-based | Tier-based | 50,000 |
| Trial Period | -- | 3 days | 3 days | 3 days |

### Notes on Gating

- **Image/video generation** and **premium LLM access** are gated by the `isPaidPlan()` check
- **Automations** require a paid plan for creation; existing free-tier automations continue to execute
- **Gate API** provides external developer access with Bearer token authentication (`agtn_` prefix) and 60 req/min rate limiting
- **Credit-based soft gating**: Even when a feature is technically available, credit exhaustion degrades the experience to free-tier providers only

---

## Related Documents

- **[SOLUTION_ARCHITECTURE.md](./SOLUTION_ARCHITECTURE.md)** -- System architecture, component diagrams, data flow, and infrastructure
- **[API_REFERENCE.md](./API.md)** -- REST API endpoints, request/response schemas, authentication
- **[TESTING.md](./TESTING.md)** -- Test strategy, coverage targets, and test execution guide
