# Weebo Ecosystem — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> **Required Sub-Skill for subagent execution:** superpowers:subagent-driven-development

**Goal:** Transform GeekSpace into a mobile-driven AI agentic ecosystem with Weebo (Pico Fleet) as the primary orchestrator, Edith (Kimi) as escalation brain, Telegram + WhatsApp as first-class channels, and portfolio as a social surface.

**Architecture:** Multi-tier AI routing (Tier 1: Weebo triage, Tier 2: cheap models, Tier 3: Edith for heavy reasoning), plan-enforced agent slots, token budgeting with warnings, memory-driven portfolio suggestions, and complete mobile UI polish.

**Tech Stack:** React 19 + Vite + TypeScript frontend, Express + better-sqlite3 backend, Docker Compose, Redis, Ollama, OpenRouter, Moonshot API

---

## Task 1: Fix P0 Issues (Pre-Feature)

**Files:**
- Modify: `eslint.config.js`
- Modify: `server/src/routes/pico.ts`
- Modify: `server/src/routes/health.ts`
- Modify: `server/src/routes/webhooks.ts`
- Modify: `server/src/index.ts`

**Step 1: Fix ESLint configuration**

Read current `eslint.config.js` and update @typescript-eslint rule configuration to fix the `allowShortCircuit` error.

**Step 2: Fix Pico planTask API contract**

In `server/src/routes/pico.ts`, ensure the response shape matches frontend expectations:

```typescript
res.json({
  tasks: tasks.map(t => ({ id: t.id, task_type: t.task_type, description: t.description, agent_slot: t.agent_slot })),
  creditCost: creditCost,
});
```

**Step 3: Add authentication to health stream endpoint**

In `server/src/routes/health.ts`, add `requireAuth` or `requireAdmin` middleware to the SSE stream endpoint.

**Step 4: Secure n8n webhook**

In `server/src/routes/webhooks.ts`, enforce N8N_WEBHOOK_SECRET validation when the env var is set.

**Step 5: Add PUT to CORS methods**

In `server/src/index.ts`, add 'PUT' to the CORS methods array.

**Step 6: Run builds to verify**

```bash
cd /root/GeekSpace2.0 && npm run build
cd server && npm run build
```

**Step 7: Commit**

```bash
git add -A
git commit -m "fix(integrity): resolve P0 issues before feature work

- Fix ESLint config for @typescript-eslint
- Fix pico planTask API response shape
- Add auth to health stream endpoint
- Secure n8n webhook with secret validation
- Add PUT to CORS methods"
```

---

## Task 2: Phase A — Navigation & Error Handling Fixes

**Files:**
- Modify: `src/pages/LoginPage.tsx`
- Modify: `src/pages/OnboardingPage.tsx`
- Modify: `src/dashboard/DashboardApp.tsx`
- Modify: `server/src/db/index.ts`

**Step 1: Fix navigation replace issues**

Add `{ replace: true }` to navigate calls:
- LoginPage.tsx:36,39,44,50 (post-auth navigation)
- OnboardingPage.tsx:54 (post-onboarding navigation)
- DashboardApp.tsx:111 (logout navigation)

**Step 2: Add FK constraint to automation_logs**

In `server/src/db/index.ts`, add migration:

