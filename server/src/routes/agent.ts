import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth, optionalAuth, type AuthRequest } from '../middleware/auth.js';
import { validateBody, chatSchema, commandSchema, agentConfigUpdateSchema, memoryCreateSchema, memoryUpdateSchema, deployPremiumSchema, premiumChatSchema } from '../middleware/validate.js';
import { db } from '../db/index.js';
import { routeChat, classifyIntent, computeCreditCost, deductSubscriptionCredits, streamOllama, pickProvider, type ChatMessage, type Provider } from '../services/llm.js';
import { edithChat } from '../services/edith.js';
import { logger } from '../logger.js';
import { config } from '../config.js';
import { OPENCLAW_IDENTITY, buildPortfolioVisitorPrompt } from '../prompts/openclaw-system.js';
import { getPersonalityPrompt, getPersonality, PERSONALITIES } from '../prompts/personalities.js';
import { checkKeywordTriggers } from '../services/automations-engine.js';
import { buildMemoryContext, buildOwnerContextForVisitor, logConversation, logTrainingExample, extractMemories, extractMemoriesWithAI, getConversationContext, getMemories, getRelevantMemories, deleteMemory, upsertMemory, getRecentConversations, formatMemoryContext, extractMemoriesFromConversation } from '../services/memory.js';
import { loadPicoContext, formatContextBlock } from '../services/pico-context.js';
import { checkContent } from '../services/content-filter.js';
import { generateCodename, buildPremiumPrompt, getDeployMessage } from '../services/premium-agent.js';
import { bridgeChat, classifyComplexity, getRecentBridgeEvents, type BridgeRequest } from '../services/pico-kimi-bridge.js';
import { getUserWorkflows, getWorkflowStatus, getWorkflowAnalytics } from '../services/workflow-engine.js';
import { getAllAgentDefinitions, selectAgents, getAgentRoles, type AgentRole } from '../services/agent-registry.js';
import { isPicoClawAvailable, queryPicoClaw } from '../services/picoclaw.js';
import { parseActions, type ParsedAction } from '../services/action-parser.js';
import { executeAction, type ActionResult } from '../services/action-executor.js';
import { runReactLoop } from '../services/react-loop.js';
import { formatReceiptCompact, type ReceiptItem } from '../services/receipts.js';
import { cacheGet, cacheSet, cacheDel } from '../services/cache.js';
import { sendTelegramNotification, escapeTelegramHtml } from '../services/telegram.js';
import { sendAgentMessage, getAgentMessages, canChatWithAgent } from '../services/agent-chat.js';
import { fetchAndExtract } from '../services/web-research.js';
import { buildPersonalityInstructions } from '../services/message-router.js';

export const agentRouter = Router();

// ---- Rate Limit Status tracker (GeekOS upgrade) ----
// Redis-backed — survives Docker restarts
const RL_WINDOW_S = 15 * 60;
const RL_LIMIT = 60;

async function incrementRateLimitTracker(userId: number): Promise<void> {
  const key = `chat:rl:${userId}`;
  try {
    const raw = await cacheGet(key);
    const count = raw ? parseInt(raw, 10) + 1 : 1;
    await cacheSet(key, String(count), RL_WINDOW_S);
  } catch { /* Redis fail = degrade to unlimited */ }
}

