# GeekSpace 2.0 — Development Roadmap

**Project:** GeekSpace 2.0 — Personal AI Operating System
**Repo:** github.com/trendywink247-afk/GeekSpace2.0
**Live:** geek-space2-0.vercel.app
**VPS:** Hostinger (12GB RAM / 150GB storage) — running
**Date:** February 15, 2026

---

## Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| React 19 Frontend | Live | Dashboard, terminal, landing, portfolio shell |
| Express API + SQLite | Live | Full CRUD, JWT auth, agent routes |
| Tri-Brain LLM Router | Built | Ollama -> OpenRouter -> EDITH routing |
| EDITH / OpenClaw (Brain 3) | Running | Gateway on VPS, custom Edith prompts |
| Ollama (Brain 1) | Running | Local inference on VPS |
| OpenRouter (Brain 2) | Configured | Cloud fallback |
| PicoClaw (Brain 4) | Not integrated | Planned as lightweight sidecar |
| Docker + Nginx + SSL | Running | Production deployment on VPS |
| Telegram/Discord Bots | Not live | Planned for PicoClaw |
| Automations Engine | CRUD only | No execution engine yet |
| Portfolio System | Partial | Routes exist, frontend needs polish |
| WebSocket / Streaming | Not built | No real-time layer |
| Edith Memory System | Missing | MEMORY.md empty in OpenClaw |
| Usage Dashboard | Partial | Backend tracking exists, frontend charts missing |
| Mobile / PWA | Not started | No responsive pass or service worker |
| Security Hardening | Partial | Basic setup done, checklist incomplete |

---

## Phase 1: PicoClaw Integration (Brain 4)

**Goal:** Wire PicoClaw into the existing Tri-Brain router as a lightweight sidecar for background tasks, Telegram presence, and heartbeat monitoring.

**Priority:** High
**Estimated effort:** 3-4 days

### 1.1 Deploy PicoClaw on VPS

PicoClaw runs as a standalone Go binary (~10MB RAM). Install it alongside your existing stack.

```
ssh root@YOUR_VPS_IP

# Download PicoClaw binary (check latest release URL)
mkdir -p /opt/picoclaw && cd /opt/picoclaw
wget https://github.com/picoclaw/picoclaw/releases/latest/download/picoclaw-linux-amd64
chmod +x picoclaw-linux-amd64
mv picoclaw-linux-amd64 picoclaw

# Create config
cat > config.yaml << 'EOF'
port: 8080
model: haiku  # lightweight model for quick tasks
workspace: /opt/picoclaw/workspace
telegram:
  bot_token: YOUR_TELEGRAM_BOT_TOKEN
  allowed_users:
    - YOUR_TELEGRAM_USER_ID
heartbeat:
  enabled: true
  interval: 60s
  targets:
    - name: geekspace
      url: http://localhost:3001/api/health
    - name: edith
      url: http://localhost:18789/api/health
    - name: ollama
      url: http://localhost:11434/api/tags
EOF

# Create systemd service
cat > /etc/systemd/system/picoclaw.service << 'EOF'
[Unit]
Description=PicoClaw AI Sidecar
After=network.target docker.service

[Service]
Type=simple
WorkingDirectory=/opt/picoclaw
ExecStart=/opt/picoclaw/picoclaw --config /opt/picoclaw/config.yaml
Restart=always
RestartSec=5
Environment=LOG_LEVEL=info

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable picoclaw
systemctl start picoclaw
systemctl status picoclaw
```

### 1.2 Add PicoClaw Service to Backend

Create `server/src/services/picoclaw.ts`:

```typescript
import { logger } from '../config';

const PICOCLAW_URL = process.env.PICOCLAW_URL || 'http://localhost:8080';
const PICOCLAW_TIMEOUT = 5000;

export async function queryPicoClaw(message: string): Promise<string | null> {
  try {
    const res = await fetch(`${PICOCLAW_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(PICOCLAW_TIMEOUT),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.response || data.text || null;
  } catch (err) {
    logger.warn({ err }, 'PicoClaw query failed');
    return null;
  }
}