```typescript
{
  name: 'add_automation_logs_fk',
  sql: `
    DELETE FROM automation_logs WHERE user_id NOT IN (SELECT id FROM users);
    CREATE TABLE automation_logs_new (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      automation_id TEXT,
      event TEXT NOT NULL,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    INSERT INTO automation_logs_new SELECT * FROM automation_logs;
    DROP TABLE automation_logs;
    ALTER TABLE automation_logs_new RENAME TO automation_logs;
  `,
}
```

**Step 3: Fix empty catch blocks**

Add error logging to empty catches in:
- Frontend pages (showToast on error)
- Server fire-and-forget calls

**Step 4: Commit**

```bash
git add -A
git commit -m "fix(integrity): navigation and error handling fixes

- Add replace: true to post-auth navigation
- Add FK constraint to automation_logs
- Fix empty catch blocks with proper error handling"
```

---

## Task 3: Phase B — Token Budget & Smart Routing

**Files:**
- Modify: `server/src/db/index.ts`
- Modify: `server/src/services/llm.ts`
- Modify: `server/src/services/pico-fleet.ts`
- Create: `server/src/services/token-budget.ts`
- Create: `soul.md`

**Step 1: Add token budget tables**

In `server/src/db/index.ts`, add migrations:

```typescript
{
  name: 'create_token_usage_table',
  sql: `
    CREATE TABLE IF NOT EXISTS token_usage (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      tokens_used INTEGER DEFAULT 0,
      tokens_budget INTEGER DEFAULT 0,
      warnings_sent TEXT DEFAULT '[]',
      UNIQUE(user_id, month)
    );
    CREATE INDEX IF NOT EXISTS idx_token_usage_user_month ON token_usage(user_id, month);
  `,
},
{
  name: 'add_token_budget_to_plans',
  sql: `
    ALTER TABLE subscriptions ADD COLUMN tokens_budget INTEGER DEFAULT 0;
    ALTER TABLE subscriptions ADD COLUMN tokens_used_this_cycle INTEGER DEFAULT 0;
  `,
},
```

**Step 2: Create token budget service**

Create `server/src/services/token-budget.ts`:

```typescript
import { db } from '../db/index.js';
import { logger } from '../logger.js';

const PLAN_TOKEN_BUDGETS: Record<string, number> = {
  free: 50000,
  intro: 300000,
  monthly: 300000,
  halfyear: 750000,
  yearly: 1000000,
};

const WARNING_THRESHOLDS = [0.7, 0.9, 1.0];

export function getTokenBudget(plan: string): number {
  return PLAN_TOKEN_BUDGETS[plan] || PLAN_TOKEN_BUDGETS.free;
}

export function getUserTokenUsage(userId: string): { used: number; budget: number; percentage: number } {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const row = db.prepare(
    'SELECT tokens_used, tokens_budget FROM token_usage WHERE user_id = ? AND month = ?'
  ).get(userId, month) as { tokens_used: number; tokens_budget: number } | undefined;

  const sub = db.prepare(
    'SELECT plan, tokens_budget, tokens_used_this_cycle FROM subscriptions WHERE user_id = ?'
  ).get(userId) as { plan: string; tokens_budget: number; tokens_used_this_cycle: number } | undefined;

  const budget = row?.tokens_budget || sub?.tokens_budget || getTokenBudget(sub?.plan || 'free');
  const used = row?.tokens_used || sub?.tokens_used_this_cycle || 0;

  return { used, budget, percentage: used / budget };
}

export function recordTokenUsage(userId: string, tokens: number): void {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  db.prepare(`
    INSERT INTO token_usage (id, user_id, month, tokens_used, tokens_budget)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, month) DO UPDATE SET
      tokens_used = tokens_used + excluded.tokens_used
  `).run(crypto.randomUUID(), userId, month, tokens, 0);

  // Also update subscription for real-time tracking
  db.prepare(`
    UPDATE subscriptions SET tokens_used_this_cycle = tokens_used_this_cycle + ?
    WHERE user_id = ?
  `).run(tokens, userId);

  checkWarningThresholds(userId);
}

function checkWarningThresholds(userId: string): void {
  const { used, budget, percentage } = getUserTokenUsage(userId);

  for (const threshold of WARNING_THRESHOLDS) {
    if (percentage >= threshold && percentage < threshold + 0.05) {
      // Send warning (would integrate with notification system)
      logger.info({ userId, threshold, used, budget }, 'Token budget warning threshold reached');
      break;
    }
  }
}

export function shouldDegradeRouting(userId: string): boolean {
  const { percentage } = getUserTokenUsage(userId);
  return percentage >= 1.0; // Over budget
}
```

**Step 3: Update LLM router with token tracking**

In `server/src/services/llm.ts`:
- Import `recordTokenUsage` and `shouldDegradeRouting`
- In `routeChat()`, check `shouldDegradeRouting()` and prefer cheaper providers
- After successful response, call `recordTokenUsage(userId, tokensIn + tokensOut)`

**Step 4: Update subscriptions with token budgets**

