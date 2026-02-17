# Audit & Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix Pico/PicoClaw naming leaks in the UI, implement voice input, fix the agentOwner routing bug in ExplorePage chat, and wire StatusPage to real health data.

**Architecture:** Server terminal strings updated in-place. Frontend display labels mapped at render time (no server API changes needed for provider names). agentOwner bug fixed by accepting the prop and branching the API call. StatusPage replaced wholesale with a real fetch.

**Tech Stack:** TypeScript, React, Express, browser SpeechRecognition API (no new packages)

---

## Task 1: Server — Pico naming in terminal commands

**Files:**
- Modify: `server/src/routes/agent.ts` (lines 565, 569, 579, 737)

**Step 1: Edit gs pico list response (line 565)**

Change:
```typescript
if (!agents.length) { res.json({ output: 'No Pico agents found.', isError: false }); return; }
```
To:
```typescript
if (!agents.length) { res.json({ output: 'No Weebo agents found.', isError: false }); return; }
```

**Step 2: Edit gs pico list header (line 569)**

Change:
```typescript
res.json({ output: `Pico Agents:\n${lines.join('\n')}`, isError: false });
```
To:
```typescript
res.json({ output: `Weebo Agents:\n${lines.join('\n')}`, isError: false });
```

**Step 3: Edit gs pico create response (line 579)**

Change:
```typescript
res.json({ output: `Created Pico agent "${agent.name}" at slot ${agent.slot}`, isError: false });
```
To:
```typescript
res.json({ output: `Created Weebo agent "${agent.name}" at slot ${agent.slot}`, isError: false });
```

**Step 4: Edit help text (line 737) — find this substring in the long help string**

Find: `Force PicoClaw`
Replace with: `Force Weebo Engine`

**Step 5: Build server and verify**

```bash
cd /root/GeekSpace2.0/server && npm run build 2>&1 | tail -5
```
Expected: clean build, no errors.

**Step 6: Commit**

```bash
git add server/src/routes/agent.ts
git commit -m "fix: rename Pico to Weebo Engine in terminal command responses"
```

---

## Task 2: AgentChatPanel — Provider display label map

**Files:**
- Modify: `src/components/AgentChatPanel.tsx` (around line 397-400)

**Context:** The server returns `provider: 'picoclaw'` (or `'ollama'`, `'edith'`, etc.) in the chat response. Line 399 currently renders `msg.provider` raw — users see `picoclaw` as text.

**Step 1: Add a providerLabels map after the personalityMeta object (after line 15)**

```typescript
const providerLabels: Record<string, string> = {
  picoclaw: 'Weebo Engine',
  ollama: 'Local Engine',
  openrouter: 'Cloud Engine',
  'openrouter-free': 'Cloud Engine',
  edith: 'Premium Engine',
  builtin: 'Built-in',
};
```

**Step 2: Update the provider display span (line 399)**

Change:
```tsx
<Zap className="w-2.5 h-2.5" /> {msg.provider}
```
To:
```tsx
<Zap className="w-2.5 h-2.5" /> {providerLabels[msg.provider!] ?? msg.provider}
```

**Step 3: Build frontend and verify**

```bash
cd /root/GeekSpace2.0 && npm run build 2>&1 | tail -10
```
Expected: clean build.

**Step 4: Commit**

```bash
git add src/components/AgentChatPanel.tsx
git commit -m "fix: map provider keys to friendly display labels (picoclaw → Weebo Engine)"
```

---

## Task 3: AgentChatPanel — Fix agentOwner routing bug

**Files:**
- Modify: `src/components/AgentChatPanel.tsx` (lines 6, 40-47, 190-195, 507-518)

**Context:** `agentOwner` is in the props interface but dropped in the function destructure (line 47). When ExplorePage passes a chat owner, the panel silently calls the viewer's own agent instead of the public endpoint. `publicAgentService` already exists in `api.ts` and has a `chat(username, message)` method.

**Step 1: Update import to include publicAgentService (line 6)**

Change:
```typescript
import { agentService, premiumAgentService } from '@/services/api';
```
To:
```typescript
import { agentService, premiumAgentService, publicAgentService } from '@/services/api';
```

**Step 2: Accept agentOwner in the function destructure (line 47)**

Change:
```typescript
export function AgentChatPanel({ isOpen, onClose }: AgentChatPanelProps) {
```
To:
```typescript
export function AgentChatPanel({ isOpen, onClose, agentOwner }: AgentChatPanelProps) {
```

**Step 3: Update doRegularChat to branch on agentOwner (lines 190-195)**