export async function checkPicoClawHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${PICOCLAW_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
```

### 1.3 Update Tri-Brain Router

Modify `server/src/services/llm.ts` to add Brain 4 routing:

```typescript
// Updated intent classification
function classifyIntent(message: string): 'complex' | 'coding' | 'planning' | 'automation' | 'simple' {
  const lower = message.toLowerCase();

  // Brain 4 (PicoClaw) keywords
  const autoKeywords = ['remind', 'schedule', 'cron', 'heartbeat', 'monitor',
    'check status', 'ping', 'uptime', 'daily summary', 'notify'];
  if (autoKeywords.some(k => lower.includes(k))) return 'automation';

  // Brain 3 (EDITH) keywords — existing logic
  const complexKeywords = ['code', 'debug', 'analyze', 'architecture',
    'refactor', 'algorithm', 'design', 'plan', 'build'];
  if (complexKeywords.some(k => lower.includes(k))) return 'coding';

  if (lower.split(' ').length > 50) return 'complex';

  return 'simple';
}
```

Modify `server/src/routes/agent.ts` to handle `/pico` prefix:

```typescript
// Routing priority:
// 1. /edith <msg>  -> OpenClaw (Brain 3) — complex reasoning
// 2. /local <msg>  -> Ollama (Brain 1) — forced local
// 3. /pico <msg>   -> PicoClaw (Brain 4) — lightweight / automation
// 4. Auto-classify:
//    - complex/coding/planning -> OpenClaw
//    - automation/reminder/schedule -> PicoClaw
//    - simple/quick -> Ollama
//    - fallback -> OpenRouter (Brain 2)
```

### 1.4 Update Health Endpoint

Add PicoClaw to `GET /api/health`:

```typescript
// In server/src/index.ts health check
const picoHealth = await checkPicoClawHealth();

res.json({
  status: 'ok',
  ollama: ollamaHealth,
  edith: edithHealth,
  picoclaw: picoHealth,  // NEW
  timestamp: new Date().toISOString(),
});
```

### 1.5 Add .env Variables

```env
PICOCLAW_URL=http://localhost:8080
PICOCLAW_ENABLED=true
```

---

## Phase 2: Automations Execution Engine

**Goal:** Make the existing automations CRUD endpoints actually *do* things. Turn GeekSpace into a real automation platform with trigger -> action workflows.

**Priority:** High
**Estimated effort:** 5-7 days

### 2.1 Architecture

```
+-------------+     +--------------+     +-------------+
|  Triggers   | --> |  Engine      | --> |  Actions    |
|             |     |  (evaluator) |     |             |
| * cron/time |     |              |     | * send msg  |
| * webhook   |     | * match      |     | * call API  |
| * event     |     | * throttle   |     | * run cmd   |
| * keyword   |     | * log        |     | * notify    |
| * health    |     |              |     | * create    |
+-------------+     +--------------+     +-------------+
```

### 2.2 Trigger Types to Implement

| Trigger | Description | Example |
|---------|-------------|---------|
| `cron` | Time-based schedule | "Every day at 9am" |
| `webhook` | Incoming HTTP POST | GitHub push event |
| `keyword` | Message pattern match | User says "deploy" in chat |
| `health_down` | Service health fails | Ollama goes offline |
| `event` | Internal event bus | New reminder created |
| `manual` | User clicks "Run" | Dashboard button |

### 2.3 Action Types to Implement

| Action | Description | Dependencies |
|--------|-------------|-------------|
| `send_message` | Send via Telegram/Discord | PicoClaw / OpenClaw |
| `call_api` | HTTP request to external service | fetch |
| `run_command` | Execute `gs` terminal command | Existing command handler |
| `notify` | Push notification / email | PicoClaw |
| `create_reminder` | Auto-create a reminder | Existing reminders API |
| `ai_response` | Route through Tri-Brain | Existing LLM router |
| `log` | Write to activity_log | Existing DB |

### 2.4 Implementation Plan

Create `server/src/services/automations-engine.ts`:

```
1. On server start, load all active automations from SQLite
2. For cron triggers: register with node-cron scheduler
3. For webhook triggers: mount dynamic POST routes at /api/webhooks/:automation_id
4. For keyword triggers: hook into the chat pipeline (post-route, pre-response)
5. For health triggers: hook into the health check loop (run every 60s)
6. For event triggers: create a simple EventEmitter bus
7. On automation create/update/delete: hot-reload the relevant trigger
8. Log every execution to activity_log with status, duration, and output
```

### 2.5 Database Changes

Add columns to `automations` table:

```sql
ALTER TABLE automations ADD COLUMN trigger_type TEXT DEFAULT 'manual';
ALTER TABLE automations ADD COLUMN trigger_config TEXT DEFAULT '{}';  -- JSON
ALTER TABLE automations ADD COLUMN action_type TEXT DEFAULT 'log';
ALTER TABLE automations ADD COLUMN action_config TEXT DEFAULT '{}';   -- JSON
ALTER TABLE automations ADD COLUMN last_run_at TEXT;
ALTER TABLE automations ADD COLUMN last_status TEXT;  -- 'success' | 'error'
ALTER TABLE automations ADD COLUMN run_count INTEGER DEFAULT 0;
```

### 2.6 Frontend — Automation Builder UI

Build a visual automation builder in `src/dashboard/pages/AutomationsPage.tsx`:

- Dropdown to select trigger type + config form per type
- Dropdown to select action type + config form per type
- Toggle active/inactive
- "Test Run" button (fires the action immediately)
- Execution log table showing recent runs with status

---

## Phase 3: WebSocket & Real-Time Layer

**Goal:** Add streaming AI responses, live terminal output, and push notifications.

**Priority:** High
**Estimated effort:** 4-5 days

### 3.1 WebSocket Server Setup

Add `ws` or `socket.io` to the Express server:

```
npm install ws   # lightweight, no overhead
# or
npm install socket.io  # more features, auto-reconnect
```

### 3.2 Channels to Implement

| Channel | Purpose | Subscribers |
|---------|---------|------------|
| `chat:stream` | Token-by-token AI response streaming | Terminal page, chat widget |
| `terminal:output` | Live command output | Terminal page |
| `notifications` | Push alerts (reminders, health, automations) | All dashboard pages |
| `health:status` | Real-time service status updates | Overview page, connection page |
| `automation:log` | Live automation execution feed | Automations page |

### 3.3 Chat Streaming Implementation

Currently the chat endpoint returns a full JSON response. Upgrade to support streaming:

```typescript
// POST /api/agent/chat?stream=true
// Returns: Server-Sent Events (SSE) or WebSocket frames

// For SSE (simpler, works with fetch):
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');

for await (const chunk of llmStream) {
  res.write(`data: ${JSON.stringify({ text: chunk, done: false })}\n\n`);
}
res.write(`data: ${JSON.stringify({ text: '', done: true, route, provider, latencyMs })}\n\n`);
res.end();
```

### 3.4 Frontend Integration

Update `src/services/agent.ts` to support streaming:

```typescript
export async function streamChat(message: string, onChunk: (text: string) => void) {
  const response = await fetch('/api/agent/chat?stream=true', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message }),
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    // Parse SSE format and call onChunk
  }
}
```

### 3.5 Nginx WebSocket Config

Already partially configured. Ensure these directives exist:

```nginx
location /ws {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400;
}
```

---

## Phase 4: Edith Memory System

**Goal:** Give Edith persistent memory across conversations — context about the user, past decisions, learned preferences, and project history.

**Priority:** Medium-High
**Estimated effort:** 3-4 days

### 4.1 Memory Architecture

```
+------------------------------------------------+
|                 Edith Memory                    |
+-------------+--------------+-------------------+
| Short-term  | Long-term    | Episodic          |
| (session)   | (persistent) | (conversation log)|
|             |              |                   |
| Current     | User prefs   | Past decisions    |
| context     | Project info | Key conversations |
| Active task | Learned      | Outcomes &        |
| state       | patterns     | follow-ups        |
+-------------+--------------+-------------------+
```

### 4.2 Database Schema

```sql
CREATE TABLE IF NOT EXISTS agent_memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  category TEXT NOT NULL,       -- 'preference' | 'fact' | 'project' | 'decision' | 'pattern'
  key TEXT NOT NULL,            -- e.g. "coding_style", "timezone", "project:geekspace"
  value TEXT NOT NULL,          -- The actual memory content
  confidence REAL DEFAULT 1.0, -- 0.0 to 1.0 — how confident Edith is
  source TEXT,                  -- 'explicit' (user told) | 'inferred' | 'observed'
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  access_count INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, category, key)
);