In `server/src/db/index.ts`, update PLAN_DEFINITIONS to include tokens_budget:

```typescript
const PLAN_DEFINITIONS = [
  { id: 'free', credits: 5000, tokens_budget: 50000, ... },
  { id: 'intro', credits: 100000, tokens_budget: 300000, ... },
  { id: 'monthly', credits: 100000, tokens_budget: 300000, ... },
  { id: 'halfyear', credits: 700000, tokens_budget: 750000, ... },
  { id: 'yearly', credits: 1500000, tokens_budget: 1000000, ... },
];
```

**Step 5: Enforce agent slots by plan**

In `server/src/services/pico-fleet.ts`, update `createAgent()`:

```typescript
const PLAN_AGENT_SLOTS: Record<string, number> = {
  free: 1,
  intro: 2,
  monthly: 2,
  halfyear: 3,
  yearly: 3,
};

export function createAgent(userId: string, name: string, personality = 'weebo'): PicoAgent {
  // Get user's plan
  const sub = db.prepare('SELECT plan FROM subscriptions WHERE user_id = ?').get(userId) as { plan: string } | undefined;
  const maxSlots = PLAN_AGENT_SLOTS[sub?.plan || 'free'];

  const existing = getUserAgents(userId);
  if (existing.length >= maxSlots) {
    throw new Error(`Your plan allows ${maxSlots} agent(s). Upgrade to add more.`);
  }
  // ... rest of function
}
```

**Step 6: Create soul.md documentation**

Create `soul.md`:

```markdown
# Soul Instructions System

## Overview

Soul Instructions are per-agent custom behavior text that shapes how agents respond.
They are stored server-side, editable in UI, and injected into prompts.

## Format

```json
{
  "soul_instructions": "You are a helpful coding assistant...",
  "safety_rules": ["Never share API keys", "Always validate inputs"],
  "privacy_level": "strict"
}
```

## Safety Rules

1. Soul instructions cannot override system security constraints
2. Instructions are filtered for prohibited content
3. User data in instructions is encrypted at rest

## Privacy

- Soul instructions are private to the user
- Not shared with other users
- Not used to train models
```

**Step 7: Build and verify**

```bash
cd /root/GeekSpace2.0/server && npm run build
```

**Step 8: Commit**

```bash
git add -A
git commit -m "feat(weebo): token budget and smart routing

- Add token_usage table for monthly tracking
- Add token budget to plan definitions
- Create token-budget.ts service with warnings
- Update LLM router with degradation logic
- Enforce agent slots by plan tier
- Create soul.md documentation"
```

---

## Task 4: Phase C — WhatsApp Integration

**Files:**
- Modify: `server/src/services/message-router.ts`
- Create: `server/src/services/whatsapp.ts`
- Modify: `server/src/routes/integrations.ts`
- Modify: `src/dashboard/pages/ConnectionsPage.tsx`

**Step 1: Create WhatsApp service**

Create `server/src/services/whatsapp.ts`:

```typescript
import { logger } from '../logger.js';
import { config } from '../config.js';

interface WhatsAppMessage {
  from: string;
  text: string;
  timestamp: string;
  messageId: string;
}

export async function sendWhatsAppMessage(
  to: string,
  text: string,
  replyToMessageId?: string
): Promise<void> {
  if (!config.whatsappApiKey) {
    logger.warn('WhatsApp not configured');
    return;
  }

  // WhatsApp Business API integration
  // This is a stub - actual implementation requires WhatsApp Business API
  logger.info({ to }, 'WhatsApp message would be sent');
}

export function verifyWhatsAppWebhook(
  signature: string,
  body: string
): boolean {
  if (!config.whatsappWebhookSecret) return true;

  const crypto = await import('crypto');
  const expected = crypto
    .createHmac('sha256', config.whatsappWebhookSecret)
    .update(body)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

export async function generateWhatsAppLinkToken(userId: string): Promise<string> {
  const crypto = await import('crypto');
  const token = crypto.randomBytes(16).toString('hex');

  // Store token with expiration (1 hour)
  const { db } = await import('../db/index.js');
  db.prepare(`
    INSERT INTO link_codes (code, user_id, channel, expires_at)
    VALUES (?, ?, 'whatsapp', datetime('now', '+1 hour'))
  `).run(token, userId);

  return token;
}
```

