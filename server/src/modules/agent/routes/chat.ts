// Extracted from agent.ts — Sprint 3 decomposition
import { Router, type NextFunction } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth, type AuthRequest } from '../../../middleware/auth.js';
import { validateBody, chatSchema, commandSchema } from '../../../middleware/validate.js';
import { aiSecurityMiddleware } from '../../../middleware/ai-security.js';
import { db } from '../../../db/index.js';
import { routeChat, classifyIntent, computeCreditCost, deductSubscriptionCredits, pickProvider, type ChatMessage, type Provider } from '../services/llm.js';
import { edithChat } from '../../../services/edith.js';
import { logger } from '../../../logger.js';
import { config } from '../../../config.js';
import { OPENCLAW_IDENTITY } from '../../../prompts/openclaw-system.js';
import { getPersonalityPrompt, getPersonality } from '../../../prompts/personalities.js';
import { checkKeywordTriggers } from '../../../services/automations-engine.js';
import { logConversation, logTrainingExample, extractMemories, extractMemoriesWithAI, getConversationContext, extractMemoriesFromConversation } from '../../../services/memory.js';
import { buildCognitiveContext } from '../../memory/services/cognitive-memory.js';
import { touchSession } from '../../memory/services/session-summary.js';
import { filterToolsBlock } from '../services/agent-tools-map.js';
import { DateTime } from 'luxon';
import { loadPicoContext, formatContextBlock } from '../../../services/pico-context.js';
import { getFestivalContext } from '../../../services/festival-calendar.js';
import { checkContent } from '../../../services/content-filter.js';
import { bridgeChat, type BridgeRequest } from '../../../services/pico-kimi-bridge.js';
import { getAgentRoles, type AgentRole } from '../services/agent-registry.js';
import { parseActions } from '../../../services/action-parser.js';
import { executeAction, type ActionResult } from '../services/action-executor.js';
import { runReactLoop } from '../services/react-loop.js';
import { runDeepReasoning } from '../services/deep-reasoning.js';
import { classifyMessageComplexity } from '../services/unified-agent-router.js';
import { formatReceiptCompact, type ReceiptItem } from '../../../services/receipts.js';
import { cacheGet, cacheSet } from '../../../services/cache.js';
import { fetchAndExtract } from '../../../services/web-research.js';
import { buildPersonalityInstructions } from '../services/message-router.js';
import { logActivity } from '../../../services/activity-log.js';
import { emitThinking, emitDone } from '../services/agent-state-bus.js';
import { routeDelegation, canDelegate, decrementDelegation } from '../../../services/delegation.js';
import { emitDelegation, emitCommSent, emitCommReceived } from '../../../services/activity-stream.js';
import { getOrCreateConversation, updateConversationMeta, autoTitleConversation } from '../services/conversation-threads.js';
import { processUploadedFile, buildFileContext } from '../services/file-processor.js';
import { withAgentinError } from '../../../middleware/error-handler.js';
import { ValidationError, PaymentRequiredError, NotFoundError } from '../../../errors/index.js';
import { isAmbiguous, generateHypotheses, formatHypothesesForPrompt } from '../services/hypothesis-service.js';

const router = Router();

// ---- Rate Limit Status tracker (GeekOS upgrade) ----
// Redis-backed — survives Docker restarts
const RL_WINDOW_S = 15 * 60;
const RL_LIMIT = 60;

/**
 * Increments the Redis-backed request counter for a user within the 15-minute rate-limit window.
 * Silently degrades to unlimited if Redis is unavailable.
 * @param userId - Numeric user ID (used as part of the cache key `chat:rl:<userId>`).
 */
async function incrementRateLimitTracker(userId: number): Promise<void> {
  const key = `chat:rl:${userId}`;
  try {
    const raw = await cacheGet(key);
    const count = raw ? parseInt(raw, 10) + 1 : 1;
    await cacheSet(key, String(count), RL_WINDOW_S);
  } catch { /* Redis fail = degrade to unlimited */ }
}

/**
 * Returns the current rate-limit status for a user.
 * Falls back to full quota (60 remaining) if Redis is unavailable.
 * @param userId - Numeric user ID.
 * @returns Object with `remaining` requests left, `limit` (60), and `windowMinutes` (15).
 */
async function _getRateLimitStatus(userId: number): Promise<{ remaining: number; limit: number; windowMinutes: number }> {
  const key = `chat:rl:${userId}`;
  try {
    const raw = await cacheGet(key);
    const count = raw ? parseInt(raw, 10) : 0;
    return { remaining: Math.max(0, RL_LIMIT - count), limit: RL_LIMIT, windowMinutes: 15 };
  } catch {
    return { remaining: RL_LIMIT, limit: RL_LIMIT, windowMinutes: 15 };
  }
}

// ---- Helper: Detect task intent in natural chat ----
// Returns true if the message looks like a task request (remind, telegram, deploy)
function detectAndHandleTaskIntent(message: string): boolean {
  const lower = message.toLowerCase().trim();
  // Must be an imperative/request — skip questions and short greetings
  if (lower.endsWith('?') || lower.split(' ').length < 3) return false;
  // Strong intent signals
  const patterns = [
    /\bremind\s+me\b/i,
    /\bset\s+(?:a\s+)?reminder\b/i,
    /\bsend\s+(?:a\s+)?(?:telegram|tg)\s+(?:message|notification|alert)\b/i,
    /\bsend\s+(?:a\s+)?message\s+(?:on|via|through)\s+telegram\b/i,
    /\bnotify\s+(?:me\s+)?(?:on|via)\s+telegram\b/i,
    /\bdeploy\s+(?:my\s+)?portfolio\b/i,
    /\bpublish\s+(?:my\s+)?portfolio\b/i,
    /\bmake\s+(?:my\s+)?portfolio\s+(?:public|live)\b/i,
  ];
  return patterns.some(p => p.test(lower));
}

// ---- Helper: Build system prompt with user context ----