Replace the existing `doRegularChat` function:
```typescript
    // Helper: non-streaming chat call
    const doRegularChat = async () => {
      const { data } = await agentService.chat(content);
      const text = data.text || '';
      if (!text && !data.actions?.length) throw new Error('Empty response');
      setAgentMsg({ content: text, isStreaming: false, provider: data.provider, actions: data.actions || undefined });
    };
```
With:
```typescript
    // Helper: non-streaming chat call
    const doRegularChat = async () => {
      if (agentOwner) {
        // Visitor mode: call the public portfolio endpoint
        const { data } = await publicAgentService.chat(agentOwner, content);
        const text = data.reply || '';
        if (!text) throw new Error('Empty response');
        setAgentMsg({ content: text, isStreaming: false, provider: 'ollama' });
        return;
      }
      const { data } = await agentService.chat(content);
      const text = data.text || '';
      if (!text && !data.actions?.length) throw new Error('Empty response');
      setAgentMsg({ content: text, isStreaming: false, provider: data.provider, actions: data.actions || undefined });
    };
```

**Step 4: Skip streaming attempt when in visitor mode**

In the main async IIFE that starts at line 198, add a guard at the top so agentOwner skips streaming and goes straight to `doRegularChat`:

Find the block starting with:
```typescript
    // Main chat logic: try streaming → fall back to regular → show error
    (async () => {
      try {
        // Attempt SSE streaming
        const res = await agentService.chatStream(content);
```

Change the opening of that try block to:
```typescript
    // Main chat logic: try streaming → fall back to regular → show error
    (async () => {
      try {
        // Visitor mode: no streaming endpoint for public chat
        if (agentOwner) {
          await doRegularChat();
          return;
        }
        // Attempt SSE streaming
        const res = await agentService.chatStream(content);
```

**Step 5: Hide premium session deploy button when in visitor mode (line 507-514)**

Change:
```tsx
            {!premiumSession && (
              <button
                onClick={() => setShowDeployDialog(true)}
```
To:
```tsx
            {!premiumSession && !agentOwner && (
              <button
                onClick={() => setShowDeployDialog(true)}
```

**Step 6: Hide owner-centric suggested prompts when in visitor mode (around the suggestedPrompts render)**

Find where `suggestedPrompts` is rendered (look for `suggestedPrompts.map` in the JSX). Wrap the entire suggested prompts section with `{!agentOwner && (...)}`.

**Step 7: Build and verify**

```bash
cd /root/GeekSpace2.0 && npm run build 2>&1 | tail -10
```
Expected: clean build, no TypeScript errors.

**Step 8: Commit**

```bash
git add src/components/AgentChatPanel.tsx
git commit -m "fix: wire agentOwner prop to public chat endpoint in ExplorePage chat"
```

---

## Task 4: ExplorePage — Fix username passed to chat panel

**Files:**
- Modify: `src/explore/ExplorePage.tsx` (line 58)

**Context:** Currently passes `profile.name.split(' ')[0]` (e.g. "Alex") as the username, but the API expects `profile.username` (e.g. "alex_j"). This would 404 every public chat attempt.

**Step 1: Fix the handleChat function (line 58)**

Change:
```typescript
    setChatOwner(profile.name.split(' ')[0]);
```
To:
```typescript
    setChatOwner(profile.username);
```

**Step 2: Build and verify**

```bash
cd /root/GeekSpace2.0 && npm run build 2>&1 | tail -10
```
Expected: clean build.

**Step 3: Commit**

```bash
git add src/explore/ExplorePage.tsx
git commit -m "fix: pass profile.username instead of display name to chat panel in ExplorePage"
```

---

## Task 5: AgentChatPanel — Implement voice input (Mic button)

**Files:**
- Modify: `src/components/AgentChatPanel.tsx`

**Context:** The Mic button exists but has no onClick. The browser's `SpeechRecognition` API (Chrome/Edge) can transcribe speech into text client-side with no backend.

**Step 1: Add TypeScript type declarations after the imports block (after line 9)**

```typescript
// Browser SpeechRecognition (Chrome/Edge only — not in @types/dom by default)
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}
```

**Step 2: Add isListening state and recognitionRef after the existing refs (around line 53)**

After `const inputRef = useRef<HTMLInputElement>(null);` add:
```typescript
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const speechSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
```

**Step 3: Add handleVoiceInput function after the existing handlers (before the return statement)**

```typescript
  const handleVoiceInput = () => {
    if (!speechSupported) return;
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join('');
      setInput(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };
```

**Step 4: Update the Mic button (line 527-529)**

Change:
```tsx
            <button className="p-2 rounded-lg hover:bg-[#7B61FF]/10 transition-colors" title="Voice input">
              <Mic className="w-4 h-4 text-[#A7ACB8]" />
            </button>
```
To:
```tsx
            {speechSupported && (
              <button
                onClick={handleVoiceInput}
                className={`p-2 rounded-lg transition-colors ${isListening ? 'bg-[#7B61FF]/20 hover:bg-[#7B61FF]/30' : 'hover:bg-[#7B61FF]/10'}`}
                title={isListening ? 'Stop listening' : 'Voice input'}
              >
                <Mic className={`w-4 h-4 ${isListening ? 'text-[#7B61FF]' : 'text-[#A7ACB8]'}`} />
              </button>
            )}
```