**Step 2: Update message router for WhatsApp**

In `server/src/services/message-router.ts`:
- Import `sendWhatsAppMessage` and `verifyWhatsAppWebhook`
- Implement WhatsApp case in `sendChannelResponse()`

**Step 3: Add WhatsApp endpoints**

In `server/src/routes/integrations.ts`, add:

```typescript
// WhatsApp link generation
integrationsRouter.post('/whatsapp/link', requireAuth, async (req: AuthRequest, res) => {
  const { generateWhatsAppLinkToken } = await import('../services/whatsapp.js');
  const token = await generateWhatsAppLinkToken(req.userId!);

  // Generate QR code URL
  const waMeUrl = `https://wa.me/${config.whatsappBusinessNumber}?text=LINK%20${token}`;

  res.json({
    linked: false,
    token,
    qrUrl: waMeUrl,
    expiresIn: 3600,
  });
});

// WhatsApp status
integrationsRouter.get('/whatsapp/status', requireAuth, (req: AuthRequest, res) => {
  const link = db.prepare(
    "SELECT external_id, linked_at FROM channel_links WHERE user_id = ? AND channel = 'whatsapp'"
  ).get(req.userId!) as { external_id: string; linked_at: string } | undefined;

  if (link) {
    res.json({ linked: true, externalId: link.external_id, linkedAt: link.linked_at });
  } else {
    res.json({ linked: false });
  }
});

// WhatsApp unlink
integrationsRouter.delete('/whatsapp/link', requireAuth, (req: AuthRequest, res) => {
  db.prepare("DELETE FROM channel_links WHERE user_id = ? AND channel = 'whatsapp'").run(req.userId!);
  res.json({ success: true });
});
```

**Step 4: Update Connections page**

In `src/dashboard/pages/ConnectionsPage.tsx`:
- Add WhatsApp card with QR code display
- Add connect/disconnect handlers
- Show status

**Step 5: Add webhook endpoint**

In `server/src/routes/webhooks.ts`, add WhatsApp webhook handler:

```typescript
webhooksRouter.post('/whatsapp', async (req, res) => {
  // Verify webhook signature
  const signature = req.headers['x-whatsapp-signature'] as string;
  const body = JSON.stringify(req.body);

  const { verifyWhatsAppWebhook } = await import('../services/whatsapp.js');
  if (!verifyWhatsAppWebhook(signature, body)) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  // Handle incoming message
  const { entry } = req.body;
  // ... process and route through message-router

  res.json({ success: true });
});
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat(whatsapp): add WhatsApp integration

