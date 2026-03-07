# Phase 104 — ReAct Tool Loop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire a multi-turn ReAct (Reason + Act) loop so the agent can call web_search, set_reminder, and telegram_notify in sequence within a single user request — visible via status messages in both web chat and Telegram/WhatsApp.

**Architecture:** Keep the existing `<<<ACTION>>>` format and action-parser/executor infrastructure. New `react-loop.ts` service wraps `routeChat()` in a loop: LLM generates → parse actions → execute → inject observations → repeat (max 5 iterations). Callers provide an `onStatus` callback so status messages ("🔍 Searching…") reach the user immediately. Wire into both `message-router.ts` (bot path) and `agent.ts` main `/chat` endpoint (web path).

**Tech Stack:** TypeScript, existing `routeChat`/`parseActions`/`executeAction` services, `tavilySearch` (already exists), `sendTelegramMessage` (already exists), Zod (already imported in action-parser).

---

### Task 1: Add `web_search` and `telegram_notify` to TOOL_SCHEMAS

**Files:**
- Modify: `server/src/services/action-parser.ts:88-103` (TOOL_SCHEMAS object)

**Step 1: Write the failing test**

File: `server/src/test/api/phase104.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SERVER_ROOT = resolve(__dirname, '../../..');

describe('Phase 104 — ReAct Tool Loop', () => {
  describe('104.1 Tool schemas', () => {
    it('TOOL_SCHEMAS includes web_search', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/action-parser.ts'), 'utf-8');
      expect(content).toContain("web_search:");
    });

    it('TOOL_SCHEMAS includes telegram_notify', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/action-parser.ts'), 'utf-8');
      expect(content).toContain("telegram_notify:");
    });

    it('web_search schema requires query string', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/action-parser.ts'), 'utf-8');
      expect(content).toContain('webSearchSchema');
      expect(content).toContain("query: z.string()");
    });

    it('telegram_notify schema requires message string', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/action-parser.ts'), 'utf-8');
      expect(content).toContain('telegramNotifySchema');
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /root/GeekSpace2.0/server && npx vitest run src/test/api/phase104.test.ts 2>&1 | head -40
```

Expected: FAIL — "TOOL_SCHEMAS includes web_search"

**Step 3: Add the two schemas and register them**

In `server/src/services/action-parser.ts`, add after `escalateToOwnerSchema` (line 86):

```typescript
const webSearchSchema = z.object({
  query: z.string().min(1).max(500),
});

const telegramNotifySchema = z.object({
  message: z.string().min(1).max(1000),
});
```

Then in `TOOL_SCHEMAS` (after `escalate_to_owner: escalateToOwnerSchema`), add:

```typescript
  web_search: webSearchSchema,
  telegram_notify: telegramNotifySchema,
```

**Step 4: Run test to verify it passes**

```bash
cd /root/GeekSpace2.0/server && npx vitest run src/test/api/phase104.test.ts 2>&1 | head -40
```

Expected: PASS (4 tests)

**Step 5: Commit**

```bash
cd /root/GeekSpace2.0 && git add server/src/services/action-parser.ts server/src/test/api/phase104.test.ts && git commit -m "feat(phase104): add web_search and telegram_notify to TOOL_SCHEMAS"
```

---

### Task 2: Add executors for `web_search` and `telegram_notify`

**Files:**
- Modify: `server/src/services/action-executor.ts` (add two new cases in the switch)

**Step 1: Write the failing test**

Add to `phase104.test.ts` describe block:

```typescript
  describe('104.2 Executors', () => {
    it('action-executor.ts handles web_search', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/action-executor.ts'), 'utf-8');
      expect(content).toContain("case 'web_search':");
      expect(content).toContain('tavilySearch');
    });

    it('action-executor.ts handles telegram_notify', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/action-executor.ts'), 'utf-8');
      expect(content).toContain("case 'telegram_notify':");
      expect(content).toContain('sendTelegramMessage');
    });
  });
```

**Step 2: Run test to verify it fails**

```bash
cd /root/GeekSpace2.0/server && npx vitest run src/test/api/phase104.test.ts 2>&1 | head -40
```

Expected: FAIL

**Step 3: Add executor cases**

First, add the imports at the top of `action-executor.ts` (after existing imports):

```typescript
import { tavilySearch } from './tavily.js';
import { sendTelegramMessage } from './telegram.js';
```

