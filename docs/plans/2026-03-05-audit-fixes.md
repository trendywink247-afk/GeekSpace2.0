# Audit Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 50 issues found in the 2026-03-05 full site audit, push to main, pass CI, deploy to production.

**Architecture:** Fixes grouped by blast radius — independent frontend fixes run in parallel batches, backend changes isolated, security patches first. Each task is a small focused change. Commit after every task.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind, Express + TypeScript + better-sqlite3, Docker Compose + Caddy, GitHub Actions CI.

---

## Pre-flight

```bash
cd ~/GeekSpace2.0
git checkout main && git pull
git checkout -b fix/audit-2026-03-05
cd server && npm test   # baseline — must be green before starting
cd .. && npm run lint   # baseline lint
```

---

## BATCH A — Critical Security & Data Integrity (do these first, independently)

### Task A1: Add iframe sandbox to Website Builder

**File:** `src/dashboard/pages/WebsiteBuilderPage.tsx`

Find the preview iframe and add sandbox attribute to prevent XSS escape.

**Step 1:** Search for the iframe in the file
```bash
grep -n "iframe" /root/GeekSpace2.0/src/dashboard/pages/WebsiteBuilderPage.tsx
```

**Step 2:** Add `sandbox="allow-scripts allow-modals allow-forms"` to the iframe element. The sandbox attribute must allow scripts (so the preview runs) but prevents access to parent context.

**Step 3:** Verify build passes
```bash
cd ~/GeekSpace2.0 && npm run build 2>&1 | tail -5
```

**Step 4:** Commit
```bash
git add src/dashboard/pages/WebsiteBuilderPage.tsx
git commit -m "fix: add sandbox attribute to website builder preview iframe

Prevents user-authored JS from accessing parent window context.
Refs audit finding: Security #2"
```

---

### Task A2: Cap Telegram polling at 30 attempts

**File:** `src/dashboard/pages/ConnectionsPage.tsx`

Find `telegramPollAttempts` usage. Add a max cap of 30 and show a timeout message.

**Step 1:** Read the file to find the polling logic
```bash
grep -n "telegramPoll\|pollAttempts\|exponential" /root/GeekSpace2.0/src/dashboard/pages/ConnectionsPage.tsx | head -30
```

**Step 2:** Add `MAX_TELEGRAM_POLL = 30` constant and check inside the polling loop:
```tsx
const MAX_TELEGRAM_POLL = 30;
// Inside the polling useEffect/function:
if (telegramPollAttempts >= MAX_TELEGRAM_POLL) {
  setTelegramStatus('timeout');
  return; // stop polling
}
```

**Step 3:** Add a timeout message to the UI when `telegramStatus === 'timeout'`:
```tsx
{telegramStatus === 'timeout' && (
  <p className="text-yellow-400 text-sm">
    Still waiting for Telegram link. Try clicking the bot link again or refresh.
  </p>
)}
```

**Step 4:** Commit
```bash
git add src/dashboard/pages/ConnectionsPage.tsx
git commit -m "fix: cap Telegram polling at 30 attempts to prevent infinite loop

Refs audit finding: Critical #19"
```

---

### Task A3: Fix Memory Manager — prevent silent delete divergence

**File:** `src/dashboard/pages/MemoryManagerPage.tsx`

**Step 1:** Read the handleDelete function
```bash
grep -n "handleDelete\|setMemories\|catch" /root/GeekSpace2.0/src/dashboard/pages/MemoryManagerPage.tsx | head -20
```

**Step 2:** Move the optimistic UI removal to AFTER the API call succeeds, and add error toast on failure:
```tsx
const handleDelete = async (id: number) => {
  try {
    await api.delete(`/agent/memory/${id}`);
    setMemories(prev => prev.filter(m => m.id !== id));
    toast.success('Memory deleted');
  } catch {
    toast.error('Failed to delete memory');
  }
};
```

**Step 3:** Replace `window.confirm` with a proper dialog for bulk delete. At minimum add a check:
```tsx
// For bulk delete — use the existing Dialog/AlertDialog component
// Replace: if (window.confirm(...))
// With: open a state-controlled confirmation dialog
```

**Step 4:** Commit
```bash
git add src/dashboard/pages/MemoryManagerPage.tsx
git commit -m "fix: prevent memory manager UI divergence on delete failure

Move optimistic removal after API success. Replace window.confirm
with proper dialog for PWA/WebView compatibility.
Refs audit finding: Security #6, Critical #8"
```

---

## BATCH B — P0 Frontend Fixes (parallel-friendly, different files)

### Task B1: Video Generator — add broken provider warning

**File:** `src/dashboard/pages/VideoGenPage.tsx`

**Step 1:** Read the file to understand current structure
```bash
wc -l /root/GeekSpace2.0/src/dashboard/pages/VideoGenPage.tsx
grep -n "generate\|pollinations\|seedance\|provider\|broken\|disabled" /root/GeekSpace2.0/src/dashboard/pages/VideoGenPage.tsx | head -30
```

**Step 2:** Add a prominent warning banner at the top of the page content area:
```tsx
{/* Provider availability warning */}
<div className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 mb-4">
  <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
  <div>
    <p className="text-yellow-400 font-medium text-sm">Video generation temporarily unavailable</p>
    <p className="text-yellow-400/70 text-xs mt-1">
      Free video providers (Pollinations, Seedance) are unreachable from this server.
      Video generation will be restored when a compatible provider is available.
    </p>
  </div>
</div>
```