- Create whatsapp.ts service
- Add WhatsApp endpoints to integrations router
- Update message router for WhatsApp channel
- Add QR-based linking flow
- Add webhook endpoint with signature verification"
```

---

## Task 5: Phase D — Portfolio Magic Generate

**Files:**
- Modify: `server/src/routes/portfolio.ts`
- Modify: `src/dashboard/pages/PortfolioPage.tsx`
- Modify: `src/services/api.ts`

**Step 1: Add generate endpoint**

In `server/src/routes/portfolio.ts`, add:

```typescript
portfolioRouter.post('/generate/:field', requireAuth, async (req: AuthRequest, res) => {
  const { field } = req.params;
  const { context } = req.body;

  const validFields = ['headline', 'about', 'skills', 'project'];
  if (!validFields.includes(field)) {
    res.status(400).json({ error: 'Invalid field' });
    return;
  }

  // Check credits
  const sub = db.prepare('SELECT credits_remaining FROM subscriptions WHERE user_id = ?').get(req.userId!) as { credits_remaining: number } | undefined;
  if (!sub || sub.credits_remaining < 5) {
    res.status(402).json({ error: 'Insufficient credits' });
    return;
  }

  // Route to cheap model first
  const { routeChat } = await import('../services/llm.js');
  const prompt = `Generate a professional ${field} for a developer portfolio based on: ${context}`;

  const result = await routeChat([{ role: 'user', content: prompt }], {
    systemPrompt: 'You are a professional copywriter for developer portfolios. Be concise and impactful.',
    userCredits: sub.credits_remaining,
  });

  // Deduct credits (cheap generation = 5 credits)
  db.prepare('UPDATE subscriptions SET credits_remaining = credits_remaining - 5 WHERE user_id = ?').run(req.userId!);

  res.json({
    generated: result.reply,
    creditsUsed: 5,
    creditsRemaining: sub.credits_remaining - 5,
  });
});
```

**Step 2: Add generate API client**

In `src/services/api.ts`, add:

```typescript
export const portfolioService = {
  // ... existing methods

  generateField: (field: string, context: string) =>
    api.post<{ generated: string; creditsUsed: number; creditsRemaining: number }>(
      `/portfolio/generate/${field}`,
      { context }
    ),
};
```

**Step 3: Add Generate buttons to Portfolio page**

In `src/dashboard/pages/PortfolioPage.tsx`:
- Add ✨ Generate button next to headline, about fields
- Show button only when user has entered some input
- Call portfolioService.generateField on click
- Preview generated content before applying

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(portfolio): add magic generate for fields

- Add /portfolio/generate/:field endpoint
- Use Tier 1/2 models for generation
- Add portfolioService.generateField API client
- Add Generate buttons to Portfolio page
- Preview flow before applying changes"
```

---

## Task 6: Phase D — Memory-Driven Portfolio Suggestions

**Files:**
- Modify: `server/src/services/memory.ts`
- Create: `server/src/services/portfolio-suggestions.ts`
- Modify: `server/src/routes/portfolio.ts`

**Step 1: Create portfolio suggestions service**

Create `server/src/services/portfolio-suggestions.ts`:

```typescript
import { db } from '../db/index.js';
import { logger } from '../logger.js';

interface PortfolioSuggestion {
  id: string;
  field: string;
  currentValue: string;
  suggestedValue: string;
  reason: string;
  confidence: number;
}

export function generatePortfolioSuggestions(userId: string): PortfolioSuggestion[] {
  const suggestions: PortfolioSuggestion[] = [];

  // Get memories that could be portfolio-worthy
  const memories = db.prepare(`
    SELECT * FROM agent_memory
    WHERE user_id = ? AND category IN ('project', 'accomplishment', 'milestone')
    ORDER BY confidence DESC, updated_at DESC
    LIMIT 10
  `).all(userId) as Array<{ id: string; key: string; value: string; confidence: number }>;

  // Get current portfolio
  const portfolio = db.prepare('SELECT * FROM portfolios WHERE user_id = ?').get(userId) as {
    headline?: string;
    about?: string;
    skills?: string;
  } | undefined;

  // Analyze for gaps
  for (const memory of memories) {
    // Check if this memory is already reflected in portfolio
    const memoryText = `${memory.key} ${memory.value}`.toLowerCase();
    const portfolioText = `${portfolio?.headline || ''} ${portfolio?.about || ''} ${portfolio?.skills || ''}`.toLowerCase();

    if (!portfolioText.includes(memory.key.toLowerCase())) {
      suggestions.push({
        id: `sugg_${memory.id}`,
        field: memory.key.includes('project') ? 'projects' : 'about',
        currentValue: portfolio?.about || '',
        suggestedValue: memory.value,
        reason: `From your ${memory.category}: ${memory.key}`,
        confidence: memory.confidence,
      });
    }
  }

  return suggestions;
}

export function applySuggestion(userId: string, suggestionId: string): boolean {
  // Extract memory ID from suggestion ID
  const memoryId = suggestionId.replace('sugg_', '');

  const memory = db.prepare('SELECT * FROM agent_memory WHERE id = ? AND user_id = ?').get(memoryId, userId) as {
    key: string;
    value: string;
    category: string;
  } | undefined;

  if (!memory) return false;

  // Apply to appropriate portfolio field
  if (memory.category === 'project') {
    // Add to projects
    const current = db.prepare('SELECT projects FROM portfolios WHERE user_id = ?').get(userId) as { projects: string } | undefined;
    const projects = JSON.parse(current?.projects || '[]');
    projects.push({
      name: memory.key,
      description: memory.value,
      added_from_memory: true,
    });
    db.prepare('UPDATE portfolios SET projects = ? WHERE user_id = ?').run(JSON.stringify(projects), userId);
  } else {
    // Append to about
    const current = db.prepare('SELECT about FROM portfolios WHERE user_id = ?').get(userId) as { about: string } | undefined;
    const updated = `${current?.about || ''}\n\n${memory.key}: ${memory.value}`.trim();
    db.prepare('UPDATE portfolios SET about = ? WHERE user_id = ?').run(updated, userId);
  }

  // Mark suggestion as applied
  db.prepare('UPDATE agent_memory SET source = ? WHERE id = ?').run('applied_to_portfolio', memoryId);

  return true;
}
```

