/**
 * @fileoverview Streaming chat routes — SSE token streaming and public portfolio chat.
 *
 * Endpoints:
 * - POST /chat/stream             — Authenticated SSE streaming chat (ReAct loop or Ollama direct)
 * - GET  /can-chat-public/:username — Check if a user has public agent chat enabled
 * - POST /chat/public/:username   — Unauthenticated portfolio visitor chat (IP rate-limited 10/hr)
 */
// Extracted from agent.ts — Sprint 3 decomposition
import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth, optionalAuth, type AuthRequest } from '../../../middleware/auth.js';
import { validateBody, chatSchema } from '../../../middleware/validate.js';
import { db } from '../../../db/index.js';
import { routeChat, classifyIntent, streamOllama, type ChatMessage, type Provider } from '../services/llm.js';
import { logger } from '../../../logger.js';
import { config } from '../../../config.js';
import { buildPortfolioVisitorPrompt } from '../../../prompts/openclaw-system.js';
import { getPersonality } from '../../../prompts/personalities.js';
import { checkContent } from '../../../services/content-filter.js';
import { logConversation, buildOwnerContextForVisitor, upsertMemory, getConversationContext } from '../../../services/memory.js';
import { isPicoClawAvailable, queryPicoClaw } from '../../../services/picoclaw.js';
import { parseActions, type ParsedAction } from '../../../services/action-parser.js';
import { executeAction } from '../services/action-executor.js';
import { runReactLoop } from '../services/react-loop.js';
import { cacheGet, cacheSet, cacheDel } from '../../../services/cache.js';
import { sendTelegramNotification, escapeTelegramHtml } from '../../../services/telegram.js';
import { detectNamedAgent } from '../services/message-router.js';
import { logActivity } from '../../../services/activity-log.js';
import { emitThinking, emitResponding, emitDone } from '../services/agent-state-bus.js';
import { routeDelegation } from '../../../services/delegation.js';
import { emitDelegation, emitCommSent, emitCommReceived } from '../../../services/activity-stream.js';
import { buildSystemPrompt } from './chat.js';
import { getOrCreateConversation, updateConversationMeta, autoTitleConversation } from '../services/conversation-threads.js';
import { touchSession } from '../../memory/services/session-summary.js';
import { processUploadedFile, buildFileContext } from '../services/file-processor.js';
import { isAmbiguous, generateHypotheses, formatHypothesesForPrompt } from '../services/hypothesis-service.js';

const router = Router();

/**
 * POST /api/agent/chat/stream
 * Streaming SSE endpoint for token-by-token LLM responses.
 */
