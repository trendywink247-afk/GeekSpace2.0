# Weebo Ecosystem Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy and activate the Weebo (PicoClaw) ecosystem — a multi-tier AI agent system with fleet dashboard, daily briefings, enhanced terminal, active memory, automation recipes, and portfolio intelligence.

**Architecture:** Weebo Engine is a lightweight Node.js Express HTTP service in Docker that proxies to Ollama's `qwen2.5-coder:1.5b` model. The Pico-Kimi Bridge routes ALL messages through a 3-tier intelligence system (Weebo Engine for trivial/simple, Ollama 7b for moderate, Moonshot Kimi for complex/multi-step). A fleet management dashboard lets users manage agents and tasks. Daily briefings, terminal commands, active memory, recipes, and portfolio intelligence round out the ecosystem.

**Tech Stack:** TypeScript/Express backend, React/Vite frontend, better-sqlite3, Docker Compose, Ollama

**User-facing naming:** "Weebo's" (sidebar), "Weebo Engine" (sidecar), "Weebo-1/2/3" (agents). Internal code stays `pico-*`.

---

## Task 1: Fix require() Bug — Commit the Existing Fix

**Files:**
- Already modified: `server/src/routes/agent.ts` (line 13 import + removed inline require at ~line 826)
- Already modified: `server/src/index.ts` (version bump to 3.0.0)

**Step 1: Verify the fix is correct**

Read `server/src/routes/agent.ts` line 13 — confirm `getRecentConversations` is in the import from `'../services/memory.js'`.

Search for any remaining `require(` calls in agent.ts — should find zero.

**Step 2: Build to verify**

Run: `cd /root/GeekSpace2.0/server && npm run build`
Expected: clean compile, no errors

**Step 3: Commit**

```bash
cd /root/GeekSpace2.0
git add server/src/routes/agent.ts server/src/index.ts
git commit -m "fix: convert require() to ESM import in conversations endpoint

The /api/agent/conversations route used CommonJS require() which fails
in ESM builds. Moved getRecentConversations to top-level import.
Also bumps version to 3.0.0."
```

---

## Task 2: Add 4GB Swap

**Step 1: Check current swap**

Run: `free -h`
Expected: Swap line shows 0B

**Step 2: Create and enable swap**

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

**Step 3: Make persistent**

```bash
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**Step 4: Verify**

Run: `free -h`
Expected: Swap line shows ~4.0Gi

---

## Task 3: Fix Git Remote URL

**Step 1: Check current remote**

Run: `cd /root/GeekSpace2.0 && git remote -v`
Expected: shows PAT in URL for `geekbase`

**Step 2: Strip PAT from remote URL**

```bash
cd /root/GeekSpace2.0
git remote set-url geekbase https://github.com/trendywink247-afk/GeekSpace2.0.git
```

**Step 3: Verify**

Run: `git remote -v`
Expected: no token in URL

Note: User will rotate the PAT in GitHub settings separately.

---

## Task 4: Create Weebo Engine (PicoClaw) Container

**Files:**
- Create: `picoclaw/package.json`
- Create: `picoclaw/index.js`
- Create: `picoclaw/Dockerfile`

**Step 1: Create `picoclaw/package.json`**

```json
{
  "name": "picoclaw",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": { "start": "node index.js" },
  "dependencies": { "express": "^4.21.0" }
}
```

**Step 2: Create `picoclaw/index.js`**

```javascript
import express from 'express';

const app = express();
app.use(express.json());

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const PORT = parseInt(process.env.PICOCLAW_PORT || '8080', 10);
const MODEL = process.env.PICOCLAW_MODEL || 'qwen2.5-coder:1.5b';
const MAX_TOKENS = 256;
const TEMPERATURE = 0.3;

app.get('/health', (_req, res) => {
  res.json({ ok: true, model: MODEL, uptime: process.uptime() });
});