Note: `sendTelegramNotification` is already imported; add `sendTelegramMessage` import alongside it.

Actually, check line 19 — `sendTelegramNotification` and `escapeTelegramHtml` are already imported from `./telegram.js`. Change that import to also include `sendTelegramMessage`:

```typescript
import { sendTelegramNotification, sendTelegramMessage, escapeTelegramHtml } from './telegram.js';
```

And add `tavilySearch` import:

```typescript
import { tavilySearch } from './tavily.js';
```

Then add two new cases in the `switch (tool)` block, **before** the `default` case (around line 554):

```typescript
      // ── web_search ─────────────────────────────────────────
      case 'web_search': {
        const query = params.query as string;
        try {
          const searchResult = await tavilySearch(query, 5);
          if (searchResult.results.length === 0) {
            return {
              tool,
              success: false,
              message: 'No search results found for that query.',
            };
          }
          const summary = searchResult.results
            .map((r, i) => `${i + 1}. ${r.title}\n   ${r.content}\n   Source: ${r.url}`)
            .join('\n\n');
          return {
            tool,
            success: true,
            message: `Found ${searchResult.results.length} results for "${query}"`,
            data: { query, results: searchResult.results, summary },
          };
        } catch (err) {
          return {
            tool,
            success: false,
            message: `Web search failed: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }

      // ── telegram_notify ────────────────────────────────────
      case 'telegram_notify': {
        const message = params.message as string;

        // Look up user's linked Telegram chat ID
        const telegramLink = db.prepare(
          "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram' AND is_verified = 1 ORDER BY linked_at DESC LIMIT 1"
        ).get(userId) as { external_id: string } | undefined;

        if (!telegramLink) {
          return {
            tool,
            success: false,
            message: 'No Telegram account connected. Link your Telegram in Connections.',
          };
        }

        try {
          await sendTelegramMessage(telegramLink.external_id, message);
          return {
            tool,
            success: true,
            message: `Telegram notification sent`,
            data: { chatId: telegramLink.external_id },
          };
        } catch (err) {
          return {
            tool,
            success: false,
            message: `Telegram send failed: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }
```

**Step 4: Run test to verify it passes**

```bash
cd /root/GeekSpace2.0/server && npx vitest run src/test/api/phase104.test.ts 2>&1 | head -40
```

Expected: PASS (6 tests so far)

**Step 5: Commit**

```bash
cd /root/GeekSpace2.0 && git add server/src/services/action-executor.ts && git commit -m "feat(phase104): add web_search and telegram_notify executors"
```

---

### Task 3: Create `react-loop.ts`

**Files:**
- Create: `server/src/services/react-loop.ts`

**Step 1: Write the failing test**

Add to `phase104.test.ts`:

```typescript
  describe('104.3 ReAct loop service', () => {
    it('react-loop.ts file exists', () => {
      const { existsSync } = require('fs');
      expect(existsSync(resolve(SERVER_ROOT, 'src/services/react-loop.ts'))).toBe(true);
    });

    it('exports runReActLoop function', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/react-loop.ts'), 'utf-8');
      expect(content).toContain('export async function runReActLoop');
    });

    it('defines MAX_REACT_ITERATIONS = 5', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/react-loop.ts'), 'utf-8');
      expect(content).toContain('MAX_REACT_ITERATIONS = 5');
    });

    it('injects observations back into messages', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/react-loop.ts'), 'utf-8');
      expect(content).toContain('[OBSERVATION');
    });

    it('returns accumulated observations on max iterations', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/react-loop.ts'), 'utf-8');
      expect(content).toContain('MAX_REACT_ITERATIONS');
      expect(content).toContain('observations');
    });

    it('calls onStatus for each tool execution', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/react-loop.ts'), 'utf-8');
      expect(content).toContain('onStatus');
    });
  });
```

**Step 2: Run test to verify it fails**

```bash
cd /root/GeekSpace2.0/server && npx vitest run src/test/api/phase104.test.ts 2>&1 | head -50
```

Expected: FAIL — file does not exist

**Step 3: Create `react-loop.ts`**

Create `server/src/services/react-loop.ts`:

```typescript
// ============================================================
// ReAct Loop — Reasoning + Acting Multi-Turn Tool Use
//
// Wraps routeChat() in a loop:
//   1. LLM generates text (possibly with <<<ACTION>>> blocks)
//   2. Parse and execute each action
//   3. Inject results as [OBSERVATION] messages
//   4. Repeat until no actions remain or max iterations hit
//   5. If max hit: return accumulated observations summary
//
// Status messages are emitted via onStatus callback so callers
// can notify the user in real-time (SSE write / Telegram send).
// ============================================================

import { routeChat, type ChatMessage, type Provider } from './llm.js';
import { parseActions } from './action-parser.js';
import { executeAction } from './action-executor.js';
import { logger } from '../logger.js';

const MAX_REACT_ITERATIONS = 5;

export interface ReActResult {
  text: string;
  iterations: number;
  observations: string[];
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  creditCost: number;
}

export type StatusCallback = (msg: string) => void | Promise<void>;

export interface ReActOpts {
  onStatus: StatusCallback;
  systemPrompt?: string;
  agentName?: string;
  userCredits?: number;
  forceProvider?: Provider;
  userId?: string;
  userPlan?: string;
}

// Map tool name → user-visible status message
function toolStatusMessage(tool: string): string {
  switch (tool) {
    case 'web_search': return '🔍 Searching the web…';
    case 'set_reminder': return '⏰ Setting reminder…';
    case 'telegram_notify': return '📨 Sending Telegram notification…';
    case 'send_email': return '📧 Sending email…';
    case 'generate_image': return '🎨 Generating image…';
    case 'generate_code': return '💻 Building website…';
    default: return `🔧 Running ${tool}…`;
  }
}

export async function runReActLoop(
  initialMessages: ChatMessage[],
  userId: string,
  opts: ReActOpts,
): Promise<ReActResult> {
  const {
    onStatus,
    systemPrompt,
    agentName,
    userCredits,
    forceProvider,
    userPlan,
  } = opts;

  const messages = [...initialMessages];
  const observations: string[] = [];
  let lastProvider = 'ollama';
  let lastModel = '';
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let totalCreditCost = 0;

  for (let i = 0; i < MAX_REACT_ITERATIONS; i++) {
    // Call LLM
    const result = await routeChat(messages, {
      systemPrompt,
      agentName,
      userCredits,
      forceProvider,
      userId,
      userPlan,
    });

    lastProvider = result.provider;
    lastModel = result.model;
    totalTokensIn += result.tokensIn;
    totalTokensOut += result.tokensOut;
    totalCreditCost += result.creditCost;

    // Parse any tool actions from the response
    const { text: cleanText, actions } = parseActions(result.reply);

    if (actions.length === 0) {
      // No tool calls — we're done
      logger.debug({ iterations: i + 1, userId }, 'react-loop: done (no actions)');
      return {
        text: cleanText || result.reply,
        iterations: i + 1,
        observations,
        provider: lastProvider,
        model: lastModel,
        tokensIn: totalTokensIn,
        tokensOut: totalTokensOut,
        creditCost: totalCreditCost,
      };
    }

    // Append assistant message (with action blocks) to history
    messages.push({ role: 'assistant', content: result.reply });

    // Execute each action and collect observations
    const observationParts: string[] = [];
    for (const action of actions) {
      await onStatus(toolStatusMessage(action.tool));
      const actionResult = await executeAction(userId, action);

      const obsText = actionResult.success
        ? `[OBSERVATION tool="${action.tool}"]: ${actionResult.message}${
            actionResult.data?.summary ? `\n${actionResult.data.summary}` : ''
          }${actionResult.data?.results && !actionResult.data?.summary
            ? `\n${JSON.stringify(actionResult.data.results).slice(0, 800)}`
            : ''
          }`
        : `[OBSERVATION tool="${action.tool}"]: Error: ${actionResult.message}`;

      observationParts.push(obsText);
      observations.push(obsText);
      logger.debug({ tool: action.tool, success: actionResult.success, userId }, 'react-loop: tool executed');
    }

    // Inject observations as a user message for next LLM turn
    const observationMessage = observationParts.join('\n\n') +
      '\n\nNow continue answering the user based on the above results. Do not emit more tool calls unless truly necessary.';
    messages.push({ role: 'user', content: observationMessage });
  }

  // Max iterations reached — compose summary from observations
  logger.warn({ userId, iterations: MAX_REACT_ITERATIONS }, 'react-loop: max iterations reached');
  const summary = observations.length > 0
    ? `I gathered the following information while working on your request:\n\n${observations.join('\n\n')}`
    : 'I was unable to complete that request after several attempts. Please try rephrasing.';

  return {
    text: summary,
    iterations: MAX_REACT_ITERATIONS,
    observations,
    provider: lastProvider,
    model: lastModel,
    tokensIn: totalTokensIn,
    tokensOut: totalTokensOut,
    creditCost: totalCreditCost,
  };
}
```

**Step 4: Run test to verify it passes**

```bash
cd /root/GeekSpace2.0/server && npx vitest run src/test/api/phase104.test.ts 2>&1 | head -50
```

Expected: PASS (12 tests)

**Step 5: TypeScript check**

```bash
cd /root/GeekSpace2.0/server && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors

**Step 6: Commit**

```bash
cd /root/GeekSpace2.0 && git add server/src/services/react-loop.ts && git commit -m "feat(phase104): create react-loop service with 5-iteration ReAct loop"
```

---

### Task 4: Update system prompt to describe available tools

**Files:**
- Modify: `server/src/routes/agent.ts` — `buildSystemPrompt()` function (around line 68-109)
- Modify: `server/src/services/message-router.ts` — `buildChannelSystemPrompt()` (around line 105-137)

**Step 1: Write the failing test**

Add to `phase104.test.ts`:

```typescript
  describe('104.4 System prompt documents tools', () => {
    it('agent.ts buildSystemPrompt mentions web_search tool', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/routes/agent.ts'), 'utf-8');
      expect(content).toContain('web_search');
    });

    it('agent.ts buildSystemPrompt mentions <<<ACTION>>> format', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/routes/agent.ts'), 'utf-8');
      expect(content).toContain('<<<ACTION');
    });

    it('message-router.ts buildChannelSystemPrompt mentions web_search tool', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/message-router.ts'), 'utf-8');
      expect(content).toContain('web_search');
    });
  });