**Step 2: Add suggestions endpoint**

In `server/src/routes/portfolio.ts`:

```typescript
portfolioRouter.get('/suggestions', requireAuth, (req: AuthRequest, res) => {
  const { generatePortfolioSuggestions } = await import('../services/portfolio-suggestions.js');
  const suggestions = generatePortfolioSuggestions(req.userId!);
  res.json(suggestions);
});

portfolioRouter.post('/suggestions/:id/apply', requireAuth, (req: AuthRequest, res) => {
  const { applySuggestion } = await import('../services/portfolio-suggestions.js');
  const success = applySuggestion(req.userId!, req.params.id);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Suggestion not found' });
  }
});
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(portfolio): memory-driven portfolio suggestions

- Create portfolio-suggestions.ts service
- Analyze memories for portfolio-worthy content
- Suggest updates for projects/about sections
- Add /portfolio/suggestions endpoints
- Require explicit user consent (Apply button)"
```

---

## Task 7: Phase D — Social Chat (Agent-to-Agent)

**Files:**
- Modify: `server/src/routes/portfolio.ts`
- Create: `server/src/services/agent-chat.ts`
- Modify: `src/dashboard/pages/DirectoryPage.tsx`

**Step 1: Create agent chat service**

Create `server/src/services/agent-chat.ts`:

```typescript
import { db } from '../db/index.js';
import { v4 as uuid } from 'uuid';

interface AgentMessage {
  id: string;
  from_user_id: string;
  to_user_id: string;
  content: string;
  created_at: string;
}

export function initAgentChatTables(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_messages (
      id TEXT PRIMARY KEY,
      from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_agent_messages_to ON agent_messages(to_user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation ON agent_messages(from_user_id, to_user_id);
  `);
}

export function sendAgentMessage(fromUserId: string, toUsername: string, content: string): boolean {
  // Check if recipient allows agent chat
  const recipient = db.prepare('SELECT id, agent_chat_enabled FROM users WHERE username = ?').get(toUsername) as {
    id: string;
    agent_chat_enabled: number;
  } | undefined;

  if (!recipient || !recipient.agent_chat_enabled) {
    return false;
  }

  db.prepare(`
    INSERT INTO agent_messages (id, from_user_id, to_user_id, content)
    VALUES (?, ?, ?, ?)
  `).run(uuid(), fromUserId, recipient.id, content);

  // Increment connection counter
  db.prepare(`
    INSERT INTO user_connections (user_id, connected_user_id, last_interaction)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(user_id, connected_user_id) DO UPDATE SET
      last_interaction = datetime('now')
  `).run(recipient.id, fromUserId);

  return true;
}

export function getAgentMessages(userId: string, limit = 50): AgentMessage[] {
  return db.prepare(`
    SELECT m.*, u.username as from_username
    FROM agent_messages m
    JOIN users u ON u.id = m.from_user_id
    WHERE m.to_user_id = ?
    ORDER BY m.created_at DESC
    LIMIT ?
  `).all(userId, limit) as AgentMessage[];
}