async function getRateLimitStatus(userId: number): Promise<{ remaining: number; limit: number; windowMinutes: number }> {
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

function buildSystemPrompt(
  agentConfig: Record<string, unknown> | undefined,
  user: Record<string, unknown> | undefined,
  userId: string,
  userMessage?: string,
  channel?: string,
): string {
  const personalityId = (agentConfig?.personality as string) || 'jarvis';
  const personality = getPersonality(personalityId);
  const personalityPrompt = getPersonalityPrompt(personalityId);
  const agentName = (agentConfig?.name as string) || personality.name;
  const voice = (agentConfig?.voice as string) || 'friendly';
  const mode = (agentConfig?.mode as string) || 'builder';
  const customPrompt = (agentConfig?.system_prompt as string) || '';
  const userName = (user?.name as string) || 'there';

  // Load full PicoContext (superset of buildMemoryContext)
  const picoCtx = loadPicoContext(userId);
  // Keep buildMemoryContext for any additional AI-extracted memory context
  const memoryBlock = buildMemoryContext(userId, userMessage);

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
Use portfolio_update_skills when the user says "update my skills", "add skills to my portfolio", "my skills are X, Y, Z", or similar. Pass skills as a JSON array of strings.`;

  // Build personality instructions from slider values (uses shared function from message-router)
  const personalityInstructions = buildPersonalityInstructions(agentConfig as { creativity?: number; formality?: number; verbosity?: number; humor?: number; empathy?: number } | undefined);

  return `LANGUAGE RULE: Detect the language the user writes in. ALWAYS reply in that exact language — no exceptions. Hindi → Hindi. Telugu → Telugu. Tamil → Tamil. English → English. Never switch languages unless the user does first.

YOUR IDENTITY: Your name is ${agentName}. If asked who you are or what your name is, say your name is ${agentName}.

${OPENCLAW_IDENTITY}

--- PERSONALITY ---
${personalityPrompt}
${personalityInstructions ? `\n--- PERSONALITY TUNING ---\n${personalityInstructions}` : ''}

${formatContextBlock(picoCtx)}

--- USER SESSION ---
User: ${userName}. Voice: ${voice}. Mode: ${mode}.
${customPrompt ? `Custom instructions: ${customPrompt}` : ''}
${memoryBlock}
${formatMemoryContext(userId)}

${toolsBlock}

${closingInstruction}`;
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
    creativity: 'creativity', formality: 'formality', verbosity: 'verbosity',
    humor: 'humor', empathy: 'empathy', responseSpeed: 'response_speed',
    monthlyBudgetUSD: 'monthly_budget_usd', avatarEmoji: 'avatar_emoji',
    accentColor: 'accent_color', bubbleStyle: 'bubble_style', status: 'status',
    personality: 'personality', model_preference: 'model_preference',
    preferred_free_model: 'preferred_free_model',
    preferred_image_model: 'preferred_image_model',
    preferred_video_model: 'preferred_video_model',
    briefing_time: 'briefing_time',
    notif_reminders: 'notif_reminders',
    notif_escalations: 'notif_escalations',
    notif_agents: 'notif_agents',
    notif_daily_briefing: 'notif_daily_briefing',
    notif_connections: 'notif_connections',
    greeting: 'greeting',
    snooze_presets: 'snooze_presets',
    use_case: 'use_case',
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

agentRouter.get('/personalities', async (_req, res) => {
  const cached = await cacheGet('agent:personalities');
  if (cached) { res.json(JSON.parse(cached)); return; }
  await cacheSet('agent:personalities', JSON.stringify(PERSONALITIES), 3600);
  res.json(PERSONALITIES);
});

// ---- AI Content Generation (for onboarding magic) ----

agentRouter.post('/generate-content', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { type, tags, name } = req.body as { type: string; tags: string[]; name?: string };
    if (!type || !tags || tags.length === 0) {
      return res.status(400).json({ error: 'type and at least 1 tag required' });
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
      return res.status(400).json({ error: 'type must be headline, bio, about, skills, bio-batch, or portfolio-batch' });
    }

    // Check subscription credits
    const sub = db.prepare('SELECT credits_remaining, billing_cycle_end FROM subscriptions WHERE user_id = ?').get(req.userId!) as { credits_remaining: number; billing_cycle_end: string } | undefined;
    if (sub && sub.credits_remaining <= 0) {
      res.status(402).json({
        error: `You've used all your credits for this month. They reset on ${sub.billing_cycle_end.split('T')[0]}. Upgrade your plan for more.`,
      });
      return;
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
  } catch (err: unknown) {
    logger.error('generate-content error: %s', err instanceof Error ? err.message : String(err));
    res.status(500).json({ error: 'AI generation failed. Try again.' });
  }
});

// ---- AI-Generated Background Gradient ----