**Step 3:** Disable the Generate button for broken providers. Find the BROKEN_VIDEO_PROVIDERS list and the generate button:
```tsx
const BROKEN_VIDEO_PROVIDERS = ['pollinations-video', 'seedance-lite', 'veo2-openrouter'];
const isProviderBroken = BROKEN_VIDEO_PROVIDERS.includes(selectedModel);

// On the Generate button:
<Button
  disabled={isGenerating || !prompt.trim() || isProviderBroken}
  ...
>
  {isProviderBroken ? 'Provider Unavailable' : 'Generate Video'}
</Button>
```

**Step 4:** Update Capabilities page to reflect broken status
In `src/dashboard/pages/CapabilitiesPage.tsx`, find the Video Generation capability card and add a badge:
```bash
grep -n "video\|Video\|film\|Film" /root/GeekSpace2.0/src/dashboard/pages/CapabilitiesPage.tsx | head -20
```
Add `<span className="text-xs text-yellow-400 ml-2">(temporarily unavailable)</span>` next to the video gen title.

**Step 5:** Lint and build check
```bash
cd ~/GeekSpace2.0 && npm run lint -- --max-warnings=0 src/dashboard/pages/VideoGenPage.tsx src/dashboard/pages/CapabilitiesPage.tsx
```

**Step 6:** Commit
```bash
git add src/dashboard/pages/VideoGenPage.tsx src/dashboard/pages/CapabilitiesPage.tsx
git commit -m "fix: show unavailability warning on video generator, disable broken providers

All free video providers (Pollinations, Seedance) blocked from Hostinger.
Disable Generate button and add clear user-facing explanation.
Update Capabilities page to reflect actual status.
Refs audit finding: P0 #1, P1 #14"
```

---

### Task B2: Chat — implement streaming + load history

**Files:**
- `src/dashboard/pages/ChatPage.tsx`
- `src/services/api.ts`

This is the highest-impact fix. The server already has `POST /api/agent/chat/stream` returning SSE.

**Step 1:** Read ChatPage to understand current state
```bash
wc -l /root/GeekSpace2.0/src/dashboard/pages/ChatPage.tsx
grep -n "agentService\|chat\|stream\|history\|conversation\|useEffect" /root/GeekSpace2.0/src/dashboard/pages/ChatPage.tsx | head -40
```

**Step 2:** Read the server streaming endpoint to understand SSE format
```bash
grep -n "chat/stream\|stream\|SSE\|text/event" /root/GeekSpace2.0/server/src/routes/agent.ts 2>/dev/null || grep -rn "chat/stream" /root/GeekSpace2.0/server/src/ | head -10
```

**Step 3:** Add streaming send function to ChatPage. Replace the `agentService.chat()` call with an SSE fetch:

```tsx
const sendMessageStreaming = async (userMessage: string) => {
  const userMsg: Message = { role: 'user', content: userMessage, id: Date.now() };
  setMessages(prev => [...prev, userMsg]);
  setIsLoading(true);

  const assistantMsg: Message = { role: 'assistant', content: '', id: Date.now() + 1 };
  setMessages(prev => [...prev, assistantMsg]);

  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const response = await fetch('/api/agent/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ message: userMessage, conversationId: currentConversationId }),
    });

    if (!response.ok) throw new Error('Stream failed');
    if (!response.body) throw new Error('No response body');

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
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            const chunk = parsed.content || parsed.delta || parsed.text || '';
            setMessages(prev => prev.map(m =>
              m.id === assistantMsg.id
                ? { ...m, content: m.content + chunk }
                : m
            ));
          } catch { /* ignore parse errors */ }
        }
      }
    }
  } catch (err) {
    console.error('Streaming failed, falling back to sync', err);
    // Fallback to synchronous call
    try {
      const res = await agentService.chat(userMessage);
      setMessages(prev => prev.map(m =>
        m.id === assistantMsg.id
          ? { ...m, content: res.data.response || res.data.message || '' }
          : m
      ));
    } catch {
      toast.error('Failed to get response');
      setMessages(prev => prev.filter(m => m.id !== assistantMsg.id));
    }
  } finally {
    setIsLoading(false);
  }
};
```

**Step 4:** Load conversation history on mount. Add a useEffect that calls GET /api/agent/conversations:
```tsx
useEffect(() => {
  const loadHistory = async () => {
    try {
      const res = await agentService.getConversations?.() || await api.get('/agent/conversations');
      const msgs = res.data?.messages || res.data?.conversations?.[0]?.messages || [];
      if (msgs.length > 0) setMessages(msgs);
    } catch { /* fresh start */ }
  };
  loadHistory();
}, []);
```
(Adjust the response path to match the actual API shape — check the server route first.)

**Step 5:** Verify server streaming endpoint shape
```bash
grep -A 30 "chat/stream\|chatStream" /root/GeekSpace2.0/server/src/routes/agent.ts 2>/dev/null | head -40
```

**Step 6:** TypeScript check
```bash
cd ~/GeekSpace2.0 && npx tsc --noEmit 2>&1 | grep -A 2 "ChatPage"
```

**Step 7:** Commit
```bash
git add src/dashboard/pages/ChatPage.tsx
git commit -m "fix: implement SSE streaming in chat and load conversation history on mount

Replaces synchronous 50-70s blocking call with streaming SSE.
Falls back to sync if SSE fails. Loads previous messages on page open.
Refs audit finding: P0 #3, P0 #4 (history)"
```

---

### Task B3: Automations — add action configuration UI

**File:** `src/dashboard/pages/AutomationsPage.tsx`

**Step 1:** Read the automation create/edit dialog
```bash
grep -n "actionType\|actionConfig\|telegram\|webhookUrl\|Dialog\|Form" /root/GeekSpace2.0/src/dashboard/pages/AutomationsPage.tsx | head -40
```