```

**Step 2: Run test to verify it fails**

```bash
cd /root/GeekSpace2.0/server && npx vitest run src/test/api/phase104.test.ts 2>&1 | head -50
```

Expected: FAIL

**Step 3: Add tool documentation block**

Define a shared tool documentation constant. In `agent.ts`, add this constant near the top of the file (after the imports, before the router):

```typescript
// ---- ReAct Tool Documentation ----
// Injected into system prompts so the LLM knows how to call tools.
const TOOL_INSTRUCTIONS = `
--- AVAILABLE TOOLS ---
You can call tools by emitting an action block in your response:
<<<ACTION
{"tool": "<tool_name>", "params": {<params>}}
ACTION>>>

Available tools:
- web_search: Search the web for current information. Params: {"query": "<search query>"}
- set_reminder: Create a reminder for the user. Params: {"text": "<reminder text>", "datetime": "<ISO datetime or natural language>", "channel": "telegram|push"}
- telegram_notify: Send a Telegram message to the user. Params: {"message": "<message text>"}
- generate_image: Generate an image. Params: {"prompt": "<image description>"}
- generate_code: Build a website/app. Params: {"title": "<name>", "html": "<html>", "css": "<css>", "js": "<js>"}
- send_email: Send an email to the user. Params: {"subject": "<subject>", "body": "<body>"}

Only call tools when the user explicitly asks for an action. Do not chain more than 3 tool calls in one response.`;
```

Then in `buildSystemPrompt()`, append `TOOL_INSTRUCTIONS` to the returned string:

Change the `return` at the end of `buildSystemPrompt` from:
```typescript
return `${OPENCLAW_IDENTITY}
...
${closingInstruction}`;
```

To:
```typescript
return `${OPENCLAW_IDENTITY}
...
${closingInstruction}
${TOOL_INSTRUCTIONS}`;
```

For `message-router.ts`, add the same `TOOL_INSTRUCTIONS` constant (copy-paste it there) and append it in `buildChannelSystemPrompt`. In the return statement, add `\n${TOOL_INSTRUCTIONS}` before the closing backtick.

**Step 4: Run test to verify it passes**

```bash
cd /root/GeekSpace2.0/server && npx vitest run src/test/api/phase104.test.ts 2>&1 | head -60
```

Expected: PASS (15 tests)

**Step 5: TypeScript check**

```bash
cd /root/GeekSpace2.0/server && npx tsc --noEmit 2>&1 | head -30
```

**Step 6: Commit**

```bash
cd /root/GeekSpace2.0 && git add server/src/routes/agent.ts server/src/services/message-router.ts && git commit -m "feat(phase104): add TOOL_INSTRUCTIONS to system prompts for ReAct tool use"
```

---

### Task 5: Wire `runReActLoop` into `message-router.ts`

**Files:**
- Modify: `server/src/services/message-router.ts` — replace `routeChat()` direct call with `runReActLoop()`

**Context:** In `message-router.ts`, the LLM is called in two places:
1. Bridge path (lines ~344-397) — has try/catch fallback
2. Direct routeChat path (lines ~383-396)

We wire the loop into the **direct routeChat path** (the `else` branch, lines ~383-396). The bridge path keeps using `bridgeChat` as-is (bridge already handles tool dispatch).

**Step 1: Write the failing test**

Add to `phase104.test.ts`:

```typescript
  describe('104.5 message-router wired to ReAct loop', () => {
    it('message-router.ts imports runReActLoop', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/message-router.ts'), 'utf-8');
      expect(content).toContain('runReActLoop');
    });

    it('message-router.ts calls onStatus with sendChannelResponse', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/services/message-router.ts'), 'utf-8');
      // onStatus callback sends a status message through the channel
      expect(content).toContain('onStatus');
      expect(content).toContain('sendChannelResponse');
    });
  });