CREATE TABLE IF NOT EXISTS conversation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL,          -- 'user' | 'assistant'
  content TEXT NOT NULL,
  provider TEXT,               -- which brain handled it
  summary TEXT,                -- auto-generated summary
  tags TEXT,                   -- JSON array of topic tags
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 4.3 Memory Extraction Pipeline

After each conversation turn, run an extraction step:

```
User message + AI response
        |
        v
  Memory Extractor (lightweight LLM call via PicoClaw/Ollama)
        |
        v
  "Did we learn anything new about the user?"
        |
   +----+----+
   | Yes     | No -> skip
   v         |
  Upsert into agent_memory
  with category + confidence
```

Prompt for extraction:
```
Given this conversation exchange, extract any facts, preferences, or decisions
the user revealed. Return JSON array of {category, key, value, confidence}.
Return empty array if nothing new was learned.
```

### 4.4 Memory Injection into System Prompt

Update `server/src/prompts/openclaw-system.ts` `buildSystemPrompt()`:

```typescript
// Fetch top relevant memories before each chat
const memories = await getRelevantMemories(userId, userMessage);
const memoryBlock = memories.map(m => `- [${m.category}] ${m.key}: ${m.value}`).join('\n');

// Inject into system prompt
const systemPrompt = `
${basePersonality}