**Step 2:** Add action-specific configuration fields below the action type selector. After the `<Select>` for actionType, add:

```tsx
{/* Action configuration — shown based on selected actionType */}
{formData.actionType === 'telegram-message' && (
  <div>
    <Label>Message Text</Label>
    <Textarea
      placeholder="Message to send via Telegram..."
      value={formData.actionConfig?.message || ''}
      onChange={e => setFormData(prev => ({
        ...prev,
        actionConfig: { ...prev.actionConfig, message: e.target.value }
      }))}
    />
  </div>
)}
{formData.actionType === 'create-reminder' && (
  <div>
    <Label>Reminder Text</Label>
    <Input
      placeholder="Reminder description..."
      value={formData.actionConfig?.text || ''}
      onChange={e => setFormData(prev => ({
        ...prev,
        actionConfig: { ...prev.actionConfig, text: e.target.value }
      }))}
    />
  </div>
)}
{formData.actionType === 'call-api' && (
  <div>
    <Label>Webhook URL</Label>
    <Input
      placeholder="https://..."
      value={formData.actionConfig?.webhookUrl || ''}
      onChange={e => setFormData(prev => ({
        ...prev,
        actionConfig: { ...prev.actionConfig, webhookUrl: e.target.value }
      }))}
    />
    <Label className="mt-2">HTTP Method</Label>
    <Select
      value={formData.actionConfig?.method || 'POST'}
      onValueChange={val => setFormData(prev => ({
        ...prev,
        actionConfig: { ...prev.actionConfig, method: val }
      }))}
    >
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="POST">POST</SelectItem>
        <SelectItem value="GET">GET</SelectItem>
      </SelectContent>
    </Select>
  </div>
)}
{formData.actionType === 'whatsapp-message' && (
  <div>
    <Label>Message Text</Label>
    <Textarea
      placeholder="Message to send via WhatsApp..."
      value={formData.actionConfig?.message || ''}
      onChange={e => setFormData(prev => ({
        ...prev,
        actionConfig: { ...prev.actionConfig, message: e.target.value }
      }))}
    />
  </div>
)}
```

**Step 3:** Fix edit dialog to restore webhookUrl. When opening edit dialog, populate actionConfig from existing automation:
```tsx
// When opening edit: ensure actionConfig is populated from the stored automation
setFormData({
  ...automation,
  actionConfig: automation.actionConfig || {},
  webhookUrl: automation.actionConfig?.webhookUrl || automation.webhookUrl || '',
});
```

**Step 4:** TypeScript + lint check
```bash
cd ~/GeekSpace2.0 && npx tsc --noEmit 2>&1 | grep -A 2 "Automations"
npm run lint -- --max-warnings=0 src/dashboard/pages/AutomationsPage.tsx
```

**Step 5:** Commit
```bash
git add src/dashboard/pages/AutomationsPage.tsx
git commit -m "fix: add action configuration fields to automations create/edit dialog

Telegram, WhatsApp, create-reminder, and call-api action types now
have payload fields in the UI. Edit form restores webhookUrl from actionConfig.
Refs audit finding: P0 #4 (automations)"
```

---

### Task B4: Memory Manager — Add/Edit UI

**File:** `src/dashboard/pages/MemoryManagerPage.tsx`

**Step 1:** Read the current memory manager structure
```bash
grep -n "useState\|Modal\|Dialog\|Add\|Edit\|POST\|PUT\|handleAdd\|handleEdit" /root/GeekSpace2.0/src/dashboard/pages/MemoryManagerPage.tsx | head -30
```

**Step 2:** Add state for add/edit modal:
```tsx
const [addOpen, setAddOpen] = useState(false);
const [editMemory, setEditMemory] = useState<Memory | null>(null);
const [memoryForm, setMemoryForm] = useState({ content: '', category: 'general', source: 'manual' });
```

**Step 3:** Add handleAddMemory function:
```tsx
const handleAddMemory = async () => {
  if (!memoryForm.content.trim()) return;
  try {
    const res = await api.post('/agent/memory', memoryForm);
    setMemories(prev => [res.data, ...prev]);
    setAddOpen(false);
    setMemoryForm({ content: '', category: 'general', source: 'manual' });
    toast.success('Memory added');
  } catch {
    toast.error('Failed to add memory');
  }
};
```

**Step 4:** Add handleEditMemory function:
```tsx
const handleEditMemory = async () => {
  if (!editMemory || !memoryForm.content.trim()) return;
  try {
    const res = await api.put(`/agent/memory/${editMemory.id}`, memoryForm);
    setMemories(prev => prev.map(m => m.id === editMemory.id ? res.data : m));
    setEditMemory(null);
    toast.success('Memory updated');
  } catch {
    toast.error('Failed to update memory');
  }
};
```

**Step 5:** Add "Add Memory" button near page header and an "Edit" icon on each memory card:
```tsx
// Header area:
<Button size="sm" onClick={() => setAddOpen(true)}>
  <Plus className="h-4 w-4 mr-1" /> Add Memory
</Button>

// On each memory card:
<Button variant="ghost" size="icon" onClick={() => {
  setEditMemory(memory);
  setMemoryForm({ content: memory.content, category: memory.category, source: memory.source });
}}>
  <Pencil className="h-3 w-3" />
</Button>
```

