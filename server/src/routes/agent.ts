import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validateBody, chatSchema, commandSchema, agentConfigUpdateSchema } from '../middleware/validate.js';
import { db } from '../db/index.js';
import { routeChat, classifyIntent, computeCreditCost, streamOllama, type ChatMessage, type Provider } from '../services/llm.js';
import { edithChat } from '../services/edith.js';
import { logger } from '../logger.js';
import { config } from '../config.js';
import { OPENCLAW_IDENTITY } from '../prompts/openclaw-system.js';
import { checkKeywordTriggers } from '../services/automations-engine.js';
import { buildMemoryContext, logConversation, extractMemories, getConversationContext } from '../services/memory.js';

export const agentRouter = Router();

// ---- Helper: Build system prompt with user context ----

function buildSystemPrompt(
  agentConfig: Record<string, unknown> | undefined,
  user: Record<string, unknown> | undefined,
  userId: string,
  userMessage?: string,
): string {
  const agentName = (agentConfig?.name as string) || 'Geek';
  const voice = (agentConfig?.voice as string) || 'friendly';
  const mode = (agentConfig?.mode as string) || 'builder';
  const customPrompt = (agentConfig?.system_prompt as string) || '';
  const userName = (user?.name as string) || 'there';

  const reminderCount = (db.prepare('SELECT COUNT(*) as c FROM reminders WHERE user_id = ? AND completed = 0').get(userId) as { c: number })?.c || 0;
  const connectedCount = (db.prepare("SELECT COUNT(*) as c FROM integrations WHERE user_id = ? AND status = 'connected'").get(userId) as { c: number })?.c || 0;

  // Inject memory context
  const memoryBlock = buildMemoryContext(userId, userMessage);

  return `${OPENCLAW_IDENTITY}

--- USER SESSION ---
Agent name: ${agentName}. User: ${userName}. Voice: ${voice}. Mode: ${mode}.
${customPrompt ? `Custom instructions: ${customPrompt}` : ''}
Active reminders: ${reminderCount}. Connected integrations: ${connectedCount}.${memoryBlock}`;
}

// ---- Agent Config CRUD ----

agentRouter.get('/config', requireAuth, (req: AuthRequest, res) => {
  const config = db.prepare('SELECT * FROM agent_configs WHERE user_id = ?').get(req.userId!) as Record<string, unknown> | undefined;
  if (!config) { res.status(404).json({ error: 'Agent config not found' }); return; }
  res.json(config);
});

agentRouter.patch('/config', requireAuth, validateBody(agentConfigUpdateSchema), (req: AuthRequest, res) => {
  const updates = req.body;
  const fields: string[] = [];
  const values: unknown[] = [];

  const allowedFields: Record<string, string> = {
    name: 'name', displayName: 'display_name', mode: 'mode', voice: 'voice',
    systemPrompt: 'system_prompt', primaryModel: 'primary_model', fallbackModel: 'fallback_model',
    creativity: 'creativity', formality: 'formality', responseSpeed: 'response_speed',
    monthlyBudgetUSD: 'monthly_budget_usd', avatarEmoji: 'avatar_emoji',
    accentColor: 'accent_color', bubbleStyle: 'bubble_style', status: 'status',
  };

  for (const [key, col] of Object.entries(allowedFields)) {
    if (updates[key] !== undefined) { fields.push(`${col} = ?`); values.push(updates[key]); }
  }

  if (fields.length) { values.push(req.userId); db.prepare(`UPDATE agent_configs SET ${fields.join(', ')} WHERE user_id = ?`).run(...values); }

  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Updated agent config', ?, 'bot')`).run(uuid(), req.userId, `Changed: ${Object.keys(updates).join(', ')}`);

  const config = db.prepare('SELECT * FROM agent_configs WHERE user_id = ?').get(req.userId!);
  res.json(config);
});

// ---- Two-Tier Agent Chat ----
//
// Tier 1 (free):    Ollama local — handles all queries by default
// Tier 2 (premium): Moonshot cloud — explicit /premium or /edith prefix, costs credits
//
// Auto-fallback: if Ollama is down, routes to cloud only when user has credits