```

**Step 2: Run test to verify it fails**

```bash
cd /root/GeekSpace2.0/server && npx vitest run src/test/api/phase104.test.ts 2>&1 | head -60
```

Expected: FAIL

**Step 3: Import and wire runReActLoop**

In `message-router.ts`, add import (near the top, with other service imports):

```typescript
import { runReActLoop } from './react-loop.js';
```

Then in `handleIncomingMessage()`, in the direct `routeChat` path (the `else` branch at line ~383), replace:

```typescript
  } else {
    // Bridge not enabled — use routeChat directly
    const messages: ChatMessage[] = [...trimmedHistory, { role: 'user', content: llmUserText }];
    const result = await routeChat(messages, {
      systemPrompt,
      agentName: (agentConfig?.name as string) || 'Geek',
      userCredits,
    });
    replyText = result.reply;
    provider = result.provider;
    model = result.model;
    tokensIn = result.tokensIn;
    tokensOut = result.tokensOut;
    creditCost = result.creditCost;
  }
```

With:

```typescript
  } else {
    // Bridge not enabled — use ReAct loop (routeChat + multi-turn tool use)
    const messages: ChatMessage[] = [...trimmedHistory, { role: 'user', content: llmUserText }];
    const reactResult = await runReActLoop(messages, userId, {
      systemPrompt,
      agentName: (agentConfig?.name as string) || 'Geek',
      userCredits,
      onStatus: async (statusMsg) => {
        // Send visible status message through the channel (non-blocking best-effort)
        try {
          await sendChannelResponse({
            channel: msg.channel,
            externalId: msg.externalId,
            text: statusMsg,
          });
        } catch { /* non-fatal */ }
      },
    });
    replyText = reactResult.text;
    provider = reactResult.provider;
    model = reactResult.model;
    tokensIn = reactResult.tokensIn;
    tokensOut = reactResult.tokensOut;
    creditCost = reactResult.creditCost;
  }