## What you know about this user:
${memoryBlock || 'No memories yet — learn about them!'}

## Recent conversation context:
${recentSummaries}
`;
```

### 4.5 Create MEMORY.md for OpenClaw

Write the missing `/home/node/openclaw/MEMORY.md`:

```markdown
# Memory System

## How to Remember
- After every meaningful interaction, note key facts about the user
- Track preferences (coding style, communication tone, project names)
- Remember decisions made and their context
- Update confidence when information is confirmed or contradicted

## What to Remember
- User's name, role, projects, goals
- Technical preferences (languages, frameworks, tools)
- Communication style preferences
- Important deadlines and commitments
- Past decisions and their outcomes
- Recurring topics and pain points

## What NOT to Remember
- Sensitive personal data (passwords, financial info)
- Temporary/transient information
- Information the user explicitly asks you to forget
```

---

## Phase 5: Portfolio System Polish

**Goal:** Make the public portfolio page a real showcase — skills, projects, milestones, and a public AI chat widget.

**Priority:** Medium
**Estimated effort:** 3-4 days

### 5.1 Portfolio Data Model (already exists, needs enrichment)

```sql
-- Extend portfolios table
ALTER TABLE portfolios ADD COLUMN tagline TEXT;
ALTER TABLE portfolios ADD COLUMN avatar_url TEXT;
ALTER TABLE portfolios ADD COLUMN resume_url TEXT;
ALTER TABLE portfolios ADD COLUMN social_links TEXT DEFAULT '{}';  -- JSON
ALTER TABLE portfolios ADD COLUMN theme TEXT DEFAULT 'dark';
ALTER TABLE portfolios ADD COLUMN custom_domain TEXT;
```