**Step 6:** Add Dialog/Sheet for add and edit (reuse the same dialog):
```tsx
<Dialog open={addOpen || editMemory !== null} onOpenChange={open => {
  if (!open) { setAddOpen(false); setEditMemory(null); }
}}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>{editMemory ? 'Edit Memory' : 'Add Memory'}</DialogTitle>
    </DialogHeader>
    <Textarea
      placeholder="What should I remember?"
      value={memoryForm.content}
      onChange={e => setMemoryForm(p => ({ ...p, content: e.target.value }))}
      rows={4}
    />
    <Select value={memoryForm.category} onValueChange={val => setMemoryForm(p => ({ ...p, category: val }))}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="general">General</SelectItem>
        <SelectItem value="preference">Preference</SelectItem>
        <SelectItem value="fact">Fact</SelectItem>
        <SelectItem value="task">Task</SelectItem>
      </SelectContent>
    </Select>
    <DialogFooter>
      <Button onClick={editMemory ? handleEditMemory : handleAddMemory}>
        {editMemory ? 'Save' : 'Add'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Step 7:** TypeScript check and commit
```bash
cd ~/GeekSpace2.0 && npx tsc --noEmit 2>&1 | grep "MemoryManager"
git add src/dashboard/pages/MemoryManagerPage.tsx
git commit -m "fix: add Add/Edit memory UI to Memory Manager

POST /api/agent/memory and PUT /api/agent/memory/:id endpoints existed
but had no frontend UI. Users can now manually add and edit memories.
Refs audit finding: P0 #7, Critical #8"
```

---

### Task B5: Settings — wire privacy toggles to server

**File:** `src/dashboard/pages/SettingsPage.tsx`

**Step 1:** Find the privacy toggles and the save handler
```bash
grep -n "showInDirectory\|showAvatar\|showLocation\|showProjects\|showActivity\|privacy\|handleSave\|PATCH" /root/GeekSpace2.0/src/dashboard/pages/SettingsPage.tsx | head -30
```

**Step 2:** Find which API endpoint handles privacy settings. Check if PATCH /api/me or PATCH /api/portfolio accepts these fields:
```bash
grep -rn "showInDirectory\|showAvatar\|privacy" /root/GeekSpace2.0/server/src/ | head -15
```

**Step 3:** Add privacy save handler (inside the Privacy tab save button or as part of the existing profile save):
```tsx
const handlePrivacySave = async () => {
  try {
    await api.patch('/portfolio', {  // or /api/me — check which endpoint accepts these
      showInDirectory: privacySettings.showInDirectory,
      showAvatar: privacySettings.showAvatar,
      showLocation: privacySettings.showLocation,
      showProjects: privacySettings.showProjects,
      showActivity: privacySettings.showActivity,
    });
    toast.success('Privacy settings saved');
  } catch {
    toast.error('Failed to save privacy settings');
  }
};
```

**Step 4:** Connect the Save button in the Privacy tab to `handlePrivacySave`.

**Step 5:** Fix the default name "Alex Chen" bug:
```tsx
// Change: value={formData.name || 'Alex Chen'}
// To:     value={formData.name || ''}
// And:    placeholder="Your name"
```

**Step 6:** Commit
```bash
git add src/dashboard/pages/SettingsPage.tsx
git commit -m "fix: wire privacy toggles to server, remove demo data defaults

Privacy settings (showInDirectory, showAvatar, etc.) now save to server.
Removed 'Alex Chen'/'alex@example.com' demo data defaults from profile form.
Refs audit finding: P0 #5, Critical #7, Critical #20"
```

---

### Task B6: Image Gallery — unify with Image Gen endpoint

**Files:**
- `src/dashboard/pages/ImageGalleryPage.tsx`
- Check server route for `/api/image/gallery` vs `/api/images`

**Step 1:** Read both pages to understand the endpoint split
```bash
grep -n "api\|endpoint\|fetch\|gallery\|images" /root/GeekSpace2.0/src/dashboard/pages/ImageGalleryPage.tsx | head -20
grep -n "api\|endpoint\|fetch\|gallery\|images" /root/GeekSpace2.0/src/dashboard/pages/ImageGenPage.tsx | head -20
```

**Step 2:** Check which server endpoint serves which data
```bash
grep -rn "image/gallery\|api/images\|route.*image" /root/GeekSpace2.0/server/src/ | head -20
```

**Step 3:** Update ImageGalleryPage to use the same endpoint as ImageGenPage (`GET /api/images`). Update the fetch call and the response parsing to match the ImageGen format.

**Step 4:** Update empty state message in Gallery to be accurate.

**Step 5:** Verify the response shape is handled correctly (both pages may need to handle the same shape).

**Step 6:** Commit
```bash
git add src/dashboard/pages/ImageGalleryPage.tsx
git commit -m "fix: unify image gallery and image gen to use same API endpoint

Both pages now read from GET /api/images. Images generated on
/image-gen now appear in /gallery as expected.
Refs audit finding: P0 #2, Critical #2"
```

---

## BATCH C — P1 Fixes (independent, can be done in parallel)

### Task C1: Enable OAuth login buttons

**File:** `src/onboarding/LoginPage.tsx`

**Step 1:** Find the disabled OAuth buttons
```bash
grep -n "disabled\|OAuth\|google\|github\|coming soon" /root/GeekSpace2.0/src/onboarding/LoginPage.tsx | head -20
```

**Step 2:** Remove `disabled` prop and "OAuth coming soon" text. Change button onClick to navigate to the OAuth endpoint:
```tsx
// Google OAuth button:
<Button
  variant="outline"
  className="w-full"
  onClick={() => window.location.href = '/auth/google'}
>
  <svg ...googleIcon.../> Continue with Google
</Button>

// GitHub OAuth button:
<Button
  variant="outline"
  className="w-full"
  onClick={() => window.location.href = '/auth/github'}
>
  <GitHubIcon /> Continue with GitHub