**Step 5: Build and verify**

```bash
cd /root/GeekSpace2.0 && npm run build 2>&1 | tail -10
```
Expected: clean build.

**Step 6: Commit**

```bash
git add src/components/AgentChatPanel.tsx
git commit -m "feat: implement browser SpeechRecognition voice input in chat panel"
```

---

## Task 6: AgentChatPanel — Remove Paperclip button

**Files:**
- Modify: `src/components/AgentChatPanel.tsx` (line 2, 516-518)

**Step 1: Remove Paperclip from the lucide-react import (line 2)**

Change:
```typescript
import { X, Send, Sparkles, Mic, Paperclip, RotateCcw, Zap, Rocket, Square } from 'lucide-react';
```
To:
```typescript
import { X, Send, Sparkles, Mic, RotateCcw, Zap, Rocket, Square } from 'lucide-react';
```

**Step 2: Remove the Paperclip button block (lines 516-518)**

Remove these lines entirely:
```tsx
            <button className="p-2 rounded-lg hover:bg-[#7B61FF]/10 transition-colors" title="Attach file">
              <Paperclip className="w-4 h-4 text-[#A7ACB8]" />
            </button>
```

**Step 3: Build and verify**

```bash
cd /root/GeekSpace2.0 && npm run build 2>&1 | tail -10
```
Expected: clean build, no `Paperclip` reference errors.

**Step 4: Commit**

```bash
git add src/components/AgentChatPanel.tsx
git commit -m "chore: remove non-functional Paperclip file attachment button"
```

---

## Task 7: Delete useOptimistic.ts

**Files:**
- Delete: `src/hooks/useOptimistic.ts`

**Step 1: Verify no imports exist**

```bash
grep -r "useOptimistic" /root/GeekSpace2.0/src/ --include="*.tsx" --include="*.ts"
```
Expected: only the file itself (or zero results if it only exports).

**Step 2: Delete the file**

```bash
rm /root/GeekSpace2.0/src/hooks/useOptimistic.ts
```

**Step 3: Build and verify**

```bash
cd /root/GeekSpace2.0 && npm run build 2>&1 | tail -10
```
Expected: clean build.

**Step 4: Commit**

```bash
git add -A src/hooks/
git commit -m "chore: delete unused useOptimistic hook"
```

---

## Task 8: StatusPage — Wire to real /api/health endpoint

**Files:**
- Rewrite: `src/pages/StatusPage.tsx`

**Context:** The current file is 149 lines of entirely mocked data. Replace it wholesale. The `/api/health` endpoint is public (no auth) and returns:
```json
{
  "ok": true,
  "status": "ok",
  "uptime": 3600,
  "version": "3.0.0",
  "timestamp": "...",
  "components": {
    "database": "ok",
    "ollama": "reachable",
    "openrouter": "configured",
    "edith": "reachable",
    "picoclaw": "reachable",
    "bridge": "active",
    "telegram": "configured",
    "n8n": "not_configured"
  }
}
```

**Step 1: Replace the entire StatusPage.tsx**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const COMPONENT_LABELS: Record<string, string> = {
  database: 'Database',
  ollama: 'Local Engine',
  openrouter: 'Cloud Engine',
  edith: 'Premium Engine',
  picoclaw: 'Weebo Engine',
  bridge: 'Bridge Router',
  telegram: 'Telegram Bot',
  n8n: 'Automation (n8n)',
};

const OK_STATUSES = new Set(['ok', 'reachable', 'configured', 'active']);
const DEGRADED_STATUSES = new Set(['degraded']);

function componentStatus(value: string): 'operational' | 'degraded' | 'down' {
  if (OK_STATUSES.has(value)) return 'operational';
  if (DEGRADED_STATUSES.has(value)) return 'degraded';
  return 'down';
}

interface HealthData {
  ok: boolean;
  status: string;
  uptime: number;
  version: string;
  timestamp: string;
  components: Record<string, string>;
}