### 5.2 Frontend Pages to Build

| Page/Component | Description |
|----------------|-------------|
| `PortfolioPublic.tsx` | The main public-facing page visitors see |
| `SkillsSection.tsx` | Skill bars/tags with proficiency levels |
| `ProjectsGrid.tsx` | Project cards with images, links, tech stack |
| `MilestonesTimeline.tsx` | Vertical timeline of achievements |
| `PublicChatWidget.tsx` | Floating chat bubble — talks to `/api/agent/chat/public/:username` |
| `ContactForm.tsx` | Already has `contact_submissions` table, just needs the form |

### 5.3 Public Chat Widget

The endpoint `POST /api/agent/chat/public/:username` already exists. Build a floating chat bubble:

- Appears bottom-right on the portfolio page
- Uses the user's agent personality (name, voice, colors from `agent_configs`)
- Rate-limited (no JWT needed, but IP-based throttle)
- Shows "Powered by GeekSpace" branding

### 5.4 Portfolio Editor in Dashboard

Enhance `src/dashboard/pages/SettingsPage.tsx` or create a dedicated `PortfolioEditorPage.tsx`:

- WYSIWYG-ish editor for bio/about
- Drag-and-drop project ordering
- Skill tag manager
- Live preview panel
- "Deploy" button that toggles public visibility (`gs deploy` command)

---

## Phase 6: Usage & Billing Dashboard

**Goal:** Visualize token consumption, cost per provider, credit balance, and usage trends.

**Priority:** Medium
**Estimated effort:** 2-3 days

### 6.1 Frontend Charts (Recharts already installed)

Build these chart components for `OverviewPage.tsx`:

| Chart | Type | Data Source |
|-------|------|-------------|
| Token usage over time | Line chart | `usage_events` grouped by day |
| Cost by provider | Pie/donut chart | `usage_events` grouped by provider |
| Requests by brain | Bar chart | `usage_events` grouped by provider |
| Credit balance trend | Area chart | Credits remaining over time |
| Response latency | Line chart | Average `latencyMs` by day |

### 6.2 API Endpoints to Add

```
GET /api/usage/chart?range=7d&group=provider   -> time series data
GET /api/usage/summary?range=30d               -> totals per provider
GET /api/usage/credits/history                  -> credit balance over time
```

### 6.3 Dashboard Cards

Add stat cards to Overview:

- Total requests today / this week / this month
- Tokens consumed (in / out)
- Average response time
- Brain utilization breakdown (% per brain)
- Credit balance with burn rate projection

---

## Phase 7: Telegram & Discord Bot Integration

**Goal:** Make Edith available on Telegram (via PicoClaw) and optionally Discord.

**Priority:** Medium
**Estimated effort:** 2-3 days

### 7.1 Platform Assignment

| Platform | Handler | Why |
|----------|---------|-----|
| Telegram | PicoClaw (Brain 4) | Lightweight, always-on, quick replies |
| WhatsApp | OpenClaw (Brain 3) | Full-featured, multi-modal |
| Discord | PicoClaw or dedicated bot | Community/server presence |

### 7.2 Telegram Bot Setup

```
1. Create bot via @BotFather on Telegram
2. Get bot token
3. Add token to PicoClaw config.yaml
4. Add token to GeekSpace .env (TELEGRAM_BOT_TOKEN)
5. Configure allowed_users in PicoClaw
6. PicoClaw handles quick replies locally
7. For complex queries, PicoClaw proxies to GeekSpace API:
   POST http://localhost:3001/api/agent/chat
   with the user's message — gets routed through tri-brain
```

### 7.3 Message Flow