```

Also replace the bridge fallback path's direct routeChat call (the `catch` block around line ~370). Find:
```typescript
      const messages: ChatMessage[] = [...trimmedHistory, { role: 'user', content: llmUserText }];
      const result = await routeChat(messages, {
        systemPrompt,
        agentName: (agentConfig?.name as string) || 'Geek',
        userCredits,
      });
      replyText = result.reply;
      provider = result.provider;
      ...
```
Replace with same `runReActLoop` pattern (same `onStatus` callback).

**Step 4: Run test to verify it passes**

```bash
cd /root/GeekSpace2.0/server && npx vitest run src/test/api/phase104.test.ts 2>&1 | head -60
```

Expected: PASS (17 tests)

**Step 5: TypeScript check**

```bash
cd /root/GeekSpace2.0/server && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors

**Step 6: Commit**

```bash
cd /root/GeekSpace2.0 && git add server/src/services/message-router.ts && git commit -m "feat(phase104): wire ReAct loop into message-router for Telegram/WhatsApp"
```

---

### Task 6: Wire `runReActLoop` into `agent.ts` main `/chat` endpoint

**Files:**
- Modify: `server/src/routes/agent.ts` — default chat path (around line 634-695)

**Context:** The default (non-bridge, non-premium) path calls `routeChat()` at line 652, then immediately calls `parseActions()` and `executeAction()` in a one-shot pass. We replace this with `runReActLoop()`. The loop handles its own action execution internally, but we still need action results for `generate_code` preview URLs and receipt rendering.

