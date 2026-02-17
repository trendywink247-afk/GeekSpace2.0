import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validateBody, chatSchema, commandSchema, agentConfigUpdateSchema, memoryCreateSchema, memoryUpdateSchema, deployPremiumSchema, premiumChatSchema, workflowQuerySchema } from '../middleware/validate.js';
import { db } from '../db/index.js';
import { routeChat, classifyIntent, computeCreditCost, deductSubscriptionCredits, streamOllama, type ChatMessage, type Provider } from '../services/llm.js';
import { edithChat } from '../services/edith.js';
import { logger } from '../logger.js';
import { config } from '../config.js';
import { OPENCLAW_IDENTITY, buildPortfolioVisitorPrompt } from '../prompts/openclaw-system.js';
import { getPersonalityPrompt, getPersonality, PERSONALITIES } from '../prompts/personalities.js';
import { checkKeywordTriggers } from '../services/automations-engine.js';
import { buildMemoryContext, logConversation, extractMemories, extractMemoriesWithAI, getConversationContext, getMemories, getRelevantMemories, deleteMemory, upsertMemory, getRecentConversations } from '../services/memory.js';
import { generateCodename, buildPremiumPrompt, getDeployMessage } from '../services/premium-agent.js';
import { bridgeChat, classifyComplexity, getRecentBridgeEvents, type BridgeRequest } from '../services/pico-kimi-bridge.js';
import { getUserWorkflows, getWorkflowStatus, getWorkflowAnalytics } from '../services/workflow-engine.js';
import { getAllAgentDefinitions, selectAgents, getAgentRoles, type AgentRole } from '../services/agent-registry.js';
import { isPicoClawAvailable, queryPicoClaw } from '../services/picoclaw.js';
import { parseActions } from '../services/action-parser.js';
import { executeAction, type ActionResult } from '../services/action-executor.js';

export const agentRouter = Router();

// ---- Helper: Build system prompt with user context ----

function buildSystemPrompt(
  agentConfig: Record<string, unknown> | undefined,
  user: Record<string, unknown> | undefined,
  userId: string,
  userMessage?: string,
): string {
  const personalityId = (agentConfig?.personality as string) || 'jarvis';
  const personality = getPersonality(personalityId);
  const personalityPrompt = getPersonalityPrompt(personalityId);
  const agentName = (agentConfig?.name as string) || personality.name;
  const voice = (agentConfig?.voice as string) || 'friendly';
  const mode = (agentConfig?.mode as string) || 'builder';
  const customPrompt = (agentConfig?.system_prompt as string) || '';
  const userName = (user?.name as string) || 'there';

  const reminderCount = (db.prepare('SELECT COUNT(*) as c FROM reminders WHERE user_id = ? AND completed = 0').get(userId) as { c: number })?.c || 0;
  const connectedCount = (db.prepare("SELECT COUNT(*) as c FROM integrations WHERE user_id = ? AND status = 'connected'").get(userId) as { c: number })?.c || 0;

  // Inject memory context
  const memoryBlock = buildMemoryContext(userId, userMessage);

  return `${OPENCLAW_IDENTITY}

--- PERSONALITY ---
${personalityPrompt}

--- USER SESSION ---
Agent name: ${agentName}. User: ${userName}. Voice: ${voice}. Mode: ${mode}.
${customPrompt ? `Custom instructions: ${customPrompt}` : ''}
Active reminders: ${reminderCount}. Connected integrations: ${connectedCount}.${memoryBlock}

IMPORTANT: Keep responses SHORT. 1-3 sentences for simple questions. No markdown formatting (no **, no ##, no bullet lists). Plain conversational text only.`;
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
    personality: 'personality',
  };

  for (const [key, col] of Object.entries(allowedFields)) {
    if (updates[key] !== undefined) { fields.push(`${col} = ?`); values.push(updates[key]); }
  }

  if (fields.length) { values.push(req.userId); db.prepare(`UPDATE agent_configs SET ${fields.join(', ')} WHERE user_id = ?`).run(...values); }

  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Updated agent config', ?, 'bot')`).run(uuid(), req.userId, `Changed: ${Object.keys(updates).join(', ')}`);

  const config = db.prepare('SELECT * FROM agent_configs WHERE user_id = ?').get(req.userId!);
  res.json(config);
});

// ---- Personalities ----