</Button>
```

**Step 3:** Verify the OAuth routes in the backend match:
```bash
grep -n "router\.\(get\|post\)\|'/google'\|'/github'" /root/GeekSpace2.0/server/src/routes/oauth.ts | head -10
```

**Step 4:** Commit
```bash
git add src/onboarding/LoginPage.tsx
git commit -m "fix: enable Google and GitHub OAuth buttons on login page

Backend OAuth routes were fully implemented. Frontend had buttons
disabled with 'OAuth coming soon'. Remove disabled state and wire
buttons to /auth/google and /auth/github.
Refs audit finding: P1 #9, Critical #6"
```

---

### Task C2: Fix Connect page brand + invite redirect

**Files:**
- `src/pages/ConnectPage.tsx` (brand fix)
- `src/pages/InvitePage.tsx` (redirect fix)

**Step 1:** Fix brand leak on ConnectPage
```bash
grep -n "GeekSpace\|Agentin\|logo\|brand" /root/GeekSpace2.0/src/pages/ConnectPage.tsx | head -10
```
Replace "GeekSpace" with "Agentin Chat" in the logo/header.

**Step 2:** Fix success CTA — change `/login` to `/invite` (or `/register`):
```bash
grep -n "login\|signup\|register\|navigate" /root/GeekSpace2.0/src/pages/ConnectPage.tsx | head -10
```

**Step 3:** Fix invite post-signup redirect
```bash
grep -n "navigate\|dashboard\|onboarding" /root/GeekSpace2.0/src/pages/InvitePage.tsx | head -15
```
Change `navigate('/dashboard')` to `navigate('/onboarding')` for new users (check if there's a way to detect new vs existing user from the response).

**Step 4:** Fix Portfolio page title brand
```bash
grep -n "document.title\|GeekSpace\|Agentin" /root/GeekSpace2.0/src/portfolio/PortfolioView.tsx | head -5
```
Change `"${name} | GeekSpace"` to `"${name} | Agentin Chat"`.

**Step 5:** Commit
```bash
git add src/pages/ConnectPage.tsx src/pages/InvitePage.tsx src/portfolio/PortfolioView.tsx
git commit -m "fix: brand consistency and invite post-signup redirect

- Connect page: replace 'GeekSpace' logo with 'Agentin Chat'
- Invite page: redirect new users to /onboarding not /dashboard
- Portfolio page title: use 'Agentin Chat' brand
Refs audit finding: P1 #10, P1 #12, Brand #1, Brand #8"
```

---

### Task C3: Fix portfolio social link double-protocol

**File:** `src/portfolio/PortfolioView.tsx`

**Step 1:** Find social link construction
```bash
grep -n "https://\${\\|social\.\|github\|twitter\|linkedin" /root/GeekSpace2.0/src/portfolio/PortfolioView.tsx | head -20
```

**Step 2:** Add a helper function to normalize URLs:
```tsx
const normalizeUrl = (url: string): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
};
```

**Step 3:** Replace all `https://${portfolio.social.github}` patterns with `normalizeUrl(portfolio.social.github)`.

**Step 4:** Commit
```bash
git add src/portfolio/PortfolioView.tsx
git commit -m "fix: prevent double-protocol in portfolio social links

URLs already containing https:// were getting prepended again.
Add normalizeUrl helper that only adds https:// when not present.
Refs audit finding: P1 #13, Critical #12"
```

---

### Task C4: Fix onboarding OpenRouter API key save

**File:** `src/onboarding/steps/AgentStep.tsx` (or OnboardingWizard.tsx — check where getStepData is defined)

**Step 1:** Find where the API key input is and where getStepData is called
```bash
grep -n "apiKey\|openRouter\|openrouter\|getStepData\|API key" /root/GeekSpace2.0/src/onboarding/steps/AgentStep.tsx 2>/dev/null | head -20
grep -n "apiKey\|getStepData" /root/GeekSpace2.0/src/onboarding/OnboardingWizard.tsx | head -20
```

**Step 2:** Add `apiKey` to the data returned by `getStepData(2)` (or whichever step collects the API key):
```tsx
// In getStepData for step 2 (Agent step):
return {
  personality: selectedPersonality,
  agentName: agentName,
  apiKey: apiKeyValue,  // ADD THIS — was missing
};
```

**Step 3:** Verify the server endpoint accepts and stores apiKey:
```bash
grep -rn "apiKey\|api_key\|openrouter" /root/GeekSpace2.0/server/src/routes/auth.ts | head -10
```

**Step 4:** Commit
```bash
git add src/onboarding/steps/AgentStep.tsx src/onboarding/OnboardingWizard.tsx
git commit -m "fix: include OpenRouter API key in onboarding step 2 data

Key was visible in UI but dropped from getStepData() — never sent to server.
Refs audit finding: P1 #11, Critical #9"
```

---

### Task C5: CSS typos and small visual bugs (batch)

**Files:**
- `src/pages/StatusPage.tsx` — `h10` → `h-10`
- `src/dashboard/pages/GmailPage.tsx` — `w-ztext-[#00F0FF]` → `w-5 h-5 text-[#00F0FF]`
- `src/dashboard/pages/AgentSettingsPage.tsx` — `Image` icon → `Brain` icon on System Instructions
- `src/dashboard/DashboardApp.tsx` — "View All" navigates to `'terminal'` → `'activity'`

**Step 1:** Fix Status page CSS typo
```bash
grep -n "h10\|h-10\|CheckCircle" /root/GeekSpace2.0/src/pages/StatusPage.tsx | head -5
# Fix: change h10 to h-10
```

**Step 2:** Fix Gmail icon className
```bash
grep -n "w-ztext\|Mail\|className" /root/GeekSpace2.0/src/dashboard/pages/GmailPage.tsx | grep -n "145\|w-z" | head -5
# Fix: w-ztext-[#00F0FF] → w-5 h-5 text-[#00F0FF]
```