router.post('/chat/stream', requireAuth, validateBody(chatSchema), async (req: AuthRequest, res) => {
  const { message } = req.body as { message: string };
  const userId = req.userId!;

  // Conversation threading + session tracking
  touchSession(userId);
  const reqConversationId = (req.body as { conversationId?: string }).conversationId;
  const conversationId = getOrCreateConversation(userId, reqConversationId, 'web');
  logConversation(userId, 'user', message, undefined, undefined, undefined, undefined, conversationId);
  autoTitleConversation(conversationId, message);
  updateConversationMeta(conversationId, message.slice(0, 200));

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let personalityId = 'jarvis';
  let streamDelegation: ReturnType<typeof routeDelegation> = null;
  let agentConfig: Record<string, unknown> | undefined;

  try {
    agentConfig = db.prepare('SELECT * FROM agent_configs WHERE user_id = ?').get(userId) as Record<string, unknown> | undefined;
    const user = db.prepare('SELECT name, credits FROM users WHERE id = ?').get(userId) as Record<string, unknown> | undefined;
    const userCredits = (user?.credits as number) || 0;
    let systemPrompt = buildSystemPrompt(agentConfig, user, userId, undefined, undefined, userCredits);

    // Process file attachments if present
    const files = (req as unknown as { files?: Express.Multer.File[] }).files;
    if (files && files.length > 0) {
      try {
        const processed = await Promise.all(files.map(f => processUploadedFile(f)));
        const fileContext = buildFileContext(processed);
        if (fileContext) systemPrompt += fileContext;
      } catch { /* non-fatal */ }
    }

    // 82.6: Content filter — tag flagged messages (non-blocking)
    checkContent(message, userId);

    const history = getConversationContext(userId, 4096, conversationId);
    const intent = classifyIntent(message);
    const agentName = (agentConfig?.name as string) || 'Geek';

    // Named agent detection
    const namedAgent = detectNamedAgent(message);
    const bodyPersonality = (req.body as Record<string, unknown>).personality as string | undefined;
    const effectivePersonality = namedAgent || bodyPersonality || (agentConfig?.personality as string) || 'jarvis';

    // Per-agent icon for activity
    const agentIconMap: Record<string, string> = {
      edith: 'zap', jarvis: 'clock', weebo: 'bot',
      aria: 'sparkles', forge: 'code', pulse: 'bar-chart',
      echo: 'heart', cal: 'calendar', nova: 'search',
    };
    const streamIcon = agentIconMap[effectivePersonality] ?? 'bot';

    if (namedAgent || bodyPersonality) {
      const overrideConfig = { ...(agentConfig || {}), personality: effectivePersonality, name: getPersonality(effectivePersonality).name };
      systemPrompt = buildSystemPrompt(overrideConfig, user, userId, undefined, undefined, userCredits);
    }

    // Auto-delegation for streaming: detect specialist + enforce tier limits
    if (!namedAgent && !bodyPersonality) {
      const userPlan = ((db.prepare('SELECT plan FROM subscriptions WHERE user_id = ?').get(userId) as { plan: string } | undefined)?.plan) || 'free';
      streamDelegation = routeDelegation(userId, userPlan, message);
      if (streamDelegation) {
        const currentAgent = (agentConfig?.personality as string) || 'weebo';
        const currentP = getPersonality(currentAgent);
        const delegatedPersonality = getPersonality(streamDelegation.agent);
        const overrideConfig = { ...(agentConfig || {}), personality: streamDelegation.agent, name: delegatedPersonality.name };
        systemPrompt = buildSystemPrompt(overrideConfig, user, userId, undefined, undefined, userCredits);
        personalityId = streamDelegation.agent;
        emitDelegation(userId, currentAgent, streamDelegation.agent, streamDelegation.reason);
        emitCommSent(userId, currentAgent, streamDelegation.agent, `Handling "${message.slice(0, 60)}…" — ${streamDelegation.reason}`);

        // Visible handoff: announce delegation to the user
        try {
          res.write(`data: ${JSON.stringify({
            text: `Handing this to ${delegatedPersonality.name} — ${streamDelegation.reason}`,
            done: false, newBubble: true,
            agentId: currentAgent, agentName: currentP.name, agentEmoji: currentP.emoji,
          })}\n\n`);
          // Next chunks will come from the delegated agent
          res.write(`data: ${JSON.stringify({
            text: '', done: false, newBubble: true,
            agentId: streamDelegation.agent, agentName: delegatedPersonality.name, agentEmoji: delegatedPersonality.emoji,
          })}\n\n`);
        } catch { /* client disconnected */ }
      }
    }

    // Push activity for office page live sync
    logActivity(String(userId), `${agentName} is thinking`, message.slice(0, 50), streamIcon);
    personalityId = streamDelegation?.agent || (agentConfig?.personality as string) || 'jarvis';
    emitThinking(String(userId), personalityId, `${agentName} is thinking...`);

    // Check for launch mode (multi-agent council) FIRST
    const { isLaunchModeRequest, runMultiAgentOrchestration } = await import('../services/multi-agent-orchestrator.js');
    if (isLaunchModeRequest(message)) {
      const write = (data: unknown) => { try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch { /* disconnected */ } };

      // Announce lead agent is assembling the team
      const leadP = getPersonality(personalityId);
      write({ text: 'Assembling specialists for this task...', done: false, newBubble: true, agentId: personalityId, agentName: leadP.name, agentEmoji: leadP.emoji });
      logActivity(String(userId), 'Agent council', 'Launch mode activated', 'sparkles');

      const orchResult = await runMultiAgentOrchestration(message, String(userId), userCredits);
      if (orchResult.success) {
        for (const ar of orchResult.agentResults) {
          const agentP = getPersonality(ar.agent);
          write({ text: ar.text, done: false, newBubble: true, agentId: ar.agent, agentName: `${agentP.name} — ${ar.role}`, agentEmoji: agentP.emoji });
          logConversation(userId, 'assistant', ar.text, 'multi-agent', 'council', undefined, ar.agent);
          logActivity(String(userId), `${agentP.name} responded`, ar.text.slice(0, 60), 'bot');
        }
        // Lead agent synthesis
        const duration = orchResult.agentResults.length;
        write({ text: `All done! ${duration} specialists collaborated on your request.`, done: false, newBubble: true, agentId: personalityId, agentName: leadP.name, agentEmoji: leadP.emoji });
      } else {
        write({ text: orchResult.text, done: false });
      }
      write({ text: '', done: true, provider: 'multi-agent', model: 'council' });
      logActivity(String(userId), 'Council complete', `${orchResult.totalAgents} agents responded`, 'sparkles');
      res.end();
      return;
    }

    // Multi-hypothesis check: inject clarification context if the message is ambiguous
    if (isAmbiguous(message)) {
      try {
        const recentText = history.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n');
        const hypResult = await generateHypotheses(String(userId), message, recentText);
        if (hypResult.shouldClarify) {
          systemPrompt += formatHypothesesForPrompt(hypResult);
        }
      } catch { /* non-fatal */ }
    }

    // For complex/coding/planning/automation intents, use ReAct loop with visible thinking steps
    if (intent === 'coding' || intent === 'planning' || intent === 'complex' || intent === 'automation') {
      const result = await runReactLoop(
        [...history, { role: 'user', content: message }],
        {
          systemPrompt, agentName, userCredits, userId,
          agentId: personalityId,
          onStep: (step) => {
            try { res.write(`data: ${JSON.stringify({ step, done: false })}\n\n`); } catch { /* client disconnected */ }
          },
        },
      );
      res.write(`data: ${JSON.stringify({ text: result.text, done: false })}\n\n`);
      const tier = (result.provider === 'ollama' || result.provider === 'builtin' || result.provider === 'openrouter-free') ? 'local' : 'premium';
      if (result.creditCost > 0) {
        db.prepare('UPDATE users SET credits = MAX(0, credits - ?) WHERE id = ?').run(result.creditCost, userId);
      }
      db.prepare(`INSERT INTO usage_events (id, user_id, provider, model, tokens_in, tokens_out, cost_usd, channel, tool)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'web', 'ai.chat.stream')`).run(
        uuid(), userId, result.provider, result.model, result.tokensIn, result.tokensOut, result.creditCost,
      );
      logConversation(userId, 'assistant', result.text, result.provider, result.model, undefined, personalityId);
      res.write(`data: ${JSON.stringify({
        text: '', done: true, provider: result.provider, model: result.model,
        tier, creditsUsed: result.creditCost, conversationId,
      })}\n\n`);
    } else {
      // Simple/automation intents — stream via Ollama if online, else cloud fallback
      const { getServiceHealth } = await import('../../../services/health-monitor.js');
      const ollamaDown = getServiceHealth().ollama?.status !== 'up';

      if (ollamaDown) {
        // Skip Ollama entirely — go straight to cloud
        emitResponding(String(userId), personalityId, 'Composing response...');
        const result = await routeChat(
          [...history, { role: 'user', content: message }],
          { systemPrompt, agentName, userCredits, userId, forceProvider: 'openrouter-free' as Provider },
        );
        res.write(`data: ${JSON.stringify({ text: result.reply, done: false })}\n\n`);
        logConversation(userId, 'assistant', result.reply, result.provider, result.model, undefined, personalityId);
        res.write(`data: ${JSON.stringify({
          text: '', done: true, provider: result.provider, model: result.model,
          tier: 'local', creditsUsed: result.creditCost,
        })}\n\n`);
      } else {
      // Ollama is up — stream directly
      const fullMessages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: message },
      ];

      const start = Date.now();
      let fullReply = '';
      let emittedResponding = false;

      // Race: stream Ollama with 15s first-chunk timeout, fallback to cloud
      let gotFirstChunk = false;
      const firstChunkTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => { if (!gotFirstChunk) reject(new Error('ollama_first_chunk_timeout')); }, 15000)
      );

      try {
        const streamPromise = streamOllama(fullMessages, (chunk) => {
          gotFirstChunk = true;
          if (!emittedResponding) {
            emitResponding(String(userId), personalityId, 'Writing response...');
            emittedResponding = true;
          }
          fullReply += chunk;
          res.write(`data: ${JSON.stringify({ text: chunk, done: false })}\n\n`);
        }, intent);

        const { tokensIn, tokensOut } = await Promise.race([streamPromise, firstChunkTimeout]) as { tokensIn: number; tokensOut: number };

        const latencyMs = Date.now() - start;

        // If streaming produced empty content, fall back to non-streaming call
        if (!fullReply.trim()) {
          logger.warn({ userId, latencyMs }, 'Stream produced empty reply, falling back to routeChat');
          emitResponding(String(userId), personalityId, 'Composing response...');
          const result = await routeChat(
            [...history, { role: 'user', content: message }],
            { systemPrompt, agentName, userCredits, userId },
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
          logConversation(userId, 'assistant', fullReply, 'ollama', config.ollamaModel, undefined, personalityId);

          // Send final event
          res.write(`data: ${JSON.stringify({
            text: '', done: true, provider: 'ollama', model: config.ollamaModel,
            latencyMs, tier: 'local', creditsUsed: 0,
          })}\n\n`);
        }
      } catch (streamErr) {
        if ((streamErr as Error).message === 'ollama_first_chunk_timeout' || !gotFirstChunk) {
          // Ollama too slow — fallback to cloud
          emitResponding(String(userId), personalityId, 'Switching to cloud...');
          const result = await routeChat(
            [...history, { role: 'user', content: message }],
            { systemPrompt, agentName, userCredits, userId, forceProvider: 'openrouter-free' as Provider },
          );
          fullReply = result.reply;
          res.write(`data: ${JSON.stringify({ text: result.reply, done: false })}\n\n`);
          logConversation(userId, 'assistant', result.reply, result.provider, result.model, undefined, personalityId);
          res.write(`data: ${JSON.stringify({ text: '', done: true, provider: result.provider, model: result.model, tier: 'local', creditsUsed: result.creditCost })}\n\n`);
          res.end();
          return;
        }
        throw streamErr; // re-throw non-timeout errors
      }
      } // end: Ollama is up
    }
  } catch (err) {
    logger.error({ err, userId }, 'Stream chat error');
    // Fallback to cloud (skip Ollama — it just failed)
    try {
      const agentConfig = db.prepare('SELECT * FROM agent_configs WHERE user_id = ?').get(userId) as Record<string, unknown> | undefined;
      const user = db.prepare('SELECT name, credits FROM users WHERE id = ?').get(userId) as Record<string, unknown> | undefined;
      const fallbackHistory = getConversationContext(userId, 4096, conversationId);
      const fallbackPersonality = (agentConfig?.personality as string) || personalityId;
      emitResponding(String(userId), fallbackPersonality, 'Composing response...');
      const result = await routeChat(
        [...fallbackHistory, { role: 'user', content: message }],
        { systemPrompt: buildSystemPrompt(agentConfig, user, userId, undefined, undefined, (user?.credits as number) || 0), agentName: (agentConfig?.name as string) || 'Geek', userCredits: (user?.credits as number) || 0, userId, forceProvider: 'openrouter-free' as Provider },
      );
      res.write(`data: ${JSON.stringify({ text: result.reply, done: false })}\n\n`);
      res.write(`data: ${JSON.stringify({ text: '', done: true, provider: result.provider, model: result.model })}\n\n`);
    } catch (fallbackErr) {
      logger.error({ fallbackErr, userId }, 'Stream fallback also failed');
      res.write(`data: ${JSON.stringify({ text: 'Sorry, I had trouble processing that. Please try again.', done: false })}\n\n`);
      res.write(`data: ${JSON.stringify({ text: '', done: true, error: 'Stream failed' })}\n\n`);
    }
  }

  // Emit delegation completion event if streaming used a delegated agent
  if (streamDelegation) {
    const coreAgent = (agentConfig?.personality as string) || 'weebo';
    emitCommReceived(userId, streamDelegation.agent, coreAgent, 'Task complete');
  }

  emitDone(String(userId), personalityId);
  res.end();
});