agentRouter.post('/generate-background', requireAuth, async (req: AuthRequest, res) => {
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

agentRouter.post('/chat', requireAuth, validateBody(chatSchema), async (req: AuthRequest, res) => {
  // Override the global 30s timeout for AI chat — allow up to 120s
  res.setTimeout(120000);
  let { message } = req.body as { message: string; channel?: string; context?: string };
  const userId = req.userId!;
  const reqChannel = (req.body as { channel?: string }).channel;
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
    } catch (guestErr) {
      res.json({ reply: `Hi! I'm the AI assistant for ${portfolioUsername}'s portfolio. How can I help you?`, agentName: 'Jarvis', ownerName: portfolioUsername });
    }
    return;
  }

  try {
    const agentConfig = db.prepare('SELECT * FROM agent_configs WHERE user_id = ?').get(userId) as Record<string, unknown> | undefined;
    const user = db.prepare('SELECT name, credits FROM users WHERE id = ?').get(userId) as Record<string, unknown> | undefined;
    const systemPrompt = buildSystemPrompt(agentConfig, user, userId, message, reqChannel);
    const userCredits = (user?.credits as number) || 0;

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
    logConversation(userId, 'user', message);
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

    if (!forceRoute && config.bridgeEnabled && config.picoClawEnabled && !hasUrl && !webChatNeedsGroq) {
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
      }
    }

    // Fire keyword-based automation triggers (non-blocking)
    checkKeywordTriggers(userId, message).catch((e: unknown) => logger.debug({ err: e }, 'background task failed'));

    // ---- Default: local-first router (Ollama → cloud fallback if Ollama down) ----
    const history = getConversationContext(userId);

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

    const messages: ChatMessage[] = [...history, { role: 'user', content: augmentedMessage }];
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
    } else {
      const smartProvider = await pickProvider(userId, message, userPlan);
      if (smartProvider !== 'ollama') {
        resolvedProvider = smartProvider;
      }
    }

    const result = await runReactLoop(messages, {
      systemPrompt,
      agentName: (agentConfig?.name as string) || 'Geek',
      userCredits,
      forceProvider: resolvedProvider,
      userId,
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

    res.json(response);
  } catch (err) {
    logger.error({ err, userId }, 'Chat handler error');
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to process message. Please try again.' });
    }
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

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.json({
    ...artifact,
    previewUrl: `${baseUrl}/preview/${req.userId}/${artifact.id}`,
  });
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
          systemPrompt: buildSystemPrompt(agentConfig, user, userId),
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
    const scheduledFor = Date.now() + 3600_000; // Default 1 hour from now
    db.prepare("INSERT INTO reminders (id, user_id, text, channel, category, created_by, scheduled_for) VALUES (?, ?, ?, 'push', 'general', 'terminal', ?)").run(remId, userId, reminderText, scheduledFor);
    res.json({ output: `<span style="color:#61FF7B">Reminder created:</span> ${reminderText}`, isError: false });
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

    // 82.6: Content filter — tag flagged messages (non-blocking)
    checkContent(message, userId);

    const history = getConversationContext(userId);
    const intent = classifyIntent(message);
    const userCredits = (user?.credits as number) || 0;
    const agentName = (agentConfig?.name as string) || 'Geek';

    // For complex/coding/planning intents, use ReAct loop with visible thinking steps
    if (intent === 'coding' || intent === 'planning' || intent === 'complex') {
      const result = await runReactLoop(
        [...history, { role: 'user', content: message }],
        {
          systemPrompt, agentName, userCredits, userId,
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
      logConversation(userId, 'assistant', result.text, result.provider, result.model);
      res.write(`data: ${JSON.stringify({
        text: '', done: true, provider: result.provider, model: result.model,
        tier, creditsUsed: result.creditCost,
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
    // Fallback to cloud (skip Ollama — it just failed)
    try {
      const agentConfig = db.prepare('SELECT * FROM agent_configs WHERE user_id = ?').get(userId) as Record<string, unknown> | undefined;
      const user = db.prepare('SELECT name, credits FROM users WHERE id = ?').get(userId) as Record<string, unknown> | undefined;
      const fallbackHistory = getConversationContext(userId);
      const result = await routeChat(
        [...fallbackHistory, { role: 'user', content: message }],
        { systemPrompt: buildSystemPrompt(agentConfig, user, userId), agentName: (agentConfig?.name as string) || 'Geek', userCredits: (user?.credits as number) || 0, userId, forceProvider: 'openrouter-free' as Provider },
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

/** Map snake_case DB row to camelCase for frontend */
function mapMemory(row: Record<string, unknown>) {
  return {
    id: row.id,
    userId: row.user_id,
    category: row.category,
    key: row.key,
    value: row.value,
    confidence: row.confidence,
    source: row.source,
    accessCount: row.access_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapConversation(row: Record<string, unknown>) {
  return {
    id: row.id,
    userId: row.user_id,
    role: row.role,
    content: row.content,
    provider: row.provider,
    model: row.model,
    summary: row.summary,
    tags: row.tags,
    createdAt: row.created_at,
    starred: !!row.starred,
  };
}

agentRouter.get('/memory', requireAuth, (req: AuthRequest, res) => {
  const category = req.query.category as string | undefined;
  const search = req.query.search as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 500);

  if (search) {
    const memories = getRelevantMemories(req.userId!, search, limit);
    res.json((memories as unknown as Record<string, unknown>[]).map(mapMemory));
    return;
  }
  const memories = getMemories(req.userId!, category, limit);
  res.json((memories as unknown as Record<string, unknown>[]).map(mapMemory));
});

agentRouter.post('/memory', requireAuth, validateBody(memoryCreateSchema), (req: AuthRequest, res) => {
  const { category, key, value, confidence, source } = req.body;
  upsertMemory(req.userId!, category, key, value, confidence, source);

  const memory = db.prepare(
    'SELECT * FROM agent_memory WHERE user_id = ? AND category = ? AND key = ?'
  ).get(req.userId!, category, key) as Record<string, unknown>;
  res.status(201).json(mapMemory(memory));
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
  ).get(req.userId!, category, key) as Record<string, unknown>;
  res.json(mapMemory(updated));
});

// ── Clear ALL memories for a user (dangerous — requires ?confirm=yes) ──────
agentRouter.delete('/memory/bulk-all', requireAuth, (req: AuthRequest, res) => {
  if (req.query.confirm !== 'yes') {
    res.status(400).json({ error: 'Must pass ?confirm=yes to clear all memories' });
    return;
  }
  const userId = req.userId!;
  const result = db.prepare('DELETE FROM agent_memory WHERE user_id = ?').run(userId);
  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Cleared all memories', ?, 'trash')`).run(uuid(), userId, `Deleted ${result.changes} memories`);
  res.json({ deleted: result.changes });
});

// ── 65.7: Bulk-clear memories by category (must be before /:id) ────────────
agentRouter.delete('/memory/bulk', requireAuth, (req: AuthRequest, res) => {
  const category = typeof req.query.category === 'string' && req.query.category.trim() ? req.query.category.trim() : null;
  const userId = req.userId!;
  if (!category) { res.status(400).json({ error: 'category query param is required' }); return; }
  const result = db.prepare('DELETE FROM agent_memory WHERE user_id = ? AND category = ?').run(userId, category);
  res.json({ deleted: result.changes });
});

agentRouter.delete('/memory/:id', requireAuth, (req: AuthRequest, res) => {
  const deleted = deleteMemory(req.userId!, req.params.id);
  if (!deleted) { res.status(404).json({ error: 'Memory not found' }); return; }
  res.json({ success: true });
});

// ---- Conversation History ----

agentRouter.get('/conversations', requireAuth, (req: AuthRequest, res) => {
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
  const search = req.query.search as string | undefined;
  const conversations = getRecentConversations(req.userId!, limit, search);
  res.json((conversations as unknown as Record<string, unknown>[]).map(mapConversation));
});

// ---- Conversation Export ----

agentRouter.get('/conversations/export', requireAuth, (req: AuthRequest, res) => {
  try {
    const allConversations = getRecentConversations(req.userId!, 1000);
    const days = Math.max(0, parseInt(req.query.days as string, 10) || 0);
    const conversations = days > 0
      ? allConversations.filter(c => {
          if (!c.created_at) return false;
          const cutoff = new Date(Date.now() - days * 86400000).toISOString();
          return c.created_at >= cutoff;
        })
      : allConversations;
    const format = (req.query.format as string | undefined) ?? 'json';

    if (format === 'md') {
      // Render as Markdown — oldest first, role headers, blank line between turns
      const sorted = [...conversations].reverse();
      const lines: string[] = ['# GeekSpace Chat Export\n'];
      for (const c of sorted) {
        const role = c.role === 'user' ? '**You**' : '**Assistant**';
        const ts = c.created_at ? `  \n_${c.created_at}_` : '';
        lines.push(`### ${role}${ts}\n\n${c.content}\n`);
      }
      const md = lines.join('\n---\n\n');
      res.setHeader('Content-Disposition', 'attachment; filename="geekspace-chat.md"');
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.send(md);
      return;
    }

    const data = (conversations as unknown as Record<string, unknown>[]).map(mapConversation);
    res.setHeader('Content-Disposition', 'attachment; filename="conversations.json"');
    res.setHeader('Content-Type', 'application/json');
    res.json(data);
  } catch (err) {
    logger.error({ err }, 'conversations/export failed');
    res.status(500).json({ error: 'Failed to export conversations' });
  }
});

// ---- Message Reactions ----

agentRouter.post('/conversations/reactions', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { messageId, reaction } = req.body as { messageId?: string; reaction?: string };
  if (!messageId || !reaction) {
    res.status(400).json({ error: 'messageId and reaction are required' });
    return;
  }
  try {
    db.prepare(
      'INSERT OR REPLACE INTO message_reactions (id, user_id, message_id, reaction, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))'
    ).run(`${userId}-${messageId}`, userId, messageId, reaction);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err, userId }, 'Failed to save reaction');
    res.status(500).json({ error: 'Failed to save reaction' });
  }
});

