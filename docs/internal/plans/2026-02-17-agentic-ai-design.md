# Agentic AI — Tool Use & Code Generation Design

> **Goal:** Transform the GeekSpace agent from a pure chatbot into an agentic AI that can generate code with live preview, manage portfolio content, and take real actions on behalf of users.

## Problem

The current agent hallucinates capabilities it doesn't have (fake `gs` CLI commands, fake project setup). It's text-in-text-out with zero ability to take actions. Users expect an AI that can actually _do_ things.

## Approach: Structured Output Tool-Use

The agent returns **structured JSON action blocks** alongside its text reply. The backend parses, validates, and executes these actions. This works with all LLM providers (Ollama, OpenRouter, Edith) because it doesn't require native function-calling support.

## Available Tools (Phase 1)

| Tool | Description | Params |
|------|-------------|--------|
| `generate_code` | Creates an HTML/CSS/JS project | `{title, html, css, js}` |
| `portfolio_add_project` | Adds a project to user's portfolio | `{title, description, tags, liveUrl?, repoUrl?}` |
| `portfolio_update_bio` | Updates user bio | `{bio}` |
| `portfolio_update_skills` | Updates skills/tags | `{skills: string[]}` |
| `portfolio_remove_project` | Removes a project | `{projectId}` |
| `portfolio_update_theme` | Changes portfolio theme | `{accentColor}` |

## Action Format

The LLM outputs actions using delimiters:

```
Here's your website! I've generated it for you.

<<<ACTION
{"tool": "generate_code", "params": {"title": "Hello World", "html": "<!DOCTYPE html>...", "css": "body {...}", "js": ""}}
ACTION>>>
```

Backend regex-parses `<<<ACTION\n{...}\nACTION>>>` blocks, validates against the tool whitelist, and executes.

## System Prompt Overhaul

### Structure
```
[Identity + personality]
[Available tools with descriptions and param schemas]
[Tool usage format: <<<ACTION ... ACTION>>>]
[Explicit boundaries: what you CANNOT do]
[User session context + memory]
```

### Key changes
- Remove all fake command references (gs CLI, terminal commands)
- Declare available tools explicitly with examples
- Add boundary rules: "Never invent capabilities. If you can't do it, say so."
- Channel-aware: Telegram prompt excludes UI-dependent tools (generate_code)

## Data Flow

```
User → "Build me a hello world website"
  → Backend: routeChat() with tool-aware system prompt
  → LLM: returns text + <<<ACTION{"tool":"generate_code",...}ACTION>>>
  → Backend: parse action, validate, store in generated_artifacts table
  → API response: {reply, actions: [{tool, result, artifactId}]}
  → Frontend: renders text + CodePreviewCard with iframe + download
```

## New DB Table

```sql
CREATE TABLE generated_artifacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'code',
  title TEXT NOT NULL,
  html TEXT DEFAULT '',
  css TEXT DEFAULT '',
  js TEXT DEFAULT '',
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_artifacts_user ON generated_artifacts(user_id);
```

## Frontend Components

### CodePreviewCard (in chat panel)
- Project title + language badges
- "Open Preview" button → sandboxed `<iframe srcdoc="...">` inline
- "Download" button → zip bundle (HTML + CSS + JS)
- "Deploy to Portfolio" button → saves as portfolio project

### PortfolioActionCard (in chat panel)
- System-style confirmation: "Added project 'X' to your portfolio"
- "View Portfolio" link

### Artifacts page (optional, future)
- List all generated artifacts for the user
- Re-preview, download, deploy to portfolio

## Backend Components

### Action Parser (`server/src/services/action-parser.ts`)
- `parseActions(llmResponse: string)` → `{text, actions[]}`
- Regex extracts `<<<ACTION ... ACTION>>>` blocks
- Validates tool name against whitelist
- Validates params with Zod schemas

### Action Executor (`server/src/services/action-executor.ts`)
- `executeAction(userId, action)` → `{success, result, artifactId?}`
- Switch on tool name, execute appropriate DB operation
- `generate_code` → insert into `generated_artifacts`
- `portfolio_*` → CRUD on `portfolios` / `portfolio_projects` tables

### Modified Chat Handler
- After `routeChat()`, pipe reply through `parseActions()`
- Execute each action via `executeAction()`
- Return enriched response: `{reply, actions: [...]}`

## Channel (Telegram) Behavior

- Telegram prompt excludes `generate_code` tool (can't show iframe)
- Agent tells Telegram users: "I've created the project! Open your dashboard to preview it."
- Portfolio tools work from Telegram (text-only confirmation)
- Artifact ID included so user can find it in dashboard

## Security

- All tool params validated with Zod before execution
- `generate_code` HTML is rendered in sandboxed iframe (`sandbox="allow-scripts"`)
- Portfolio actions scoped to authenticated user's data only
- Rate limit on action execution (max 5 actions per 15 min)

## Credit Cost

- Tool execution itself is free (the LLM call already costs credits)
- No additional credit charge for actions

## Out of Scope (Future)

- Sandboxed code execution (Docker containers per user)
- Multi-file project generation
- Server-side deployment to custom URLs
- Image generation
- API calling on user's behalf