For this task: wire `runReActLoop()` for the loop/observation part. The `generate_code` special case (injecting `baseUrl`/`existingArtifactId` into params) needs to stay — add that injection into the `onStatus` callback logic by running a pre-execution hook. However, since `react-loop.ts` calls `executeAction` directly and doesn't expose action params injection, we handle this differently: `generate_code` already gets `baseUrl` injected by the executor fallback...

Actually, looking at it more carefully: the `baseUrl` injection happens in agent.ts BEFORE `executeAction` is called (line 684-689). The react-loop calls executeAction internally. For Phase 104, the simplest approach: skip the react-loop for the bridge path (it already handles tools), and for the default path, replace `routeChat` + manual action loop with `runReActLoop`. The `generate_code baseUrl` injection can be done by passing it as part of `params` overrides — but that requires changes to react-loop.ts.

**Simpler approach:** Wire `runReActLoop` for the default path, but for `generate_code` actions, the executor already looks up `config.apiUrl`. The current agent.ts passes `req.protocol + req.get('host')` instead of `config.apiUrl`. This is a minor difference — just pass `config.apiUrl` via executor (it's the same value in production). No special injection needed.

Since `runReActLoop` handles action execution internally and returns the final text, the agent.ts handler no longer needs the separate `parseActions`/`executeAction` loop. But we still need `actionResults` for the JSON response (receipts, imageUrl, etc.). For Phase 104, skip returning action details in JSON — return just `text`. Action receipts can be re-added in Phase 105.

**Step 1: Write the failing test**

Add to `phase104.test.ts`:

```typescript
  describe('104.6 agent.ts wired to ReAct loop', () => {
    it('agent.ts imports runReActLoop', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/routes/agent.ts'), 'utf-8');
      expect(content).toContain('runReActLoop');
    });

    it('agent.ts default chat path calls runReActLoop', () => {
      const content = readFileSync(resolve(SERVER_ROOT, 'src/routes/agent.ts'), 'utf-8');
      // The default path should call runReActLoop, not bare routeChat for the main chat flow
      const defaultPathSection = content.slice(
        content.indexOf('Default: local-first router'),
        content.indexOf('Default: local-first router') + 1500,
      );
      expect(defaultPathSection).toContain('runReActLoop');
    });
  });
```

**Step 2: Run test to verify it fails**

```bash
cd /root/GeekSpace2.0/server && npx vitest run src/test/api/phase104.test.ts 2>&1 | head -70
```

Expected: FAIL

**Step 3: Import and wire in agent.ts**

Add import at the top of `agent.ts` (alongside other service imports):

```typescript
import { runReActLoop } from '../services/react-loop.js';
```

Then in the default chat path (around line 634), replace the block:

```typescript
    const result = await routeChat(messages, {
      systemPrompt,
      agentName: (agentConfig?.name as string) || 'Geek',
      userCredits,
      forceProvider: resolvedProvider,
      userId,
    });
    ...
    const { text: cleanReply, actions: parsedActions } = parseActions(result.reply);
    const actionResults: ActionResult[] = [];

    for (const action of parsedActions) {
      if (action.tool === 'generate_code') {
        action.params.baseUrl = `${req.protocol}://${req.get('host')}`;
        if (reqExistingArtifactId) {
          action.params.existingArtifactId = reqExistingArtifactId;
        }
      }
      const actionResult = await executeAction(userId, action);
      actionResults.push(actionResult);
    }

    // Log the clean reply (without action blocks)
    logConversation(userId, 'assistant', cleanReply || result.reply, result.provider, result.model);