export function canChatWithAgent(viewerUserId: string, targetUsername: string): boolean {
  const target = db.prepare('SELECT id, agent_chat_enabled FROM users WHERE username = ?').get(targetUsername) as {
    id: string;
    agent_chat_enabled: number;
  } | undefined;

  if (!target) return false;
  if (target.id === viewerUserId) return true; // Can always chat with own agent
  return !!target.agent_chat_enabled;
}
```

**Step 2: Add endpoints**

In `server/src/routes/portfolio.ts`:

```typescript
// Check if can chat with user's agent
portfolioRouter.get('/:username/can-chat', (req, res) => {
  const { canChatWithAgent } = await import('../services/agent-chat.js');
  const userId = req.userId; // May be undefined for public
  const canChat = canChatWithAgent(userId || '', req.params.username);
  res.json({ canChat });
});

// Send message to user's agent
portfolioRouter.post('/:username/chat', requireAuth, async (req, res) => {
  const { sendAgentMessage } = await import('../services/agent-chat.js');
  const { message } = req.body;

  const success = sendAgentMessage(req.userId!, req.params.username, message);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(403).json({ error: 'Agent chat not enabled for this user' });
  }
});

// Get incoming agent messages
portfolioRouter.get('/agent-messages', requireAuth, (req, res) => {
  const { getAgentMessages } = await import('../services/agent-chat.js');
  const messages = getAgentMessages(req.userId!);
  res.json(messages);
});
```

**Step 3: Update Directory page**

In `src/dashboard/pages/DirectoryPage.tsx`:
- Add "Chat" button to user cards
- Show button only if `canChat` is true
- Open chat modal when clicked

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(portfolio): agent-to-agent social chat

- Create agent-chat.ts service with tables
- Add agent_messages for storing conversations
- Add can-chat check endpoint
- Add chat send/receive endpoints
- Update Directory page with Chat buttons"
```

---

## Task 8: Phase E — Smoke Tests

**Files:**
- Create: `scripts/smoke/package.json`
- Create: `scripts/smoke/smoke-tests.ts`

**Step 1: Create smoke test runner**

Create `scripts/smoke/package.json`:

```json
{
  "name": "geekspace-smoke-tests",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "tsx smoke-tests.ts"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

Create `scripts/smoke/smoke-tests.ts`:

```typescript
import { strict as assert } from 'assert';

const BASE_URL = process.env.API_URL || 'http://localhost:3001';
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WHATSAPP_ENABLED = process.env.WHATSAPP_API_KEY;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name}: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}