**Step 3:** Fix Agent Settings wrong icon
```bash
grep -n "Image\|System Instructions\|system_instructions" /root/GeekSpace2.0/src/dashboard/pages/AgentSettingsPage.tsx | head -10
# Replace Image icon with Brain or FileText icon for System Instructions section
```

**Step 4:** Fix Dashboard "View All" navigation
```bash
grep -n "View All\|terminal\|activity\|navigate" /root/GeekSpace2.0/src/dashboard/pages/OverviewPage.tsx | head -10
# Change navigate to 'terminal' → navigate to 'activity'
```

**Step 5:** Fix Activity Log pull-to-refresh
```bash
grep -n "handlePullRefresh\|getActivity\|setEntries" /root/GeekSpace2.0/src/dashboard/pages/ActivityPage.tsx | head -10
# The refresh fires API call but discards result. Fix to update entries state.
```

**Step 6:** Commit all small fixes together
```bash
git add src/pages/StatusPage.tsx src/dashboard/pages/GmailPage.tsx src/dashboard/pages/AgentSettingsPage.tsx src/dashboard/pages/OverviewPage.tsx src/dashboard/pages/ActivityPage.tsx
git commit -m "fix: CSS typos, wrong icon, broken navigation, pull-to-refresh state

- Status page: h10 → h-10 (icon height typo)
- Gmail page: w-ztext-[#00F0FF] → w-5 h-5 text-[#00F0FF]
- Agent Settings: Image icon → Brain icon on System Instructions
- Overview: 'View All' in Recent Activity navigates to 'activity' not 'terminal'
- Activity Log: pull-to-refresh now updates entries state from API response
Refs audit finding: P1 #21, P1 #18, P1 #23, P2 #28, P1 #16"
```

---

### Task C6: Fix Agent Settings form clobbering + Memory nav link

**File:** `src/dashboard/pages/AgentSettingsPage.tsx`

**Step 1:** Read the sync useEffect
```bash
grep -n "useEffect\|isDirty\|agent\.\|setForm\|sync" /root/GeekSpace2.0/src/dashboard/pages/AgentSettingsPage.tsx | head -30
```

**Step 2:** Add an `isDirty` ref to skip store sync when user has unsaved changes:
```tsx
const isDirty = useRef(false);

// In the form change handlers, set isDirty = true
const handleFieldChange = (field: string, value: string) => {
  isDirty.current = true;
  setFormData(prev => ({ ...prev, [field]: value }));
};

// In the sync useEffect:
useEffect(() => {
  if (isDirty.current) return; // don't clobber unsaved edits
  if (agent) {
    setFormData({ ...agent });
  }
}, [agent]); // or whatever the dependency is

// In the save handler, reset isDirty after successful save:
const handleSave = async () => {
  await updateAgent(formData);
  isDirty.current = false;
  toast.success('Settings saved');
};
```

**Step 3:** Fix Memory link — replace `<a href="/dashboard/memory">` with proper navigation:
```bash
grep -n "href.*memory\|<a " /root/GeekSpace2.0/src/dashboard/pages/AgentSettingsPage.tsx | head -5
# Replace with: <button onClick={() => navigate('/dashboard/memory')}>Memory Manager</button>
# Or use the setCurrentPage approach from DashboardApp
```

**Step 4:** Commit
```bash
git add src/dashboard/pages/AgentSettingsPage.tsx
git commit -m "fix: prevent form clobbering in agent settings, fix memory nav link

isDirty ref prevents background store updates from overwriting unsaved
form edits. Memory Manager link uses client-side navigation.
Refs audit finding: P1 #18, Critical #15"
```

---

### Task C7: Mobile touch target fixes

**Files:** (multiple — batch all touch target fixes)
- `src/dashboard/pages/InboxPage.tsx` — action buttons 28px → min 44px
- `src/dashboard/pages/HealthDashboardPage.tsx` — retry button 24px → min 44px
- `src/dashboard/pages/ActivityPage.tsx` — delete hover-only → always visible on mobile
- `src/dashboard/pages/TerminalPage.tsx` — copy hover-only → always visible on mobile
- `src/pages/StatusPage.tsx` — mobile header overflow fix

**Step 1:** Fix Inbox action buttons — add `min-h-[44px] min-w-[44px]` or `p-3` to action buttons
```bash
grep -n "p-1\.5\|h-7\|w-7\|action\|mark\|archive\|delete" /root/GeekSpace2.0/src/dashboard/pages/InboxPage.tsx | head -20
```

**Step 2:** Fix Health retry button
```bash
grep -n "h-6\|retry\|Retry\|reconnect" /root/GeekSpace2.0/src/dashboard/pages/HealthDashboardPage.tsx | head -10
# Add min-h-[44px] to retry button
```

**Step 3:** Fix Activity delete — remove `group-hover:opacity-100`, always show delete button
```bash
grep -n "group-hover\|opacity\|delete\|Delete" /root/GeekSpace2.0/src/dashboard/pages/ActivityPage.tsx | head -10
# Change opacity-0 group-hover:opacity-100 to always visible (or show on mobile via media query)
```

**Step 4:** Fix Terminal copy — same hover-only fix
```bash
grep -n "hover\|copy\|Copy\|clipboard" /root/GeekSpace2.0/src/dashboard/pages/TerminalPage.tsx | head -10
```

**Step 5:** Fix Status page mobile header overflow
```bash
grep -n "Last checked\|flex\|wrap\|overflow" /root/GeekSpace2.0/src/pages/StatusPage.tsx | head -10
# Add flex-wrap to the header row so it wraps on narrow screens
```