app.post('/api/chat', async (req, res) => {
  const { message, system } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  const ollamaMessages = [];
  if (system) {
    ollamaMessages.push({ role: 'system', content: system });
  }
  ollamaMessages.push({ role: 'user', content: message });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const ollamaRes = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: ollamaMessages,
        stream: false,
        options: {
          num_predict: MAX_TOKENS,
          temperature: TEMPERATURE,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!ollamaRes.ok) {
      const body = await ollamaRes.text().catch(() => '');
      return res.status(502).json({ error: `Ollama returned ${ollamaRes.status}`, detail: body });
    }

    const data = await ollamaRes.json();

    res.json({
      response: data.message?.content || '',
      tokens_in: data.prompt_eval_count || 0,
      tokens_out: data.eval_count || 0,
      model: MODEL,
      duration_ms: data.total_duration ? Math.round(data.total_duration / 1e6) : 0,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Ollama request timed out (5s)' });
    }
    res.status(500).json({ error: err.message || 'Internal error' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[PicoClaw] Weebo Engine listening on :${PORT} → ${OLLAMA_BASE_URL} (${MODEL})`);
});
```

**Step 3: Create `picoclaw/Dockerfile`**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY index.js ./
EXPOSE 8080
USER node
CMD ["node", "index.js"]
```

**Step 4: Install dependencies**

```bash
cd /root/GeekSpace2.0/picoclaw && npm install
```

**Step 5: Verify locally (quick smoke test)**

```bash
cd /root/GeekSpace2.0/picoclaw && OLLAMA_BASE_URL=http://localhost:32778 node index.js &
sleep 2
curl -sf http://localhost:8080/health | python3 -m json.tool
# Expected: { "ok": true, "model": "qwen2.5-coder:1.5b", ... }
curl -sf -X POST http://localhost:8080/api/chat -H 'Content-Type: application/json' -d '{"message":"say hi in 3 words"}' | python3 -m json.tool
# Expected: { "response": "...", "tokens_in": N, "tokens_out": N, ... }
kill %1
```

**Step 6: Commit**

```bash
cd /root/GeekSpace2.0
git add picoclaw/
git commit -m "feat: add Weebo Engine (PicoClaw) sidecar container

Lightweight Express server that proxies to Ollama's qwen2.5-coder:1.5b
for fast triage and simple tasks. Endpoints: GET /health, POST /api/chat.
5s timeout, max 256 tokens, temperature 0.3."
```

---

## Task 5: Add Weebo Engine to Docker Compose

**Files:**
- Modify: `docker-compose.yml` (add picoclaw service after redis, before n8n)
- Modify: `.env.example` (add BRIDGE_* vars)

**Step 1: Add picoclaw service to docker-compose.yml**

After the redis service block (line 89) and before the n8n comment (line 91), insert:

```yaml
  # ---- Weebo Engine (PicoClaw — fast AI triage sidecar) ----
  picoclaw:
    build: ./picoclaw
    container_name: geekspace-picoclaw
    restart: unless-stopped
    environment:
      - OLLAMA_BASE_URL=${PICOCLAW_OLLAMA_URL:-http://ollama-qtzz-ollama-1:11434}
      - PICOCLAW_PORT=8080
      - PICOCLAW_MODEL=${PICOCLAW_MODEL:-qwen2.5-coder:1.5b}
    networks:
      - geekspace-net
      - geekspace-shared
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8080/health"]
      interval: 15s
      timeout: 5s
      start_period: 10s
      retries: 3
    deploy:
      resources:
        limits:
          memory: 64M
```

Note: Use `wget` instead of `curl` in healthcheck since Alpine image may not have curl. Also add `PICOCLAW_URL=http://picoclaw:8080` and `PICOCLAW_ENABLED=true` to the geekspace service's environment block.

**Step 2: Add geekspace depends_on for picoclaw**

In the geekspace service `depends_on` section, add:

```yaml
      picoclaw:
        condition: service_healthy
```

**Step 3: Add environment vars to geekspace service**

Add these to the geekspace service `environment:` block:

```yaml
      - PICOCLAW_URL=${PICOCLAW_URL:-http://picoclaw:8080}
      - PICOCLAW_ENABLED=${PICOCLAW_ENABLED:-true}
      - BRIDGE_ENABLED=${BRIDGE_ENABLED:-true}
      - BRIDGE_AUTO_ESCALATE=${BRIDGE_AUTO_ESCALATE:-true}
      - BRIDGE_MAX_WORKFLOW_STEPS=${BRIDGE_MAX_WORKFLOW_STEPS:-6}
```

**Step 4: Add missing vars to `.env.example`**

Add these after the existing PICOCLAW section:

```
# Pico-Kimi Bridge (orchestration layer)
BRIDGE_ENABLED=false
BRIDGE_AUTO_ESCALATE=true
BRIDGE_MAX_WORKFLOW_STEPS=6
```

**Step 5: Commit**

```bash
cd /root/GeekSpace2.0
git add docker-compose.yml .env.example
git commit -m "feat: add Weebo Engine to Docker Compose

Adds picoclaw service (64MB limit) on geekspace-net + geekspace-shared.
Adds BRIDGE_* vars to .env.example. GeekSpace app now depends on picoclaw."
```

---

## Task 6: Auto-route ALL Messages Through Bridge

**Files:**
- Modify: `server/src/routes/agent.ts` (lines 209-260)

**Step 1: Add auto-bridge routing**

After the `forceRoute` prefix parsing block (line 209, after the closing `}` of the `/agent:` check) and before the premium route check (line 211), insert:

```typescript
    // ---- Auto-route through bridge when enabled ----
    if (!forceRoute && config.bridgeEnabled && config.picoClawEnabled) {
      forceRoute = 'bridge';
    }
```

This is a 3-line change. When both `BRIDGE_ENABLED` and `PICOCLAW_ENABLED` are true, all messages that don't have an explicit prefix get routed through the bridge. The bridge's `classifyComplexity()` handles the tier decision. When bridge fails, it falls through to `routeChat()` (line 312-315).

**Step 2: Build and verify**

```bash
cd /root/GeekSpace2.0/server && npm run build
```
Expected: clean compile

**Step 3: Commit**

```bash
cd /root/GeekSpace2.0
git add server/src/routes/agent.ts
git commit -m "feat: auto-route all messages through bridge when enabled

When BRIDGE_ENABLED and PICOCLAW_ENABLED are both true, all messages
route through the Pico-Kimi bridge for 3-tier intelligence routing.
Falls back to routeChat() if bridge fails."
```

---

## Task 7: Add Pico API Client to Frontend

**Files:**
- Modify: `src/services/api.ts` (add picoService + briefingService at the end)

**Step 1: Add picoService and briefingService to api.ts**

Append before the final export (or at the end of the file):

```typescript
// ----- Pico Fleet (Weebo's) --------------------------------

export const picoService = {
  getAgents: () =>
    api.get<Array<{
      id: string; user_id: string; slot: number; name: string;
      status: string; tasks_completed: number; tasks_failed: number;
      created_at: string;
    }>>('/pico/agents'),

  createAgent: (name: string) =>
    api.post<{ id: string; slot: number; name: string }>('/pico/agents', { name }),

  updateAgent: (id: string, data: { name?: string; status?: string }) =>
    api.patch(`/pico/agents/${id}`, data),

  deleteAgent: (id: string) =>
    api.delete(`/pico/agents/${id}`),

  getTasks: (params?: { status?: string; slot?: number; limit?: number }) =>
    api.get<Array<{
      id: string; user_id: string; agent_slot: number; agent_name: string;
      task_type: string; description: string; payload: string;
      status: string; result: string | null; planned_by: string;
      created_at: string; started_at: string | null; completed_at: string | null;
    }>>('/pico/tasks', { params }),

  getTask: (id: string) =>
    api.get('/pico/tasks/' + id),

  planTask: (request: string) =>
    api.post<{
      tasks: Array<{ id: string; task_type: string; description: string; agent_slot: number }>;
      creditCost: number;
    }>('/pico/tasks/plan', { request }),

  cancelTask: (id: string) =>
    api.delete(`/pico/tasks/${id}`),
};

// ----- Briefings -------------------------------------------

export const briefingService = {
  getRecent: (limit = 10) =>
    api.get<Array<{
      id: string; type: string; content: string;
      channels_sent: string; created_at: string;
    }>>('/briefings', { params: { limit } }),

  triggerNow: () =>
    api.post('/briefings/trigger'),
};
```

**Step 2: Commit**

```bash
cd /root/GeekSpace2.0
git add src/services/api.ts
git commit -m "feat: add picoService and briefingService API clients

Frontend service layer for Weebo Fleet agents/tasks and briefings."
```

---

## Task 8: Build Weebo's Dashboard Page

**Files:**
- Create: `src/dashboard/pages/PicoFleetPage.tsx`
- Modify: `src/dashboard/DashboardApp.tsx` (add lazy import, PageType, sidebar item, renderPage case)

**Step 1: Create PicoFleetPage.tsx**

Create `src/dashboard/pages/PicoFleetPage.tsx` with:

```tsx
import { useState, useEffect, useCallback } from 'react';
import {
  Zap, Plus, Trash2, Play, Square, Clock, CheckCircle,
  XCircle, AlertCircle, RefreshCw, Send, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { picoService } from '@/services/api';

interface PicoAgent {
  id: string;
  slot: number;
  name: string;
  status: string;
  tasks_completed: number;
  tasks_failed: number;
  created_at: string;
}

interface PicoTask {
  id: string;
  agent_slot: number;
  agent_name: string;
  task_type: string;
  description: string;
  status: string;
  result: string | null;
  planned_by: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

const statusColors: Record<string, string> = {
  active: '#61FF7B',
  idle: '#A7ACB8',
  disabled: '#FF6161',
  queued: '#7B61FF',
  running: '#FFD761',
  completed: '#61FF7B',
  failed: '#FF6161',
  cancelled: '#A7ACB8',
};

export function PicoFleetPage() {
  const [agents, setAgents] = useState<PicoAgent[]>([]);
  const [tasks, setTasks] = useState<PicoTask[]>([]);
  const [taskInput, setTaskInput] = useState('');
  const [planning, setPlanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newAgentName, setNewAgentName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState<PicoTask | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = useCallback(async () => {
    try {
      const [agentsRes, tasksRes] = await Promise.all([
        picoService.getAgents(),
        picoService.getTasks({ limit: 50 }),
      ]);
      setAgents(agentsRes.data);
      setTasks(tasksRes.data);
    } catch {
      showToast('Failed to load fleet data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) return;
    try {
      await picoService.createAgent(newAgentName.trim());
      setNewAgentName('');
      setShowCreateForm(false);
      showToast('Agent created');
      loadData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to create agent';
      showToast(msg, 'error');
    }
  };

  const handleDeleteAgent = async (id: string) => {
    try {
      await picoService.deleteAgent(id);
      showToast('Agent removed');
      loadData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to delete agent';
      showToast(msg, 'error');
    }
  };

  const handlePlanTask = async () => {
    if (!taskInput.trim()) return;
    setPlanning(true);
    try {
      const res = await picoService.planTask(taskInput.trim());
      const planned = res.data;
      showToast(`Planned ${planned.tasks.length} task(s) — ${planned.creditCost} credits`);
      setTaskInput('');
      loadData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to plan task';
      showToast(msg, 'error');
    } finally {
      setPlanning(false);
    }
  };

  const handleCancelTask = async (id: string) => {
    try {
      await picoService.cancelTask(id);
      showToast('Task cancelled');
      loadData();
    } catch {
      showToast('Failed to cancel task', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#7B61FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Pad agents to 3 slots
  const slots = [1, 2, 3].map(slot => agents.find(a => a.slot === slot) || null);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg border text-sm font-medium transition-all duration-300 ${
          toast.type === 'success' ? 'bg-[#61FF7B]/10 border-[#61FF7B]/30 text-[#61FF7B]' : 'bg-[#FF6161]/10 border-[#FF6161]/30 text-[#FF6161]'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Weebo's
          </h1>
          <p className="text-[#A7ACB8]">
            {agents.length} agent{agents.length !== 1 ? 's' : ''} active · {tasks.filter(t => t.status === 'completed').length} tasks completed
          </p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm" className="border-[#7B61FF]/30">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {slots.map((agent, i) => (
          <Card key={i} className="bg-[#0B0B10] border-[#7B61FF]/20 hover:border-[#7B61FF]/40 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="w-4 h-4" style={{ color: agent ? statusColors[agent.status] || '#A7ACB8' : '#333' }} />
                  {agent ? agent.name : `Slot ${i + 1}`}
                </CardTitle>
                {agent && (
                  <Badge variant="outline" className="text-xs" style={{
                    borderColor: statusColors[agent.status] || '#A7ACB8',
                    color: statusColors[agent.status] || '#A7ACB8',
                  }}>
                    {agent.status}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {agent ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-[#A7ACB8]">Completed</span>
                      <p className="text-[#61FF7B] font-semibold">{agent.tasks_completed}</p>
                    </div>
                    <div>
                      <span className="text-[#A7ACB8]">Failed</span>
                      <p className="text-[#FF6161] font-semibold">{agent.tasks_failed}</p>
                    </div>
                  </div>
                  {agent.slot !== 1 && (
                    <Button
                      onClick={() => handleDeleteAgent(agent.id)}
                      variant="ghost"
                      size="sm"
                      className="w-full text-[#A7ACB8] hover:bg-[#FF6161]/10 hover:text-[#FF6161]"
                    >
                      <Trash2 className="w-3 h-3 mr-2" /> Remove
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  {showCreateForm && i === slots.findIndex(s => !s) ? (
                    <div className="flex gap-2">
                      <Input
                        value={newAgentName}
                        onChange={(e) => setNewAgentName(e.target.value)}
                        placeholder="Agent name..."
                        className="bg-[#05050A] border-[#7B61FF]/20 text-sm"
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateAgent()}
                      />
                      <Button onClick={handleCreateAgent} size="sm" className="bg-[#7B61FF] hover:bg-[#6B51EF]">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={() => setShowCreateForm(true)}
                      variant="ghost"
                      size="sm"
                      className="text-[#A7ACB8] hover:text-[#7B61FF]"
                    >
                      <Plus className="w-4 h-4 mr-2" /> Add Agent
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Task */}
      <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Quick Task</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              placeholder="Describe a task in natural language..."
              className="bg-[#05050A] border-[#7B61FF]/20 flex-1"
              onKeyDown={(e) => e.key === 'Enter' && !planning && handlePlanTask()}
              disabled={planning}
            />
            <Button
              onClick={handlePlanTask}
              disabled={planning || !taskInput.trim()}
              className="bg-[#7B61FF] hover:bg-[#6B51EF] min-w-[100px]"
            >
              {planning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" /> Plan
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-[#A7ACB8] mt-2">
            Kimi will analyze your request and create structured tasks for Weebo to execute.
          </p>
        </CardContent>
      </Card>

      {/* Task History */}
      <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Task History</CardTitle>
            <span className="text-sm text-[#A7ACB8]">{tasks.length} tasks</span>
          </div>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-10 h-10 mx-auto mb-3 text-[#7B61FF]/30" />
              <p className="text-[#A7ACB8]">No tasks yet. Plan one above!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map(task => {
                const StatusIcon = task.status === 'completed' ? CheckCircle
                  : task.status === 'failed' ? XCircle
                  : task.status === 'running' ? Play
                  : task.status === 'cancelled' ? Square
                  : AlertCircle;

                return (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(selectedTask?.id === task.id ? null : task)}
                    className="flex items-center gap-3 p-3 rounded-lg bg-[#05050A] border border-transparent hover:border-[#7B61FF]/20 cursor-pointer transition-colors"
                  >
                    <StatusIcon className="w-4 h-4 flex-shrink-0" style={{ color: statusColors[task.status] }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs border-[#7B61FF]/30 text-[#7B61FF]">
                          {task.task_type}
                        </Badge>
                        <span className="text-sm text-[#F4F6FF] truncate">{task.description}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-[#A7ACB8]">
                        <span>{task.agent_name || `Slot ${task.agent_slot}`}</span>
                        <span>{new Date(task.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                    {task.status === 'queued' && (
                      <Button
                        onClick={(e) => { e.stopPropagation(); handleCancelTask(task.id); }}
                        variant="ghost"
                        size="sm"
                        className="text-[#A7ACB8] hover:text-[#FF6161]"
                      >
                        <Square className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Task Detail Panel */}
          {selectedTask && (
            <div className="mt-4 p-4 rounded-lg bg-[#05050A] border border-[#7B61FF]/20">
              <h4 className="font-semibold mb-2">{selectedTask.description}</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-[#A7ACB8]">Type:</span> {selectedTask.task_type}</div>
                <div><span className="text-[#A7ACB8]">Status:</span> {selectedTask.status}</div>
                <div><span className="text-[#A7ACB8]">Planned by:</span> {selectedTask.planned_by}</div>
                <div><span className="text-[#A7ACB8]">Agent:</span> {selectedTask.agent_name || `Slot ${selectedTask.agent_slot}`}</div>
              </div>
              {selectedTask.result && (
                <div className="mt-3">
                  <span className="text-[#A7ACB8] text-sm">Result:</span>
                  <pre className="mt-1 p-2 rounded bg-[#0B0B10] text-xs text-[#F4F6FF] overflow-auto max-h-40">{selectedTask.result}</pre>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Add to DashboardApp.tsx**

Add lazy import (after line 33, the BillingPage import):

```typescript
const PicoFleetPage = lazy(() =>
  import('./pages/PicoFleetPage').then(m => ({ default: m.PicoFleetPage }))
);
```

Update PageType union (line 35) — add `'pico'`:

```typescript
type PageType = 'overview' | 'portfolio' | 'usage' | 'billing' | 'memory' | 'connections' | 'agent' | 'reminders' | 'automations' | 'pico' | 'terminal' | 'settings';
```

Add sidebar item to menuItems array (after the `automations` entry, before `terminal`):

```typescript
  { id: 'pico', label: "Weebo's", icon: Zap },
```

Note: `Zap` is already imported. But `automations` also uses `Zap` — so use a different icon for Weebo's. Import `Cpu` from lucide-react and use that instead:

```typescript
  { id: 'pico', label: "Weebo's", icon: Cpu },
```

Add to renderPage switch (after the `automations` case):

```typescript
    case 'pico':         return <PicoFleetPage />;
```

Add `Cpu` to the lucide-react import at the top of DashboardApp.tsx.

**Step 3: Build frontend to verify**

```bash
cd /root/GeekSpace2.0 && npx vite build
```
Expected: clean build

**Step 4: Commit**

```bash
cd /root/GeekSpace2.0
git add src/dashboard/pages/PicoFleetPage.tsx src/dashboard/DashboardApp.tsx
git commit -m "feat: add Weebo's fleet dashboard page

Agent cards (3 slots), quick task planner with Kimi integration,
task history with status badges and detail panel."
```

---

## Task 9: Add Daily Briefing System

**Files:**
- Create: `server/src/services/daily-briefing.ts`
- Modify: `server/src/db/index.ts` (add briefings table migration)
- Create: `server/src/routes/briefings.ts`
- Modify: `server/src/index.ts` (mount briefings router + start scheduler)

**Step 1: Add briefings table migration**

In `server/src/db/index.ts`, find the migrations array and add:

```typescript
{
  name: 'create_briefings_table',
  sql: `
    CREATE TABLE IF NOT EXISTS briefings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT DEFAULT 'daily',
      content TEXT NOT NULL,
      channels_sent TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_briefings_user ON briefings(user_id, created_at);
  `,
},
```

Also add `briefing_time` column to agent_configs if it doesn't exist:

```typescript
{
  name: 'add_briefing_time_to_agent_configs',
  sql: `ALTER TABLE agent_configs ADD COLUMN briefing_time TEXT DEFAULT '08:00'`,
},
```

**Step 2: Create daily-briefing.ts**

```typescript
import { v4 as uuid } from 'uuid';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { config } from '../config.js';
import { isPicoClawAvailable, queryPicoClaw } from './picoclaw.js';
import { routeChat, type ChatMessage } from './llm.js';

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

interface BriefingData {
  pendingReminders: number;
  dueToday: number;
  completedYesterday: number;
  failedYesterday: number;
  activeAgents: number;
}

function gatherBriefingData(userId: string): BriefingData {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const yesterdayStr = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);

  const pendingReminders = (db.prepare(
    "SELECT COUNT(*) as c FROM reminders WHERE user_id = ? AND status = 'pending'"
  ).get(userId) as { c: number })?.c || 0;

  const dueToday = (db.prepare(
    "SELECT COUNT(*) as c FROM reminders WHERE user_id = ? AND status = 'pending' AND due_at <= ? || 'T23:59:59'"
  ).get(userId, todayStr) as { c: number })?.c || 0;

  const completedYesterday = (db.prepare(
    "SELECT COUNT(*) as c FROM pico_tasks WHERE user_id = ? AND status = 'completed' AND completed_at >= ? || 'T00:00:00'"
  ).get(userId, yesterdayStr) as { c: number })?.c || 0;

  const failedYesterday = (db.prepare(
    "SELECT COUNT(*) as c FROM pico_tasks WHERE user_id = ? AND status = 'failed' AND completed_at >= ? || 'T00:00:00'"
  ).get(userId, yesterdayStr) as { c: number })?.c || 0;

  const activeAgents = (db.prepare(
    "SELECT COUNT(*) as c FROM pico_agents WHERE user_id = ? AND status = 'active'"
  ).get(userId) as { c: number })?.c || 0;

  return { pendingReminders, dueToday, completedYesterday, failedYesterday, activeAgents };
}

async function generateBriefing(userId: string): Promise<string> {
  const data = gatherBriefingData(userId);

  const prompt = `Generate a concise daily briefing (3-5 sentences) for a user based on this data:
- ${data.pendingReminders} pending reminders (${data.dueToday} due today)
- ${data.completedYesterday} tasks completed yesterday, ${data.failedYesterday} failed
- ${data.activeAgents} active Weebo agents
Be conversational and helpful. If there are failed tasks, mention them. If nothing notable, keep it short.`;

  const picoAvailable = await isPicoClawAvailable();

  if (picoAvailable) {
    const result = await queryPicoClaw(prompt, 'You are a helpful AI assistant providing a daily briefing.');
    return result.text;
  }

  // Fallback to Ollama
  const messages: ChatMessage[] = [{ role: 'user', content: prompt }];
  const result = await routeChat(messages, {
    systemPrompt: 'You are a helpful AI assistant providing a daily briefing.',
    forceProvider: 'ollama',
    userCredits: 1000,
  });
  return result.reply;
}

export async function createBriefing(userId: string): Promise<string> {
  const content = await generateBriefing(userId);
  const id = uuid();

  db.prepare(
    "INSERT INTO briefings (id, user_id, type, content, channels_sent) VALUES (?, ?, 'daily', ?, '[]')"
  ).run(id, userId, content);

  logger.info({ userId, briefingId: id }, 'Daily briefing created');
  return content;
}

export function getRecentBriefings(userId: string, limit = 10): unknown[] {
  return db.prepare(
    'SELECT * FROM briefings WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(userId, limit);
}

function checkAndSendBriefings(): void {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const todayStr = now.toISOString().slice(0, 10);

  // Find users whose briefing_time matches current minute and haven't had a briefing today
  const users = db.prepare(`
    SELECT ac.user_id, ac.briefing_time FROM agent_configs ac
    WHERE ac.briefing_time = ?
    AND NOT EXISTS (
      SELECT 1 FROM briefings b
      WHERE b.user_id = ac.user_id AND b.created_at >= ? || 'T00:00:00'
    )
  `).all(currentTime, todayStr) as Array<{ user_id: string; briefing_time: string }>;

  for (const user of users) {
    createBriefing(user.user_id).catch(err => {
      logger.warn({ userId: user.user_id, error: (err as Error).message }, 'Failed to create daily briefing');
    });
  }
}

export function startBriefingScheduler(): void {
  if (schedulerInterval) return;
  // Check every 60 seconds
  schedulerInterval = setInterval(checkAndSendBriefings, 60_000);
  logger.info('Daily briefing scheduler started (60s interval)');
}

export function stopBriefingScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
```

**Step 3: Create briefings router**

Create `server/src/routes/briefings.ts`:

```typescript
import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { getRecentBriefings, createBriefing } from '../services/daily-briefing.js';

export const briefingsRouter = Router();

briefingsRouter.get('/', requireAuth, (req: AuthRequest, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
  const briefings = getRecentBriefings(req.userId!, limit);
  res.json(briefings);
});

briefingsRouter.post('/trigger', requireAuth, async (req: AuthRequest, res) => {
  try {
    const content = await createBriefing(req.userId!);
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
```

**Step 4: Mount router and start scheduler in index.ts**

In `server/src/index.ts`, add:

```typescript
import { briefingsRouter } from './routes/briefings.js';
import { startBriefingScheduler } from './services/daily-briefing.js';
```

Mount the router alongside existing routes:

```typescript
app.use('/api/briefings', briefingsRouter);
```

After the server starts listening, add:

```typescript
startBriefingScheduler();
```

**Step 5: Build and verify**

```bash
cd /root/GeekSpace2.0/server && npm run build
```
Expected: clean compile

**Step 6: Commit**

```bash
cd /root/GeekSpace2.0
git add server/src/services/daily-briefing.ts server/src/routes/briefings.ts server/src/db/index.ts server/src/index.ts
git commit -m "feat: add daily briefing system

Briefing scheduler checks every 60s, generates per-user daily briefings
via Weebo Engine (PicoClaw) or Ollama fallback. New GET /api/briefings
and POST /api/briefings/trigger endpoints."
```

---

## Task 10: Enhance Terminal Commands

**Files:**
- Modify: `server/src/routes/agent.ts` (lines 377-652, the /command handler)

**Step 1: Add new terminal commands**

In the `/command` handler, add these command handlers before the existing `help` case. The exact insertion point is after the `ai "..."` block (line 642) and before `help` (line 644).

Add these commands:

```typescript
    // ---- System commands ----
    if (cmd === 'gs health') {
      try {
        const healthRes = await fetch(`http://localhost:${config.port}/api/health`);
        const health = await healthRes.json() as Record<string, unknown>;
        const output = Object.entries(health)
          .map(([k, v]) => `<span style="color:#7B61FF;font-weight:bold">${k}:</span> ${JSON.stringify(v)}`)
          .join('\n');
        res.json({ output, isError: false });
      } catch {
        res.json({ output: '<span style="color:#FF6161">Failed to reach health endpoint</span>', isError: true });
      }
      return;
    }

    if (cmd === 'gs credits') {
      const sub = db.prepare('SELECT plan, credits_remaining, billing_cycle_end FROM subscriptions WHERE user_id = ?').get(userId) as { plan: string; credits_remaining: number; billing_cycle_end: string } | undefined;
      if (!sub) {
        res.json({ output: 'No subscription found.', isError: false });
        return;
      }
      res.json({
        output: `<span style="color:#7B61FF;font-weight:bold">Plan:</span> ${sub.plan}\n<span style="color:#7B61FF;font-weight:bold">Credits remaining:</span> <span style="color:#61FF7B">${sub.credits_remaining.toLocaleString()}</span>\n<span style="color:#7B61FF;font-weight:bold">Cycle ends:</span> ${sub.billing_cycle_end}`,
        isError: false,
      });
      return;
    }

    if (cmd === 'gs brief') {
      try {
        const { createBriefing: createBriefingFn } = await import('../services/daily-briefing.js');
        const content = await createBriefingFn(userId);
        res.json({ output: `<span style="color:#7B61FF;font-weight:bold">Daily Briefing:</span>\n${content}`, isError: false });
      } catch (err) {
        res.json({ output: `<span style="color:#FF6161">Briefing failed: ${(err as Error).message}</span>`, isError: true });
      }
      return;
    }

    if (cmd.startsWith('gs remind ')) {
      const text = command.slice(10).trim().replace(/^["']|["']$/g, '');
      if (!text) {
        res.json({ output: 'Usage: gs remind <text>', isError: false });
        return;
      }
      const id = uuid();
      db.prepare("INSERT INTO reminders (id, user_id, title, status) VALUES (?, ?, ?, 'pending')").run(id, userId, text);
      res.json({ output: `<span style="color:#61FF7B">Reminder created:</span> ${text}`, isError: false });
      return;
    }

    if (cmd === 'gs deploy portfolio') {
      db.prepare("UPDATE portfolios SET is_public = 1 WHERE user_id = ?").run(userId);
      res.json({ output: '<span style="color:#61FF7B">Portfolio deployed!</span>', isError: false });
      return;
    }
```

**Step 2: Update the help command output**

Find the existing help response and add the new commands to it:

```
gs pico status/agents/tasks  — fleet management
gs health                     — system health check
gs credits                    — credit balance
gs remind <text>              — quick reminder
gs deploy portfolio           — deploy portfolio
gs brief                      — trigger daily briefing
```

**Step 3: Build and verify**

```bash
cd /root/GeekSpace2.0/server && npm run build
```

**Step 4: Commit**

```bash
cd /root/GeekSpace2.0
git add server/src/routes/agent.ts
git commit -m "feat: add terminal 2.0 commands

New commands: gs health, gs credits, gs brief, gs remind, gs deploy portfolio.
Colored HTML output for terminal display."
```

---

## Task 11: Active Memory Extraction

**Files:**
- Modify: `server/src/services/memory.ts` (enhance extractMemories + add memory injection)
- Modify: `server/src/routes/agent.ts` (add background memory extraction after response)

**Step 1: Enhance extractMemories in memory.ts**

The existing `extractMemories()` function uses basic regex patterns. Enhance it to optionally use PicoClaw for richer extraction when available.

Add this function to memory.ts:

```typescript
export async function extractMemoriesWithAI(userId: string, message: string, response: string): Promise<void> {
  try {
    const picoAvailable = await isPicoClawAvailable();
    if (!picoAvailable) {
      // Fall back to existing regex-based extraction
      extractMemories(userId, message);
      return;
    }

    const prompt = `Extract facts about the user from this conversation. Return ONLY a JSON array of objects with {category, key, value}. Categories: preference, fact, project, pattern. If nothing notable, return [].

User said: "${message.slice(0, 500)}"
Assistant said: "${response.slice(0, 500)}"`;

    const result = await queryPicoClaw(prompt, 'You extract user facts from conversations. Return valid JSON only.');

    let facts: Array<{ category: string; key: string; value: string }>;
    try {
      facts = JSON.parse(result.text);
      if (!Array.isArray(facts)) return;
    } catch {
      return; // PicoClaw didn't return valid JSON, skip
    }

    for (const fact of facts.slice(0, 5)) {
      if (!fact.category || !fact.key || !fact.value) continue;
      // Deduplicate: check if similar memory exists
      const existing = db.prepare(
        "SELECT value FROM agent_memory WHERE user_id = ? AND key = ?"
      ).get(userId, fact.key) as { value: string } | undefined;

      if (existing && existing.value === fact.value) continue;

      upsertMemory(userId, fact.category, fact.key, fact.value, 0.7, 'ai-extract');
    }
  } catch (err) {
    logger.debug({ error: (err as Error).message }, 'AI memory extraction failed (non-fatal)');
  }
}
```

Add the import for `isPicoClawAvailable` and `queryPicoClaw` at the top of memory.ts:

```typescript
import { isPicoClawAvailable, queryPicoClaw } from './picoclaw.js';
```

**Step 2: Add background extraction after chat response**

In `server/src/routes/agent.ts`, after the `res.json(response)` call in the bridge block (line 310) and in the default router block (after the response is sent), add a non-blocking memory extraction call:

```typescript
    // Background memory extraction (non-blocking)
    extractMemoriesWithAI(userId, message, result.reply || bridgeResult.text).catch(() => {});
```

Import `extractMemoriesWithAI` from memory.ts at the top of agent.ts.

**Step 3: Enhance buildMemoryContext for relevant injection**

The existing `buildMemoryContext()` in memory.ts already does this — verify it's called in `buildSystemPrompt()` in agent.ts. If not, add it.

**Step 4: Build and verify**

```bash
cd /root/GeekSpace2.0/server && npm run build
```

**Step 5: Commit**

```bash
cd /root/GeekSpace2.0
git add server/src/services/memory.ts server/src/routes/agent.ts
git commit -m "feat: add AI-powered memory extraction after chat

Uses Weebo Engine to extract user preferences, facts, and patterns
from conversations. Falls back to regex extraction when PicoClaw
is unavailable. Non-blocking background processing."
```

---

## Task 12: Automation Recipes Backend

**Files:**
- Create: `server/src/services/recipes.ts`
- Create: `server/src/routes/recipes.ts`
- Modify: `server/src/db/index.ts` (add installed_recipes table migration)
- Modify: `server/src/index.ts` (mount recipes router)

**Step 1: Add installed_recipes table migration**

In `server/src/db/index.ts`, add to migrations:

```typescript
{
  name: 'create_installed_recipes_table',
  sql: `
    CREATE TABLE IF NOT EXISTS installed_recipes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      recipe_id TEXT NOT NULL,
      config TEXT DEFAULT '{}',
      installed_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, recipe_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `,
},
```

**Step 2: Create recipes.ts service**

Create `server/src/services/recipes.ts`:

```typescript
import { v4 as uuid } from 'uuid';
import { db } from '../db/index.js';
import { logger } from '../logger.js';

export interface Recipe {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'productivity' | 'monitoring' | 'communication' | 'analytics';
  requiredIntegrations: string[];
}

const RECIPES: Recipe[] = [
  {
    id: 'morning-briefing',
    name: 'Morning Briefing',
    description: 'Get a daily briefing at 8 AM with your pending tasks, reminders, and agent status.',
    icon: 'sunrise',
    category: 'productivity',
    requiredIntegrations: [],
  },
  {
    id: 'git-watcher',
    name: 'Git Watcher',
    description: 'Receive a summary reminder when a GitHub push event is detected via webhook.',
    icon: 'git-branch',
    category: 'monitoring',
    requiredIntegrations: [],
  },
  {
    id: 'weekly-review',
    name: 'Weekly Review',
    description: 'Every Sunday, get a summary of all tasks completed and failed during the week.',
    icon: 'calendar-check',
    category: 'analytics',
    requiredIntegrations: [],
  },
  {
    id: 'deadline-enforcer',
    name: 'Deadline Enforcer',
    description: 'When a reminder is overdue by 1 hour, escalate via Telegram notification.',
    icon: 'alert-triangle',
    category: 'productivity',
    requiredIntegrations: ['telegram'],
  },
  {
    id: 'api-health-monitor',
    name: 'API Health Monitor',
    description: 'Check a URL every 5 minutes and create an alert if it returns an error.',
    icon: 'activity',
    category: 'monitoring',
    requiredIntegrations: [],
  },
  {
    id: 'portfolio-traffic',
    name: 'Portfolio Traffic',
    description: 'Weekly summary of portfolio page visits and visitor interactions.',
    icon: 'eye',
    category: 'analytics',
    requiredIntegrations: [],
  },
];

export function getAllRecipes(): Recipe[] {
  return RECIPES;
}

export function getRecipe(recipeId: string): Recipe | undefined {
  return RECIPES.find(r => r.id === recipeId);
}

export function getInstalledRecipes(userId: string): Array<{ recipe_id: string; config: string; installed_at: string }> {
  return db.prepare(
    'SELECT recipe_id, config, installed_at FROM installed_recipes WHERE user_id = ?'
  ).all(userId) as Array<{ recipe_id: string; config: string; installed_at: string }>;
}

export function installRecipe(userId: string, recipeId: string, recipeConfig: Record<string, unknown> = {}): void {
  const recipe = getRecipe(recipeId);
  if (!recipe) throw new Error(`Unknown recipe: ${recipeId}`);

  const existing = db.prepare(
    'SELECT id FROM installed_recipes WHERE user_id = ? AND recipe_id = ?'
  ).get(userId, recipeId);
  if (existing) throw new Error('Recipe already installed');

  db.prepare(
    'INSERT INTO installed_recipes (id, user_id, recipe_id, config) VALUES (?, ?, ?, ?)'
  ).run(uuid(), userId, recipeId, JSON.stringify(recipeConfig));

  logger.info({ userId, recipeId }, 'Recipe installed');
}

export function uninstallRecipe(userId: string, recipeId: string): void {
  const result = db.prepare(
    'DELETE FROM installed_recipes WHERE user_id = ? AND recipe_id = ?'
  ).run(userId, recipeId);

  if (result.changes === 0) throw new Error('Recipe not installed');
  logger.info({ userId, recipeId }, 'Recipe uninstalled');
}
```

**Step 3: Create recipes router**

Create `server/src/routes/recipes.ts`:

```typescript
import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { getAllRecipes, getInstalledRecipes, installRecipe, uninstallRecipe } from '../services/recipes.js';

export const recipesRouter = Router();

recipesRouter.get('/', requireAuth, (req: AuthRequest, res) => {
  const recipes = getAllRecipes();
  const installed = getInstalledRecipes(req.userId!);
  const installedIds = new Set(installed.map(i => i.recipe_id));

  const result = recipes.map(r => ({
    ...r,
    installed: installedIds.has(r.id),
    installedAt: installed.find(i => i.recipe_id === r.id)?.installed_at || null,
  }));

  res.json(result);
});

recipesRouter.post('/:id/install', requireAuth, async (req: AuthRequest, res) => {
  try {
    installRecipe(req.userId!, req.params.id, req.body.config || {});
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

recipesRouter.delete('/:id/uninstall', requireAuth, (req: AuthRequest, res) => {
  try {
    uninstallRecipe(req.userId!, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});
```

**Step 4: Mount router in index.ts**

Add to `server/src/index.ts`:

```typescript
import { recipesRouter } from './routes/recipes.js';
app.use('/api/recipes', recipesRouter);
```

**Step 5: Build and verify**

```bash
cd /root/GeekSpace2.0/server && npm run build
```

**Step 6: Commit**

```bash
cd /root/GeekSpace2.0
git add server/src/services/recipes.ts server/src/routes/recipes.ts server/src/db/index.ts server/src/index.ts
git commit -m "feat: add automation recipes backend

6 starter recipes: morning briefing, git watcher, weekly review,
deadline enforcer, API health monitor, portfolio traffic.
Install/uninstall endpoints with installed_recipes table."
```

---

## Task 13: Recipes Frontend Page

**Files:**
- Create: `src/dashboard/pages/RecipesPage.tsx`
- Modify: `src/services/api.ts` (add recipeService)
- Modify: `src/dashboard/DashboardApp.tsx` (add page + sidebar entry)

**Step 1: Add recipeService to api.ts**

Append to `src/services/api.ts`:

```typescript
// ----- Recipes -----------------------------------------------

export const recipeService = {
  getAll: () =>
    api.get<Array<{
      id: string; name: string; description: string; icon: string;
      category: string; requiredIntegrations: string[];
      installed: boolean; installedAt: string | null;
    }>>('/recipes'),

  install: (id: string, config?: Record<string, unknown>) =>
    api.post(`/recipes/${id}/install`, { config }),

  uninstall: (id: string) =>
    api.delete(`/recipes/${id}/uninstall`),
};
```

**Step 2: Create RecipesPage.tsx**

Create `src/dashboard/pages/RecipesPage.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Download, Trash2, CheckCircle, AlertTriangle,
  Sunrise, GitBranch, CalendarCheck, Activity, Eye, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { recipeService } from '@/services/api';

interface RecipeItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  requiredIntegrations: string[];
  installed: boolean;
  installedAt: string | null;
}

const iconMap: Record<string, typeof BookOpen> = {
  sunrise: Sunrise,
  'git-branch': GitBranch,
  'calendar-check': CalendarCheck,
  'alert-triangle': AlertTriangle,
  activity: Activity,
  eye: Eye,
};

const categoryColors: Record<string, string> = {
  productivity: '#7B61FF',
  monitoring: '#FFD761',
  communication: '#61FF7B',
  analytics: '#FF61DC',
};

export function RecipesPage() {
  const [recipes, setRecipes] = useState<RecipeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadRecipes = useCallback(async () => {
    try {
      const res = await recipeService.getAll();
      setRecipes(res.data);
    } catch {
      showToast('Failed to load recipes', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRecipes(); }, [loadRecipes]);

  const handleInstall = async (id: string) => {
    setActionId(id);
    try {
      await recipeService.install(id);
      showToast('Recipe activated');
      loadRecipes();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to install';
      showToast(msg, 'error');
    } finally {
      setActionId(null);
    }
  };

  const handleUninstall = async (id: string) => {
    setActionId(id);
    try {
      await recipeService.uninstall(id);
      showToast('Recipe deactivated');
      loadRecipes();
    } catch {
      showToast('Failed to uninstall', 'error');
    } finally {
      setActionId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#7B61FF] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg border text-sm font-medium ${
          toast.type === 'success' ? 'bg-[#61FF7B]/10 border-[#61FF7B]/30 text-[#61FF7B]' : 'bg-[#FF6161]/10 border-[#FF6161]/30 text-[#FF6161]'
        }`}>
          {toast.message}
        </div>
      )}

      <div>
        <h1 className="text-3xl md:text-4xl font-bold mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Recipes
        </h1>
        <p className="text-[#A7ACB8]">
          Pre-built automations you can activate with one click. {recipes.filter(r => r.installed).length} active.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {recipes.map(recipe => {
          const Icon = iconMap[recipe.icon] || BookOpen;
          const catColor = categoryColors[recipe.category] || '#7B61FF';

          return (
            <Card key={recipe.id} className="bg-[#0B0B10] border-[#7B61FF]/20 hover:border-[#7B61FF]/40 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: catColor + '15' }}>
                      <Icon className="w-5 h-5" style={{ color: catColor }} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{recipe.name}</CardTitle>
                      <Badge variant="outline" className="text-xs mt-1" style={{ borderColor: catColor + '40', color: catColor }}>
                        {recipe.category}
                      </Badge>
                    </div>
                  </div>
                  {recipe.installed && (
                    <Badge className="bg-[#61FF7B]/10 text-[#61FF7B] border-[#61FF7B]/30">
                      <CheckCircle className="w-3 h-3 mr-1" /> Active
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#A7ACB8] mb-4">{recipe.description}</p>

                {recipe.requiredIntegrations.length > 0 && (
                  <p className="text-xs text-[#A7ACB8] mb-3">
                    Requires: {recipe.requiredIntegrations.join(', ')}
                  </p>
                )}

                {recipe.installed ? (
                  <Button
                    onClick={() => handleUninstall(recipe.id)}
                    variant="ghost"
                    size="sm"
                    disabled={actionId === recipe.id}
                    className="w-full text-[#A7ACB8] hover:bg-[#FF6161]/10 hover:text-[#FF6161]"
                  >
                    {actionId === recipe.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                    Deactivate
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleInstall(recipe.id)}
                    size="sm"
                    disabled={actionId === recipe.id}
                    className="w-full bg-[#7B61FF] hover:bg-[#6B51EF]"
                  >
                    {actionId === recipe.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                    Activate
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 3: Add to DashboardApp.tsx**

Add lazy import:

```typescript
const RecipesPage = lazy(() =>
  import('./pages/RecipesPage').then(m => ({ default: m.RecipesPage }))
);
```

Update PageType — add `'recipes'`:

```typescript
type PageType = ... | 'recipes' | ...;
```

Add sidebar item (after `automations`, before `pico`):

```typescript
  { id: 'recipes', label: 'Recipes', icon: BookOpen },
```

Add `BookOpen` to the lucide-react import.

Add to renderPage:

```typescript
    case 'recipes':      return <RecipesPage />;
```

**Step 4: Build and verify**

```bash
cd /root/GeekSpace2.0 && npx vite build
```

**Step 5: Commit**

```bash
cd /root/GeekSpace2.0
git add src/dashboard/pages/RecipesPage.tsx src/services/api.ts src/dashboard/DashboardApp.tsx
git commit -m "feat: add Recipes page with 6 starter automations

Card grid with install/uninstall, category badges, active indicators.
New recipeService API client."
```

---

## Task 14: Portfolio Intelligence

**Files:**
- Modify: `server/src/routes/agent.ts` (enhance the `POST /chat/public/:username` handler)
- Modify: `server/src/prompts/openclaw-system.ts` (enhance `buildPortfolioVisitorPrompt`)

**Step 1: Find the public chat handler**

In `agent.ts`, find the `POST /chat/public/:username` handler. This is the portfolio visitor chat endpoint.

**Step 2: Add visitor intent detection**

Before calling the LLM in the public chat handler, add a PicoClaw-based intent classification step:

```typescript
// Detect visitor intent (first message only)
let visitorIntent = 'curious'; // default
const messageCount = /* count from session or query */;
if (messageCount <= 1) {
  try {
    const picoAvailable = await isPicoClawAvailable();
    if (picoAvailable) {
      const classResult = await queryPicoClaw(
        message,
        'Classify this portfolio visitor as one of: recruiter, collaborator, curious. Reply with ONLY the classification word.'
      );
      const intent = classResult.text.trim().toLowerCase();
      if (['recruiter', 'collaborator', 'curious'].includes(intent)) {
        visitorIntent = intent;
      }
    }
  } catch {
    // Non-fatal, use default
  }
}
```

**Step 3: Add abuse detection**

After counting messages, add a check:

```typescript
// Abuse detection: 20+ messages from same visitor
if (messageCount > 20) {
  res.json({
    text: "I appreciate your interest! If you'd like to connect, here's my contact info — feel free to reach out directly.",
    provider: 'builtin',
    latencyMs: 0,
  });
  return;
}
```

**Step 4: Enhance buildPortfolioVisitorPrompt**

In `server/src/prompts/openclaw-system.ts`, modify `buildPortfolioVisitorPrompt()` to accept a `visitorIntent` parameter and adjust the prompt accordingly:

```typescript
export function buildPortfolioVisitorPrompt(
  ownerName: string,
  skills: string[],
  projects: string[],
  bio: string,
  personality: string,
  visitorIntent?: string,
): string {
  // ... existing prompt ...
  // Add intent-specific guidance:
  let intentGuidance = '';
  if (visitorIntent === 'recruiter') {
    intentGuidance = `The visitor appears to be a recruiter. Emphasize skills, experience, and notable projects. Be professional and impressive.`;
  } else if (visitorIntent === 'collaborator') {
    intentGuidance = `The visitor appears to be a potential collaborator. Highlight open source work, tech stack, and collaboration opportunities.`;
  }
  // Inject intentGuidance into the prompt
}
```

**Step 5: Log visitor interactions**

After the response, log to activity_log:

```typescript
db.prepare(
  "INSERT INTO activity_log (id, user_id, action, detail) VALUES (?, ?, 'portfolio_visitor_chat', ?)"
).run(uuid(), portfolioUserId, JSON.stringify({ intent: visitorIntent, messageLength: message.length }));
```

**Step 6: Build and verify**

```bash
cd /root/GeekSpace2.0/server && npm run build
```

**Step 7: Commit**

```bash
cd /root/GeekSpace2.0
git add server/src/routes/agent.ts server/src/prompts/openclaw-system.ts
git commit -m "feat: add portfolio visitor intent detection

PicoClaw classifies visitors as recruiter/collaborator/curious.
Adjusts portfolio prompt based on intent. Abuse detection at 20+ messages.
Logs visitor interactions to activity_log."
```

---

## Task 15: Add Briefing Card to Overview Page

**Files:**
- Modify: `src/dashboard/pages/OverviewPage.tsx` (add a Daily Briefing card)

**Step 1: Add briefing card**

Import `briefingService` from `'@/services/api'`.

Add state and effect to load the latest briefing:

```typescript
const [latestBriefing, setLatestBriefing] = useState<{ content: string; created_at: string } | null>(null);

useEffect(() => {
  briefingService.getRecent(1).then(res => {
    if (res.data.length > 0) setLatestBriefing(res.data[0]);
  }).catch(() => {});
}, []);
```

Add a card in the overview layout (after the existing quick stats section):

```tsx
{latestBriefing && (
  <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm flex items-center gap-2">
        <Zap className="w-4 h-4 text-[#FFD761]" />
        Daily Briefing
      </CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-[#F4F6FF]">{latestBriefing.content}</p>
      <p className="text-xs text-[#A7ACB8] mt-2">
        {new Date(latestBriefing.created_at).toLocaleString()}
      </p>
    </CardContent>
  </Card>
)}
```

**Step 2: Build and verify**

```bash
cd /root/GeekSpace2.0 && npx vite build
```

**Step 3: Commit**

```bash
cd /root/GeekSpace2.0
git add src/dashboard/pages/OverviewPage.tsx
git commit -m "feat: add daily briefing card to overview page

Shows the latest briefing with timestamp on the dashboard overview."
```

---

## Task 16: Memory Management Enhancements on Frontend

**Files:**
- Modify: `src/dashboard/pages/MemoryManagerPage.tsx` (add category filter, edit/delete controls)

**Step 1: Read existing MemoryManagerPage.tsx to understand current UI**

Read the file and understand what's already there.

**Step 2: Add category filter tabs**

Add tabs at the top: All, Preference, Fact, Project, Pattern. Filter displayed memories by category.

**Step 3: Add edit/delete inline controls**

Each memory entry should have:
- Delete button (trash icon, red hover)
- Category badge showing the type

**Step 4: Build and verify**

```bash
cd /root/GeekSpace2.0 && npx vite build
```

**Step 5: Commit**

```bash
cd /root/GeekSpace2.0
git add src/dashboard/pages/MemoryManagerPage.tsx
git commit -m "feat: enhance memory manager with category filters

Category filter tabs, inline delete controls, and category badges."
```

---

## Task 17: Update .env and Final Build

**Files:**
- Modify: `.env` (local, not committed — just set the right values)

**Step 1: Set env vars for local development**

In `.env` (gitignored), ensure these are set:

```
PICOCLAW_URL=http://localhost:8080
PICOCLAW_ENABLED=true
BRIDGE_ENABLED=true
BRIDGE_AUTO_ESCALATE=true
BRIDGE_MAX_WORKFLOW_STEPS=6
```

**Step 2: Full backend build**

```bash
cd /root/GeekSpace2.0/server && npm run build
```
Expected: clean compile

**Step 3: Full frontend build**

```bash
cd /root/GeekSpace2.0 && npx vite build
```
Expected: clean build

**Step 4: Verify health endpoint**

Start the server and verify all components report correctly:

```bash
cd /root/GeekSpace2.0
fuser -k 3001/tcp 2>/dev/null
OLLAMA_BASE_URL=http://localhost:32778 OLLAMA_MODEL=llama3.1:8b OLLAMA_TIMEOUT_MS=120000 node server/dist/index.js &
sleep 3
curl -sf http://localhost:3001/api/health | python3 -m json.tool
```

Expected: health check returns with picoclaw status reflecting PICOCLAW_ENABLED setting.

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Fix require() bug (commit) | agent.ts, index.ts |
| 2 | Add swap | System config |
| 3 | Fix git remote | Git config |
| 4 | Create Weebo Engine container | picoclaw/* |
| 5 | Add to Docker Compose | docker-compose.yml, .env.example |
| 6 | Auto-route through bridge | agent.ts |
| 7 | Frontend API clients | api.ts |
| 8 | Weebo's dashboard page | PicoFleetPage.tsx, DashboardApp.tsx |
| 9 | Daily briefing system | daily-briefing.ts, briefings.ts, db/index.ts |
| 10 | Terminal 2.0 commands | agent.ts |
| 11 | Active memory extraction | memory.ts, agent.ts |
| 12 | Recipes backend | recipes.ts (service + route), db/index.ts |
| 13 | Recipes frontend | RecipesPage.tsx, api.ts, DashboardApp.tsx |
| 14 | Portfolio intelligence | agent.ts, openclaw-system.ts |
| 15 | Briefing card on overview | OverviewPage.tsx |
| 16 | Memory manager enhancements | MemoryManagerPage.tsx |
| 17 | Final build and verify | .env, builds |