// ---- Reactions Summary ----

agentRouter.get('/conversations/reactions/summary', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  try {
    // Get top reactions grouped by reaction emoji with count
    const rows = db.prepare(
      `SELECT reaction, COUNT(*) as count
       FROM message_reactions
       WHERE user_id = ?
       GROUP BY reaction
       ORDER BY count DESC
       LIMIT 10`
    ).all(userId) as { reaction: string; count: number }[];
    res.json({ reactions: rows });
  } catch (err) {
    logger.error({ err, userId }, 'Failed to get reaction summary');
    res.status(500).json({ error: 'Failed to get reaction summary' });
  }
});

// ---- 60.2: Star/unstar a conversation message ----

agentRouter.post('/conversations/:id/star', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const row = db.prepare('SELECT id, user_id, starred FROM conversation_log WHERE id = ? AND user_id = ?').get(req.params.id, userId) as { id: string; user_id: string; starred: number } | undefined;
  if (!row) { res.status(404).json({ error: 'Message not found' }); return; }
  const newStarred = row.starred ? 0 : 1;
  db.prepare('UPDATE conversation_log SET starred = ? WHERE id = ? AND user_id = ?').run(newStarred, req.params.id, userId);
  res.json({ starred: !!newStarred });
});

// 60.2: Get all starred messages (must come before /:id/star to avoid route ambiguity)
agentRouter.get('/conversations/starred', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
  const rows = db.prepare(
    'SELECT * FROM conversation_log WHERE user_id = ? AND starred = 1 ORDER BY created_at DESC LIMIT ?'
  ).all(userId, limit) as Record<string, unknown>[];
  res.json({ messages: rows.map(mapConversation) });
});