agentRouter.post('/chat', requireAuth, validateBody(chatSchema), async (req: AuthRequest, res) => {
  let { message } = req.body as { message: string };
  const userId = req.userId!;

  try {
    const agentConfig = db.prepare('SELECT * FROM agent_configs WHERE user_id = ?').get(userId) as Record<string, unknown> | undefined;
    const user = db.prepare('SELECT name, credits FROM users WHERE id = ?').get(userId) as Record<string, unknown> | undefined;
    const systemPrompt = buildSystemPrompt(agentConfig, user, userId, message);
    const userCredits = (user?.credits as number) || 0;

    // Log user message + extract memories (non-blocking)
    logConversation(userId, 'user', message);
    extractMemories(userId, message);

    // ---- Parse route prefix: /premium, /edith, /local, /pico, or auto ----
    let forceRoute: 'premium' | 'local' | 'pico' | null = null;

    if (message.startsWith('/premium ') || message.startsWith('/edith ')) {
      forceRoute = 'premium';
      const prefixLen = message.startsWith('/premium ') ? 9 : 7;
      message = message.slice(prefixLen).trim();
    } else if (message.startsWith('/local ')) {
      forceRoute = 'local';
      message = message.slice(7).trim();
    } else if (message.startsWith('/pico ')) {
      forceRoute = 'pico';
      message = message.slice(6).trim();
    }

    // ---- Premium route: explicit opt-in via prefix ----
    if (forceRoute === 'premium') {
      if (userCredits <= 0) {
        res.json({
          text: 'You don\'t have enough credits to use the premium model. Use the free local model by default, or check your balance with `gs credits`.',
          route: 'error',
          tier: 'premium',
          provider: 'builtin',
          latencyMs: 0,
        });
        return;
      }

      try {
        const edithResult = await edithChat(message, systemPrompt);

        // Compute credit cost
        const creditCost = computeCreditCost('edith', edithResult.tokensIn, edithResult.tokensOut);

        // Log usage
        db.prepare(`INSERT INTO usage_events (id, user_id, provider, model, tokens_in, tokens_out, cost_usd, channel, tool)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'web', 'ai.chat')`).run(
          uuid(), userId, 'edith', config.moonshotReasoningModel,
          edithResult.tokensIn, edithResult.tokensOut, creditCost,
        );

        // Deduct credits
        db.prepare('UPDATE users SET credits = MAX(0, credits - ?) WHERE id = ?').run(creditCost, userId);
        const updatedCredits = (db.prepare('SELECT credits FROM users WHERE id = ?').get(userId) as { credits: number })?.credits ?? 0;

        res.json({
          text: edithResult.text,
          route: 'premium',
          tier: 'premium',
          latencyMs: edithResult.latencyMs,
          provider: 'edith',
          model: config.moonshotReasoningModel,
          creditsUsed: creditCost,
          creditsRemaining: updatedCredits,
        });
        return;
      } catch (err) {
        logger.warn({ err, userId }, 'Premium (Moonshot) call failed, falling back to local');
        // Fall through to local router
      }
    }

    // Fire keyword-based automation triggers (non-blocking)
    checkKeywordTriggers(userId, message).catch(() => {});

    // ---- Default: local-first router (Ollama → cloud fallback if Ollama down) ----
    const history = getConversationContext(userId);
    const messages: ChatMessage[] = [...history, { role: 'user', content: message }];
    const intent = classifyIntent(message);

    const result = await routeChat(messages, {
      systemPrompt,
      agentName: (agentConfig?.name as string) || 'Geek',
      userCredits,
      forceProvider: forceRoute === 'local' ? 'ollama' : forceRoute === 'pico' ? 'picoclaw' : undefined,
    });

    // Determine tier from actual provider used
    const tier = (result.provider === 'ollama' || result.provider === 'builtin' || result.provider === 'openrouter-free') ? 'local' : 'premium';

    // Log usage
    db.prepare(`INSERT INTO usage_events (id, user_id, provider, model, tokens_in, tokens_out, cost_usd, channel, tool)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'web', 'ai.chat')`).run(
      uuid(), userId, result.provider, result.model,
      result.tokensIn, result.tokensOut, result.creditCost,
    );

    // Deduct credits for premium tier
    if (result.creditCost > 0) {
      db.prepare('UPDATE users SET credits = MAX(0, credits - ?) WHERE id = ?').run(result.creditCost, userId);
    }

    const updatedCredits = (db.prepare('SELECT credits FROM users WHERE id = ?').get(userId) as { credits: number })?.credits ?? userCredits;

    // Log assistant response
    logConversation(userId, 'assistant', result.reply, result.provider, result.model);

    const response: Record<string, unknown> = {
      text: result.reply,
      route: tier,
      tier,
      latencyMs: result.latencyMs,
      provider: result.provider,
      model: result.model,
      creditsUsed: result.creditCost,
      creditsRemaining: updatedCredits,
    };
    if (config.logLevel === 'debug') {
      response.debug = { intent, forceRoute, tokensUsed: result.tokensIn + result.tokensOut };
    }

    res.json(response);
  } catch (err) {
    logger.error({ err, userId }, 'Chat handler error');
    res.status(500).json({ error: 'Failed to process message. Please try again.' });
  }
});