// ---- Public can-chat check (no auth required) ----

router.get('/can-chat-public/:username', (_req, res) => {
  const { username } = _req.params;
  const target = db.prepare('SELECT agent_chat_enabled FROM users WHERE username = ?').get(username) as { agent_chat_enabled: number } | undefined;
  if (!target) { res.json({ canChat: false }); return; }
  res.json({ canChat: !!target.agent_chat_enabled });
});

// ---- Public Portfolio Chat (real LLM-powered) ----

router.post('/chat/public/:username', optionalAuth, validateBody(chatSchema), async (req: AuthRequest, res) => {
  // Override the global 30s timeout for visitor chat — allow up to 120s
  res.setTimeout(120000);
  const { message, messageCount, history } = req.body as { message: string; messageCount?: number; history?: Array<{ role: string; content: string }> };
  const { username } = req.params;

  // IP rate limit: 10 messages/hour per IP — no credits deducted for visitor chats
  const visitorIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  const visitorRlKey = `visitor:chat:rl:${visitorIp}`;
  try {
    const rlRaw = await cacheGet(visitorRlKey);
    const rlCount = rlRaw ? parseInt(rlRaw, 10) : 0;
    if (rlCount >= 10) {
      res.status(429).json({ error: 'Rate limit exceeded. Please try again in an hour.', retryAfter: 3600 });
      return;
    }
    await cacheSet(visitorRlKey, String(rlCount + 1), 3600);
  } catch { /* Redis unavailable — allow through */ }

  const user = db.prepare('SELECT id, name, location, role, company, agent_chat_enabled FROM users WHERE username = ?').get(username) as Record<string, unknown> | undefined;
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  if (!user.agent_chat_enabled) { res.status(403).json({ error: 'Agent chat is not enabled for this user' }); return; }

  // Resolve visitor identity from optional JWT
  let visitorName: string | undefined;
  if (req.userId) {
    const visitor = db.prepare('SELECT name, username FROM users WHERE id = ?')
      .get(req.userId) as { name: string; username: string } | undefined;
    visitorName = visitor?.name || visitor?.username;
  }

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

  // ---- Check for Telegram escalation (for hasTelegramEscalation flag) ----
  const telegramLink = db.prepare(`
    SELECT external_id FROM channel_links
    WHERE user_id = ? AND channel = 'telegram'
    ORDER BY linked_at DESC LIMIT 1
  `).get(user.id as string) as { external_id: string } | undefined;

  const hasTelegramEscalation = !!telegramLink;

  // ---- Visitor intent detection (first message only, non-fatal) ----
  let visitorIntent = 'curious';
  if (!messageCount || messageCount === 0) {
    try {
      const picoAvail = await isPicoClawAvailable();
      if (picoAvail) {
        const classifyResult = await Promise.race([
          queryPicoClaw(
            `Classify this visitor message into exactly one category: "recruiter", "collaborator", or "curious". Only respond with one of those three words.\n\nMessage: "${message}"`,
          ),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('classify timeout')), 4000)),
        ]);
        const classified = classifyResult.text.trim().toLowerCase();
        if (classified === 'recruiter' || classified === 'collaborator' || classified === 'curious') {
          visitorIntent = classified;
        }
      }
    } catch {
      // Non-fatal — default to "curious"
    }
  }

  // Load owner memories with schedule separation
  const ownerContext = buildOwnerContextForVisitor(user.id as string, message);

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
    ownerMemories: ownerContext.general || undefined,
    ownerScheduleMemories: ownerContext.schedule || undefined,
    visitorName,
    hasTelegramEscalation,
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

  // ---- Build multi-turn message array ----
  const chatMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  if (history?.length) {
    for (const h of history.slice(-10)) {
      chatMessages.push({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content });
    }
  }
  chatMessages.push({ role: 'user', content: message });

  // ---- LLM call: Groq first (fast ~1-2s), fall back to openrouter-free ----
  let result: Awaited<ReturnType<typeof routeChat>> | null = null;
  try {
    result = await routeChat(
      chatMessages,
      { systemPrompt, agentName, forceProvider: 'groq' },
    );
  } catch (groqErr) {
    logger.warn({ err: (groqErr as Error).message }, 'visitor-chat: Groq failed, falling back to openrouter-free');
    try {
      result = await routeChat(
        chatMessages,
        { systemPrompt, agentName, forceProvider: 'openrouter-free' },
      );
    } catch (orErr) {
      logger.warn({ err: (orErr as Error).message }, 'visitor-chat: openrouter-free also failed');
    }
  }

  if (!result) {
    res.json({
      reply: `Hi! I'm ${agentName}, ${ownerName}'s assistant. I'm having trouble connecting right now, but you can learn more from the portfolio above.`,
      agentName,
      ownerName,
      personality: personalityId,
      personalityEmoji: personality.emoji,
    });
    return;
  }

  try {
    // Parse for escalation actions
    let finalReply = result.reply;
    const { text: cleanReply, actions } = parseActions(result.reply);
    if (actions.length > 0) {
      finalReply = cleanReply;
      for (const action of actions) {
        if (action.tool === 'escalate_to_owner') {
          action.params._ownerUserId = user.id as string;
          action.params._ownerUsername = username;
          action.params._visitorName = visitorName || 'A visitor';
          await executeAction(user.id as string, action);
        }
      }
    }

    // Fallback escalation: if LLM says it'll check/ask the owner but didn't emit an action block
    const escalationPhrases = /\b(let me check with|i'll ask|i'll check with|let me reach out to|i'll reach out to|check with .+ directly|ask .+ directly)\b/i;
    if (hasTelegramEscalation && actions.length === 0 && escalationPhrases.test(finalReply)) {
      const fallbackAction: ParsedAction = {
        tool: 'escalate_to_owner',
        params: {
          question: message,
          context: `Visitor conversation — agent indicated it would check with owner`,
          _ownerUserId: user.id as string,
          _ownerUsername: username,
          _visitorName: visitorName || 'A visitor',
        },
      };
      try {
        await executeAction(user.id as string, fallbackAction);
      } catch (escErr) {
        logger.warn({ err: (escErr as Error).message }, 'Fallback escalation failed');
      }
    }

    // Save visitor interaction to owner's memory
    const snippet = message.slice(0, 80);
    const memoryValue = visitorName
      ? `${visitorName} asked about: "${snippet}"`
      : `Anonymous visitor asked about: "${snippet}"`;
    upsertMemory(user.id as string, 'visitor', `portfolio-chat:${Date.now()}`, memoryValue, 0.8, 'portfolio-chat');

    // Increment connection counter
    db.prepare(`
      UPDATE portfolios SET
        connection_count = connection_count + 1,
        last_connected_at = datetime('now')
      WHERE user_id = ?
    `).run(user.id as string);

    // Invalidate portfolio cache
    void cacheDel(`portfolio:${req.params.username}`);

    // Send Telegram notification if connected (non-blocking, non-fatal, only on first message)
    if (telegramLink && (!messageCount || messageCount === 0)) {
      const who = visitorName ? `<b>${escapeTelegramHtml(visitorName)}</b> from Agentin` : 'Someone';
      void sendTelegramNotification(telegramLink.external_id,
        `${who} started chatting with your agent:\n<i>"${escapeTelegramHtml(snippet)}"</i>\n\nCheck your dashboard for the conversation.`
      ).catch(() => { /* non-fatal */ });
    }

    res.json({ reply: finalReply, agentName, ownerName, personality: personalityId, personalityEmoji: personality.emoji });
  } catch {
    res.json({
      reply: `Hi! I'm ${agentName}, ${ownerName}'s assistant. I'm having trouble connecting right now, but you can learn more from the portfolio above.`,
      agentName,
      ownerName,
      personality: personalityId,
      personalityEmoji: personality.emoji,
    });
  }
});

export default router;