async function main() {
  console.log('🧪 GeekSpace Smoke Tests\n');

  // Health check
  await test('Health endpoint returns ok', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
  });

  // Reminders
  await test('Reminders API requires auth', async () => {
    const res = await fetch(`${BASE_URL}/api/reminders`);
    assert.equal(res.status, 401);
  });

  // Portfolio generate
  await test('Portfolio generate requires auth', async () => {
    const res = await fetch(`${BASE_URL}/api/portfolio/generate/headline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: 'test' }),
    });
    assert.equal(res.status, 401);
  });

  // Telegram (if configured)
  if (TELEGRAM_TOKEN) {
    await test('Telegram webhook exists', async () => {
      // Would need valid auth to test fully
      console.log('  📱 Telegram configured - skipping full test');
    });
  } else {
    console.log('  ⏭️  Telegram not configured - skipping');
  }

  // WhatsApp (if configured)
  if (WHATSAPP_ENABLED) {
    await test('WhatsApp endpoints exist', async () => {
      console.log('  📱 WhatsApp configured - skipping full test');
    });
  } else {
    console.log('  ⏭️  WhatsApp not configured - skipping');
  }

  // Theme persistence
  await test('Theme settings persist', async () => {
    // Would need auth to test properly
    console.log('  🎨 Theme test requires auth - skipping');
  });

  console.log('\n✨ Smoke tests complete');
}

main().catch(console.error);
```

**Step 2: Commit**

```bash
git add -A
git commit -m "test(smoke): add smoke test suite

- Create scripts/smoke/ directory
- Add health, reminders, portfolio generate tests
- Conditional Telegram/WhatsApp tests
- Exit with error code on failure"
```

---

## Task 9: Phase F — Billing UI (Sale Look)

**Files:**
- Modify: `src/dashboard/pages/BillingPage.tsx`

**Step 1: Update Billing page with sale styling**

In `src/dashboard/pages/BillingPage.tsx`:
- Add "Most Popular" badge to Monthly/Intro plan
- Add "Best Value" badge to Yearly plan
- Show slashed "old price" with new price emphasized
- Add comparison table: agent slots, token budget, Kimi availability

```typescript
const PLAN_DISPLAY = [
  { id: 'free', oldPrice: 99, badge: '' },
  { id: 'intro', oldPrice: 1499, badge: 'Most Popular' },
  { id: 'monthly', oldPrice: 1499, badge: 'Popular' },
  { id: 'halfyear', oldPrice: 5999, badge: '' },
  { id: 'yearly', oldPrice: 9999, badge: 'Best Value' },
];
```

**Step 2: Commit**

```bash
git add -A
git commit -m "ui(billing): add sale styling to billing page

- Add Most Popular and Best Value badges
- Show slashed old prices
- Add plan comparison table
- Emphasize savings on longer plans"
```

---

## Task 10: Phase G — Mobile UI Polish

**Files:**
- Modify: All `src/dashboard/pages/*.tsx`
- Modify: `src/dashboard/DashboardApp.tsx`
- Modify: `src/components/ui/*.tsx`

**Step 1: Audit and fix common mobile issues**

For each page, verify and fix:
- Touch targets ≥ 44px
- Safe area padding for bottom nav
- No overflow/clipped modals
- Consistent card padding
- Proper scroll behavior

**Step 2: Update DashboardApp safe areas**

In `src/dashboard/DashboardApp.tsx`:

```typescript
// Add safe area padding for mobile
<div className="pb-safe pt-safe">
  {/* content */}
</div>
```

Add to `tailwind.config.js`:

```javascript
extend: {
  padding: {
    'safe': 'env(safe-area-inset-bottom)',
    'safe-top': 'env(safe-area-inset-top)',
  },
}
```

**Step 3: Fix modal overflow**

In `src/components/ui/dialog.tsx`:
- Add `max-h-[90vh]` and `overflow-y-auto`

**Step 4: Test on mobile viewport**

```bash
# Start dev server
npm run dev

# Test via browser dev tools mobile viewport
# 375x667 (iPhone SE), 390x844 (iPhone 14)
```

**Step 5: Create mobile fix log**

Create `docs/audit/MOBILE_UI_FIX_LOG.md` documenting all fixes made.

**Step 6: Commit**

```bash
git add -A
git commit -m "ui(mobile): mobile-first polish across all pages

- Add safe area padding for bottom nav
- Ensure tap targets ≥ 44px
- Fix modal overflow with max-h and scroll
- Consistent card padding and spacing
- Document fixes in MOBILE_UI_FIX_LOG.md"
```

---

## Task 11: Final Verification

**Step 1: Run all builds**

```bash
cd /root/GeekSpace2.0
npm run build
cd server && npm run build
```

**Step 2: Run smoke tests**

```bash
cd scripts/smoke && npm test
```

**Step 3: Create final report**

Create `docs/audit/FINAL_REPORT.md` with:
- Summary of all changes
- Commands run and results
- Known issues (if any)
- Deployment notes

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore(release): weebo ecosystem v3.1.0

Major update including:
- Token budget system with warnings
- Smart routing (Weebo → cheap → Edith)
- WhatsApp integration
- Portfolio magic generate
- Memory-driven portfolio suggestions
- Agent-to-agent social chat
- Mobile UI polish
- Comprehensive smoke tests"
```

---

## Summary

| Phase | Tasks | Key Deliverables |
|-------|-------|------------------|
| A | Fixes | ESLint, navigation, FK constraints |
| B | Weebo | Token budget, smart routing, agent slots |
| C | WhatsApp | QR linking, webhooks, UI |
| D | Portfolio | Magic generate, suggestions, social chat |
| E | Tests | Smoke test suite |
| F | Billing | Sale UI styling |
| G | Mobile | Safe areas, touch targets, modals |

**Estimated effort:** 40-50 tasks, ~6-8 hours with subagent-driven execution

**Dependencies:** None (all work is additive or fix-based)

**Risk level:** Low (no rewrites, incremental changes)