// ---- Agent Quality Metrics (Phase 26.5) ----

agentRouter.get('/quality', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  try {
    // Total messages sent by this user
    const totalRow = db.prepare(
      `SELECT COUNT(*) as count FROM conversation_log WHERE user_id = ?`
    ).get(userId) as { count: number };

    // Positive reactions: 👍 ❤️ 🔥
    const positiveRow = db.prepare(
      `SELECT COUNT(*) as count FROM message_reactions WHERE user_id = ? AND reaction IN ('👍', '❤️', '🔥')`
    ).get(userId) as { count: number };

    // Negative reactions: 👎
    const negativeRow = db.prepare(
      `SELECT COUNT(*) as count FROM message_reactions WHERE user_id = ? AND reaction = '👎'`
    ).get(userId) as { count: number };

    const positive = positiveRow.count;
    const negative = negativeRow.count;
    const total = totalRow.count;
    const totalReacted = positive + negative;
    const satisfactionRate = totalReacted > 0 ? Math.round((positive / totalReacted) * 100) : null;

    // Trend: compare this week vs last week (reaction counts)
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const thisWeekStart = new Date(now - weekMs).toISOString();
    const lastWeekStart = new Date(now - 2 * weekMs).toISOString();

    const thisWeekPositive = (db.prepare(
      `SELECT COUNT(*) as count FROM message_reactions WHERE user_id = ? AND reaction IN ('👍', '❤️', '🔥') AND created_at >= ?`
    ).get(userId, thisWeekStart) as { count: number }).count;

    const lastWeekPositive = (db.prepare(
      `SELECT COUNT(*) as count FROM message_reactions WHERE user_id = ? AND reaction IN ('👍', '❤️', '🔥') AND created_at >= ? AND created_at < ?`
    ).get(userId, lastWeekStart, thisWeekStart) as { count: number }).count;

    const trend = lastWeekPositive === 0
      ? (thisWeekPositive > 0 ? 'up' : 'neutral')
      : thisWeekPositive > lastWeekPositive ? 'up'
      : thisWeekPositive < lastWeekPositive ? 'down'
      : 'neutral';

    res.json({
      totalMessages: total,
      positiveReactions: positive,
      negativeReactions: negative,
      satisfactionRate,
      trend,
      hasEnoughData: totalReacted >= 5,
    });
  } catch (err) {
    logger.error({ err, userId }, 'Failed to get agent quality metrics');
    res.status(500).json({ error: 'Failed to get quality metrics' });
  }
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

// ---- Public can-chat check (no auth required) ----

agentRouter.get('/can-chat-public/:username', (_req, res) => {
  const { username } = _req.params;
  const target = db.prepare('SELECT agent_chat_enabled FROM users WHERE username = ?').get(username) as { agent_chat_enabled: number } | undefined;
  if (!target) { res.json({ canChat: false }); return; }
  res.json({ canChat: !!target.agent_chat_enabled });
});

// ---- Public Portfolio Chat (real LLM-powered) ----

agentRouter.post('/chat/public/:username', optionalAuth, validateBody(chatSchema), async (req: AuthRequest, res) => {
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
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
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
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
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

// ---- Agent-to-Agent Messaging ----

agentRouter.post('/send-message', requireAuth, async (req: AuthRequest, res) => {
  const { recipientAgentId, message } = req.body as { recipientAgentId?: string; message?: string };

  if (!recipientAgentId || !message) {
    res.status(400).json({ error: 'Missing recipientAgentId or message' });
    return;
  }

  if (message.length > 2000) {
    res.status(400).json({ error: 'Message too long (max 2000 characters)' });
    return;
  }

  const success = await sendAgentMessage(req.userId!, recipientAgentId, message);

  if (!success) {
    res.status(400).json({ error: 'Cannot send message to this agent. They may have agent chat disabled or not exist.' });
    return;
  }

  res.json({ success: true, message: 'Message sent successfully' });
});

agentRouter.get('/messages', requireAuth, (req: AuthRequest, res) => {
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
  const messages = getAgentMessages(req.userId!, limit);
  res.json(messages);
});

agentRouter.get('/can-chat/:username', requireAuth, (req: AuthRequest, res) => {
  const canChat = canChatWithAgent(req.userId!, req.params.username);
  res.json({ canChat });
});

// ---- Agent Status Endpoints (for testing and UI state management) ----

agentRouter.get('/status', requireAuth, (req: AuthRequest, res) => {
  const agent = db.prepare('SELECT * FROM agent_configs WHERE user_id = ?').get(req.userId!) as {
    status: string;
    name: string;
    mode: string;
    personality: string;
  } | undefined;

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  const isActive = agent.status === 'online';

  res.json({
    status: isActive ? 'active' : 'inactive',
    agent: {
      name: agent.name,
      mode: agent.mode,
      personality: agent.personality || 'jarvis',
      isActive,
    },
  });
});

agentRouter.post('/activate', requireAuth, (req: AuthRequest, res) => {
  db.prepare('UPDATE agent_configs SET status = ? WHERE user_id = ?').run('online', req.userId!);

  // Log activity
  db.prepare(`
    INSERT INTO activity_log (id, user_id, action, details, icon)
    VALUES (?, ?, 'Agent activated', 'Agent is now online', 'power')
  `).run(uuid(), req.userId!);

  res.json({ success: true, status: 'active' });
});

agentRouter.post('/deactivate', requireAuth, (req: AuthRequest, res) => {
  db.prepare('UPDATE agent_configs SET status = ? WHERE user_id = ?').run('offline', req.userId!);

  // Log activity
  db.prepare(`
    INSERT INTO activity_log (id, user_id, action, details, icon)
    VALUES (?, ?, 'Agent deactivated', 'Agent is now offline', 'power-off')
  `).run(uuid(), req.userId!);

  res.json({ success: true, status: 'inactive' });
});

agentRouter.get('/rate-limit-status', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId! as unknown as number;
  const status = await getRateLimitStatus(userId);
  res.json({
    ...status,
    resetAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  });
});

// ── Phase 109: Conversation Quality Rating ─────────────────────────────────

agentRouter.get('/conversations/ratings', requireAuth, (req: AuthRequest, res): void => {
  const userId = req.userId!;
  const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt((req.query.limit as string) ?? '20', 10) || 20));
  const offset = (page - 1) * limit;

  try {
    const rows = db.prepare(`
      SELECT
        a.id,
        a.content AS assistant_content,
        a.provider,
        a.model,
        a.quality_score,
        a.created_at,
        u.content AS user_content
      FROM conversation_log a
      LEFT JOIN conversation_log u ON (
        u.user_id = a.user_id
        AND u.role = 'user'
        AND u.created_at = (
          SELECT MAX(x.created_at) FROM conversation_log x
          WHERE x.user_id = a.user_id AND x.role = 'user' AND x.created_at <= a.created_at
        )
      )
      WHERE a.user_id = ? AND a.role = 'assistant'
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `).all(userId, limit, offset) as Array<{
      id: string;
      assistant_content: string;
      provider: string;
      model: string;
      quality_score: number | null;
      created_at: string;
      user_content: string | null;
    }>;

    const total = (db.prepare(`SELECT COUNT(*) as count FROM conversation_log WHERE user_id = ? AND role = 'assistant'`).get(userId) as { count: number }).count;

    res.json({
      conversations: rows.map(r => ({
        id: r.id,
        userMessage: r.user_content ?? '',
        assistantMessage: r.assistant_content,
        provider: r.provider,
        model: r.model,
        qualityScore: r.quality_score,
        createdAt: r.created_at,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    logger.error({ err, userId }, 'Failed to fetch conversations for rating');
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

agentRouter.post('/conversations/:id/rating', requireAuth, (req: AuthRequest, res): void => {
  const userId = req.userId!;
  const { id } = req.params;
  const { score } = req.body as { score?: unknown };

  if (typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > 5) {
    res.status(400).json({ error: 'score must be an integer between 1 and 5' });
    return;
  }

  try {
    const row = db.prepare('SELECT id FROM conversation_log WHERE id = ? AND user_id = ? AND role = ?').get(id, userId, 'assistant') as { id: string } | undefined;
    if (!row) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    db.prepare('UPDATE conversation_log SET quality_score = ? WHERE id = ? AND user_id = ?').run(score, id, userId);
    res.json({ success: true, id, score });
  } catch (err) {
    logger.error({ err, userId, id }, 'Failed to update conversation rating');
    res.status(500).json({ error: 'Failed to update rating' });
  }
});