**Step 6:** Commit
```bash
git add src/dashboard/pages/InboxPage.tsx src/dashboard/pages/HealthDashboardPage.tsx src/dashboard/pages/ActivityPage.tsx src/dashboard/pages/TerminalPage.tsx src/pages/StatusPage.tsx
git commit -m "fix: mobile touch targets and hover-only interactions

- Inbox action buttons: 28px → 44px min touch target
- Health retry: 24px → 44px
- Activity delete: hover-only → always visible
- Terminal copy: hover-only → always visible on mobile
- Status header: add flex-wrap for narrow screens
Refs audit finding: Mobile issues"
```

---

### Task C8: Fix Forgot Password response contract + Proactive AI locale

**Files:**
- `src/onboarding/ForgotPasswordPage.tsx`
- `src/dashboard/pages/ProactivePage.tsx`

**Step 1:** Fix forgot password — check server route response format first
```bash
grep -n "success\|message\|channel\|res.data" /root/GeekSpace2.0/server/src/routes/auth.ts | grep -i "forgot\|otp\|reset" | head -10
grep -n "res.data.success\|res.data.message\|success\|channel" /root/GeekSpace2.0/src/onboarding/ForgotPasswordPage.tsx | head -10
```

Update the client check to match what the server actually returns, OR update server to include `success: true` in response. Prefer updating the client since it's the simpler change:
```tsx
// Instead of checking res.data.success, check for presence of a token/OTP channel:
if (res.data.message || res.data.channel || res.status === 200) {
  setStep('otp');
}
```

**Step 2:** Fix Proactive AI hardcoded locale
```bash
grep -n "en-IN\|locale\|formatDate\|toLocaleDateString" /root/GeekSpace2.0/src/dashboard/pages/ProactivePage.tsx | head -10
# Replace 'en-IN' with navigator.language
```

**Step 3:** Commit
```bash
git add src/onboarding/ForgotPasswordPage.tsx src/dashboard/pages/ProactivePage.tsx
git commit -m "fix: forgot password response contract and proactive AI locale

- Forgot password: client checks actual server response shape
- Proactive AI: replace hardcoded 'en-IN' with navigator.language
Refs audit finding: P1 #24, P2 #29"
```

---

### Task C9: Focus & Habits — add error toasts

**File:** `src/dashboard/pages/FocusPage.tsx`

**Step 1:** Read all the empty catch blocks
```bash
grep -n "catch\|try\|toast\|error" /root/GeekSpace2.0/src/dashboard/pages/FocusPage.tsx | head -30
```

**Step 2:** For every empty `catch {}` block, add a `toast.error(...)` call:
```tsx
// startFocus
} catch {
  toast.error('Failed to start focus session');
}

// endFocus
} catch {
  toast.error('Failed to end focus session');
}

// logHabit
} catch {
  toast.error('Failed to log habit');
}

// addHabit
} catch {
  toast.error('Failed to add habit');
}

// deleteHabit
} catch {
  toast.error('Failed to delete habit');
}
```

**Step 3:** Commit
```bash
git add src/dashboard/pages/FocusPage.tsx
git commit -m "fix: add error feedback to focus & habits API call failures

All catch blocks were empty — users had no feedback when API calls failed.
Refs audit finding: P2 #30"
```

---

### Task C10: Explore filter, Roadmap, Reminders, and Recipes fixes

**Files:** Multiple small fixes batched together.

**Step 1:** Fix Explore stale closure
```bash
grep -n "profiles\|fetchProfiles\|useCallback\|dependency\|eslint-disable" /root/GeekSpace2.0/src/explore/ExplorePage.tsx | head -20
# Fix the dependency array to include profiles, or use a ref
```

**Step 2:** Fix Reminders isOverdue — match by ID not datetime string
```bash
grep -n "isOverdue\|datetime\|overdue\|id" /root/GeekSpace2.0/src/dashboard/pages/RemindersPage.tsx | head -20
# isOverdue should check reminder.id against a Set of overdue IDs, not datetime string comparison
```

**Step 3:** Fix Recipes — add integration pre-check before install
```bash
grep -n "install\|activate\|integrations\|telegram\|connected" /root/GeekSpace2.0/src/dashboard/pages/RecipesPage.tsx | head -20
# Before installing a telegram recipe, check if integrations.some(i => i.type === 'telegram' && i.status === 'active')
# If not, show a toast: "Connect Telegram first to use this recipe"
```

**Step 4:** Commit
```bash
git add src/explore/ExplorePage.tsx src/dashboard/pages/RemindersPage.tsx src/dashboard/pages/RecipesPage.tsx
git commit -m "fix: explore stale closure, reminders isOverdue by ID, recipes integration check

- Explore: fix dependency array so fetch errors surface after initial load
- Reminders: isOverdue lookup by ID not datetime string
- Recipes: warn before installing recipe that requires unconnected integration
Refs audit finding: P2 #27, P2 #25, P2 #39"
```

---

## BATCH D — Backend Fixes

### Task D1: Fix server response format for forgot password

**File:** `server/src/routes/auth.ts`

**Step 1:** Find the forgot password route response
```bash
grep -n "forgot\|reset\|otp\|json\|success" /root/GeekSpace2.0/server/src/routes/auth.ts | head -20
```

**Step 2:** Add `success: true` to the successful OTP send response:
```ts
res.json({ success: true, message: 'OTP sent', channel: 'email' });
```

**Step 3:** Run server tests
```bash
cd ~/GeekSpace2.0/server && npm test 2>&1 | tail -20
```

**Step 4:** Commit
```bash
git add server/src/routes/auth.ts
git commit -m "fix: add success field to forgot password OTP response

Frontend was checking res.data.success which was missing from response.
Was working by coincidence — now explicit and contract-stable.
Refs audit finding: Security #10, P1 #24"
```