agentRouter.get('/personalities', (_req, res) => {
  res.json(PERSONALITIES);
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

    // Check subscription credits
    const sub = db.prepare('SELECT credits_remaining, billing_cycle_end FROM subscriptions WHERE user_id = ?').get(userId) as { credits_remaining: number; billing_cycle_end: string } | undefined;
    if (sub && sub.credits_remaining <= 0) {
      res.json({
        text: `You've used all your credits for this month! They reset on ${sub.billing_cycle_end.split('T')[0]}. Upgrade your plan for more.`,
        route: 'error',
        tier: 'local',
        provider: 'builtin',
        latencyMs: 0,
        creditsUsed: 0,
        creditsRemaining: 0,
      });
      return;
    }

    // Log user message + extract memories (non-blocking)
    logConversation(userId, 'user', message);
    extractMemories(userId, message);

    // ---- Parse route prefix: /premium, /edith, /local, /pico, /bridge, or auto ----
    let forceRoute: 'premium' | 'local' | 'pico' | 'bridge' | null = null;
    let forceAgent: AgentRole | undefined;

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
    } else if (message.startsWith('/task ')) {
      // ---- Pico Fleet task planning via chat ----
      const taskDesc = message.slice(6).trim();
      if (!taskDesc) {
        res.json({ text: 'Usage: /task <description>', route: 'error', provider: 'builtin', latencyMs: 0 });
        return;
      }
      try {
        if (sub && sub.credits_remaining < 10) {
          res.json({ text: 'Not enough credits for task planning (minimum 10 required).', route: 'error', provider: 'builtin', latencyMs: 0 });
          return;
        }
        const { planTasks: planTasksFn, queueTasks: queueTasksFn } = await import('../services/pico-fleet.js');
        const start = Date.now();
        const { tasks, creditCost } = await planTasksFn(userId, taskDesc);
        const latencyMs = Date.now() - start;

        if (tasks.length === 0) {
          res.json({ text: `No actionable tasks could be planned. Credits used: ${creditCost}`, route: 'pico-fleet', provider: 'edith', latencyMs, creditsUsed: creditCost });
          return;
        }

        const taskIds = queueTasksFn(userId, tasks, 'kimi');
        const updatedSub = db.prepare('SELECT credits_remaining FROM subscriptions WHERE user_id = ?').get(userId) as { credits_remaining: number } | undefined;
        const summary = tasks.map(t => `[slot ${t.agent_slot}] ${t.task_type}: ${t.description}`).join('\n');

        logConversation(userId, 'assistant', `Planned ${taskIds.length} task(s):\n${summary}`);

        res.json({
          text: `Planned ${taskIds.length} task(s):\n${summary}\n\nCredits used: ${creditCost}. Remaining: ${updatedSub?.credits_remaining ?? 0}`,
          route: 'pico-fleet',
          tier: 'premium',
          provider: 'edith',
          latencyMs,
          creditsUsed: creditCost,
          creditsRemaining: updatedSub?.credits_remaining ?? 0,
        });
      } catch (err) {
        res.json({ text: `Task planning failed: ${err instanceof Error ? err.message : 'Unknown error'}`, route: 'error', provider: 'builtin', latencyMs: 0 });
      }
      return;
    } else if (message.startsWith('/bridge ') || message.startsWith('/workflow ')) {
      forceRoute = 'bridge';
      const prefixLen = message.startsWith('/bridge ') ? 8 : 10;
      message = message.slice(prefixLen).trim();
    } else if (message.startsWith('/agent:')) {
      // Force a specific agent: /agent:coder, /agent:planner, etc.
      forceRoute = 'bridge';
      const match = message.match(/^\/agent:(\w+)\s+(.+)$/s);
      if (match) {
        const requestedRole = match[1];
        const validRoles = getAgentRoles();
        if (validRoles.includes(requestedRole as AgentRole)) {
          forceAgent = requestedRole as AgentRole;
          message = match[2].trim();
        } else {
          res.status(400).json({
            error: `Unknown agent role: "${requestedRole}". Valid roles: ${validRoles.join(', ')}`,
          });
          return;
        }
      }
    }

    // ---- Auto-route through bridge when enabled ----
    if (!forceRoute && config.bridgeEnabled && config.picoClawEnabled) {
      forceRoute = 'bridge';
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
        deductSubscriptionCredits(userId, creditCost);
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

    // ---- Bridge route: Pico-Kimi orchestration (multi-agent workflows) ----
    if (forceRoute === 'bridge') {
      try {
        const history = getConversationContext(userId);
        const bridgeReq: BridgeRequest = {
          userId,
          message,
          systemPrompt,
          conversationHistory: history,
          forceAgent,
          forceWorkflow: forceAgent ? false : (message.length > 100),
          userCredits,
        };

        const bridgeResult = await bridgeChat(bridgeReq);

        // Log usage
        db.prepare(`INSERT INTO usage_events (id, user_id, provider, model, tokens_in, tokens_out, cost_usd, channel, tool)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'web', 'ai.bridge')`).run(
          uuid(), userId, bridgeResult.provider, bridgeResult.model,
          bridgeResult.tokensIn, bridgeResult.tokensOut, bridgeResult.creditCost,
        );

        // Deduct credits
        if (bridgeResult.creditCost > 0) {
          db.prepare('UPDATE users SET credits = MAX(0, credits - ?) WHERE id = ?').run(bridgeResult.creditCost, userId);
          deductSubscriptionCredits(userId, bridgeResult.creditCost);
        }

        const updatedCredits = (db.prepare('SELECT credits FROM users WHERE id = ?').get(userId) as { credits: number })?.credits ?? userCredits;

        // Log assistant response
        logConversation(userId, 'assistant', bridgeResult.text, bridgeResult.provider, bridgeResult.model);

        const response: Record<string, unknown> = {
          text: bridgeResult.text,
          route: bridgeResult.route,
          tier: bridgeResult.route === 'pico-direct' ? 'local' : 'premium',
          latencyMs: bridgeResult.latencyMs,
          provider: bridgeResult.provider,
          model: bridgeResult.model,
          creditsUsed: bridgeResult.creditCost,
          creditsRemaining: updatedCredits,
          complexity: bridgeResult.complexity,
          agentsUsed: bridgeResult.agentsUsed,
          workflowId: bridgeResult.workflowId,
        };
        if (bridgeResult.steps) {
          response.steps = bridgeResult.steps;
        }

        // Background AI memory extraction (non-blocking)
        extractMemoriesWithAI(userId, message, bridgeResult.text).catch((e: unknown) => logger.debug({ err: e }, 'background task failed'));

        res.json(response);
        return;
      } catch (err) {
        logger.warn({ err, userId }, 'Bridge route failed, falling back to standard router');
        // Fall through to standard local router
      }
    }

    // Fire keyword-based automation triggers (non-blocking)
    checkKeywordTriggers(userId, message).catch((e: unknown) => logger.debug({ err: e }, 'background task failed'));

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

    // Deduct credits
    if (result.creditCost > 0) {
      db.prepare('UPDATE users SET credits = MAX(0, credits - ?) WHERE id = ?').run(result.creditCost, userId);
    }
    deductSubscriptionCredits(userId, result.creditCost);

    const updatedCredits = (db.prepare('SELECT credits FROM users WHERE id = ?').get(userId) as { credits: number })?.credits ?? userCredits;

    // Parse and execute any tool actions from LLM response
    const { text: cleanReply, actions: parsedActions } = parseActions(result.reply);
    const actionResults: ActionResult[] = [];

    for (const action of parsedActions) {
      const actionResult = await executeAction(userId, action);
      actionResults.push(actionResult);
    }

    // Log the clean reply (without action blocks)
    logConversation(userId, 'assistant', cleanReply || result.reply, result.provider, result.model);

    const response: Record<string, unknown> = {
      text: cleanReply || result.reply,
      route: tier,
      tier,
      latencyMs: result.latencyMs,
      provider: result.provider,
      model: result.model,
      creditsUsed: result.creditCost,
      creditsRemaining: updatedCredits,
    };

    // Attach action results if any
    if (actionResults.length > 0) {
      response.actions = actionResults;
    }

    if (config.logLevel === 'debug') {
      response.debug = { intent, forceRoute, tokensUsed: result.tokensIn + result.tokensOut };
    }

    // Background AI memory extraction (non-blocking)
    extractMemoriesWithAI(userId, message, cleanReply || result.reply).catch((e: unknown) => logger.debug({ err: e }, 'background task failed'));

    res.json(response);
  } catch (err) {
    logger.error({ err, userId }, 'Chat handler error');
    res.status(500).json({ error: 'Failed to process message. Please try again.' });
  }
});