```
Telegram User -> PicoClaw Bot
                    |
                    +- Simple query? -> PicoClaw responds directly (Haiku model)
                    |
                    +- Complex query? -> Proxy to GeekSpace API
                                            |
                                            +- Ollama (Brain 1)
                                            +- OpenRouter (Brain 2)
                                            +- EDITH (Brain 3)
                                            +- Response back to Telegram
```

### 7.4 Discord Bot (Optional)

If you want Discord presence, create a minimal Discord bot using `discord.js` that:

- Listens for mentions or DMs
- Proxies messages to GeekSpace API
- Returns formatted responses with markdown

---

## Phase 8: Mobile Responsiveness & PWA

**Goal:** Make GeekSpace feel native on mobile devices.

**Priority:** Medium
**Estimated effort:** 3-4 days

### 8.1 Responsive Pass

Key screens to make responsive:

| Screen | Priority | Notes |
|--------|----------|-------|
| Dashboard Overview | High | Stack cards vertically, collapse charts |
| Terminal | High | Full-width input, scrollable output |
| Chat/Agent | High | This is the #1 mobile use case |
| Reminders | Medium | List view works, calendar needs collapse |
| Automations | Medium | Card grid -> single column |
| Settings | Low | Already mostly form-based |
| Portfolio (public) | High | This is what visitors see |

### 8.2 PWA Setup

Add to `index.html` and create `manifest.json`:

```json
{
  "name": "GeekSpace",
  "short_name": "GeekSpace",
  "description": "Personal AI Operating System",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#05050A",
  "theme_color": "#7B61FF",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Add a service worker for:

- Offline shell caching (app shell loads without internet)
- Background sync for reminders
- Push notifications (Web Push API)

---

## Phase 9: Security Hardening

**Goal:** Lock down the production VPS and app.

**Priority:** High (do this in parallel with other phases)
**Estimated effort:** 1-2 days

### 9.1 Checklist

```
Server Level:
[ ] UFW firewall — allow only 80, 443, SSH port
[ ] Change SSH port from 22 to something custom
[ ] Disable root SSH login (use a deploy user)
[ ] Install fail2ban for brute-force protection
[ ] Enable unattended-upgrades for security patches
[ ] Set up log rotation (logrotate) for all services