---

### Task D2: Fix Telegram notification permission check

**File:** `server/src/routes/integrations.ts` or `server/src/services/message-router.ts`

**Step 1:** Find the notification permission check
```bash
grep -n "notif_connections\|!== 0\|=== 1\|NULL\|notify" /root/GeekSpace2.0/server/src/routes/integrations.ts /root/GeekSpace2.0/server/src/services/message-router.ts 2>/dev/null | head -20
```

**Step 2:** Change `!== 0` to `=== 1` for explicit opt-in (prevents NULL values from enabling notifications):
```ts
// Before: if (agentCfg.notif_connections !== 0)
// After:  if (agentCfg.notif_connections === 1)
```

**Step 3:** Run tests
```bash
cd ~/GeekSpace2.0/server && npm test 2>&1 | tail -10
```

**Step 4:** Commit
```bash
git add server/src/routes/integrations.ts server/src/services/message-router.ts
git commit -m "fix: use explicit === 1 for Telegram notification permission check

NULL values in DB were passing !== 0 check, enabling notifications
for users who never explicitly opted in.
Refs audit finding: Security #8"
```

---

## BATCH E — Verification & Deploy

### Task E1: Full test + lint + build

```bash
cd ~/GeekSpace2.0

# Server tests
cd server && npm test
# Expected: all tests pass (1656+ tests)

# TypeScript check — frontend
cd .. && npx tsc --noEmit
# Expected: 0 errors

# TypeScript check — server
cd server && npx tsc --noEmit
cd ..

# Lint
npm run lint
# Expected: 0 errors, 0 warnings

# Production build
npm run build && cd server && npm run build
# Expected: dist/ generated with no errors
```

Fix any failures before proceeding.

---

### Task E2: Push to main and wait for CI

```bash
cd ~/GeekSpace2.0

# Final status check
git log --oneline -20
git status

# Push to feature branch
git push -u origin fix/audit-2026-03-05

# Create PR targeting main
gh pr create \
  --title "fix: full site audit fixes — 40+ bugs across 42 pages" \
  --body "$(cat <<'EOF'
## Summary
Fixes from the 2026-03-05 full site audit covering all 42 pages.

## P0 Fixes (critical)
- Video generator: unavailability warning, disabled broken providers
- Chat: SSE streaming + conversation history on mount
- Automations: action configuration fields in create/edit UI
- Memory Manager: Add/Edit UI (POST/PUT endpoints had no frontend)
- Settings privacy toggles: wired to server (were UI-only)
- Image Gallery: unified to same endpoint as Image Gen
- Website Builder: iframe sandbox attribute

## P1 Fixes (high impact)
- OAuth buttons: enabled (backend was already implemented)
- Brand: Connect page now shows "Agentin Chat"
- Invite: post-signup redirects to /onboarding not /dashboard
- Portfolio social links: double-protocol bug fixed
- Onboarding: OpenRouter API key no longer silently discarded
- Capabilities: Video Gen marked as temporarily unavailable
- CSS typos: Status h10, Gmail w-ztext
- Activity log: pull-to-refresh now updates state
- Agent settings: form clobbering fixed, System Instructions icon fixed
- Telegram: polling capped at 30 attempts

## P2 Fixes
- Mobile touch targets: Inbox, Health, Activity, Terminal
- Focus & Habits: error toasts on API failures
- Proactive AI: locale uses navigator.language not hardcoded en-IN
- Reminders: isOverdue lookup by ID not datetime string
- Recipes: pre-install integration check

## Backend
- Forgot password: explicit success field in response
- Telegram notifications: === 1 check (not !== 0)
- Memory Manager: prevent UI divergence on failed delete

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"

# Watch CI
gh pr checks --watch
```

---

### Task E3: Fix CI failures (if any)

If CI fails:

```bash
# Check which checks failed
gh pr checks

# View failing test output
gh run view --log-failed

# Common fixes:
# TypeScript error: npx tsc --noEmit → fix the error
# Lint error: npm run lint → fix the warning/error
# Test failure: cd server && npm test -- --reporter=verbose 2>&1 | grep -A 10 "FAIL"
```

Fix, commit, push — CI will re-run automatically.

---

### Task E4: Merge to main + deploy to production

**Only after CI is green:**

```bash
# Merge the PR
gh pr merge --squash --delete-branch

# Switch to main and pull
git checkout main && git pull

# Deploy to production
cd ~/GeekSpace2.0
docker compose up -d --build geekspace

# Wait for container to be healthy
docker compose ps
curl -s localhost:3001/api/health | jq '.status'
# Expected: "ok"

# Copy new frontend build to Caddy volume
docker cp geekspace-app:/app/dist/. /var/www/geekspace/
# (Only if Caddy serves static files from host volume — check Caddyfile)

# Verify production
curl -s https://ai.geekspace.space | head -5
curl -s https://api.geekspace.space/api/health

# Monitor logs for 5 minutes
docker compose logs -f geekspace-app --tail=50
```

---

## Summary — What Gets Fixed

| Priority | Count | Key Items |
|----------|-------|-----------|
| P0 | 8 | Streaming chat, video warning, automations config, memory CRUD, gallery unification, privacy toggles, iframe sandbox |
| P1 | 16 | OAuth, brand, invite redirect, social links, CSS typos, form clobbering, mobile touch targets |
| P2 | 10 | Error toasts, locale fix, isOverdue, stale closure, recipes check, pull-to-refresh |
| Backend | 2 | Response contract, permission check |
| **Total** | **36** | out of 50 audit items (P3 items deferred as future features) |