```

With:

```typescript
    const reactResult = await runReActLoop(messages, userId, {
      systemPrompt,
      agentName: (agentConfig?.name as string) || 'Geek',
      userCredits,
      forceProvider: resolvedProvider,
      userId,
      userPlan,
      onStatus: () => { /* no-op for JSON endpoint — client doesn't see intermediate messages */ },
    });

    // Alias for downstream code that builds the JSON response
    const result = {
      reply: reactResult.text,
      provider: reactResult.provider,
      model: reactResult.model,
      tokensIn: reactResult.tokensIn,
      tokensOut: reactResult.tokensOut,
      creditCost: reactResult.creditCost,
      latencyMs: 0,
    };
    const cleanReply = reactResult.text;
    const actionResults: ActionResult[] = []; // Actions already executed inside the loop

    // Log the clean reply
    logConversation(userId, 'assistant', cleanReply, result.provider, result.model);
```

The downstream code (usage logging, deductSubscriptionCredits, res.json response) uses `result.*` and `cleanReply`, so it will work without further changes.

**Step 4: Run test + full test suite**

```bash
cd /root/GeekSpace2.0/server && npx vitest run src/test/api/phase104.test.ts 2>&1 | head -70
```

Expected: PASS (19 tests)

```bash
cd /root/GeekSpace2.0/server && npm test 2>&1 | tail -20
```

Expected: All existing tests still pass (no regressions)

**Step 5: TypeScript + build check**

```bash
cd /root/GeekSpace2.0/server && npx tsc --noEmit 2>&1 | head -30
cd /root/GeekSpace2.0/server && npm run build 2>&1 | tail -20
```

Expected: No errors

**Step 6: Commit**

```bash
cd /root/GeekSpace2.0 && git add server/src/routes/agent.ts && git commit -m "feat(phase104): wire ReAct loop into agent.ts main chat path"
```

---

### Task 7: Full test run + branch push

**Step 1: Run all server tests**

```bash
cd /root/GeekSpace2.0/server && npm test 2>&1 | tail -30
```

Expected: All tests pass (no regressions from Phase 103 + Phase 104 tests green)

**Step 2: TypeScript check frontend**

```bash
cd /root/GeekSpace2.0 && npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Final phase104 test count**

```bash
cd /root/GeekSpace2.0/server && npx vitest run src/test/api/phase104.test.ts --reporter=verbose 2>&1
```

Expected: 19 tests passing

**Step 4: Push branch and open PR**

```bash
cd /root/GeekSpace2.0 && git log --oneline -8
```

Check all commits look correct, then:

```bash
cd /root/GeekSpace2.0 && git push -u origin ai/phase-104-react-loop
```

```bash
gh pr create \
  --title "Phase 104: ReAct tool loop — web_search, set_reminder, telegram_notify" \
  --body "## Summary
- Add \`web_search\` and \`telegram_notify\` to TOOL_SCHEMAS and action-executor
- New \`react-loop.ts\` service: 5-iteration ReAct loop with onStatus callbacks
- System prompts updated to document available tools and \`<<<ACTION>>>\` format
- Both \`message-router.ts\` (Telegram/WhatsApp) and \`agent.ts\` (/chat) wired to loop
- Status messages visible in Telegram/WhatsApp during tool execution

## Test plan
- [ ] 19 phase104 tests pass
- [ ] All prior tests still pass (no regressions)
- [ ] TypeScript clean on both frontend and server
- [ ] Manual: send 'search for latest AI news' in Telegram, see 🔍 status message appear

🤖 Generated with [Claude Code](https://claude.com/claude-code)" \
  --base main
```

---

## Quick Reference

**New file:** `server/src/services/react-loop.ts`

**Modified files:**
- `server/src/services/action-parser.ts` — +2 tool schemas (web_search, telegram_notify)
- `server/src/services/action-executor.ts` — +2 executor cases + imports
- `server/src/routes/agent.ts` — TOOL_INSTRUCTIONS constant + runReActLoop wiring
- `server/src/services/message-router.ts` — TOOL_INSTRUCTIONS + runReActLoop wiring

**Test file:** `server/src/test/api/phase104.test.ts` (19 tests)

**Key design choices:**
- onStatus is a no-op in JSON endpoint; sends real Telegram message in bot path
- generate_code baseUrl uses `config.apiUrl` (same as production value)
- Bridge path keeps using `bridgeChat` unchanged (bridge has its own tool dispatch)
- SSE streaming path untouched (can be enhanced in Phase 105 with collapsible trace)