Application Level:
[ ] Rotate JWT_SECRET and ENCRYPTION_KEY (generate new ones)
[ ] Ensure .env is NOT committed to git (verify .gitignore)
[ ] Set CORS_ORIGINS to only your domain (not *)
[ ] Verify rate limiting is active on all public endpoints
[ ] Add CSRF protection for state-changing requests
[ ] Audit all /api/* routes for proper auth middleware

Port Lockdown:
[ ] 3001 (Express) — only via Nginx, not public
[ ] 11434 (Ollama) — only localhost
[ ] 18789 (OpenClaw) — only via Nginx /openclaw/ path
[ ] 8080 (PicoClaw) — only localhost
[ ] 6379 (Redis) — only localhost, no password = never expose

SSL & Headers:
[ ] Certbot auto-renewal: certbot renew --dry-run
[ ] HSTS header enabled
[ ] Content-Security-Policy header
[ ] X-Frame-Options: DENY
[ ] X-Content-Type-Options: nosniff
```

---

## Execution Timeline

| Week | Phase | Deliverables |
|------|-------|-------------|
| **Week 1** | Phase 1 + Phase 9 | PicoClaw deployed, Brain 4 routing live, security hardened |
| **Week 2** | Phase 2 | Automations engine running, triggers firing, basic UI builder |
| **Week 3** | Phase 3 + Phase 7 | WebSocket streaming, SSE chat, Telegram bot live |
| **Week 4** | Phase 4 | Edith memory system, MEMORY.md complete, memory extraction pipeline |
| **Week 5** | Phase 5 + Phase 6 | Portfolio polished, public chat widget, usage charts live |
| **Week 6** | Phase 8 | Responsive pass complete, PWA installable, push notifications |
| **Buffer** | Bug fixes, polish | Integration testing, performance tuning, documentation |

**Total: ~6-7 weeks** if working consistently. Can compress to 4 weeks with focused effort.

---

## Quick Wins (Do Anytime)

These are small improvements you can knock out between major phases:

1. **Add PicoClaw health to the Overview page** — one new card
2. **Wire up the existing contact form** — `contact_submissions` table is ready
3. **Add "Export Data" to Settings** — `gs export` command exists, just needs a download button
4. **Dark/light theme toggle** — design tokens already defined
5. **Keyboard shortcuts** — Ctrl+K for command palette, Ctrl+/ for terminal focus
6. **Favicon + OG meta tags** — for link previews when sharing

---

## Architecture After All Phases

```
                    +------------------------------+
                    |     Nginx + Certbot SSL       |
                    |  geekspace.yourdomain.com     |
                    +--------------+----------------+
                                   |
        +--------------+-----------+-----------+--------------+
        |              |           |           |              |
   /*  (SPA)      /api/*       /ws         /openclaw/*   /webhooks/*
        |              |           |           |              |
  +-----v-----+ +------v------+ +-v----+ +----v-----+ +-----v------+
  | React 19  | | Express API | |  WS  | | OpenClaw | | Automation |
  | PWA       | | + SQLite    | |Server| | Gateway  | | Webhooks   |
  | Vite      | | JWT Auth    | |      | | (Brain3) | |            |
  +-----------+ +------+------+ +------+ +----------+ +------------+
                       |
        +--------------+--------------+----------------+
        |              |              |                |
   +----v----+   +-----v-----+  +----v-----+    +----v----+
   | Ollama  |   |OpenRouter |  | PicoClaw |    |  Redis  |
   | (local) |   | (cloud)   |  | (sidecar)|    | (cache) |
   | Brain 1 |   | Brain 2   |  | Brain 4  |    |         |
   +---------+   +-----------+  +----+-----+    +---------+
                                     |
                              +------+------+
                              |      |      |
                          Telegram Discord Cron
                            Bot     Bot   Jobs
```

---

## Files to Create / Modify Summary

### New Files

| File | Phase |
|------|-------|
| `server/src/services/picoclaw.ts` | 1 |
| `server/src/services/automations-engine.ts` | 2 |
| `server/src/services/websocket.ts` | 3 |
| `server/src/services/memory.ts` | 4 |
| `src/dashboard/pages/PortfolioEditorPage.tsx` | 5 |
| `src/components/PublicChatWidget.tsx` | 5 |
| `src/components/charts/UsageCharts.tsx` | 6 |
| `public/manifest.json` | 8 |
| `public/sw.js` | 8 |

### Modified Files

| File | Phase | Change |
|------|-------|--------|
| `server/src/services/llm.ts` | 1 | Add Brain 4 routing |
| `server/src/routes/agent.ts` | 1 | Add /pico prefix, update auto-classify |
| `server/src/index.ts` | 1, 3 | Health check + WebSocket upgrade |
| `server/src/db/index.ts` | 2, 4 | New tables (automation fields, memory) |
| `server/src/routes/automations.ts` | 2 | Connect to execution engine |
| `server/src/prompts/openclaw-system.ts` | 4 | Memory injection |
| `server/src/routes/usage.ts` | 6 | Chart data endpoints |
| `src/dashboard/pages/OverviewPage.tsx` | 6 | Charts + stat cards |
| `src/dashboard/pages/AutomationsPage.tsx` | 2 | Builder UI |
| `src/dashboard/pages/TerminalPage.tsx` | 3 | Streaming output |
| `docker-compose.yml` | 1 | PicoClaw env vars |
| `nginx/default.conf` | 3 | WebSocket + webhook paths |
| `.env.example` | 1 | PicoClaw vars |