// ---- Terminal Commands ----

agentRouter.post('/command', requireAuth, validateBody(commandSchema), async (req: AuthRequest, res) => {
  const { command } = req.body;
  const cmd = (command as string).trim().toLowerCase();
  const userId = req.userId!;

  if (cmd === 'gs me') {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as Record<string, unknown>;
    if (user) {
      res.json({ output: `Name: ${user.name}\nUsername: ${user.username}\nEmail: ${user.email}\nPlan: ${(user.plan as string).charAt(0).toUpperCase() + (user.plan as string).slice(1)}\nCredits: ${user.credits}\nJoined: ${user.created_at}`, isError: false });
      return;
    }
  }

  if (cmd === 'gs reminders list') {
    const reminders = db.prepare('SELECT * FROM reminders WHERE user_id = ? ORDER BY datetime ASC').all(userId) as Record<string, unknown>[];
    if (!reminders.length) { res.json({ output: 'No reminders set. Use: gs reminders add "text"', isError: false }); return; }
    const table = 'ID  | Reminder                    | When\n--- | --------------------------- | ------------------\n' +
      reminders.map(r => `${(r.id as string).slice(0, 4)} | ${(r.text as string).padEnd(27)} | ${r.datetime || 'no date'}${r.completed ? ' done' : ''}`).join('\n');
    res.json({ output: table, isError: false });
    return;
  }

  if (cmd.startsWith('gs reminders add ')) {
    const text = cmd.slice(17).replace(/^["']|["']$/g, '');
    if (!text || text.length > 500) { res.json({ output: 'Reminder text required (max 500 chars)', isError: true }); return; }
    const id = uuid();
    db.prepare('INSERT INTO reminders (id, user_id, text, channel, category, created_by) VALUES (?, ?, ?, ?, ?, ?)').run(id, userId, text, 'push', 'general', 'terminal');
    db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Created reminder', ?, 'bell')`).run(uuid(), userId, text);
    res.json({ output: `Reminder added! ID: ${id.slice(0, 8)}\nText: ${text}`, isError: false });
    return;
  }

  if (cmd === 'gs credits') {
    const user = db.prepare('SELECT credits, plan FROM users WHERE id = ?').get(userId) as Record<string, unknown>;
    const usage = db.prepare('SELECT COUNT(*) as calls, SUM(cost_usd) as cost FROM usage_events WHERE user_id = ?').get(userId) as Record<string, unknown>;
    res.json({ output: `Credit Balance: ${user?.credits || 0}\nPlan: ${user?.plan || 'free'}\n\nUsage:\n- API Calls: ${usage?.calls || 0}\n- Total Cost: $${((usage?.cost as number) || 0).toFixed(2)}`, isError: false });
    return;
  }

  if (cmd === 'gs usage today') {
    const usage = db.prepare("SELECT COUNT(*) as calls, SUM(tokens_in) as tin, SUM(tokens_out) as tout, SUM(cost_usd) as cost FROM usage_events WHERE user_id = ? AND date(created_at) = date('now')").get(userId) as Record<string, unknown>;
    res.json({ output: `Today's Usage:\n  API Calls: ${usage?.calls || 0}\n  Tokens: ${usage?.tin || 0} in / ${usage?.tout || 0} out\n  Cost: $${((usage?.cost as number) || 0).toFixed(4)}`, isError: false });
    return;
  }

  if (cmd === 'gs usage month') {
    const usage = db.prepare("SELECT provider, COUNT(*) as calls, SUM(cost_usd) as cost FROM usage_events WHERE user_id = ? AND created_at >= datetime('now', '-30 days') GROUP BY provider").all(userId) as Record<string, unknown>[];
    const total = db.prepare("SELECT SUM(cost_usd) as cost FROM usage_events WHERE user_id = ? AND created_at >= datetime('now', '-30 days')").get(userId) as Record<string, unknown>;
    const lines = ['This Month:', `  Total Cost: $${((total?.cost as number) || 0).toFixed(2)}`, '  By Provider:'];
    for (const row of usage) lines.push(`    ${row.provider}: $${((row.cost as number) || 0).toFixed(2)} (${row.calls} calls)`);
    res.json({ output: lines.join('\n'), isError: false });
    return;
  }

  if (cmd === 'gs integrations') {
    const integrations = db.prepare('SELECT name, status, health, requests_today FROM integrations WHERE user_id = ?').all(userId) as Record<string, unknown>[];
    const lines = integrations.map(i => `  ${(i.name as string).padEnd(16)} - ${i.status}${i.status === 'connected' ? ` (${i.health}% health, ${i.requests_today} req today)` : ''}`);
    res.json({ output: `Integrations:\n${lines.join('\n')}`, isError: false });
    return;
  }

  if (cmd === 'gs automations') {
    const automations = db.prepare('SELECT name, trigger_type, enabled, run_count FROM automations WHERE user_id = ?').all(userId) as Record<string, unknown>[];
    if (!automations.length) { res.json({ output: 'No automations configured yet.\nUse the Automations page to create one.', isError: false }); return; }
    const lines = automations.map(a => `  ${a.name} [${a.enabled ? 'ON' : 'OFF'}] trigger: ${a.trigger_type}, runs: ${a.run_count}`);
    res.json({ output: `Automations:\n${lines.join('\n')}`, isError: false });
    return;
  }

  if (cmd === 'gs status') {
    const agent = db.prepare('SELECT * FROM agent_configs WHERE user_id = ?').get(userId) as Record<string, unknown>;
    res.json({ output: `Agent Status: ${agent?.status || 'unknown'}\nName: ${agent?.name || 'Geek'}\nMode: ${agent?.mode || 'builder'}\nVoice: ${agent?.voice || 'friendly'}\nModel: ${agent?.primary_model || 'default'}`, isError: false });
    return;
  }

  if (cmd === 'gs portfolio') {
    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as Record<string, unknown>;
    res.json({ output: `Portfolio: /portfolio/${user?.username || 'you'}`, isError: false });
    return;
  }

  if (cmd === 'gs deploy') {
    db.prepare('UPDATE portfolios SET is_public = 1 WHERE user_id = ?').run(userId);
    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as Record<string, unknown>;
    db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Deployed portfolio', 'Public', 'globe')`).run(uuid(), userId);
    res.json({ output: `Portfolio deployed!\nLive at: /portfolio/${user?.username || 'you'}`, isError: false });
    return;
  }

  if (cmd.startsWith('gs connect ')) {
    const svc = cmd.slice(11).trim();
    const integration = db.prepare('SELECT * FROM integrations WHERE user_id = ? AND (LOWER(type) = ? OR LOWER(name) = ?)').get(userId, svc, svc) as Record<string, unknown> | undefined;
    if (integration) {
      db.prepare("UPDATE integrations SET status = 'connected', health = 100, last_sync = ? WHERE id = ?").run(new Date().toISOString(), integration.id);
      db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Connected', ?, 'link')`).run(uuid(), userId, integration.name);
      res.json({ output: `Connected ${integration.name}! Health: 100%`, isError: false });
    } else { res.json({ output: `Integration "${svc}" not found.`, isError: true }); }
    return;
  }

  if (cmd.startsWith('gs disconnect ')) {
    const svc = cmd.slice(14).trim();
    const integration = db.prepare('SELECT * FROM integrations WHERE user_id = ? AND (LOWER(type) = ? OR LOWER(name) = ?)').get(userId, svc, svc) as Record<string, unknown> | undefined;
    if (integration) {
      db.prepare("UPDATE integrations SET status = 'disconnected', health = 0 WHERE id = ?").run(integration.id);
      res.json({ output: `Disconnected ${integration.name}.`, isError: false });
    } else { res.json({ output: `Integration "${svc}" not found.`, isError: true }); }
    return;
  }

  if (cmd.startsWith('gs profile set ')) {
    const parts = cmd.slice(15).split(' ');
    const field = parts[0];
    const value = parts.slice(1).join(' ').replace(/^["']|["']$/g, '');
    const PROFILE_FIELDS: Record<string, string> = {
      name: 'name', bio: 'bio', location: 'location',
      website: 'website', role: 'role', company: 'company',
    };
    const column = PROFILE_FIELDS[field];
    if (column) {
      db.prepare(`UPDATE users SET ${column} = ? WHERE id = ?`).run(value, userId);
      res.json({ output: `Updated ${field} to: ${value}`, isError: false });
    } else { res.json({ output: `Unknown field: ${field}. Allowed: ${Object.keys(PROFILE_FIELDS).join(', ')}`, isError: true }); }
    return;
  }

  if (cmd === 'gs export') {
    const user = db.prepare('SELECT id, email, username, name, bio, location, plan, credits, created_at FROM users WHERE id = ?').get(userId);
    const reminders = db.prepare('SELECT * FROM reminders WHERE user_id = ?').all(userId);
    const integrations = db.prepare('SELECT * FROM integrations WHERE user_id = ?').all(userId);
    const portfolio = db.prepare('SELECT * FROM portfolios WHERE user_id = ?').get(userId);
    res.json({ output: JSON.stringify({ user, reminders, integrations, portfolio }, null, 2), isError: false });
    return;
  }

  // ---- AI command — routed through tri-brain ----
  if (cmd.startsWith('ai ')) {
    const query = command.slice(3).replace(/^["']|["']$/g, '');
    const agentConfig = db.prepare('SELECT * FROM agent_configs WHERE user_id = ?').get(userId) as Record<string, unknown>;
    const user = db.prepare('SELECT name, credits FROM users WHERE id = ?').get(userId) as Record<string, unknown>;

    try {
      const termHistory = getConversationContext(userId);
      const result = await routeChat(
        [...termHistory, { role: 'user', content: query }],
        {
          systemPrompt: buildSystemPrompt(agentConfig, user, userId),
          agentName: (agentConfig?.name as string) || 'Geek',
          userCredits: (user?.credits as number) || 0,
        },
      );

      db.prepare(`INSERT INTO usage_events (id, user_id, provider, model, tokens_in, tokens_out, cost_usd, channel, tool)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'terminal', 'ai.chat')`).run(
        uuid(), userId, result.provider, result.model,
        result.tokensIn, result.tokensOut, result.creditCost,
      );

      if (result.creditCost > 0) {
        db.prepare('UPDATE users SET credits = MAX(0, credits - ?) WHERE id = ?').run(result.creditCost, userId);
      }

      res.json({
        output: `[${agentConfig?.name || 'Geek'}] ${result.reply}`,
        isError: false,
        meta: { provider: result.provider, model: result.model, latencyMs: result.latencyMs, creditsUsed: result.creditCost },
      });
    } catch {
      res.json({ output: `[${agentConfig?.name || 'Geek'}] Sorry, I couldn't process that request right now. Try again shortly.`, isError: true });
    }
    return;
  }

  if (cmd === 'help') {
    res.json({ output: `GeekSpace Terminal Commands:\n  gs me                     Show your profile\n  gs reminders list         List reminders\n  gs reminders add "text"   Create a reminder\n  gs credits                Check credit balance\n  gs usage today|month      Usage reports\n  gs integrations           List integrations\n  gs connect <service>      Connect integration\n  gs disconnect <service>   Disconnect integration\n  gs automations            List automations\n  gs status                 Agent status\n  gs portfolio              Portfolio URL\n  gs deploy                 Deploy portfolio\n  gs profile set <f> <v>    Update profile field\n  gs export                 Export all data as JSON\n  ai "prompt"               Ask your AI agent (real LLM)\n  clear                     Clear terminal\n  help                      Show this help`, isError: false });
    return;
  }

  if (cmd === 'clear') { res.json({ output: '', isError: false, clear: true }); return; }

  res.json({ output: `Command not found: ${command}\nType 'help' to see available commands.`, isError: true });
});

// ---- SSE Streaming Chat ----

agentRouter.post('/chat/stream', requireAuth, validateBody(chatSchema), async (req: AuthRequest, res) => {
  const { message } = req.body as { message: string };
  const userId = req.userId!;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    const agentConfig = db.prepare('SELECT * FROM agent_configs WHERE user_id = ?').get(userId) as Record<string, unknown> | undefined;
    const user = db.prepare('SELECT name, credits FROM users WHERE id = ?').get(userId) as Record<string, unknown> | undefined;
    const systemPrompt = buildSystemPrompt(agentConfig, user, userId);

    const history = getConversationContext(userId);
    const fullMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message },
    ];

    const start = Date.now();
    let fullReply = '';

    const { tokensIn, tokensOut } = await streamOllama(fullMessages, (chunk) => {
      fullReply += chunk;
      res.write(`data: ${JSON.stringify({ text: chunk, done: false })}\n\n`);
    });

    const latencyMs = Date.now() - start;

    // If streaming produced empty content, fall back to non-streaming call
    if (!fullReply.trim()) {
      logger.warn({ userId, latencyMs }, 'Stream produced empty reply, falling back to routeChat');
      const result = await routeChat(
        [...history, { role: 'user', content: message }],
        { systemPrompt, agentName: (agentConfig?.name as string) || 'Geek', userCredits: (user?.credits as number) || 0 },
      );
      res.write(`data: ${JSON.stringify({ text: result.reply, done: false })}\n\n`);
      res.write(`data: ${JSON.stringify({
        text: '', done: true, provider: result.provider, model: result.model,
        latencyMs: result.latencyMs, tier: (result.provider === 'ollama' || result.provider === 'openrouter-free') ? 'local' : 'premium', creditsUsed: result.creditCost,
      })}\n\n`);
    } else {
      // Log usage
      db.prepare(`INSERT INTO usage_events (id, user_id, provider, model, tokens_in, tokens_out, cost_usd, channel, tool)
        VALUES (?, ?, 'ollama', ?, ?, ?, 0, 'web', 'ai.chat.stream')`).run(
        uuid(), userId, config.ollamaModel, tokensIn, tokensOut,
      );

      // Send final event
      res.write(`data: ${JSON.stringify({
        text: '', done: true, provider: 'ollama', model: config.ollamaModel,
        latencyMs, tier: 'local', creditsUsed: 0,
      })}\n\n`);
    }
  } catch (err) {
    logger.error({ err, userId }, 'Stream chat error');
    // Try non-streaming fallback even on stream error
    try {
      const agentConfig = db.prepare('SELECT * FROM agent_configs WHERE user_id = ?').get(userId) as Record<string, unknown> | undefined;
      const user = db.prepare('SELECT name, credits FROM users WHERE id = ?').get(userId) as Record<string, unknown> | undefined;
      const fallbackHistory = getConversationContext(userId);
      const result = await routeChat(
        [...fallbackHistory, { role: 'user', content: message }],
        { systemPrompt: buildSystemPrompt(agentConfig, user, userId), agentName: (agentConfig?.name as string) || 'Geek', userCredits: (user?.credits as number) || 0 },
      );
      res.write(`data: ${JSON.stringify({ text: result.reply, done: false })}\n\n`);
      res.write(`data: ${JSON.stringify({ text: '', done: true, provider: result.provider, model: result.model })}\n\n`);
    } catch (fallbackErr) {
      logger.error({ fallbackErr, userId }, 'Stream fallback also failed');
      res.write(`data: ${JSON.stringify({ text: 'Sorry, I had trouble processing that. Please try again.', done: false })}\n\n`);
      res.write(`data: ${JSON.stringify({ text: '', done: true, error: 'Stream failed' })}\n\n`);
    }
  }

  res.end();
});

// ---- Memory Management ----

agentRouter.get('/memory', requireAuth, (req: AuthRequest, res) => {
  const { getMemories } = require('../services/memory.js');
  const category = req.query.category as string | undefined;
  const memories = getMemories(req.userId!, category);
  res.json(memories);
});

agentRouter.delete('/memory/:id', requireAuth, (req: AuthRequest, res) => {
  const { deleteMemory } = require('../services/memory.js');
  const deleted = deleteMemory(req.userId!, req.params.id);
  if (!deleted) { res.status(404).json({ error: 'Memory not found' }); return; }
  res.json({ success: true });
});

// ---- Conversation History ----

agentRouter.get('/conversations', requireAuth, (req: AuthRequest, res) => {
  const { getRecentConversations } = require('../services/memory.js');
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const conversations = getRecentConversations(req.userId!, limit);
  res.json(conversations);
});

// ---- Public Portfolio Chat (real LLM-powered) ----

agentRouter.post('/chat/public/:username', validateBody(chatSchema), async (req, res) => {
  const { message } = req.body;
  const { username } = req.params;

  const user = db.prepare('SELECT id, name FROM users WHERE username = ?').get(username) as Record<string, unknown> | undefined;
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const agentConfig = db.prepare('SELECT * FROM agent_configs WHERE user_id = ?').get(user.id as string) as Record<string, unknown> | undefined;
  const portfolio = db.prepare('SELECT * FROM portfolios WHERE user_id = ?').get(user.id as string) as Record<string, unknown> | undefined;

  const skills = JSON.parse(portfolio?.skills as string || '[]');
  const projects = JSON.parse(portfolio?.projects as string || '[]');
  const ownerName = user.name as string;
  const agentName = (agentConfig?.name || 'Assistant') as string;

  const systemPrompt = `You are ${agentName}, the AI assistant for ${ownerName}'s portfolio on GeekSpace.
Your role: Help visitors learn about ${ownerName}'s work, skills, and how to get in touch.
Be friendly, professional, and concise. Keep responses under 150 words.

${ownerName}'s skills: ${skills.join(', ') || 'Not specified'}
${ownerName}'s projects: ${projects.map((p: Record<string, unknown>) => p.name).join(', ') || 'None published'}
Portfolio about: ${portfolio?.about || 'No bio'}`;

  try {
    const result = await routeChat(
      [{ role: 'user', content: message }],
      { systemPrompt, agentName, forceProvider: 'ollama' },
    );
    res.json({ reply: result.reply, agentName, ownerName });
  } catch {
    res.json({
      reply: `Hi! I'm ${agentName}, ${ownerName}'s AI assistant. I'm having trouble connecting right now, but you can learn more from the portfolio above.`,
      agentName,
      ownerName,
    });
  }
});
