# Phase 104 — ReAct Tool Loop Design

## Goal

Wire a multi-turn Reasoning + Acting (ReAct) loop that lets the AI agent call tools (web search, set reminder, Telegram notify) and chain them in a single user request, across both web chat and bot (Telegram/WhatsApp) paths.

## Decisions

| Question | Decision |
|----------|----------|
| Scope | Both web chat (agent.ts) and bot path (message-router.ts) |
| Max iteration fallback | Return accumulated observations summary |
| Tool call visibility | Visible status messages ("🔍 Searching…") in both paths; collapsible trace for web in a later phase |
| Action format | Keep `<<<ACTION>>>` format (Approach A) — migrate to native function calling later |
| Max iterations | 5 |

## Architecture

### New file: `server/src/services/react-loop.ts`

```typescript
runReActLoop(messages, userId, opts: {
  onStatus: (msg: string) => void | Promise<void>,
  maxIterations?: number,
  userPlan?: string,
}): Promise<{ text: string, iterations: number }>
```

Loop:
1. Call `routeChat(messages, opts)` — LLM generates text
2. Parse `<<<ACTION>>>` blocks via `parseActions(text)`
3. If no actions → return text (done)
4. For each action:
   - Call `opts.onStatus("🔍 Searching the web…")` (or appropriate status)
   - Execute via `executeAction(action, userId)`
   - Append to messages: `{ role: 'tool', content: '[OBSERVATION tool="web_search"]: <result>' }`
5. Repeat up to `maxIterations` (default 5)
6. If limit hit → return summary of all observations collected

### Callers

**`agent.ts`** (web chat SSE path):
- `onStatus` → write SSE chunk: `data: {"type":"status","text":"🔍 Searching…"}\n\n`

**`message-router.ts`** (Telegram/WhatsApp):
- `onStatus` → `bot.sendMessage(chatId, "🔍 Searching…")` (non-blocking)

### Tools to add

| Tool | TOOL_SCHEMAS entry | Executor |
|------|--------------------|----------|
| `web_search` | `{ query: string }` | calls `tavilySearch(query)` |
| `telegram_notify` | `{ message: string, chatId?: string }` | calls `sendTelegramMessage(chatId, message)` |
| `set_reminder` | already exists | already exists |

### System prompt additions

Document the three available tools and the `<<<ACTION>>>` format in the agent system prompt so the LLM knows to use them.

## Error handling

- Individual tool failure → inject `[OBSERVATION tool="..."]: Error: <message>` and continue loop
- LLM error mid-loop → propagate as normal error to caller
- Max iterations hit → compose summary: "I tried N steps to answer your question. Here is what I found: <observations>"

## Testing

- Unit tests in `server/src/test/api/phase104.test.ts`
- Test: loop terminates after 0 action steps
- Test: loop injects observations and calls LLM again
- Test: max iteration fallback returns observations
- Test: `web_search` tool schema present in TOOL_SCHEMAS
- Test: `telegram_notify` tool schema present in TOOL_SCHEMAS
- Test: status callback is invoked for each tool call