export function buildSystemPrompt(
  agentConfig: Record<string, unknown> | undefined,
  user: Record<string, unknown> | undefined,
  userId: string,
  userMessage?: string,
  channel?: string,
  credits?: number,
): string {
  const personalityId = (agentConfig?.personality as string) || 'jarvis';
  const personality = getPersonality(personalityId);
  const personalityPrompt = getPersonalityPrompt(personalityId);
  const agentName = (agentConfig?.name as string) || personality.name;
  const voice = (agentConfig?.voice as string) || 'friendly';
  const mode = (agentConfig?.mode as string) || 'builder';
  const customPrompt = (agentConfig?.system_prompt as string) || '';
  const userName = (user?.name as string) || 'there';

  // Load full PicoContext
  const picoCtx = loadPicoContext(userId);

  // For the website builder channel, use a code-generation-focused closing instruction
  // instead of the brevity instruction — otherwise the LLM skips generate_code actions
  const closingInstruction = channel === 'builder'
    ? `IMPORTANT: When asked to build or create a website, you MUST emit a generate_code action block with COMPLETE working HTML/CSS/JS code. Do not give short text responses for build requests — always use the action block. Write complete, self-contained code with no placeholders.`
    : `IMPORTANT: Keep responses SHORT. 1-3 sentences for simple questions. No markdown formatting (no **, no ##, no bullet lists). Plain conversational text only.`;

  const toolsBlock = `--- AVAILABLE TOOLS ---
Use <<<ACTION>>> blocks to invoke tools when needed:
<<<ACTION>>>
tool: web_search
query: your search query
<<<END>>>
Use web_search for general questions, news, or topics. For site-specific queries include the site name (e.g. "BBC news iran israel").
<<<ACTION>>>
tool: crawl_url
url: https://example.com
<<<END>>>
Use crawl_url to read the full content of any website URL.
<<<ACTION>>>
tool: take_screenshot
url: https://example.com
<<<END>>>
Use take_screenshot to capture a visual screenshot of any webpage and show it to the user.
<<<ACTION>>>
tool: get_links
url: https://example.com
filter: all
<<<END>>>
Use get_links to extract all links from a page. filter: "internal", "external", or "all".
<<<ACTION>>>
tool: send_telegram
message: your message text
<<<END>>>
<<<ACTION>>>
tool: delete_reminder
deleteAll: true
<<<END>>>
Use delete_reminder with deleteAll:true to wipe all pending reminders, or reminderId:"<id>" to delete one specific reminder.
<<<ACTION>>>
tool: search_memory
query: what did I say about my project last week
<<<END>>>
Use search_memory when the user asks "what did I say about X", "find my note about Y", "do you remember when I mentioned Z", or any question about past conversations or saved memories.
<<<ACTION>>>
tool: portfolio_update_skills
skills: ["Skill 1", "Skill 2", "Skill 3"]
<<<END>>>
Use portfolio_update_skills when the user says "update my skills", "add skills to my portfolio", "my skills are X, Y, Z", or similar. Pass skills as a JSON array of strings.
<<<ACTION>>>
tool: create_goal
title: Launch my SaaS by April
description: Build and launch the MVP
category: technical
target_date: 2026-04-30
<<<END>>>
Use create_goal when user says "I want to...", "my goal is...", "help me achieve...". Planning is triggered automatically after creation. Use plan_goal only to re-plan an existing goal.
<<<ACTION>>>
tool: list_goals
status: active
<<<END>>>
Use list_goals to show user's goals with IDs for follow-up actions.
<<<ACTION>>>
tool: goal_status
goal_id: <id>
<<<END>>>
Use goal_status to fetch a single goal with its steps, progress, and current status.
<<<ACTION>>>
tool: plan_goal
goal_id: <id>
<<<END>>>
Use plan_goal only to re-plan an existing goal when automatic planning failed or needs revision.
<<<ACTION>>>
tool: execute_goal_step
goal_id: <id>
<<<END>>>
Use execute_goal_step to autonomously work on the next step of a goal.
<<<ACTION>>>
tool: save_artifact
title: Sprint plan
content: ...
type: plan
<<<END>>>
Use save_artifact to persist notes, research, drafts, code, or plans to the shared workspace.`;

  // Build personality instructions from slider values (uses shared function from message-router)
  const personalityInstructions = buildPersonalityInstructions(agentConfig as { creativity?: number; formality?: number; verbosity?: number; humor?: number; empathy?: number } | undefined);

  // Indian festival / cultural context (injected when relevant)
  const festivalCtx = getFestivalContext();
  const festivalBlock = festivalCtx ? `\n--- CULTURAL CONTEXT ---\n${festivalCtx}` : '';

  return `LANGUAGE RULE: Detect the language the user writes in. ALWAYS reply in that exact language — no exceptions. Hindi → Hindi. Telugu → Telugu. Tamil → Tamil. English → English. Never switch languages unless the user does first.

YOUR IDENTITY: Your name is ${agentName}. If asked who you are or what your name is, say your name is ${agentName}.

${OPENCLAW_IDENTITY}

--- PERSONALITY ---
${personalityPrompt}
${personalityInstructions ? `\n--- PERSONALITY TUNING ---\n${personalityInstructions}` : ''}

${formatContextBlock(picoCtx)}

--- USER SESSION ---
User: ${userName}. Voice: ${voice}. Mode: ${mode}. Credits: ${credits ?? 0}.
${customPrompt ? `Custom instructions: ${customPrompt}` : ''}
${buildCognitiveContext(userId, userMessage || '')}
${festivalBlock}

--- CURRENT DATE & TIME ---
${(() => {
  const tzRow = db.prepare('SELECT timezone FROM users WHERE id = ?').get(userId) as { timezone?: string } | undefined;
  const tz = tzRow?.timezone || 'Asia/Kolkata';
  return `Right now it is: ${DateTime.now().setZone(tz).toFormat("cccc, LLLL d, yyyy 'at' h:mm a z")}. Use this exact time when the user asks what time or date it is. Do NOT guess or infer from other context.`;
})()}

${filterToolsBlock(toolsBlock, personalityId)}

${closingInstruction}`;
}

// ---- AI Content Generation (for onboarding magic) ----