export function StatusPage() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    setChecking(true);
    setError(false);
    try {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error('Health check failed');
      const data: HealthData = await res.json();
      setHealth(data);
      setLastChecked(new Date());
    } catch {
      setError(true);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  const getStatusIcon = (s: 'operational' | 'degraded' | 'down') => {
    if (s === 'operational') return <CheckCircle2 className="w-5 h-5 text-[#61FF7B]" />;
    if (s === 'degraded') return <AlertTriangle className="w-5 h-5 text-[#FFD761]" />;
    return <XCircle className="w-5 h-5 text-[#FF6161]" />;
  };

  const getStatusColor = (s: 'operational' | 'degraded' | 'down') => {
    if (s === 'operational') return 'text-[#61FF7B]';
    if (s === 'degraded') return 'text-[#FFD761]';
    return 'text-[#FF6161]';
  };

  const components = health?.components ?? {};
  const entries = Object.entries(components).filter(([key]) => key in COMPONENT_LABELS);
  const allOk = entries.every(([, v]) => componentStatus(v) === 'operational');

  return (
    <div className="min-h-screen bg-[#05050A] text-[#F4F6FF]">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Button variant="ghost" onClick={() => navigate(-1)} className="text-[#A7ACB8] hover:text-[#F4F6FF] mb-8">
          <ArrowLeft className="w-4 h-4 mr-2" />Back
        </Button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              System Status
            </h1>
            <p className="text-[#A7ACB8]">
              {lastChecked ? `Last checked: ${lastChecked.toLocaleTimeString()}` : 'Checking…'}
              {health && ` · v${health.version} · uptime ${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m`}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={fetchHealth}
            disabled={checking}
            className="border-[#7B61FF]/30 hover:bg-[#7B61FF]/10"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {error && (
          <Card className="mb-8 border bg-[#FF6161]/5 border-[#FF6161]/30">
            <CardContent className="p-6 text-center">
              <XCircle className="w-10 h-10 text-[#FF6161] mx-auto mb-3" />
              <h2 className="text-xl font-bold text-[#FF6161]">Unable to Reach Server</h2>
              <p className="text-sm text-[#A7ACB8] mt-1">Could not connect to the health endpoint</p>
            </CardContent>
          </Card>
        )}

        {health && (
          <>
            <Card className={`mb-8 border ${allOk ? 'bg-[#61FF7B]/5 border-[#61FF7B]/30' : 'bg-[#FFD761]/5 border-[#FFD761]/30'}`}>
              <CardContent className="p-6 text-center">
                {allOk ? (
                  <>
                    <CheckCircle2 className="w-10 h-10 text-[#61FF7B] mx-auto mb-3" />
                    <h2 className="text-xl font-bold text-[#61FF7B]">All Systems Operational</h2>
                    <p className="text-sm text-[#A7ACB8] mt-1">Everything is running smoothly</p>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-10 h-10 text-[#FFD761] mx-auto mb-3" />
                    <h2 className="text-xl font-bold text-[#FFD761]">Partial Degradation</h2>
                    <p className="text-sm text-[#A7ACB8] mt-1">Some services are experiencing issues</p>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="space-y-3">
              {entries.map(([key, value]) => {
                const status = componentStatus(value);
                return (
                  <Card key={key} className="bg-[#0B0B10] border-[#7B61FF]/20">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(status)}
                          <span className="font-medium text-[#F4F6FF]">{COMPONENT_LABELS[key]}</span>
                        </div>
                        <span className={`text-sm capitalize ${getStatusColor(status)}`}>
                          {status}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {!health && !error && checking && (
          <div className="text-center text-[#A7ACB8] py-12">Checking system status…</div>
        )}

        <div className="mt-12 p-6 rounded-xl bg-[#0B0B10] border border-[#7B61FF]/20">
          <p className="text-sm text-[#A7ACB8]">
            Experiencing issues? Contact us at{' '}
            <span className="text-[#7B61FF]">support@geekspace.app</span>
          </p>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Build and verify**

```bash
cd /root/GeekSpace2.0 && npm run build 2>&1 | tail -10
```
Expected: clean build.

**Step 3: Commit**

```bash
git add src/pages/StatusPage.tsx
git commit -m "feat: wire StatusPage to real /api/health endpoint, map picoclaw → Weebo Engine"
```

---

## Task 9: Build, deploy, smoke test

**Step 1: Build server (if any server changes since last build)**

```bash
cd /root/GeekSpace2.0/server && npm run build 2>&1 | tail -5
```

**Step 2: Build frontend**

```bash
cd /root/GeekSpace2.0 && npm run build 2>&1 | tail -5
```

**Step 3: Deploy frontend**

```bash
cp -r /root/GeekSpace2.0/dist/* /var/www/geekspace/
```

**Step 4: Restart server**

```bash
fuser -k 3001/tcp 2>/dev/null; sleep 1
cd /root/GeekSpace2.0 && node server/dist/index.js &
sleep 3
```

**Step 5: Run smoke test**

```bash
bash /root/GeekSpace2.0/scripts/smoke-test.sh http://localhost:3001
```
Expected: ALL 11 TESTS PASSED

**Step 6: Final commit and push**

```bash
git push origin live-production
git push origin live-production:main
```