// ---- Get Generated Artifact ----
agentRouter.get('/artifact/:id', requireAuth, (req: AuthRequest, res) => {
  const artifact = db.prepare(
    'SELECT * FROM generated_artifacts WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.userId!) as Record<string, unknown> | undefined;

  if (!artifact) {
    res.status(404).json({ error: 'Artifact not found' });
    return;
  }

  res.json(artifact);
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
    const creditsSub = db.prepare('SELECT plan, credits_remaining, billing_cycle_end FROM subscriptions WHERE user_id = ?').get(userId) as { plan: string; credits_remaining: number; billing_cycle_end: string } | undefined;
    if (!creditsSub) {
      res.json({ output: 'No subscription found.', isError: false });
      return;
    }
    res.json({
      output: `<span style="color:#7B61FF;font-weight:bold">Plan:</span> ${creditsSub.plan}\n<span style="color:#7B61FF;font-weight:bold">Credits remaining:</span> <span style="color:#61FF7B">${creditsSub.credits_remaining.toLocaleString()}</span>\n<span style="color:#7B61FF;font-weight:bold">Cycle ends:</span> ${creditsSub.billing_cycle_end}`,
      isError: false,
    });
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

  // ---- Pico Fleet commands ----
  if (cmd === 'gs pico list') {
    const { getUserAgents } = await import('../services/pico-fleet.js');
    const agents = getUserAgents(userId);
    if (!agents.length) { res.json({ output: 'No Weebo agents found.', isError: false }); return; }
    const lines = agents.map(a =>
      `  Slot ${a.slot}: ${a.name} [${a.status}] completed: ${a.tasks_completed}, failed: ${a.tasks_failed}`
    );
    res.json({ output: `Weebo Agents:\n${lines.join('\n')}`, isError: false });
    return;
  }

  if (cmd.startsWith('gs pico create ')) {
    const name = cmd.slice(15).replace(/^["']|["']$/g, '').trim();
    if (!name || name.length > 30) { res.json({ output: 'Agent name required (1-30 chars)', isError: true }); return; }
    try {
      const { createAgent } = await import('../services/pico-fleet.js');
      const agent = createAgent(userId, name);
      res.json({ output: `Created Weebo agent "${agent.name}" at slot ${agent.slot}`, isError: false });
    } catch (err) {
      res.json({ output: err instanceof Error ? err.message : 'Failed to create agent', isError: true });
    }
    return;
  }

  if (cmd.startsWith('gs pico pause ')) {
    const slotStr = cmd.slice(14).trim();
    const slot = parseInt(slotStr, 10);
    if (isNaN(slot) || slot < 1 || slot > 3) { res.json({ output: 'Usage: gs pico pause <slot> (1-3)', isError: true }); return; }
    const { getAgentBySlot, updateAgent } = await import('../services/pico-fleet.js');
    const agent = getAgentBySlot(userId, slot);
    if (!agent) { res.json({ output: `No agent at slot ${slot}`, isError: true }); return; }
    updateAgent(agent.id, userId, { status: 'paused' });
    res.json({ output: `Paused ${agent.name} (slot ${slot})`, isError: false });
    return;
  }

  if (cmd.startsWith('gs pico resume ')) {
    const slotStr = cmd.slice(15).trim();
    const slot = parseInt(slotStr, 10);
    if (isNaN(slot) || slot < 1 || slot > 3) { res.json({ output: 'Usage: gs pico resume <slot> (1-3)', isError: true }); return; }
    const { getAgentBySlot, updateAgent } = await import('../services/pico-fleet.js');
    const agent = getAgentBySlot(userId, slot);
    if (!agent) { res.json({ output: `No agent at slot ${slot}`, isError: true }); return; }
    updateAgent(agent.id, userId, { status: 'active' });
    res.json({ output: `Resumed ${agent.name} (slot ${slot})`, isError: false });
    return;
  }

  if (cmd === 'gs pico tasks') {
    const { getUserTasks } = await import('../services/pico-fleet.js');
    const tasks = getUserTasks(userId, { limit: 20 });
    if (!tasks.length) { res.json({ output: 'No tasks found. Use: gs task "description"', isError: false }); return; }
    const lines = tasks.map(t => {
      const slot = t.agent_slot || '?';
      return `  ${(t.id).slice(0, 6)} | slot ${slot} | ${t.task_type.padEnd(18)} | ${t.status.padEnd(9)} | ${t.description.slice(0, 40)}`;
    });
    res.json({ output: `Recent Tasks:\nID     | Slot | Type               | Status    | Description\n${lines.join('\n')}`, isError: false });
    return;
  }

  if (cmd.startsWith('gs task ')) {
    const taskDesc = command.slice(8).replace(/^["']|["']$/g, '').trim();
    if (!taskDesc) { res.json({ output: 'Usage: gs task "description"', isError: true }); return; }

    try {
      const sub = db.prepare('SELECT credits_remaining FROM subscriptions WHERE user_id = ?').get(userId) as { credits_remaining: number } | undefined;
      if (sub && sub.credits_remaining < 10) {
        res.json({ output: 'Not enough credits for task planning (minimum 10 required)', isError: true });
        return;
      }

      const { planTasks, queueTasks } = await import('../services/pico-fleet.js');
      const { tasks, creditCost } = await planTasks(userId, taskDesc);

      if (tasks.length === 0) {
        res.json({ output: `No actionable tasks planned. Credits used: ${creditCost}`, isError: false });
        return;
      }

      const taskIds = queueTasks(userId, tasks, 'kimi');
      const summary = tasks.map(t => `  - [slot ${t.agent_slot}] ${t.task_type}: ${t.description}`).join('\n');
      const updatedSub = db.prepare('SELECT credits_remaining FROM subscriptions WHERE user_id = ?').get(userId) as { credits_remaining: number } | undefined;

      res.json({
        output: `Planned ${taskIds.length} task(s):\n${summary}\n\nCredits used: ${creditCost} (planning). Remaining: ${updatedSub?.credits_remaining ?? 0}`,
        isError: false,
      });
    } catch (err) {
      res.json({ output: `Task planning failed: ${err instanceof Error ? err.message : 'Unknown error'}`, isError: true });
    }
    return;
  }

  // ---- AI command — routed through LLM router ----
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

  if (cmd === 'gs health') {
    try {
      const healthRes = await fetch(`http://localhost:${config.port}/api/health`);
      const health = await healthRes.json() as Record<string, unknown>;
      const lines = Object.entries(health)
        .map(([k, v]) => `<span style="color:#7B61FF;font-weight:bold">${k}:</span> ${typeof v === 'object' ? JSON.stringify(v) : v}`)
        .join('\n');
      res.json({ output: lines, isError: false });
    } catch {
      res.json({ output: '<span style="color:#FF6161">Failed to reach health endpoint</span>', isError: true });
    }
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
    const reminderText = command.slice(10).trim().replace(/^["']|["']$/g, '');
    if (!reminderText) {
      res.json({ output: 'Usage: gs remind &lt;text&gt;', isError: false });
      return;
    }
    const remId = uuid();
    db.prepare("INSERT INTO reminders (id, user_id, text, channel, category, created_by) VALUES (?, ?, ?, 'push', 'general', 'terminal')").run(remId, userId, reminderText);
    res.json({ output: `<span style="color:#61FF7B">Reminder created:</span> ${reminderText}`, isError: false });
    return;
  }

  if (cmd === 'gs deploy portfolio') {
    db.prepare("UPDATE portfolios SET is_public = 1 WHERE user_id = ?").run(userId);
    res.json({ output: '<span style="color:#61FF7B">Portfolio deployed!</span>', isError: false });
    return;
  }

  if (cmd === 'help') {
    res.json({ output: `GeekSpace Terminal Commands:\n  gs me                     Show your profile\n  gs reminders list         List reminders\n  gs reminders add "text"   Create a reminder\n  gs remind <text>          Quick reminder shortcut\n  gs credits                Check subscription credits\n  gs usage today|month      Usage reports\n  gs integrations           List integrations\n  gs connect <service>      Connect integration\n  gs disconnect <service>   Disconnect integration\n  gs automations            List automations\n  gs status                 Agent status\n  gs health                 System health check\n  gs brief                  Daily briefing summary\n  gs portfolio              Portfolio URL\n  gs deploy                 Deploy portfolio\n  gs deploy portfolio       Deploy portfolio (alias)\n  gs profile set <f> <v>    Update profile field\n  gs export                 Export all data as JSON\n  gs pico list              List Weebo agents\n  gs pico create "Name"     Create a new Weebo agent (max 3)\n  gs pico pause <slot>      Pause agent at slot (1-3)\n  gs pico resume <slot>     Resume agent at slot\n  gs pico tasks             List recent tasks\n  gs task "description"     Plan and queue tasks via Kimi\n  ai "prompt"               Ask your AI agent (real LLM)\n  clear                     Clear terminal\n  help                      Show this help\n\nChat Prefixes:\n  /bridge <msg>             Multi-agent orchestration\n  /workflow <msg>           Alias for /bridge\n  /agent:<role> <msg>       Force specific agent (coder, planner, analyst, etc.)\n  /premium <msg>            Force Kimi premium reasoning\n  /local <msg>              Force local Ollama\n  /pico <msg>               Force Weebo Engine\n  /task <description>       Plan and queue tasks via Kimi`, isError: false });
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
    const intent = classifyIntent(message);
    const userCredits = (user?.credits as number) || 0;
    const agentName = (agentConfig?.name as string) || 'Geek';

    // For complex/coding/planning intents, skip slow Ollama stream and use routeChat
    if (intent === 'coding' || intent === 'planning' || intent === 'complex') {
      const result = await routeChat(
        [...history, { role: 'user', content: message }],
        { systemPrompt, agentName, userCredits },
      );
      res.write(`data: ${JSON.stringify({ text: result.reply, done: false })}\n\n`);
      const tier = (result.provider === 'ollama' || result.provider === 'builtin' || result.provider === 'openrouter-free') ? 'local' : 'premium';
      if (result.creditCost > 0) {
        db.prepare('UPDATE users SET credits = MAX(0, credits - ?) WHERE id = ?').run(result.creditCost, userId);
      }
      db.prepare(`INSERT INTO usage_events (id, user_id, provider, model, tokens_in, tokens_out, cost_usd, channel, tool)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'web', 'ai.chat.stream')`).run(
        uuid(), userId, result.provider, result.model, result.tokensIn, result.tokensOut, result.creditCost,
      );
      logConversation(userId, 'assistant', result.reply, result.provider, result.model);
      res.write(`data: ${JSON.stringify({
        text: '', done: true, provider: result.provider, model: result.model,
        latencyMs: result.latencyMs, tier, creditsUsed: result.creditCost,
      })}\n\n`);
    } else {
      // Simple/automation intents → stream via Ollama (fast, free)
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
          { systemPrompt, agentName, userCredits },
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
        logConversation(userId, 'assistant', fullReply, 'ollama', config.ollamaModel);

        // Send final event
        res.write(`data: ${JSON.stringify({
          text: '', done: true, provider: 'ollama', model: config.ollamaModel,
          latencyMs, tier: 'local', creditsUsed: 0,
        })}\n\n`);
      }
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
  const category = req.query.category as string | undefined;
  const search = req.query.search as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);

  if (search) {
    const memories = getRelevantMemories(req.userId!, search, limit);
    res.json(memories);
    return;
  }
  const memories = getMemories(req.userId!, category, limit);
  res.json(memories);
});

agentRouter.post('/memory', requireAuth, validateBody(memoryCreateSchema), (req: AuthRequest, res) => {
  const { category, key, value, confidence, source } = req.body;
  upsertMemory(req.userId!, category, key, value, confidence, source);

  // Return the newly created/updated memory
  const memory = db.prepare(
    'SELECT * FROM agent_memory WHERE user_id = ? AND category = ? AND key = ?'
  ).get(req.userId!, category, key);
  res.status(201).json(memory);
});

agentRouter.put('/memory/:id', requireAuth, validateBody(memoryUpdateSchema), (req: AuthRequest, res) => {
  const existing = db.prepare(
    'SELECT * FROM agent_memory WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.userId!) as Record<string, unknown> | undefined;

  if (!existing) { res.status(404).json({ error: 'Memory not found' }); return; }

  const category = req.body.category ?? existing.category;
  const key = req.body.key ?? existing.key;
  const value = req.body.value ?? existing.value;
  const confidence = req.body.confidence ?? existing.confidence;

  // Delete old entry if category or key changed (unique constraint)
  if (category !== existing.category || key !== existing.key) {
    db.prepare('DELETE FROM agent_memory WHERE id = ?').run(req.params.id);
  }

  upsertMemory(req.userId!, category as string, key as string, value as string, confidence as number, existing.source as string);

  const updated = db.prepare(
    'SELECT * FROM agent_memory WHERE user_id = ? AND category = ? AND key = ?'
  ).get(req.userId!, category, key);
  res.json(updated);
});

agentRouter.delete('/memory/:id', requireAuth, (req: AuthRequest, res) => {
  const deleted = deleteMemory(req.userId!, req.params.id);
  if (!deleted) { res.status(404).json({ error: 'Memory not found' }); return; }
  res.json({ success: true });
});

// ---- Conversation History ----

agentRouter.get('/conversations', requireAuth, (req: AuthRequest, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const conversations = getRecentConversations(req.userId!, limit);
  res.json(conversations);
});

// ---- Premium Agent (Specialist Sessions) ----

agentRouter.post('/deploy-premium', requireAuth, validateBody(deployPremiumSchema), async (req: AuthRequest, res) => {
  const { task } = req.body as { task: string };
  const userId = req.userId!;

  try {
    // Check subscription: must be paid plan
    const sub = db.prepare('SELECT plan, credits_remaining FROM subscriptions WHERE user_id = ?').get(userId) as { plan: string; credits_remaining: number } | undefined;
    if (!sub || sub.plan === 'free') {
      res.status(403).json({ error: 'Premium agent requires a paid plan.' });
      return;
    }
    if (sub.credits_remaining < 100) {
      res.status(403).json({ error: 'Not enough credits to deploy a specialist (100 required).' });
      return;
    }

    // Deduct deployment cost
    deductSubscriptionCredits(userId, 100);

    const codename = generateCodename();
    const agentConfig = db.prepare('SELECT personality FROM agent_configs WHERE user_id = ?').get(userId) as { personality?: string } | undefined;
    const personalityId = agentConfig?.personality || 'jarvis';

    const sessionId = uuid();
    db.prepare(`INSERT INTO premium_sessions (id, user_id, agent_codename, task, credits_used) VALUES (?, ?, ?, ?, 100)`).run(sessionId, userId, codename, task);

    const message = getDeployMessage(codename, personalityId);

    res.json({ sessionId, codename, status: 'active', message, creditsUsed: 100 });
  } catch (err) {
    logger.error({ err, userId }, 'Deploy premium agent error');
    res.status(500).json({ error: 'Failed to deploy specialist.' });
  }
});

agentRouter.post('/premium-chat/:sessionId', requireAuth, validateBody(premiumChatSchema), async (req: AuthRequest, res) => {
  const { message } = req.body as { message: string };
  const { sessionId } = req.params;
  const userId = req.userId!;

  try {
    const session = db.prepare('SELECT * FROM premium_sessions WHERE id = ? AND user_id = ?').get(sessionId, userId) as Record<string, unknown> | undefined;
    if (!session) { res.status(404).json({ error: 'Session not found.' }); return; }
    if (session.status !== 'active') { res.status(400).json({ error: 'Session has ended.' }); return; }

    // Check credits
    const sub = db.prepare('SELECT credits_remaining FROM subscriptions WHERE user_id = ?').get(userId) as { credits_remaining: number } | undefined;
    if (!sub || sub.credits_remaining <= 0) {
      res.json({ text: 'You have no credits remaining. Please upgrade your plan.', provider: 'builtin', model: '', latencyMs: 0, creditsUsed: 0, sessionCreditsTotal: session.credits_used as number, messagesCount: session.messages_count as number, creditsRemaining: 0 });
      return;
    }

    const agentConfig = db.prepare('SELECT personality FROM agent_configs WHERE user_id = ?').get(userId) as { personality?: string } | undefined;
    const personalityId = agentConfig?.personality || 'jarvis';
    const premiumSystemPrompt = buildPremiumPrompt(session.task as string, session.agent_codename as string, personalityId);

    const edithResult = await edithChat(message, premiumSystemPrompt);

    const creditCost = computeCreditCost('edith', edithResult.tokensIn, edithResult.tokensOut);
    deductSubscriptionCredits(userId, creditCost);

    // Update session stats
    const newCreditsUsed = (session.credits_used as number) + creditCost;
    const newMessagesCount = (session.messages_count as number) + 1;
    db.prepare('UPDATE premium_sessions SET credits_used = ?, messages_count = ?, model_used = ? WHERE id = ?').run(newCreditsUsed, newMessagesCount, config.moonshotReasoningModel, sessionId);

    // Log usage
    db.prepare(`INSERT INTO usage_events (id, user_id, provider, model, tokens_in, tokens_out, cost_usd, channel, tool)
      VALUES (?, ?, 'edith', ?, ?, ?, ?, 'web', 'premium-agent')`).run(
      uuid(), userId, config.moonshotReasoningModel, edithResult.tokensIn, edithResult.tokensOut, creditCost,
    );

    const updatedSub = db.prepare('SELECT credits_remaining FROM subscriptions WHERE user_id = ?').get(userId) as { credits_remaining: number };

    res.json({
      text: edithResult.text,
      provider: 'edith',
      model: config.moonshotReasoningModel,
      latencyMs: edithResult.latencyMs,
      creditsUsed: creditCost,
      sessionCreditsTotal: newCreditsUsed,
      messagesCount: newMessagesCount,
      creditsRemaining: updatedSub.credits_remaining,
    });
  } catch (err) {
    logger.error({ err, userId, sessionId }, 'Premium chat error');
    res.status(500).json({ error: 'Failed to process message.' });
  }
});

agentRouter.delete('/premium-session/:sessionId', requireAuth, (req: AuthRequest, res) => {
  const { sessionId } = req.params;
  const userId = req.userId!;

  const session = db.prepare('SELECT * FROM premium_sessions WHERE id = ? AND user_id = ?').get(sessionId, userId) as Record<string, unknown> | undefined;
  if (!session) { res.status(404).json({ error: 'Session not found.' }); return; }

  db.prepare("UPDATE premium_sessions SET status = 'completed', ended_at = datetime('now') WHERE id = ?").run(sessionId);

  const createdAt = new Date(session.created_at as string).getTime();
  const duration = Math.round((Date.now() - createdAt) / 1000);

  res.json({
    sessionId,
    codename: session.agent_codename,
    creditsUsed: session.credits_used,
    messagesCount: session.messages_count,
    duration,
    status: 'completed',
  });
});

// ---- Public Portfolio Chat (real LLM-powered) ----

agentRouter.post('/chat/public/:username', validateBody(chatSchema), async (req, res) => {
  const { message, messageCount } = req.body as { message: string; messageCount?: number };
  const { username } = req.params;

  const user = db.prepare('SELECT id, name, location, role, company FROM users WHERE username = ?').get(username) as Record<string, unknown> | undefined;
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const agentConfig = db.prepare('SELECT * FROM agent_configs WHERE user_id = ?').get(user.id as string) as Record<string, unknown> | undefined;
  const portfolio = db.prepare('SELECT * FROM portfolios WHERE user_id = ?').get(user.id as string) as Record<string, unknown> | undefined;

  const personalityId = (agentConfig?.personality as string) || 'jarvis';
  const personality = getPersonality(personalityId);

  const skills: string[] = JSON.parse(portfolio?.skills as string || '[]');
  const projects: Array<{ name: string; description?: string }> = JSON.parse(portfolio?.projects as string || '[]');
  const ownerName = user.name as string;
  const agentName = (agentConfig?.name || personality.name) as string;

  // ---- Abuse detection: cap at 20 messages per session ----
  if (messageCount !== undefined && messageCount >= 20) {
    res.json({
      reply: `Thanks for chatting! You've been really engaged. If you'd like to continue the conversation, feel free to reach out to ${ownerName} directly.`,
      agentName,
      ownerName,
      personality: personalityId,
      personalityEmoji: personality.emoji,
    });
    return;
  }

  // ---- Visitor intent detection (first message only, non-fatal) ----
  let visitorIntent = 'curious';
  if (!messageCount || messageCount === 0) {
    try {
      const picoAvail = await isPicoClawAvailable();
      if (picoAvail) {
        const classifyResult = await queryPicoClaw(
          `Classify this visitor message into exactly one category: "recruiter", "collaborator", or "curious". Only respond with one of those three words.\n\nMessage: "${message}"`,
        );
        const classified = classifyResult.text.trim().toLowerCase();
        if (classified === 'recruiter' || classified === 'collaborator' || classified === 'curious') {
          visitorIntent = classified;
        }
      }
    } catch {
      // Non-fatal — default to "curious"
    }
  }

  const basePrompt = buildPortfolioVisitorPrompt({
    ownerName,
    agentName,
    skills,
    projects,
    about: (portfolio?.about as string) || '',
    location: (user.location as string) || undefined,
    role: (user.role as string) || undefined,
    company: (user.company as string) || undefined,
    visitorIntent,
  });

  const systemPrompt = `${basePrompt}\n\n--- PERSONALITY ---\n${personality.promptAddition}`;

  // ---- Log visitor interaction to activity_log ----
  try {
    db.prepare('INSERT INTO activity_log (id, user_id, action, details) VALUES (?, ?, \'portfolio_visitor_chat\', ?)').run(
      uuid(), user.id as string, JSON.stringify({ intent: visitorIntent, messageLength: message.length }),
    );
  } catch {
    // Non-fatal — don't block the chat response
  }

  try {
    const result = await routeChat(
      [{ role: 'user', content: message }],
      { systemPrompt, agentName, forceProvider: 'ollama' },
    );
    res.json({ reply: result.reply, agentName, ownerName, personality: personalityId, personalityEmoji: personality.emoji });
  } catch {
    res.json({
      reply: `Hi! I'm ${agentName}, ${ownerName}'s AI assistant. I'm having trouble connecting right now, but you can learn more from the portfolio above.`,
      agentName,
      ownerName,
      personality: personalityId,
      personalityEmoji: personality.emoji,
    });
  }
});

// ============================================================
// Pico-Kimi Bridge — Workflow & Agent Orchestration Endpoints
// ============================================================

// ---- Agent Registry (public) ----

agentRouter.get('/agents', (_req, res) => {
  const agents = getAllAgentDefinitions().map(a => ({
    role: a.role,
    name: a.name,
    description: a.description,
    capabilities: a.capabilities,
    costMultiplier: a.costMultiplier,
  }));
  res.json(agents);
});

// ---- Workflow History ----

agentRouter.get('/workflows', requireAuth, (req: AuthRequest, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const workflows = getUserWorkflows(req.userId!, limit);
  res.json(workflows);
});

// ---- Workflow Status ----

agentRouter.get('/workflows/:workflowId', requireAuth, (req: AuthRequest, res) => {
  const status = getWorkflowStatus(req.params.workflowId, req.userId!);
  if (!status) {
    res.status(404).json({ error: 'Workflow not found' });
    return;
  }
  res.json(status);
});

// ---- Workflow Analytics ----

agentRouter.get('/workflows-analytics', requireAuth, (req: AuthRequest, res) => {
  const analytics = getWorkflowAnalytics(req.userId!);
  res.json(analytics);
});

// ---- Bridge Events (debugging/analytics) ----

agentRouter.get('/bridge-events', requireAuth, (req: AuthRequest, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const events = getRecentBridgeEvents(req.userId!, limit);
  res.json(events);
});

// ---- Complexity Preview (dry run — shows what the bridge would do) ----

agentRouter.post('/bridge-preview', requireAuth, validateBody(chatSchema), (req: AuthRequest, res) => {
  const { message } = req.body as { message: string };
  const complexity = classifyComplexity(message);

  const selectedAgents = selectAgents(message, 3);

  res.json({
    complexity,
    selectedAgents,
    wouldUseWorkflow: complexity === 'complex' || complexity === 'multi-step',
    estimatedCreditRange: complexity === 'trivial' ? '1'
      : complexity === 'simple' ? '1-5'
      : complexity === 'moderate' ? '5-20'
      : complexity === 'complex' ? '20-80'
      : '50-200',
  });
});