router.post('/generate-content', requireAuth, withAgentinError(async (req: AuthRequest, res) => {
  const { type, tags, name } = req.body as { type: string; tags: string[]; name?: string };
  if (!type || !tags || tags.length === 0) {
    throw new ValidationError('type and at least 1 tag required');
  }

    const prompts: Record<string, string> = {
      headline: `Generate a short professional headline (under 12 words) for someone named "${name || 'a developer'}" who specializes in: ${tags.join(', ')}. Return ONLY the headline text, no quotes, no explanation.`,
      bio: `Write a 2-sentence professional bio for someone named "${name || 'a developer'}" who specializes in: ${tags.join(', ')}. Make it engaging and personal. Return ONLY the bio text, no quotes.`,
      about: `Write a brief 3-sentence "about me" for a developer portfolio. Person: "${name || 'a developer'}". Expertise: ${tags.join(', ')}. Make it compelling for potential collaborators. Return ONLY the text, no quotes.`,
      skills: `Suggest 6 technical skills (comma-separated) for someone who specializes in: ${tags.join(', ')}. Return ONLY the comma-separated list, nothing else.`,
      'bio-batch': `You are helping a developer set up their Agentin AI profile.
Return ONLY valid JSON, no markdown, no extra text:
{"headline": "one-line professional headline under 80 chars", "bio": "2-3 sentence professional summary"}

Name: ${name || 'a developer'}
Skills/interests: ${Array.isArray(tags) ? tags.join(', ') : tags || 'software development'}`,
      'portfolio-batch': `You are helping a developer complete their portfolio.
Return ONLY valid JSON, no markdown, no extra text:
{"headline": "one-line professional headline under 80 chars", "about": "2-3 sentence about section", "skills": ["skill1","skill2","skill3","skill4","skill5"]}

Name: ${name || 'a developer'}
Skills/interests: ${Array.isArray(tags) ? tags.join(', ') : tags || 'software development'}`,
    };

  const systemPrompt = prompts[type];
  if (!systemPrompt) {
    throw new ValidationError('type must be headline, bio, about, skills, bio-batch, or portfolio-batch');
  }

  // Check subscription credits
  const sub = db.prepare('SELECT credits_remaining, billing_cycle_end FROM subscriptions WHERE user_id = ?').get(req.userId!) as { credits_remaining: number; billing_cycle_end: string } | undefined;
  if (sub && sub.credits_remaining <= 0) {
    throw new PaymentRequiredError(`You've used all your credits for this month. They reset on ${sub.billing_cycle_end.split('T')[0]}. Upgrade your plan for more.`);
  }

  const result = await routeChat(
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: 'Generate it now.' }],
    { forceProvider: 'edith' as Provider, userId: req.userId! }
  );

  // Deduct actual credit cost
  deductSubscriptionCredits(req.userId!, result.creditCost);

  // Batch types return structured JSON
  if (type.endsWith('-batch')) {
    try {
      const jsonText = result.reply.trim().replace(/^```(?:json)?\n?|\n?```$/g, '');
      const parsed = JSON.parse(jsonText);
      res.json({ content: result.reply, parsed });
      return;
    } catch {
      res.status(500).json({ error: 'AI returned invalid JSON. Please try again.' });
      return;
    }
  }

  res.json({ content: result.reply.trim().replace(/^["']|["']$/g, '') });
}));

// ---- AI-Generated Background Gradient ----

router.post('/generate-background', requireAuth, async (req: AuthRequest, res) => {
  const { vibe } = req.body as { vibe?: string };

  const prompt = `Generate a beautiful CSS gradient for a dark tech dashboard.
${vibe ? `Vibe: ${vibe}` : 'Make it feel like a dark, futuristic workspace — deep purples, dark blues, subtle teals.'}

Return ONLY valid JSON in this exact format:
{
  "gradient": "linear-gradient(135deg, #1a0533 0%, #0d1b4b 50%, #003d2b 100%)",
  "name": "Neon Jungle",
  "accent": "#7B61FF"
}

Rules:
- gradient must be a valid CSS gradient string
- All colors must be dark (no white or light backgrounds)
- name must be 2-3 words, evocative
- accent must be a single hex color that works as UI accent`;

  try {
    const edithResult = await edithChat(prompt);
    const raw = edithResult.text.trim().replace(/^```(?:json)?\n?|\n?```$/g, '');
    const parsed = JSON.parse(raw) as { gradient?: string; name?: string; accent?: string };
    if (!parsed.gradient || !parsed.name || !parsed.accent) throw new Error('Invalid response');
    const creditCost = computeCreditCost('edith', edithResult.tokensIn, edithResult.tokensOut);
    deductSubscriptionCredits(req.userId!, creditCost);
    res.json(parsed);
  } catch {
    // Fallback gradient if Kimi fails
    res.json({
      gradient: 'linear-gradient(135deg, #1a0533 0%, #0a0a1a 40%, #001a33 100%)',
      name: 'Deep Space',
      accent: '#7B61FF',
    });
  }
});

// ---- Two-Tier Agent Chat ----
//
// Tier 1 (free):    Ollama local — handles all queries by default
// Tier 2 (premium): Moonshot cloud — explicit /premium or /edith prefix, costs credits
//
// Auto-fallback: if Ollama is down, routes to cloud only when user has credits

router.post('/chat', requireAuth, aiSecurityMiddleware, validateBody(chatSchema), async (req: AuthRequest, res) => {
  // Override the global 30s timeout for AI chat — allow up to 120s
  res.setTimeout(120000);
  let { message } = req.body as { message: string; channel?: string; context?: string };
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  // Track session activity for idle-based summarization
  touchSession(userId);
  const reqChannel = (req.body as { channel?: string }).channel;
  // Conversation threading: get or create a conversation thread
  const reqConversationId = (req.body as { conversationId?: string }).conversationId;
  const conversationId = getOrCreateConversation(userId, reqConversationId, reqChannel || 'web');
  // Optional: builder sends this when editing an existing project so generate_code updates it
  const reqExistingArtifactId = (req.body as { existingArtifactId?: string }).existingArtifactId;
  // Guest/visitor tokens have sub = 'guest:UUID' — route to portfolio chat logic
  const isGuestUser = userId.startsWith('guest:');
  if (isGuestUser) {
    const portfolioUsername = req.portfolioUsername ||
      (req.body as { portfolioUsername?: string }).portfolioUsername;
    if (!portfolioUsername) {
      res.status(403).json({ error: 'Please use the portfolio chat endpoint for visitor access.' });
      return;
    }
    // Look up portfolio owner and serve a basic response via Groq
    try {
      const ownerRow = db.prepare('SELECT id, name, role, company FROM users WHERE username = ?').get(portfolioUsername) as Record<string, unknown> | undefined;
      if (!ownerRow) { res.status(404).json({ error: 'Portfolio not found' }); return; }
      const portfolioRow = db.prepare('SELECT about, skills, projects FROM portfolios WHERE user_id = ?').get(ownerRow.id as string) as Record<string, unknown> | undefined;
      const agentCfg = db.prepare('SELECT * FROM agent_configs WHERE user_id = ?').get(ownerRow.id as string) as Record<string, unknown> | undefined;
      const skills: string[] = JSON.parse((portfolioRow?.skills as string) || '[]');
      const ownerName = (ownerRow.name as string) || portfolioUsername;
      const agentName = ((agentCfg?.name as string) || 'Jarvis');
      const sysPrompt = `You are ${agentName}, the AI assistant for ${ownerName}'s portfolio. ${ownerName} is a ${ownerRow.role || 'professional'}${ownerRow.company ? ` at ${ownerRow.company}` : ''}. Skills: ${skills.slice(0, 10).join(', ')}. About: ${(portfolioRow?.about as string || '').slice(0, 300)}. Answer visitor questions about ${ownerName} concisely and professionally.`;
      const { routeChat } = await import('../services/llm.js');
      const guestMessage = (req.body as { message: string }).message || '';
      const result = await routeChat([{ role: 'user', content: guestMessage }], { systemPrompt: sysPrompt, forceProvider: 'groq' });
      res.json({ reply: result.reply, agentName, ownerName });
    } catch (_guestErr) {
      res.json({ reply: `Hi! I'm the AI assistant for ${portfolioUsername}'s portfolio. How can I help you?`, agentName: 'Jarvis', ownerName: portfolioUsername });
    }
    return;
  }

  try {
    const agentConfig = db.prepare('SELECT * FROM agent_configs WHERE user_id = ?').get(userId) as Record<string, unknown> | undefined;
    const user = db.prepare('SELECT name, credits FROM users WHERE id = ?').get(userId) as Record<string, unknown> | undefined;
    const userCredits = (user?.credits as number) || 0;
    let systemPrompt = buildSystemPrompt(agentConfig, user, userId, message, reqChannel, userCredits);

    // Process file attachments if present (multipart/form-data)
    const files = (req as unknown as { files?: Express.Multer.File[] }).files;
    if (files && files.length > 0) {
      try {
        const processed = await Promise.all(files.map(f => processUploadedFile(f)));
        const fileContext = buildFileContext(processed);
        if (fileContext) systemPrompt += fileContext;
      } catch (err) {
        logger.warn({ err }, 'File processing failed (non-fatal)');
      }
    }

    // Check subscription credits
    const sub = db.prepare('SELECT plan, credits_remaining, billing_cycle_end FROM subscriptions WHERE user_id = ?').get(userId) as { plan: string; credits_remaining: number; billing_cycle_end: string } | undefined;
    const userPlan = sub?.plan || 'free';
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

    // 82.6: Content filter — tag flagged messages (non-blocking, never stops the request)
    checkContent(message, userId);

    // Log user message + extract memories (non-blocking)
    logConversation(userId, 'user', message, undefined, undefined, undefined, undefined, conversationId);
    autoTitleConversation(conversationId, message);
    updateConversationMeta(conversationId, message.slice(0, 200));
    extractMemories(userId, message);

    // ---- Terminal Jarvis: route ai "prompt" through Jarvis on OpenRouter free ----
    if (reqChannel === 'terminal') {
      const terminalSystemPrompt = `${OPENCLAW_IDENTITY}

${getPersonalityPrompt('jarvis')}

You are assisting via the Agentin terminal. Be concise. No markdown headers. Plain text or simple code blocks only.`;

      const terminalMessages: ChatMessage[] = [
        { role: 'system', content: terminalSystemPrompt },
        { role: 'user', content: message },
      ];

      const terminalResult = await routeChat(terminalMessages, { forceProvider: 'openrouter-free' as Provider, userId });
      deductSubscriptionCredits(userId, terminalResult.creditCost);
      db.prepare(`INSERT INTO usage_events (id, user_id, provider, model, tokens_in, tokens_out, cost_usd, channel, tool)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'terminal', 'ai.chat')`).run(
        uuid(), userId, terminalResult.provider, terminalResult.model,
        terminalResult.tokensIn, terminalResult.tokensOut, terminalResult.creditCost,
      );
      logConversation(userId, 'assistant', terminalResult.reply, terminalResult.provider, terminalResult.model);
      res.json({ text: terminalResult.reply, provider: 'jarvis-terminal', creditCost: terminalResult.creditCost, latencyMs: terminalResult.latencyMs });
      return;
    }

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
        const { tasks, creditCost } = await planTasksFn(userId, taskDesc, userPlan);
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

    // ---- Auto-detect task intent: automatically create Pico tasks without /task prefix ----
    if (!forceRoute) {
      const taskIntentResult = detectAndHandleTaskIntent(message);
      if (taskIntentResult) {
        try {
          const { planTasks: planTasksFn, queueTasks: queueTasksFn } = await import('../services/pico-fleet.js');
          const { tasks } = await planTasksFn(userId, message, userPlan);

          if (tasks.length > 0) {
            const taskIds = queueTasksFn(userId, tasks, 'weebo');
            const updatedSub = db.prepare('SELECT credits_remaining FROM subscriptions WHERE user_id = ?').get(userId) as { credits_remaining: number } | undefined;
            const summary = tasks.map(t => `**${t.task_type.replace(/_/g, ' ')}**: ${t.description}`).join('\n');

            logConversation(userId, 'assistant', `Done! I've queued ${taskIds.length} task(s) for Weebo:\n${summary}`);

            res.json({
              text: `Done! I've queued ${taskIds.length} task(s) for Weebo:\n${summary}`,
              route: 'pico-fleet',
              tier: 'local',
              provider: 'builtin',
              latencyMs: 0,
              creditsUsed: 0,
              creditsRemaining: updatedSub?.credits_remaining ?? 0,
            });
            return;
          }
        } catch {
          // Fall through to normal chat if task planning fails
        }
      }
    }

    // ---- Website builder fast-path: bypass LLM for build/edit requests ----
    if (!forceRoute) {
      const createWebsitePattern = /\b(?:build|create|make|generate)\b.{0,80}\b(?:website|site|portfolio|landing|blog|page)\b/i;
      const editWebsitePattern = /\b(?:change|update|edit|modify|redesign|redo|refresh|revamp|adjust|tweak|rebuild)\b.{0,80}\b(?:website|site|portfolio|landing|blog|page|theme|background|color)\b/i;
      if (createWebsitePattern.test(message) || editWebsitePattern.test(message)) {
        const { executeAction } = await import('../services/action-executor.js');
        const msgLower = message.toLowerCase();
        const nameMatch = message.match(/\b(?:for|name is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/) ?? message.match(/\bmy name is\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\b/i);
        const themeMatch = msgLower.match(/\b(dark|light|purple|blue|gradient)\b/);
        const templateMatch = msgLower.match(/\b(landing|blog|business)\b/);
        const locationMatch = message.match(/\bfrom\s+([A-Z][a-zA-Z\s]{2,20})\b/);
        const professionMatch = message.match(/\b(developer|designer|engineer|writer|photographer|artist|consultant|manager|teacher|doctor|lawyer|freelancer)\b/i);
        const isEdit = editWebsitePattern.test(message) && !createWebsitePattern.test(message);
        const baseUrl = `${req.protocol}://${req.get('host')}`;

        // For edits, look up the target artifact and check whether it was built with the
        // template system (has a 'template' key in metadata) or with the LLM custom path.
        // This determines whether to merge template params or to pass the existing HTML to the LLM.
        let editTargetId: string | undefined = reqExistingArtifactId;
        let editTargetIsTemplate = false;
        if (isEdit) {
          if (!editTargetId) {
            const latest = db.prepare(
              'SELECT id, metadata FROM generated_artifacts WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
            ).get(userId) as { id: string; metadata: string } | undefined;
            if (latest) {
              editTargetId = latest.id;
              try { editTargetIsTemplate = !!JSON.parse(latest.metadata || '{}').template; } catch { /* ignore */ }
            }
          } else {
            const existing = db.prepare(
              'SELECT metadata FROM generated_artifacts WHERE id = ? AND user_id = ?'
            ).get(editTargetId, userId) as { metadata: string } | undefined;
            if (existing?.metadata) {
              try { editTargetIsTemplate = !!JSON.parse(existing.metadata).template; } catch { /* ignore */ }
            }
          }
        }

        // Use template system for: personal-page signals on new creations, or edits to template artifacts.
        // Use LLM+existing-code path for: custom/freeform edits (e.g. editing a calculator, game, etc.)
        const isPersonalTemplate =
          (isEdit && editTargetIsTemplate) ||
          (!isEdit && (
            !!templateMatch ||
            !!nameMatch ||
            !!professionMatch ||
            !!locationMatch ||
            /\b(my (portfolio|blog|website|site|page|landing)|portfolio (website|site|page))\b/i.test(message)
          ));

        let artifactParams: Record<string, unknown>;
        if (isPersonalTemplate) {
          artifactParams = {
            template: templateMatch?.[1] || 'portfolio',
            theme: themeMatch?.[1] || 'dark',
            baseUrl,
            selfDestruct: false,
            ...(nameMatch?.[1] ? { name: nameMatch[1] } : {}),
            ...(locationMatch?.[1] ? { location: locationMatch[1].trim() } : {}),
            ...(professionMatch?.[1] ? { profession: professionMatch[1] } : {}),
          };
        } else {
          // Custom/freeform — LLM generates or edits HTML matching the user's actual request.
          // For edits, action-executor loads the existing HTML and passes it to the LLM.
          artifactParams = { prompt: message, baseUrl, selfDestruct: false };
        }

        if (editTargetId) {
          artifactParams.existingArtifactId = editTargetId;
        }
        const fastResult = await executeAction(userId, { tool: 'generate_code', params: artifactParams });
        if (fastResult.success) {
          const isUpdated = isEdit && !!(fastResult.data as Record<string, unknown>)?.updated;
          const replyText = isUpdated ? `Done! Your site has been updated.` : `Here's your website!`;
          logConversation(userId, 'assistant', replyText, 'builtin', 'website-builder');
          res.json({
            text: replyText,
            reply: replyText,
            route: 'website-builder',
            provider: 'builtin',
            latencyMs: 0,
            creditsUsed: 0,
            actionResults: [{ tool: 'generate_code', success: true, previewUrl: fastResult.previewUrl, artifactId: fastResult.artifactId }],
          });
          return;
        }
      }
    }

    // ---- Image generation fast-path: bypass LLM for image generation requests ----
    if (!forceRoute) {
      const imageVerbNounPattern = /\b(?:generate|create|make|render|produce|show me|i want|give me|can you make|imagine|visualize)\b.{0,60}\b(?:image|picture|photo|illustration|artwork|art|painting|portrait|wallpaper|sketch)\b/i;
      const drawingVerbPattern = /\b(?:draw|paint|sketch|imagine|visualize)\b\s+\S/i;
      const isReminderMsg = /\b(?:remind|reminder|schedule|alarm)\b/i.test(message);
      if (!isReminderMsg && (imageVerbNounPattern.test(message) || drawingVerbPattern.test(message))) {
        const promptMatch = message.match(/\b(?:generate|create|make|draw|render|produce|show me|i want|give me|can you make|can you draw|paint|sketch|imagine|visualize)\b.{0,20}\b(?:image|picture|photo|illustration|artwork|art|drawing|painting|portrait|wallpaper|sketch)\b(?:\s+of\s+|\s+showing\s+|\s+with\s+|\s+)?([\s\S]+)/i)
          ?? message.match(/\b(?:draw|paint|sketch|imagine|visualize)\b\s+(?:me\s+)?(?:a\s+|an\s+|the\s+)?([\s\S]+)/i);
        const rawPrompt = promptMatch?.[1]?.trim() || message;
        const imagePrompt = rawPrompt.replace(/^(?:a\s+|an\s+|the\s+|me\s+)/i, '').trim() || message;
        try {
          const imgFastResult = await executeAction(userId, { tool: 'generate_image', params: { prompt: imagePrompt } });
          if (imgFastResult.success && imgFastResult.imageUrl) {
            const replyText = `Here's your image!`;
            logConversation(userId, 'assistant', replyText, 'builtin', 'image-generator');
            res.json({
              text: replyText,
              reply: replyText,
              route: 'image-generator',
              provider: 'builtin',
              latencyMs: 0,
              creditsUsed: 0,
              actionResults: [{ tool: 'generate_image', success: true, imageUrl: imgFastResult.imageUrl, imageId: imgFastResult.imageId, prompt: imagePrompt }],
            });
            return;
          }
        } catch (e) {
          logger.warn({ err: (e as Error).message }, 'Image generation fast-path failed, falling through to LLM');
        }
      }
    }

        // ---- Auto-route through bridge when enabled ----
    // URL-containing messages skip bridge and go to runReactLoop so crawl_url tool fires correctly
    // Also detect bare domains like "ai.agentin.chat" (no https:// prefix)
    const BARE_DOMAIN_RE = /\b([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+\.[a-zA-Z]{2,})\b/;
    const hasUrl = /https?:\/\/\S+/.test(message) || BARE_DOMAIN_RE.test(message);

    // Multilingual detection: non-Latin script (Devanagari/Telugu/Tamil/Arabic) or Hinglish
    // Chinese models (qwen3:8b, stepfun) reply in Chinese for these — route to Groq instead
    const msgHasNonLatin = /\p{Script=Devanagari}|\p{Script=Telugu}|\p{Script=Arabic}|\p{Script=Tamil}|\p{Script=Gujarati}/u.test(message);
    const HINGLISH_SET = new Set(['aap','kya','kaise','hai','hain','ho','mera','meri','nahi','haan',
      'yaar','bhai','bolo','main','tum','woh','yeh','karo','batao','kitna','kahan','kab','kaun','kyun',
      'mujhe','tumhe','theek','accha','chalo','suno','bahut','abhi','lekin','sirf','toh','naam','kaam']);
    const msgWords = message.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
    const msgIsHinglish = !forceRoute && msgWords.filter(w => HINGLISH_SET.has(w)).length >= 2;
    const webChatNeedsGroq = !forceRoute && (msgHasNonLatin || msgIsHinglish);

    // Skip the Pico-Kimi bridge for web chat: the standard Ollama-first waterfall is faster
    // and avoids PicoClaw<->Ollama contention on NUM_PARALLEL=1. The bridge still activates
    // for explicit /bridge or /agent: prefixes, and for cloud-preference users.
    const userModelPref = (agentConfig?.model_preference as string) || 'auto';
    if (!forceRoute && config.bridgeEnabled && config.picoClawEnabled && !hasUrl && !webChatNeedsGroq && userModelPref === 'cloud') {
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

        // Parse and execute any tool actions from LLM response
        const { text: cleanEdithReply, actions: edithActions } = parseActions(edithResult.text);
        const edithActionResults: ActionResult[] = [];

        for (const action of edithActions) {
          if (action.tool === 'generate_code') {
            action.params.baseUrl = `${req.protocol}://${req.get('host')}`;
            if (reqExistingArtifactId) {
              action.params.existingArtifactId = reqExistingArtifactId;
            }
          }
          const actionResult = await executeAction(userId, action);
          edithActionResults.push(actionResult);
        }

        logConversation(userId, 'assistant', cleanEdithReply || edithResult.text, 'edith', config.moonshotReasoningModel);

        const edithResponse: Record<string, unknown> = {
          text: cleanEdithReply || edithResult.text,
          route: 'premium',
          tier: 'premium',
          latencyMs: edithResult.latencyMs,
          provider: 'edith',
          model: config.moonshotReasoningModel,
          creditsUsed: creditCost,
          creditsRemaining: updatedCredits,
        };

        if (edithActionResults.length > 0) {
          edithResponse.actions = edithActionResults;
          const receipts: ReceiptItem[] = edithActionResults
            .filter(ar => ar.receipt)
            .map(ar => ar.receipt!);
          if (receipts.length > 0) {
            edithResponse.receiptText = formatReceiptCompact(receipts);
            edithResponse.receipts = receipts;
          }
        }

        res.json(edithResponse);
        return;
      } catch (err) {
        logger.warn({ err, userId }, 'Premium (Moonshot) call failed, falling back to local');
        // Fall through to local router
      }
    }

    // ---- Bridge route: Pico-Kimi orchestration (multi-agent workflows) ----
    let bridgeFellThrough = false;
    let delegatedAgent = forceAgent;
    let delegationInfo: { delegationCount: number; delegationLimit: number; remaining: number } | undefined;
    if (forceRoute === 'bridge') {
      try {
        // Auto-delegation: detect specialist agent + enforce tier limits
        if (!forceAgent) {
          const delegation = routeDelegation(userId, userPlan, message);
          if (delegation) {
            delegatedAgent = delegation.agent as AgentRole;
            delegationInfo = { delegationCount: delegation.delegationCount, delegationLimit: delegation.delegationLimit, remaining: delegation.remaining };
            // Emit visible delegation event in Office timeline + canvas
            const currentAgent = (agentConfig?.personality as string) || 'weebo';
            emitDelegation(userId, currentAgent, delegation.agent, delegation.reason);
            emitCommSent(userId, currentAgent, delegation.agent, `Handling "${message.slice(0, 60)}…" — ${delegation.reason}`);
          }
        }

        const history = getConversationContext(userId, 4096, conversationId);
        const bridgeReq: BridgeRequest = {
          userId,
          message,
          systemPrompt,
          conversationHistory: history,
          forceAgent: delegatedAgent,
          forceWorkflow: delegatedAgent ? false : (message.length > 100),
          userCredits,
        };

        const bridgeResult = await bridgeChat(bridgeReq);

        // Emit comm_received when specialist responds (specialist reports back to core)
        if (delegatedAgent && delegationInfo) {
          const currentAgent = (agentConfig?.personality as string) || 'weebo';
          emitCommReceived(userId, delegatedAgent, currentAgent, `Done: ${bridgeResult.text.slice(0, 60)}`);
        }

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

        // Parse and execute any tool actions from LLM response
        const { text: cleanReply, actions: parsedActions } = parseActions(bridgeResult.text);
        const actionResults: ActionResult[] = [];

        for (const action of parsedActions) {
          // Inject baseUrl for generate_code actions to create preview links
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
        logConversation(userId, 'assistant', cleanReply || bridgeResult.text, bridgeResult.provider, bridgeResult.model);

        const response: Record<string, unknown> = {
          text: cleanReply || bridgeResult.text,
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
        // Include delegation tracking info so frontend shows remaining count
        if (delegationInfo) {
          response.delegation = {
            agent: delegatedAgent,
            used: delegationInfo.delegationCount,
            limit: delegationInfo.delegationLimit,
            remaining: delegationInfo.remaining,
          };
        }
        if (bridgeResult.steps) {
          response.steps = bridgeResult.steps;
        }

        // Attach action results and receipts if any
        if (actionResults.length > 0) {
          response.actions = actionResults;

          // Format receipts for display
          const receipts = actionResults
            .filter(ar => ar.receipt)
            .map(ar => ar.receipt!);

          if (receipts.length > 0) {
            response.receiptText = formatReceiptCompact(receipts);
            response.receipts = receipts;
          }
        }

        // Background AI memory extraction (non-blocking)
        extractMemoriesWithAI(userId, message, cleanReply || bridgeResult.text).catch((e: unknown) => logger.debug({ err: e }, 'background task failed'));
        // Phase 94: also extract into user_memories (flat key-value store)
        extractMemoriesFromConversation(userId, [{ role: 'user', content: message }]);

        res.json(response);
        return;
      } catch (err) {
        logger.warn({ err, userId }, 'Bridge route failed, falling back to standard router');
        // If the response was already partially sent, don't fall through
        if (res.headersSent) return;
        // Roll back delegation counter if bridge delegated but failed to complete
        if (delegationInfo) {
          decrementDelegation(userId);
          logger.info({ userId }, 'Rolled back delegation counter after bridge failure');
        }
        bridgeFellThrough = true;
      }
    }

    // Fire keyword-based automation triggers (non-blocking)
    checkKeywordTriggers(userId, message).catch((e: unknown) => logger.debug({ err: e }, 'background task failed'));

    // ---- Auto-delegation for local route ----
    // If bridge already fired delegation events + incremented counter, only detect (don't re-increment).
    // If bridge didn't run or fell through without delegating, do full routeDelegation.
    let localDelegation: ReturnType<typeof routeDelegation> = null;
    let effectiveAgentConfig = agentConfig;
    let effectiveSystemPrompt = systemPrompt;
    if (!forceAgent) {
      if (bridgeFellThrough) {
        // Bridge already called routeDelegation — just re-detect target without incrementing
        const { detectDelegationTarget, canDelegate: checkCan } = await import('../../../services/delegation.js');
        const target = detectDelegationTarget(message);
        if (target) {
          const status = checkCan(userId, userPlan);
          if (status.allowed) {
            // Bridge already incremented, so just build the result shape
            localDelegation = { agent: target.agent, reason: target.reason, delegationCount: status.used, delegationLimit: status.limit, remaining: status.remaining };
            // Don't re-emit delegation/comm_sent — bridge already did that
          }
        }
      } else {
        localDelegation = routeDelegation(userId, userPlan, message);
        if (localDelegation) {
          const currentAgent = (agentConfig?.personality as string) || 'weebo';
          emitDelegation(userId, currentAgent, localDelegation.agent, localDelegation.reason);
          emitCommSent(userId, currentAgent, localDelegation.agent, `Handling "${message.slice(0, 60)}…" — ${localDelegation.reason}`);
        }
      }
      // Override personality for delegated agent (both bridge-fallthrough and fresh)
      if (localDelegation) {
        const delegatedPersonality = getPersonality(localDelegation.agent);
        effectiveAgentConfig = { ...(agentConfig || {}), personality: localDelegation.agent, name: delegatedPersonality.name };
        effectiveSystemPrompt = buildSystemPrompt(effectiveAgentConfig, user, userId, message, reqChannel, userCredits);
        emitThinking(userId, localDelegation.agent, `${delegatedPersonality.name} is processing...`);
      }
    }

    // ---- Default: local-first router (Ollama → cloud fallback if Ollama down) ----

    // ---- URL pre-fetch: inject page content so LLM always gets real data ----
    // More reliable than tool-use path: doesn't depend on model format compliance.
    // Supports both explicit URLs (https://...) and bare domains (ai.agentin.chat)
    let augmentedMessage = message;
    if (hasUrl) {
      const explicitUrl = message.match(/https?:\/\/\S+/);
      const bareDomain = !explicitUrl ? message.match(BARE_DOMAIN_RE) : null;
      const targetUrl = explicitUrl ? explicitUrl[0] : (bareDomain ? `https://${bareDomain[1]}` : null);
      if (targetUrl) {
        try {
          const pageContent = await fetchAndExtract(targetUrl);
          augmentedMessage = `${message}\n\n[Page content from ${targetUrl}]:\n${pageContent}\n\nPlease summarize or answer based on the above content.`;
          logger.info({ url: targetUrl, chars: pageContent.length }, 'web_research: pre-fetched URL for LLM context');
        } catch (fetchErr) {
          logger.warn({ url: targetUrl, err: (fetchErr as Error).message }, 'web_research: pre-fetch failed, proceeding without content');
        }
      }
    }

    const intent = classifyIntent(message);

    // Resolve forced provider from prefix overrides or smart picker
    let resolvedProvider: Provider | undefined;
    if (forceRoute === 'local') {
      resolvedProvider = 'ollama';
    } else if (forceRoute === 'pico') {
      resolvedProvider = 'picoclaw';
    } else if (webChatNeedsGroq) {
      resolvedProvider = 'groq';
      logger.info({ userId, reason: msgHasNonLatin ? 'non-latin-script' : 'hinglish' }, 'web chat multilingual — routing to Groq');
    } else if (userModelPref === 'local') {
      // Bridge skip: local-pref users go straight to Ollama — no pickProvider DB query,
      // no PicoClaw double-hop (PicoClaw also calls Ollama = 2× timeout on cold start).
      resolvedProvider = 'ollama';
      logger.info({ userId, reason: 'local_preference_direct' }, 'Skipping pickProvider — direct Ollama');
    } else {
      resolvedProvider = await pickProvider(userId, message, userPlan);
    }

    // Reduce context for Ollama — 4K tokens on CPU is too slow (60s+ prefill).
    // Cloud models handle 4096 chars fine; Ollama needs ~1500 to stay under 30s.
    const isLocalRoute = !resolvedProvider || resolvedProvider === 'ollama' || resolvedProvider === 'picoclaw';
    const history = getConversationContext(userId, isLocalRoute ? 1500 : 4096, conversationId);
    const messages: ChatMessage[] = [...history, { role: 'user', content: augmentedMessage }];

    // Multi-hypothesis check: inject clarification context if the message is ambiguous
    if (isAmbiguous(message)) {
      try {
        const recentText = history.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n');
        const hypResult = await generateHypotheses(userId, message, recentText);
        if (hypResult.shouldClarify) {
          effectiveSystemPrompt += formatHypothesesForPrompt(hypResult);
        }
      } catch { /* non-fatal */ }
    }

    // Route complex queries through deep reasoning engine (10 iterations + self-reflection + delegation)
    const complexity = classifyMessageComplexity(message);
    const useDeepReasoning = complexity === 'multi_step' || complexity === 'multi_agent';

    const result = useDeepReasoning
      ? await runDeepReasoning(messages, {
          systemPrompt: effectiveSystemPrompt,
          agentName: (effectiveAgentConfig?.name as string) || 'Geek',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          agentId: (effectiveAgentConfig?.personality as any) || undefined,
          userCredits,
          forceProvider: resolvedProvider,
          userId,
          enableDelegation: true,
          enableReflection: true,
        })
      : await runReactLoop(messages, {
          systemPrompt: effectiveSystemPrompt,
          agentName: (effectiveAgentConfig?.name as string) || 'Geek',
          userCredits,
          forceProvider: resolvedProvider,
          userId,
        });

    // Guard: if the 120s HTTP timeout already sent a 503, don't try to send another response
    if (res.headersSent) {
      logger.warn({ userId, provider: result.provider }, 'chat: response arrived after HTTP timeout — logging but not sending');
    }

    // Determine tier from actual provider used
    const tier = (result.provider === 'ollama' || result.provider === 'builtin' || result.provider === 'openrouter-free') ? 'local' : 'premium';

    // Log usage (always, even if response was already sent)
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

    // ReAct loop already executed tool actions; collect results and handle generate_code separately
    let cleanReply = result.text;
    const actionResults: ActionResult[] = [...result.actions];

    // generate_code was deferred inside the loop (needs baseUrl from HTTP layer) — execute now
    for (const action of result.deferredActions) {
      action.params.baseUrl = `${req.protocol}://${req.get('host')}`;
      if (reqExistingArtifactId) {
        action.params.existingArtifactId = reqExistingArtifactId;
      }
      const actionResult = await executeAction(userId, action);
      actionResults.push(actionResult);
    }
    // Also check reply text for any actions the parser might find (bridge responses)
    const { actions: topLevelActions } = parseActions(result.text);
    for (const action of topLevelActions) {
      if (action.tool === 'generate_code') {
        action.params.baseUrl = `${req.protocol}://${req.get('host')}`;
        if (reqExistingArtifactId) {
          action.params.existingArtifactId = reqExistingArtifactId;
        }
        const actionResult = await executeAction(userId, action);
        actionResults.push(actionResult);
      }
    }

    // Strip generate_code blocks from final reply text
    const { text: strippedText } = parseActions(cleanReply);
    cleanReply = strippedText || cleanReply;

    // Log the clean reply (without action blocks)
    logConversation(userId, 'assistant', cleanReply, result.provider, result.model);
    logTrainingExample({ userId, input: message, output: cleanReply, provider: result.provider, model: result.model });

    const response: Record<string, unknown> = {
      text: cleanReply,
      route: tier,
      tier,
      provider: result.provider,
      model: result.model,
      creditsUsed: result.creditCost,
      creditsRemaining: updatedCredits,
      conversationId,
    };

    // Attach action results and receipts if any
    if (actionResults.length > 0) {
      response.actions = actionResults;

      // Format receipts for display
      const receipts: ReceiptItem[] = actionResults
        .filter(ar => ar.receipt)
        .map(ar => ar.receipt!);

      if (receipts.length > 0) {
        response.receiptText = formatReceiptCompact(receipts);
        response.receipts = receipts;
      }
    }

    if (config.logLevel === 'debug') {
      response.debug = { intent, forceRoute, tokensUsed: result.tokensIn + result.tokensOut };
    }

    // Background AI memory extraction (non-blocking)
    extractMemoriesWithAI(userId, message, cleanReply).catch((e: unknown) => logger.debug({ err: e }, 'background task failed'));
    // Phase 94: also extract into user_memories (flat key-value store)
    extractMemoriesFromConversation(userId, [{ role: 'user', content: message }]);

    // Increment rate limit tracker for UI display
    incrementRateLimitTracker(userId as unknown as number).catch(() => {});

    // Push activity for office page live sync
    const chatAgentName = (effectiveAgentConfig?.name as string) || 'Geek';
    logActivity(String(userId), `${chatAgentName} replied`, (cleanReply || '').slice(0, 80), 'bot');
    const chatPersonalityId = (effectiveAgentConfig?.personality as string) || 'jarvis';
    emitDone(String(userId), chatPersonalityId);

    // Emit comm_received when local-route delegation completes
    if (localDelegation) {
      const coreAgent = (agentConfig?.personality as string) || 'weebo';
      emitCommReceived(String(userId), localDelegation.agent, coreAgent, `Done: ${(cleanReply || '').slice(0, 60)}`);
      response.delegation = {
        agent: localDelegation.agent,
        used: localDelegation.delegationCount,
        limit: localDelegation.delegationLimit,
        remaining: localDelegation.remaining,
      };
    }

    if (!res.headersSent) {
      res.json(response);
    }
  } catch (err) {
    logger.error({ err, userId }, 'Chat handler error');
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to process message. Please try again.' });
    }
  }
});

// ---- Get Generated Artifact ----
router.get('/artifact/:id', requireAuth, (req: AuthRequest, res, next: NextFunction) => {
  const artifact = db.prepare(
    'SELECT * FROM generated_artifacts WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.userId!) as Record<string, unknown> | undefined;

  if (!artifact) {
    next(new NotFoundError('Artifact not found'));
    return;
  }

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.json({
    ...artifact,
    previewUrl: `${baseUrl}/preview/${req.userId}/${artifact.id}`,
  });
});

// ---- Delegation Status ----
router.get('/delegation/status', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const sub = db.prepare('SELECT plan FROM subscriptions WHERE user_id = ?').get(userId) as { plan: string } | undefined;
  const userPlan = sub?.plan || 'free';
  const status = canDelegate(userId, userPlan);
  res.json({ ...status, plan: userPlan });
});

// ---- Terminal Commands ----

router.post('/command', requireAuth, validateBody(commandSchema), async (req: AuthRequest, res) => {
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
    const scheduledFor = Date.now() + 3600_000; // Default 1 hour from now
    db.prepare('INSERT INTO reminders (id, user_id, text, channel, category, created_by, scheduled_for) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, userId, text, 'push', 'general', 'terminal', scheduledFor);
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
    if (isNaN(slot) || slot < 1 || slot > 6) { res.json({ output: 'Usage: gs pico pause <slot> (1-6)', isError: true }); return; }
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
    if (isNaN(slot) || slot < 1 || slot > 6) { res.json({ output: 'Usage: gs pico resume <slot> (1-6)', isError: true }); return; }
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
      const sub = db.prepare('SELECT plan, credits_remaining FROM subscriptions WHERE user_id = ?').get(userId) as { plan: string; credits_remaining: number } | undefined;
      if (sub && sub.credits_remaining < 10) {
        res.json({ output: 'Not enough credits for task planning (minimum 10 required)', isError: true });
        return;
      }
      const taskUserPlan = sub?.plan || 'free';

      const { planTasks, queueTasks } = await import('../services/pico-fleet.js');
      const { tasks, creditCost } = await planTasks(userId, taskDesc, taskUserPlan);

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
          systemPrompt: buildSystemPrompt(agentConfig, user, userId, undefined, undefined, (user?.credits as number) || 0),
          agentName: (agentConfig?.name as string) || 'Geek',
          userCredits: (user?.credits as number) || 0,
          userId,
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
      const { createBriefing: createBriefingFn } = await import('../../../services/daily-briefing.js');
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
    const scheduledFor = Date.now() + 3600_000; // Default 1 hour from now
    db.prepare("INSERT INTO reminders (id, user_id, text, channel, category, created_by, scheduled_for) VALUES (?, ?, ?, 'push', 'general', 'terminal', ?)").run(remId, userId, reminderText, scheduledFor);
    const safeReminderText = reminderText
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    // nosemgrep: javascript.express.security.injection.raw-html-format.raw-html-format — reminderText is HTML-entity-escaped above (& < > " ') before interpolation
    res.json({ output: `<span style="color:#61FF7B">Reminder created:</span> ${safeReminderText}`, isError: false });
    return;
  }

  if (cmd === 'gs deploy portfolio') {
    db.prepare("UPDATE portfolios SET is_public = 1 WHERE user_id = ?").run(userId);
    res.json({ output: '<span style="color:#61FF7B">Portfolio deployed!</span>', isError: false });
    return;
  }

  if (cmd === 'help') {
    res.json({ output: `Agentin Terminal Commands:\n  gs me                     Show your profile\n  gs reminders list         List reminders\n  gs reminders add "text"   Create a reminder\n  gs remind <text>          Quick reminder shortcut\n  gs credits                Check subscription credits\n  gs usage today|month      Usage reports\n  gs integrations           List integrations\n  gs connect <service>      Connect integration\n  gs disconnect <service>   Disconnect integration\n  gs automations            List automations\n  gs status                 Agent status\n  gs health                 System health check\n  gs brief                  Daily briefing summary\n  gs portfolio              Portfolio URL\n  gs deploy                 Deploy portfolio\n  gs deploy portfolio       Deploy portfolio (alias)\n  gs profile set <f> <v>    Update profile field\n  gs export                 Export all data as JSON\n  gs pico list              List Weebo agents\n  gs pico create "Name"     Create a new Weebo agent (max 6)\n  gs pico pause <slot>      Pause agent at slot (1-6)\n  gs pico resume <slot>     Resume agent at slot\n  gs pico tasks             List recent tasks\n  gs task "description"     Plan and queue tasks via Kimi\n  ai "prompt"               Ask your AI agent (real LLM)\n  clear                     Clear terminal\n  help                      Show this help\n\nChat Prefixes:\n  /bridge <msg>             Multi-agent orchestration\n  /workflow <msg>           Alias for /bridge\n  /agent:<role> <msg>       Force specific agent (coder, planner, analyst, etc.)\n  /premium <msg>            Force Kimi premium reasoning\n  /local <msg>              Force local Ollama\n  /pico <msg>               Force Weebo Engine\n  /task <description>       Plan and queue tasks via Kimi`, isError: false });
    return;
  }

  if (cmd === 'clear') { res.json({ output: '', isError: false, clear: true }); return; }

  res.json({ output: `Command not found: ${command}\nType 'help' to see available commands.`, isError: true });
});

export default router;
