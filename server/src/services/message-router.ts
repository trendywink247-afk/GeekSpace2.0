// ============================================================
// Unified Message Router
//
// Normalizes incoming messages from any channel (Telegram, WhatsApp,
// etc.) and routes them through the existing LLM pipeline.
//
// Flow: incoming message → resolve user → check credits →
//       build system prompt → routeChat() → send response back
// ============================================================

import { v4 as uuid } from 'uuid';
import { DateTime } from 'luxon';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { config } from '../config.js';
import { deductSubscriptionCredits, routeChat, type ChatMessage } from './llm.js';
import { runReactLoop } from './react-loop.js';
import { bridgeChat, type BridgeRequest } from './pico-kimi-bridge.js';
import { buildMemoryContext, logConversation, logTrainingExample, extractMemories, extractMemoriesWithOllama, getConversationContext } from './memory.js';
import { checkKeywordTriggers } from './automations-engine.js';
import { sendTelegramMessage, sendTelegramPhoto, sendTelegramVideo } from './telegram.js';
import { getPersonalityPrompt, getPersonality } from '../prompts/personalities.js';
import { OPENCLAW_IDENTITY_COMPACT } from '../prompts/openclaw-system.js';
import { parseActions } from './action-parser.js';
import { executeAction, type ActionResult } from './action-executor.js';
import { compressPrompt, trimConversationHistory } from '../utils/token-format.js';
import { isSearchIntent, tavilySearch } from './tavily.js';
import { extractUrl } from './firecrawl.js';
import { fetchAndExtract, smartSearch } from './web-research.js';
import { addInboxMessage } from './inbox.js';
import { checkContentSafety } from './content-filter.js';

// ---- Resolve agent name from config + personality (never returns 'Geek') ----
function resolveAgentName(
  agentConfig: Record<string, unknown> | null | undefined,
  personalityId?: string,
): string {
  if (agentConfig?.name && typeof agentConfig.name === 'string' && agentConfig.name.trim()) {
    return agentConfig.name.trim();
  }
  return getPersonality(personalityId || 'jarvis').name;
}

// ---- Screenshot compression using ffmpeg (avoids 413 errors for large screenshots) ----
async function compressScreenshot(base64Png: string): Promise<string> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const { writeFile, readFile, unlink } = await import('fs/promises');
  const { tmpdir } = await import('os');
  const { join } = await import('path');
  const execAsync = promisify(exec);

  const id = Math.random().toString(36).slice(2);
  const inFile = join(tmpdir(), `ss_in_${id}.png`);
  const outFile = join(tmpdir(), `ss_out_${id}.jpg`);

  try {
    await writeFile(inFile, Buffer.from(base64Png, 'base64'));
    // Resize to fit within 1280x4096 box, convert to JPEG (-update 1 = single frame JPEG)
    // cap height prevents PHOTO_INVALID_DIMENSIONS for tall full-page screenshots
    await execAsync(`ffmpeg -y -i "${inFile}" -vf "scale=1280:4096:force_original_aspect_ratio=decrease" -q:v 4 -update 1 "${outFile}" 2>/dev/null`);
    const jpegBuf = await readFile(outFile);
    return `data:image/jpeg;base64,${jpegBuf.toString('base64')}`;
  } finally {
    unlink(inFile).catch(() => {});
    unlink(outFile).catch(() => {});
  }
}

// ---- ReAct Tool Instructions ----
// Injected into system prompts so the LLM knows how to call tools.
const TOOL_INSTRUCTIONS = `
--- AVAILABLE TOOLS ---
You can call tools by emitting an action block in your response:
<<<ACTION
{"tool": "<tool_name>", "params": {<params>}}
ACTION>>>

Available tools:
- web_search: Search the web for current information. Params: {"query": "<search query>"}
- crawl_url: Fetch and read any website URL. Params: {"url": "<full URL including https://>"}
- take_screenshot: Take a screenshot of any website. Params: {"url": "<full URL including https://>"}. Use when user says "screenshot", "take a photo of", "show me the website", "capture".
- get_links: Extract all links from a webpage. Params: {"url": "<full URL>", "filter": "all|internal|external"}. Use when user says "get links", "all links", "links from", "list links".
- set_reminder: Create a reminder for the user. Params: {"text": "<reminder text>", "datetime": "<EXACT time the user said, e.g. '3:30am', 'tomorrow at 9pm', 'in 2 hours' — do NOT convert to ISO or UTC>", "channel": "telegram|push"}
- telegram_notify: Send a Telegram message to the user. Params: {"message": "<message text>"}
- generate_image: Generate an image. Params: {"prompt": "<image description>"}
- generate_code: Build or update a website. Params: {"template": "portfolio|landing|blog|business", "title": "...", "name": "...", "theme": "dark|light|purple|blue|gradient", "profession": "...", "location": "...", "bio": "...", "skills": ["skill1","skill2"], "email": "...", "tagline": "..."}. Use this for both creating AND editing websites (just output updated params — the server handles the rest). Never write raw HTML.
- send_email: Send an email to the user. Params: {"subject": "<subject>", "body": "<body>"}
- delete_reminder: Delete reminders. To delete ALL pending reminders: {"deleteAll": true}. To delete one: {"reminderId": "<id>"}. Use this whenever the user says "delete my reminders", "cancel all reminders", "remove reminders", etc.
- list_reminders: Show pending reminders. Params: {}. ALWAYS use this when user says "what reminders do I have", "show my reminders", "list reminders", "any reminders?", "what have I got scheduled". NEVER guess or invent reminders — always call this tool.
- create_note: Save a note. Params: {"title": "<title>", "content": "<note content>", "tags": ["<tag1>"]}. Use when user says "save this", "take note", "note this down", "remember this".
- search_notes: Search saved notes. Params: {"query": "<search term>", "limit": 5}. Use when user says "find my note", "search notes", "what did I save about".
- track_habit: Log a habit completion for today. Params: {"habitName": "<habit name>", "note": "<optional note>"}. Use when user says "I did X", "track my X", "log X habit", "mark X as done".
- start_focus: Start a focus/Pomodoro session. Params: {"goal": "<what to focus on>", "duration_min": 25}. Use when user says "start focus", "pomodoro", "focus mode", "I need to focus on".
- create_flashcards: Create study flashcards. Params: {"topic": "<topic>", "cards": [{"q": "<question>", "a": "<answer>"}]}. Use when user says "make flashcards", "create quiz", "study cards for".
- meeting_notes: Save structured meeting notes. Params: {"title": "<meeting title>", "attendees": ["<name>"], "agenda": "<agenda>", "notes": "<notes>", "action_items": ["<item>"]}. Use when user says "save meeting notes", "meeting summary", "record this meeting".
- code_review: Review code for bugs and improvements. Params: {"code": "<code>", "language": "<lang>", "focus": "<what to check>"}. Use when user says "review this code", "check my code", "what's wrong with".
- github_pr: Generate a PR description. Params: {"title": "<PR title>", "changes": "<what changed>", "branch": "<branch>", "base": "main"}. Use when user says "write PR description", "create pull request description", "PR for".
- seo_audit: Audit a website's SEO. Params: {"url": "<URL>"}. Use when user says "check SEO", "audit SEO", "how's my SEO", "SEO score".
- generate_social_post: Write a social media post. Params: {"topic": "<topic>", "platform": "twitter|linkedin|instagram|facebook", "tone": "professional|casual|funny|inspiring"}. Use when user says "write a tweet", "LinkedIn post", "social post about".
- create_automation: Create a new automation workflow. Params: {"name": "<name>", "description": "<desc>", "trigger": "manual|daily|weekly", "steps": [{"action": "<tool>", "params": {}}]}. Use when user says "create automation", "set up workflow", "automate this".
- youtube_summarize: Summarize a YouTube video. Params: {"url": "<YouTube URL>"}. Use when user says "summarize this video", "what's this YouTube about", "YouTube summary".
- get_briefing: Get a daily or weekly briefing. Params: {"type": "daily|weekly"}. Use when user says "morning briefing", "daily summary", "what's on my agenda", "weekly report".
- list_workflows: List all automations. Params: {}. Use when user says "show my automations", "list workflows", "what automations do I have".
- run_workflow: Run an automation by ID. Params: {"workflowId": <number>}. Use when user says "run automation #N", "execute workflow", "trigger workflow N".
- generate_video_story: Write a video story script. Params: {"topic": "<topic>", "style": "cinematic|documentary|comedy|dramatic", "duration_sec": 60}. Use when user says "write a video script", "video story for", "create video content".
- summarize_url: Summarize a web page. Params: {"url": "<URL>", "format": "bullets|paragraph|tldr"}. Use when user says "summarize this URL", "what's on this page", "TL;DR this link".
- track_expense: Log an expense. Params: {"amount": <number>, "category": "food|transport|shopping|entertainment|health|utilities|rent|education|travel|other", "description": "<what was bought>", "currency": "USD"}. Use when user says "I spent X on Y", "log $X for food", "add expense: X", "paid X for Y".
- list_expenses: List expenses. Params: {"period": "today|week|month|all", "category": "<optional filter>"}. Use when user says "show my expenses", "how much did I spend", "spending report", "what have I bought".
- set_budget: Set a spending budget. Params: {"category": "food|total|...", "amount": <number>, "period": "daily|weekly|monthly"}. Use when user says "set budget", "spending limit", "my food budget is X".

Only call tools when the user explicitly requests an action. Do not chain more than 3 tool calls in one response.`;

// ---- Tool Trigger Detection ----
// Detects phrases that should bypass the bridge and use the ReAct loop directly,
// ensuring TOOL_INSTRUCTIONS are available and actions are executed.
function hasToolTrigger(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    // Notes
    /\b(save\s+(a\s+)?note|take\s+note|note\s+(this|it)|write\s+(this|it)\s+down|remember\s+this|jot\s+(this|it)|save\s+this)\b/i.test(lower) ||
    /\bsearch\s+(my\s+)?notes?\b/i.test(lower) ||
    /\bfind\s+(my\s+)?note\b/i.test(lower) ||
    // Habits — catch "log my workout", "track my running", "did my yoga", "morning workout done"
    /\b(track|log|mark|did|done|completed?|finished?)\s+(my\s+)?\w+\s+(habit|workout|exercise|run|yoga|meditation|reading|study|training)\b/i.test(lower) ||
    /\b(track|log|mark|did|done|completed?)\s+(my\s+)?habit\b/i.test(lower) ||
    /\bi\s+(did|completed?|finished?|tracked?)\s+(my\s+)?\w/i.test(lower) ||
    /\b(morning|evening|daily)\s+(workout|run|exercise|yoga|meditation|routine)\s+(done|completed?|logged?|tracked?)\b/i.test(lower) ||
    /\b(log|track)\s+(morning|evening|daily|my)\s+\w+(ing)?\b/i.test(lower) ||
    // Focus
    /\b(start\s+focus|pomodoro|focus\s+mode|focus\s+(session|timer)|i\s+need\s+to\s+focus)\b/i.test(lower) ||
    // Flashcards
    /\b(make|create|generate)\s+flashcards?\b/i.test(lower) ||
    /\bstudy\s+cards?\b/i.test(lower) ||
    // Meeting notes
    /\b(save|take|record|write)\s+(meeting\s+notes?|minutes)\b/i.test(lower) ||
    /\bmeeting\s+(summary|recap|notes?)\b/i.test(lower) ||
    // Code review
    /\b(review|check|analyse?|audit)\s+(this|my)?\s+code\b/i.test(lower) ||
    // PR
    /\b(write|create|generate)\s+(a\s+)?pr\s+(description|summary)\b/i.test(lower) ||
    /\bpull\s+request\s+description\b/i.test(lower) ||
    // SEO
    /\b(check|audit|analyse?|analyse?)\s+(seo|my\s+seo)\b/i.test(lower) ||
    /\bseo\s+(score|audit|check)\b/i.test(lower) ||
    // Social posts
    /\b(write|create|generate)\s+(a\s+)?(tweet|linkedin|instagram|facebook)\s+post\b/i.test(lower) ||
    /\bsocial\s+(media\s+)?post\b/i.test(lower) ||
    // Automation
    /\b(create|set\s+up|add)\s+(an?\s+)?automation\b/i.test(lower) ||
    /\b(create|set\s+up|build)\s+(a\s+)?workflow\b/i.test(lower) ||
    // YouTube
    /\b(summarize|summarise)\s+(this\s+)?(youtube|video)\b/i.test(lower) ||
    /\byoutube\s+summary\b/i.test(lower) ||
    // Briefing
    /\b(morning|daily|weekly)\s+briefing\b/i.test(lower) ||
    /\b(show|give)\s+(me\s+)?(my\s+)?(daily|weekly)?\s+(briefing|agenda|summary|report)\b/i.test(lower) ||
    /\bwhat.{0,20}(my\s+)?agenda\b/i.test(lower) ||
    // Workflows
    /\b(show|list)\s+(my\s+)?automations?\b/i.test(lower) ||
    /\blist\s+(my\s+)?workflows?\b/i.test(lower) ||
    /\brun\s+(automation|workflow)\s*(#?\d+)?\b/i.test(lower) ||
    // Video story
    /\b(write|create|generate)\s+(a\s+)?(video\s+story|video\s+script)\b/i.test(lower) ||
    // Summarize URL
    /\b(summarize|tldr|tl;dr|summarise)\s+(this\s+)?(url|link|page|article|website)\b/i.test(lower) ||
    // Expenses
    /\b(track|log|add|record|spent?|paid?)\s+(an?\s+)?(expense|purchase|payment)\b/i.test(lower) ||
    /\bi\s+(spent|paid|bought|purchased)\s+[$₹€£]?\d/i.test(lower) ||
    /\b[$₹€£]\d+(\.\d+)?\s+(on|for)\s+\w/i.test(lower) ||
    /\bshow\s+(my\s+)?(spending|expenses|purchases)\b/i.test(lower) ||
    /\b(how\s+much\s+(have\s+i\s+)?spent|my\s+expenses|expense\s+(report|summary|tracker))\b/i.test(lower) ||
    /\b(set\s+)?(monthly|weekly|daily)?\s*(budget|spending\s+limit)\b/i.test(lower)
  );
}

// ---- Named Agent Detection ----
// Detects when the user addresses a specific named agent by name.
// Returns the personality ID to use, or null if no named agent detected.
function detectNamedAgent(message: string): string | null {
  const lower = message.toLowerCase().trim();
  // Check for "hey <name>", "<name>,", "<name>:", "@<name>" patterns
  const AGENT_NAMES: Record<string, string> = {
    aria: 'aria',
    forge: 'forge',
    pulse: 'pulse',
    echo: 'echo',
    cal: 'cal',
    nova: 'nova',
    edith: 'edith',
    jarvis: 'jarvis',
    weebo: 'weebo',
  };
  for (const [name, personalityId] of Object.entries(AGENT_NAMES)) {
    // Match: "hey aria", "aria,", "aria:", "@aria", "ask aria", "tell aria"
    const patterns = [
      new RegExp(`^(?:hey|hi|ok|ask|tell|use)?\\s*${name}[,:\\s]`, 'i'),
      new RegExp(`^@${name}\\b`, 'i'),
      new RegExp(`\\b${name}[,:]\\s`, 'i'),
    ];
    if (patterns.some(p => p.test(lower))) return personalityId;
  }
  return null;
}

// ---- Task Intent Detection ----

function detectTaskIntent(message: string): boolean {
  const lower = message.toLowerCase().trim();
  if (lower.endsWith('?') || lower.split(' ').length < 3) return false;
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

/** Check if a message with a task intent also has a content request (mixed intent).
 *  e.g. "Give me a workout plan and remind me to start Monday" */
function hasMixedContent(message: string): boolean {
  const lower = message.toLowerCase();
  const hasContentRequest = /\b(?:give|create|make|build|explain|list|show|tell|help|write|suggest|recommend|what|how|why|describe|generate)\b/i.test(lower);
  const hasConjunction = /\b(?:and|also|but also|plus|then|as well|additionally)\b/i.test(lower);
  return hasContentRequest && hasConjunction;
}

// ---- Types ----

export interface NormalizedMessage {
  channel: 'telegram' | 'whatsapp';
  externalId: string;
  text: string;
  messageId?: string;
  senderName?: string;
  timestamp: string;
  requestId?: string;  // For tracing through the pipeline
}

interface ChannelResponse {
  channel: string;
  externalId: string;
  text: string;
  replyToMessageId?: string;
}

interface ResolvedUser {
  userId: string;
  agentConfig: Record<string, unknown> | undefined;
  user: Record<string, unknown>;
  subscription: { credits_remaining: number; billing_cycle_end: string } | null;
}

// ---- User Resolution ----

function resolveUserFromChannel(channel: string, externalId: string): ResolvedUser | null {
  const link = db.prepare(
    'SELECT user_id FROM channel_links WHERE channel = ? AND external_id = ? AND is_verified = 1'
  ).get(channel, externalId) as { user_id: string } | undefined;

  if (!link) return null;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(link.user_id) as Record<string, unknown> | undefined;
  if (!user) return null;

  const agentConfig = db.prepare('SELECT * FROM agent_configs WHERE user_id = ?')
    .get(link.user_id) as Record<string, unknown> | undefined;
  const subscription = db.prepare('SELECT credits_remaining, billing_cycle_end FROM subscriptions WHERE user_id = ?')
    .get(link.user_id) as { credits_remaining: number; billing_cycle_end: string } | null;

  return { userId: link.user_id, agentConfig, user, subscription };
}

// ---- Channel-Aware System Prompt ----

export function buildChannelSystemPrompt(
  agentConfig: Record<string, unknown> | undefined,
  user: Record<string, unknown>,
  userId: string,
  channel: string,
  userMessage?: string,
): string {
  const personalityId = (agentConfig?.personality as string) || 'jarvis';
  const personalityPrompt = getPersonalityPrompt(personalityId);
  const agentName = (agentConfig?.name as string) || getPersonality(personalityId).name;
  const voice = (agentConfig?.voice as string) || 'friendly';
  const mode = (agentConfig?.mode as string) || 'builder';
  const userName = (user?.name as string) || 'there';
  const memoryBlock = buildMemoryContext(userId, userMessage);

  // Inject actual current datetime in user's local timezone so the LLM never guesses time.
  const userTzRow = db.prepare('SELECT timezone FROM users WHERE id = ?').get(userId) as { timezone?: string } | undefined;
  const userTimezone = userTzRow?.timezone || 'Asia/Kolkata';
  const nowLocal = DateTime.now().setZone(userTimezone);
  const localTimeString = nowLocal.toFormat("cccc, LLLL d, yyyy 'at' h:mm a z");

  return `LANGUAGE RULE: Detect the language the user writes or speaks in. ALWAYS reply in that exact language — no exceptions. Hindi message → reply in Hindi. Telugu message → reply in Telugu. English message → reply in English. Never switch to a different language unless the user does first.

YOUR IDENTITY: Your name is ${agentName}. If anyone asks who you are, what your name is, or what to call you, answer with your name: ${agentName}.

${OPENCLAW_IDENTITY_COMPACT}

--- PERSONALITY ---
${personalityPrompt}

--- USER SESSION ---
User: ${userName}. Voice: ${voice}. Mode: ${mode}.
Channel: ${channel}. This is a messaging app — keep responses SHORT and mobile-friendly.${memoryBlock}

--- CURRENT DATE & TIME ---
Right now it is: ${localTimeString}. Use this exact time when the user asks what time or date it is. Do NOT guess or infer from other context.

IMPORTANT: Max 2-3 sentences for simple questions. No markdown formatting (no **, no ##, no bullet lists). Plain text only. Be concise.
${TOOL_INSTRUCTIONS}`;
}

// ---- Channel Reply Builder (exported for testing) ----

/**
 * Appends action summaries to the LLM reply text for channel delivery.
 * Deduplicates: skips messages already present in finalReply.
 */
export function buildActionChannelSuffix(finalReply: string, actionResults: ActionResult[]): string {
  let channelReply = finalReply;
  const seenSummaries = new Set<string>();
  for (const ar of actionResults) {
    if (!ar.success) continue;
    if (ar.tool === 'generate_code') {
      if (ar.artifactId) {
        if (ar.previewUrl) {
          channelReply += `\n🔗 Preview: ${ar.previewUrl}`;
          channelReply += `\nAlso saved to your Projects.`;
        } else {
          channelReply += `\nSaved to your Projects — open your dashboard to preview.`;
        }
      }
      continue;
    }
    if (ar.tool === 'generate_image' && ar.imageUrl) {
      // Image is sent as a native Telegram photo (see step 11b); skip raw URL in text.
      // For WhatsApp: sendWhatsAppImage is not yet implemented — no text fallback to avoid raw paths.
      continue;
    }
    if (ar.tool === 'generate_video' && ar.videoUrl) {
      // Video is sent as a native Telegram video (see step 11b); skip raw URL in text.
      continue;
    }
    // For all other actions: append confirmation only if not already in the reply
    if (ar.message && !seenSummaries.has(ar.message) && !finalReply.includes(ar.message)) {
      channelReply += `\n\n✅ ${ar.message}`;
      seenSummaries.add(ar.message);
    }
  }
  return channelReply;
}

// ---- Main Handler ----

export async function handleIncomingMessage(msg: NormalizedMessage): Promise<void> {
  const startTime = Date.now();
  const requestId = msg.requestId || uuid(); // Generate if not provided

  logger.info({ requestId, channel: msg.channel, externalId: msg.externalId }, 'Processing incoming message');

  // 1. Resolve user
  const resolved = resolveUserFromChannel(msg.channel, msg.externalId);

  if (!resolved) {
    logger.info({ requestId, channel: msg.channel }, 'No linked user found');
    await sendUnlinkedResponse(msg);
    return;
  }

  const { userId, agentConfig, user, subscription } = resolved;
  logger.debug({ requestId, userId }, 'User resolved');

  // 2. Check credits
  if (subscription && subscription.credits_remaining <= 0) {
    logger.info({ requestId, userId }, 'User has no credits');
    await sendChannelResponse({
      channel: msg.channel,
      externalId: msg.externalId,
      text: `You've used all your credits for this cycle. They reset on ${subscription.billing_cycle_end.split('T')[0]}.`,
      replyToMessageId: msg.messageId,
    });
    return;
  }

  // 3. Update last_message_at in channel_links + last_sync in integrations (78.6: reflect real activity time)
  const now = new Date().toISOString();
  db.prepare('UPDATE channel_links SET last_message_at = ? WHERE channel = ? AND external_id = ?')
    .run(now, msg.channel, msg.externalId);
  db.prepare("UPDATE integrations SET last_sync = ? WHERE user_id = ? AND type = ?")
    .run(now, userId, msg.channel);

  // Capture conversation history BEFORE logging current message (prevents duplication in LLM context)
  const history = getConversationContext(userId);

  // 4. Log user message + extract memories
  logConversation(userId, 'user', msg.text, requestId);
  extractMemories(userId, msg.text);
  logger.debug({ requestId, userId }, 'Activity logged and memories extracted');

  // 4b. Inbox side-effect: store incoming channel message (non-blocking)
  try {
    addInboxMessage(userId, msg.channel, msg.senderName || msg.externalId, msg.text);
  } catch (e) {
    logger.warn({ err: (e as Error).message }, 'Failed to add message to inbox');
  }

  // 4c. Safety content filter — block sexual violence, drugging, and other severe harm BEFORE LLM
  const safetyResult = checkContentSafety(msg.text, userId);
  if (safetyResult.blocked) {
    logger.warn({ requestId, userId, flags: safetyResult.flags }, 'content-filter: message blocked');
    await sendChannelResponse({
      channel: msg.channel,
      externalId: msg.externalId,
      text: "I'm not able to help with that. If you're in distress or need support, please contact a crisis helpline.",
      replyToMessageId: msg.messageId,
    });
    return;
  }

  // 5. Fire keyword automation triggers (non-blocking)
  checkKeywordTriggers(userId, msg.text).catch((e: unknown) => logger.debug({ err: (e as Error).message }, 'keyword trigger bg error'));

  // 5a. Website builder fast-path — detect website creation/edit intent directly
  //     and execute generate_code without LLM to bypass model format unreliability
  {
    const createWebsitePattern = /\b(?:build|create|make|generate)\b.{0,80}\b(?:website|site|portfolio|landing|blog|page)\b/i;
    const editWebsitePattern = /\b(?:change|update|edit|modify|redesign|redo|refresh|revamp|adjust|tweak|rebuild)\b.{0,80}\b(?:website|site|portfolio|landing|blog|page|theme|background|color)\b/i;

    if (createWebsitePattern.test(msg.text) || editWebsitePattern.test(msg.text)) {
      try {
        const text = msg.text.toLowerCase();
        // Extract params from message
        const nameMatch = msg.text.match(/\b(?:for|name is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/)
          ?? msg.text.match(/\bmy name is\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\b/i)
          ?? msg.text.match(/\b[Ii][''\u2019]m\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/); // "I'm Aliya Shaikh"
        const themeMatch = text.match(/\b(dark|light|purple|blue|gradient)\b/);
        const templateMatch = text.match(/\b(landing|blog|business)\b/);
        const locationMatch = msg.text.match(/\bfrom\s+([A-Z][a-zA-Z\s]{2,20})\b/)
          ?? msg.text.match(/\bin\s+([A-Z][a-zA-Z\s]{2,20})(?:[,.]|$)/); // "in Mumbai"
        const professionMatch = msg.text.match(/\b(developer|designer|engineer|writer|photographer|artist|consultant|manager|teacher|doctor|lawyer|freelancer)\b/i);
        // Extract comma-separated skills: "Skills: Figma, Adobe CC, React" or "skills are Figma and React"
        const skillsRaw = msg.text.match(/\bskills?[:\s]+([A-Za-z0-9 ,&/]+?)(?:\.|theme|dark|light|\n|$)/i)?.[1];
        const skillsMatch = skillsRaw ? skillsRaw.split(/[,&]/).map(s => s.trim()).filter(s => s.length > 1) : null;

        const isEdit = editWebsitePattern.test(msg.text) && !createWebsitePattern.test(msg.text);

        const { executeAction } = await import('./action-executor.js');
        const baseUrl = config.apiUrl || `https://api.agentin.chat`;

        // For edits, check the existing artifact's metadata to determine if it's template-based
        // or custom (LLM-generated). Template artifacts have a 'template' key; custom do not.
        let editTargetId: string | undefined;
        let editTargetIsTemplate = false;
        if (isEdit) {
          const latest = db.prepare(
            'SELECT id, metadata FROM generated_artifacts WHERE user_id = ? ORDER BY created_at DESC LIMIT 1'
          ).get(userId) as { id: string; metadata: string } | undefined;
          if (latest) {
            editTargetId = latest.id;
            try { editTargetIsTemplate = !!JSON.parse(latest.metadata || '{}').template; } catch { /* ignore */ }
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
            /\b(my (portfolio|blog|website|site|page|landing)|portfolio (website|site|page))\b/i.test(msg.text)
          ));

        let artifactParams: Record<string, unknown>;
        if (isPersonalTemplate) {
          artifactParams = {
            template: templateMatch?.[1] || 'portfolio',
            theme: themeMatch?.[1] || 'dark',
            baseUrl,
            selfDestruct: false,
          };
          if (nameMatch?.[1]) artifactParams.name = nameMatch[1];
          if (locationMatch?.[1]) artifactParams.location = locationMatch[1].trim();
          if (professionMatch?.[1]) artifactParams.profession = professionMatch[1];
          if (skillsMatch?.length) artifactParams.skills = skillsMatch;
        } else {
          // Custom/freeform — LLM generates or edits HTML. For edits, action-executor
          // loads the existing HTML and passes it to the LLM as context.
          artifactParams = { prompt: msg.text, baseUrl, selfDestruct: false };
        }

        if (editTargetId) {
          artifactParams.existingArtifactId = editTargetId;
        }

        const result = await executeAction(userId, { tool: 'generate_code', params: artifactParams });

        if (result.success) {
          const isUpdated = isEdit && (result.data as Record<string, unknown>)?.updated;
          let reply = isUpdated
            ? `Updated! Here's your refreshed site:`
            : `Here's your website!`;
          if (result.previewUrl) {
            reply += `\n🔗 Preview: ${result.previewUrl}\nAlso saved to your Projects.`;
          }
          logConversation(userId, 'user', msg.text, requestId);
          logConversation(userId, 'assistant', reply, requestId, 'builtin', 'website-builder');
          await sendChannelResponse({ channel: msg.channel, externalId: msg.externalId, text: reply });
          logger.info({ channel: msg.channel, userId, artifactId: result.artifactId, isEdit }, 'Website builder fast-path executed');
          return;
        }
      } catch (e) {
        logger.warn({ err: (e as Error).message }, 'Website builder fast-path failed, falling through to LLM');
      }
    }
  }

  // 5aa. Reminder delete fast-path — directly delete pending reminders without LLM
  {
    const deleteAllPattern = /\b(?:cancel|delete|remove|clear|wipe)\b.{0,40}\b(?:all|every).{0,20}\b(?:reminder|reminders|alarm|alarms)\b/i;
    const deleteSinglePattern = /\b(?:cancel|delete|remove)\b.{0,40}\b(?:reminder|alarm)\b/i;
    if (deleteAllPattern.test(msg.text)) {
      const { changes } = db.prepare('DELETE FROM reminders WHERE user_id = ? AND completed = 0').run(userId);
      const reply = changes > 0 ? `Done! Deleted ${changes} pending reminder${changes !== 1 ? 's' : ''}.` : `You don't have any pending reminders to delete.`;
      logConversation(userId, 'user', msg.text, requestId);
      logConversation(userId, 'assistant', reply, requestId, 'builtin', 'delete-reminder');
      await sendChannelResponse({ channel: msg.channel, externalId: msg.externalId, text: reply });
      logger.info({ channel: msg.channel, userId, changes }, 'Reminder delete-all fast-path executed');
      return;
    }
    // "cancel reminder 3" or "delete my last reminder" — pass to LLM (needs context)
    // Only delete-all gets the fast-path since it doesn't need specific reminderId
    if (deleteSinglePattern.test(msg.text) && /\b(last|latest|that|this|it)\b/i.test(msg.text)) {
      // Fetch the most recent non-completed reminder and delete it
      const last = db.prepare('SELECT id, text FROM reminders WHERE user_id = ? AND completed = 0 ORDER BY created_at DESC LIMIT 1').get(userId) as { id: string; text: string } | undefined;
      if (last) {
        db.prepare('DELETE FROM reminders WHERE id = ?').run(last.id);
        const reply = `Cancelled: "${last.text}"`;
        logConversation(userId, 'user', msg.text, requestId);
        logConversation(userId, 'assistant', reply, requestId, 'builtin', 'delete-reminder');
        await sendChannelResponse({ channel: msg.channel, externalId: msg.externalId, text: reply });
        return;
      }
    }
  }

  // 5ab. List reminders fast-path — query DB directly, never hallucinate
  {
    const listPattern = /\b(?:what|show|list|any|do i have|see my)\b.{0,30}\b(?:reminder|reminders|alarm|alarms)\b/i;
    const altPattern = /\b(?:reminder|reminders).*\b(?:do i have|i have|pending|scheduled|upcoming)\b/i;
    if (listPattern.test(msg.text) || altPattern.test(msg.text)) {
      const rows = db.prepare(`
        SELECT text, datetime as scheduled_time FROM reminders
        WHERE user_id = ? AND completed = 0
        ORDER BY datetime ASC LIMIT 10
      `).all(userId) as Array<{text:string; scheduled_time:string}>;

      let reply: string;
      if (rows.length === 0) {
        reply = "You have no pending reminders.";
      } else {
        const { DateTime: DT } = await import('luxon');
        const userTz = (db.prepare('SELECT timezone FROM users WHERE id = ?').get(userId) as {timezone?:string} | undefined)?.timezone || 'Asia/Kolkata';
        const list = rows.map((r, i) => {
          let time = r.scheduled_time;
          try { time = DT.fromSQL(r.scheduled_time, {zone:'utc'}).setZone(userTz).toFormat('dd MMM, h:mm a'); } catch { /* raw */ }
          return `${i + 1}. ${r.text} — ${time}`;
        }).join('\n');
        reply = `Your ${rows.length} pending reminder${rows.length !== 1 ? 's' : ''}:\n${list}`;
      }
      logConversation(userId, 'user', msg.text, requestId);
      logConversation(userId, 'assistant', reply, requestId, 'builtin', 'list-reminders');
      await sendChannelResponse({ channel: msg.channel, externalId: msg.externalId, text: reply });
      logger.info({ channel: msg.channel, userId, count: rows.length }, 'Reminder list fast-path executed');
      return;
    }
  }

  // 5ac. Image generation fast-path — detect image creation intent and execute directly
  {
    // Pattern 1: verb + image-type-word (broad verbs, requires explicit image noun)
    const imageVerbNounPattern = /\b(?:generate|create|make|render|produce|show me|i want|give me|can you make|imagine|visualize)\b.{0,60}\b(?:image|picture|photo|illustration|artwork|art|painting|portrait|wallpaper|sketch)\b/i;
    // Pattern 2: drawing verbs alone — draw/paint/sketch inherently mean image creation
    const drawingVerbPattern = /\b(?:draw|paint|sketch|imagine|visualize)\b\s+\S/i;
    // Guard: skip if this is clearly a reminder/task message
    const isReminderMsg = /\b(?:remind|reminder|schedule|alarm)\b/i.test(msg.text);

    if (!isReminderMsg && (imageVerbNounPattern.test(msg.text) || drawingVerbPattern.test(msg.text))) {
      try {
        const { executeAction: execImg } = await import('./action-executor.js');
        const promptMatch = msg.text.match(/\b(?:generate|create|make|draw|render|produce|show me|i want|give me|can you make|can you draw|paint|sketch|imagine|visualize)\b.{0,20}\b(?:image|picture|photo|illustration|artwork|art|drawing|painting|portrait|wallpaper|sketch)\b(?:\s+of\s+|\s+showing\s+|\s+with\s+|\s+)?([\s\S]+)/i)
          ?? msg.text.match(/\b(?:draw|paint|sketch|imagine|visualize)\b\s+(?:me\s+)?(?:a\s+|an\s+|the\s+)?([\s\S]+)/i);
        const rawPrompt = promptMatch?.[1]?.trim() || msg.text;
        const prompt = rawPrompt.replace(/^(?:a\s+|an\s+|the\s+|me\s+)/i, '').trim() || msg.text;

        const imgResult = await execImg(userId, { tool: 'generate_image', params: { prompt } });

        if (imgResult.success && imgResult.imageUrl) {
          const absoluteUrl = imgResult.imageUrl.startsWith('http')
            ? imgResult.imageUrl
            : `${config.apiUrl}${imgResult.imageUrl}`;

          const reply = `Here's your image!`;
          logConversation(userId, 'user', msg.text, requestId);
          logConversation(userId, 'assistant', reply, requestId, 'builtin', 'image-generator');

          await sendTelegramMessage(msg.externalId, reply).catch(() => {});
          await sendTelegramPhoto(msg.externalId, absoluteUrl).catch((e: unknown) =>
            logger.warn({ err: (e as Error).message }, 'Image fast-path: failed to send photo'),
          );
          logger.info({ channel: msg.channel, userId, prompt }, 'Image generation fast-path executed');
          return;
        }
      } catch (e) {
        logger.warn({ err: (e as Error).message }, 'Image generation fast-path failed, falling through to LLM');
      }
    }
  }

  // 5ac. Screenshot fast-path — detect screenshot intent and execute directly
  {
    const screenshotIntent = /\b(?:take|capture|get|show|grab)\s+(?:a\s+)?screenshot\s+(?:of|from)\b|\bscreenshot\s+of\b/i;
    if (screenshotIntent.test(msg.text)) {
      const urlMatch = msg.text.match(/https?:\/\/\S+/) ?? msg.text.match(/\b([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+\.[a-zA-Z]{2,})\b/);
      let targetUrl = urlMatch?.[0] ?? '';
      if (targetUrl && !targetUrl.startsWith('http')) targetUrl = `https://${targetUrl}`;
      if (targetUrl) {
        try {
          const { fetchScreenshot } = await import('./web-research.js');
          const base64Png = await fetchScreenshot(targetUrl);
          // Compress PNG → JPEG to stay within Telegram's 10MB photo limit
          const photoData = await compressScreenshot(base64Png).catch(() => `data:image/png;base64,${base64Png}`);
          const reply = `Here's the screenshot of ${targetUrl}!`;
          logConversation(userId, 'user', msg.text, requestId);
          logConversation(userId, 'assistant', reply, requestId, 'builtin', 'screenshot');
          await sendTelegramMessage(msg.externalId, reply).catch(() => {});
          await sendTelegramPhoto(msg.externalId, photoData).catch((e: unknown) =>
            logger.warn({ err: (e as Error).message }, 'Screenshot fast-path: failed to send photo'),
          );
          logger.info({ channel: msg.channel, userId, url: targetUrl }, 'Screenshot fast-path executed');
          return;
        } catch (e) {
          logger.warn({ err: (e as Error).message }, 'Screenshot fast-path failed, falling through to LLM');
        }
      }
    }
  }

  // 5ad. Links fast-path — extract all links from a webpage
  {
    const linksIntent = /\b(?:get|extract|list|show|find|give me)\s+(?:all\s+)?(?:the\s+)?links\s+(?:from|on|in|of)\b|\ball links\s+(?:from|on|in|of)\b/i;
    if (linksIntent.test(msg.text)) {
      const urlMatch = msg.text.match(/https?:\/\/\S+/) ?? msg.text.match(/\b([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+\.[a-zA-Z]{2,})\b/);
      let targetUrl = urlMatch?.[0] ?? '';
      if (targetUrl && !targetUrl.startsWith('http')) targetUrl = `https://${targetUrl}`;
      if (targetUrl) {
        try {
          const { extractLinks } = await import('./web-research.js');
          const links = await extractLinks(targetUrl);
          const linkList = links.slice(0, 20).map(l => `• ${l.text}: ${l.href}`).join('\n');
          const reply = `Found ${links.length} links on ${targetUrl}:\n\n${linkList}`;
          logConversation(userId, 'user', msg.text, requestId);
          logConversation(userId, 'assistant', reply, requestId, 'builtin', 'links');
          await sendChannelResponse({ channel: msg.channel, externalId: msg.externalId, text: reply });
          logger.info({ channel: msg.channel, userId, url: targetUrl, count: links.length }, 'Links fast-path executed');
          return;
        } catch (e) {
          logger.warn({ err: (e as Error).message }, 'Links fast-path failed, falling through to LLM');
        }
      }
    }
  }

  // 5ae. get_briefing fast-path — assemble stats without LLM
  {
    const briefingPattern = /\b(morning|daily|weekly)\s+briefing\b|\b(show|give)\s+(me\s+)?(my\s+)?(daily|weekly)?\s+(briefing|agenda)\b|\bwhat.{0,20}on\s+my\s+agenda\b/i;
    if (briefingPattern.test(msg.text)) {
      const isWeekly = /weekly/i.test(msg.text);
      const type = isWeekly ? 'weekly' : 'daily';
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const since = isWeekly ? now - 7 * dayMs : now - dayMs;
      const pendingReminders = (db.prepare(`SELECT COUNT(*) as n FROM reminders WHERE user_id = ? AND completed = 0`).get(userId) as { n: number }).n;
      const habitsDone = (db.prepare(`SELECT COUNT(*) as n FROM habit_logs WHERE user_id = ? AND logged_at > ?`).get(userId, since) as { n: number }).n;
      const notesSaved = (db.prepare(`SELECT COUNT(*) as n FROM notes WHERE user_id = ? AND created_at > ? AND archived = 0`).get(userId, since) as { n: number }).n;
      const focusSessions = (db.prepare(`SELECT COUNT(*) as n, SUM(duration_min) as total FROM focus_sessions WHERE user_id = ? AND started_at > ?`).get(userId, since) as { n: number; total: number | null });
      const upcomingReminders = db.prepare(`SELECT text, datetime FROM reminders WHERE user_id = ? AND completed = 0 ORDER BY datetime ASC LIMIT 3`).all(userId) as Array<{ text: string; datetime: string }>;
      const recentNotes = db.prepare(`SELECT title FROM notes WHERE user_id = ? AND archived = 0 ORDER BY updated_at DESC LIMIT 3`).all(userId) as Array<{ title: string }>;
      const lines: string[] = [
        `Your ${type} briefing:`,
        `• Pending reminders: ${pendingReminders}`,
        `• Habits logged (${isWeekly ? '7 days' : 'today'}): ${habitsDone}`,
        `• Notes saved: ${notesSaved}`,
        `• Focus sessions: ${focusSessions.n}${focusSessions.total ? ` (${focusSessions.total} min)` : ''}`,
      ];
      if (upcomingReminders.length) {
        lines.push('', 'Upcoming:');
        upcomingReminders.forEach(r => {
          let t = r.datetime;
          try { t = new Date(r.datetime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' }); } catch { }
          lines.push(`  ${r.text} — ${t}`);
        });
      }
      if (recentNotes.length) lines.push('', `Recent notes: ${recentNotes.map(n => n.title).join(', ')}`);
      const reply = lines.join('\n');
      logConversation(userId, 'user', msg.text, requestId);
      logConversation(userId, 'assistant', reply, requestId, 'builtin', 'briefing');
      await sendChannelResponse({ channel: msg.channel, externalId: msg.externalId, text: reply });
      logger.info({ channel: msg.channel, userId }, 'Briefing fast-path executed');
      return;
    }
  }

  // 5af. list_workflows fast-path — list DB workflows without LLM
  {
    const listWfPattern = /\b(show|list|what)\s+(are\s+)?(my\s+)?(automations?|workflows?)\b/i;
    if (listWfPattern.test(msg.text)) {
      const rows = db.prepare(`SELECT id, name, trigger, enabled FROM user_workflows WHERE user_id = ? ORDER BY created_at DESC LIMIT 15`).all(userId) as Array<{id:number; name:string; trigger:string; enabled:number}>;
      let reply: string;
      if (rows.length === 0) {
        reply = 'You have no automations yet. Say "create automation" to make one.';
      } else {
        const list = rows.map((w, i) => `${i + 1}. ${w.enabled ? '✓' : '⏸'} ${w.name} (id:${w.id}, trigger:${w.trigger})`).join('\n');
        reply = `Your automations (${rows.length}):\n${list}`;
      }
      logConversation(userId, 'user', msg.text, requestId);
      logConversation(userId, 'assistant', reply, requestId, 'builtin', 'list-workflows');
      await sendChannelResponse({ channel: msg.channel, externalId: msg.externalId, text: reply });
      logger.info({ channel: msg.channel, userId, count: rows.length }, 'List workflows fast-path executed');
      return;
    }
  }

  // 5b. Auto-detect task intents (remind, telegram, deploy) — route to Pico Fleet
  // For mixed-intent messages (e.g. "Give me a workout plan and remind me"),
  // queue the tasks but continue to LLM for the content response.
  let taskConfirmation = '';
  if (detectTaskIntent(msg.text)) {
    try {
      const { planTasks, queueTasks } = await import('./pico-fleet.js');
      const userPlan = (subscription as Record<string, unknown>)?.plan as string || 'free';
      const { tasks } = await planTasks(userId, msg.text, userPlan);
      if (tasks.length > 0) {
        const taskIds = queueTasks(userId, tasks, 'weebo', requestId);
        const summary = tasks.map((t: { task_type: string; description: string }) =>
          `${t.task_type.replace(/_/g, ' ')}: ${t.description}`).join('\n');
        logger.info({ requestId, taskCount: taskIds.length, taskIds }, 'Tasks queued from message router');

        if (hasMixedContent(msg.text)) {
          // Mixed intent — queue tasks, but continue to LLM for content
          taskConfirmation = `Done! I've queued ${taskIds.length} task(s): ${summary}\n\n`;
          logger.info({ channel: msg.channel, userId, taskCount: taskIds.length }, 'Mixed intent: tasks queued, continuing to LLM');
        } else {
          // Pure task intent — return task confirmation only
          const reply = `Done! I've queued ${taskIds.length} task(s):\n${summary}`;
          logConversation(userId, 'assistant', reply, requestId, 'builtin', 'pico-fleet');
          await sendChannelResponse({
            channel: msg.channel,
            externalId: msg.externalId,
            text: reply,
          });
          logger.info({ channel: msg.channel, userId, taskCount: taskIds.length, latencyMs: Date.now() - startTime }, 'Channel task auto-detected');
          return;
        }
      }
    } catch (e) {
      logger.warn({ err: (e as Error).message }, 'Channel task auto-detect failed, falling through to chat');
    }
  }

  // 6. Build messages for LLM
  let systemPrompt = buildChannelSystemPrompt(agentConfig, user, userId, msg.channel, msg.text);
  const userCredits = (user?.credits as number) || 0;
  // Check if user is addressing a named agent (e.g. "hey Aria,", "Forge:", "@nova")
  const namedAgent = detectNamedAgent(msg.text);
  const effectivePersonalityId = namedAgent || (agentConfig?.personality as string) || 'jarvis';
  const resolvedAgentName = namedAgent
    ? getPersonality(namedAgent).name
    : resolveAgentName(agentConfig, effectivePersonalityId);
  // If user addressed a specific named agent, rebuild system prompt with that personality
  if (namedAgent) {
    const overriddenConfig = { ...(agentConfig || {}), personality: namedAgent, name: getPersonality(namedAgent).name };
    systemPrompt = buildChannelSystemPrompt(overriddenConfig, user, userId, msg.channel, msg.text);
    systemPrompt = compressPrompt(systemPrompt);
    logger.info({ userId, namedAgent, resolvedAgentName }, 'Named agent routing: overriding personality');
  }

  // 6a. Token compression — compress system prompt + user message for LLM
  //     (msg.text kept original for logging/memory/channel delivery)
  systemPrompt = compressPrompt(systemPrompt);
  const llmUserText = compressPrompt(msg.text);

  // 6a.1 Website build/edit intent — append critical instruction so model outputs
  //       a short ACTION block instead of writing raw HTML (which hits token limits)
  const websiteIntent = /\b(?:build|create|make|generate|rebuild|update|change|edit|modify|redesign|redo|refresh|revamp|adjust|tweak)\b.{0,60}\b(?:website|site|portfolio|page|landing|blog)\b|\b(?:website|site|portfolio|page|landing|blog)\b.{0,60}\b(?:build|create|make|generate|rebuild|update|change|edit|modify|redesign|redo|refresh|revamp)\b/i;
  if (websiteIntent.test(msg.text)) {
    systemPrompt += '\n\nCRITICAL: You MUST use ONLY the generate_code tool (not portfolio_update_theme or any other tool). Output ONLY this block, nothing else:\n<<<ACTION\n{"tool":"generate_code","params":{<params>}}\nACTION>>>\nDo NOT write HTML/CSS/JS directly. Keep params JSON under 150 tokens.';
  }

  // 6b. Web search enrichment — Tavily (keyword) + crawl4ai smart search fallback
  let webSearchUsed = false;
  if (isSearchIntent(msg.text)) {
    if (process.env.TAVILY_API_KEY) {
      try {
        const searchResult = await tavilySearch(msg.text);
        if (searchResult.results.length > 0) {
          const context = searchResult.results
            .map((r) => `[${r.title}]: ${r.content}`)
            .join('\n');
          systemPrompt += `\n\nWEB_SEARCH_RESULTS:\n${context}`;
          webSearchUsed = true;
          logger.debug({ query: msg.text, resultCount: searchResult.results.length }, 'Tavily search enriched prompt');
        }
      } catch (e) {
        logger.debug({ err: (e as Error).message }, 'Tavily search failed, trying smart search fallback');
      }
    }
    // Smart search fallback: crawl4ai site-specific search (BBC, CNN, Reddit, etc.)
    if (!webSearchUsed) {
      try {
        const smartResult = await smartSearch(msg.text);
        if (smartResult) {
          systemPrompt += `\n\nWEB_SEARCH_RESULTS:\n${smartResult}`;
          webSearchUsed = true;
          logger.debug({ query: msg.text }, 'Smart search fallback enriched prompt');
        }
      } catch (e) {
        logger.debug({ err: (e as Error).message }, 'Smart search fallback failed, continuing');
      }
    }
  }

  // 6c. URL scraping enrichment via crawl4ai — runs when URL (explicit or bare domain) found in message
  //     Also handles /research <url> command
  const BARE_DOMAIN_RE_MSG = /\b([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+\.[a-zA-Z]{2,})\b/;
  const explicitResearchUrl = msg.text.startsWith('/research ')
    ? msg.text.replace('/research ', '').trim()
    : extractUrl(msg.text);
  const bareDomainInMsg = !explicitResearchUrl ? msg.text.match(BARE_DOMAIN_RE_MSG)?.[1] : null;
  const researchUrl = explicitResearchUrl || (bareDomainInMsg ? `https://${bareDomainInMsg}` : null);

  // URL scraping runs whenever a URL is present — even if Tavily searched, crawl4ai gives
  // the actual page content which Tavily results cannot replace.
  if (researchUrl) {
    try {
      const pageContent = await fetchAndExtract(researchUrl);
      if (pageContent) {
        systemPrompt += `\n\nPAGE_CONTENT [${researchUrl}]:\n${pageContent}`;
        logger.info({ url: researchUrl }, 'crawl4ai page scraped and injected into prompt');
      }
    } catch (e) {
      logger.warn({ err: (e as Error).message, url: researchUrl }, 'crawl4ai page scrape failed, continuing');
    }
  }

  // 6d. Trim conversation history to token budget (3000 token estimate)
  // For website requests: clear history entirely — prior chatty responses confuse
  // the model and cause it to ignore the ACTION block instruction.
  const trimmedHistory = websiteIntent.test(msg.text)
    ? []
    : trimConversationHistory(history, 3000) as ChatMessage[];

  // 7. Route through bridge (PicoClaw for simple, Kimi for complex) or fallback to routeChat
  let replyText: string;
  let provider: string;
  let model: string;
  let tokensIn = 0;
  let tokensOut = 0;
  let creditCost = 0;

  // Non-Latin script detection: Hindi (Devanagari), Telugu, Arabic, Tamil, Gujarati etc.
  // Chinese models (qwen3:8b, stepfun) reply in Chinese for these inputs despite instructions.
  // Route to Groq Llama 3.3 70B instead — truly multilingual.
  const hasNonLatinScript = /\p{Script=Devanagari}|\p{Script=Telugu}|\p{Script=Arabic}|\p{Script=Tamil}|\p{Script=Gujarati}/u.test(msg.text);

  // Romanized Hindi (Hinglish) detection — common Hindi words typed in Latin script.
  // e.g. "aap kaise ho", "kya haal hai", "bhai bata do"
  const HINGLISH_WORDS = new Set(['aap','kya','kaise','hai','hain','ho','mera','meri','tera','teri',
    'nahi','haan','yaar','bhai','bolo','main','tum','woh','yeh','karo','batao','samjho',
    'kitna','kahan','kab','kaun','kyun','mujhe','tumhe','apna','apni','hamara','hamari',
    'isko','usko','iski','uski','theek','accha','acha','chalo','suno','dekho','jana',
    'kuch','bahut','thoda','zyada','abhi','phir','lekin','aur','par','sirf','toh',
    'didi','bhaiya','beta','yaar','dost','mere','tere','unka','unki','naam','kaam']);
  const msgWords = msg.text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
  const hinglishMatches = msgWords.filter(w => HINGLISH_WORDS.has(w)).length;
  const hasHinglish = hinglishMatches >= 2;

  const needsGroq = hasNonLatinScript || hasHinglish;

  if (needsGroq) {
    const reason = hasNonLatinScript ? 'non-latin-script' : 'hinglish';
    logger.info({ userId, reason }, 'Multilingual input detected — routing to Groq');
    const messages: ChatMessage[] = [...trimmedHistory, { role: 'user', content: llmUserText }];
    try {
      const result = await routeChat(messages, {
        systemPrompt,
        userId,
        forceProvider: 'groq',
      });
      replyText = result.reply;
      provider = result.provider;
      model = result.model;
      tokensIn = result.tokensIn;
      tokensOut = result.tokensOut;
      creditCost = result.creditCost;
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'Groq failed for non-Latin message, falling back to ReAct loop');
      const reactResult = await runReactLoop(messages, { systemPrompt, agentName: resolvedAgentName, userCredits, userId });
      replyText = reactResult.text;
      provider = reactResult.provider;
      model = reactResult.model;
      tokensIn = reactResult.tokensIn;
      tokensOut = reactResult.tokensOut;
      creditCost = reactResult.creditCost;
    }
  } else if (config.bridgeEnabled && !researchUrl && !webSearchUsed && !hasToolTrigger(msg.text)) {
    // Use the bridge — routes trivial/simple → PicoClaw (2-5s), complex → Kimi
    // Skip bridge when URL content, web search results, or Phase 2 tool keywords are present —
    // the bridge's PicoClaw path doesn't have tool execution capabilities, and
    // the bridge's stepfun fallback ignores enriched context and outputs
    // tool_call XML instead of using PAGE_CONTENT/WEB_SEARCH_RESULTS.
    try {
      const bridgeReq: BridgeRequest = {
        userId,
        message: llmUserText,
        systemPrompt,
        conversationHistory: trimmedHistory,
        userCredits,
      };
      const bridgeResult = await bridgeChat(bridgeReq);
      replyText = bridgeResult.text;
      provider = bridgeResult.provider;
      model = bridgeResult.model;
      tokensIn = bridgeResult.tokensIn;
      tokensOut = bridgeResult.tokensOut;
      creditCost = bridgeResult.creditCost;

      logger.debug({
        route: bridgeResult.route,
        complexity: bridgeResult.complexity,
        provider,
        latencyMs: bridgeResult.latencyMs,
      }, 'Channel message routed via bridge');
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'Bridge failed for channel message, falling back to ReAct loop');
      // Fallback to ReAct loop
      const messages: ChatMessage[] = [...trimmedHistory, { role: 'user', content: llmUserText }];
      const reactResult = await runReactLoop(messages, {
        systemPrompt,
        agentName: (agentConfig?.name as string) || 'Geek',
        userCredits,
        userId,
      });
      replyText = reactResult.text;
      provider = reactResult.provider;
      model = reactResult.model;
      tokensIn = reactResult.tokensIn;
      tokensOut = reactResult.tokensOut;
      creditCost = reactResult.creditCost;
    }
  } else {
    // Bridge not enabled — use ReAct loop (routeChat + multi-turn tool use)
    const messages: ChatMessage[] = [...trimmedHistory, { role: 'user', content: llmUserText }];
    const reactResult = await runReactLoop(messages, {
      systemPrompt,
      agentName: (agentConfig?.name as string) || 'Geek',
      userCredits,
      userId,
    });
    replyText = reactResult.text;
    provider = reactResult.provider;
    model = reactResult.model;
    tokensIn = reactResult.tokensIn;
    tokensOut = reactResult.tokensOut;
    creditCost = reactResult.creditCost;
  }

  // 7b. Parse and execute actions
  const { text: cleanReply, actions: parsedActions } = parseActions(replyText);
  const actionResults: ActionResult[] = [];

  // Detect edit intent for generate_code: if user says update/change/edit/fix/modify their website,
  // look up their most recent artifact and inject existingArtifactId so the action updates it in-place.
  const editWebsiteIntent = /\b(?:update|change|edit|modify|fix|improve|redesign|redo|refresh|revamp|add to|remove from|make it|adjust|tweak)\b/i;

  for (const action of parsedActions) {
    // Inject baseUrl for generate_code actions to create preview links
    if (action.tool === 'generate_code') {
      action.params.baseUrl = config.apiUrl;
      // If user is editing (no explicit new site request), inject their latest artifact ID
      if (!action.params.existingArtifactId && editWebsiteIntent.test(msg.text)) {
        const latest = db.prepare(
          `SELECT id FROM generated_artifacts WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
        ).get(userId) as { id: string } | undefined;
        if (latest) action.params.existingArtifactId = latest.id;
      }
    }
    const actionResult = await executeAction(userId, action);
    actionResults.push(actionResult);
  }

  // Strip any remaining action-like patterns the parser missed (malformed tags, PicoClaw inline format)
  let finalReply = (cleanReply || replyText)
    .replace(/<<<?\w[\s\S]*?>>>?/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // If a generate_code action succeeded, strip raw code blocks — the artifact holds the code;
  // the user gets a preview link instead.
  const hasCodeAction = actionResults.some(ar => ar.tool === 'generate_code' && ar.success);
  if (hasCodeAction) {
    finalReply = finalReply
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // Build action summary for channel (no iframe possible).
  // Prepend 🔍 if web search was used — visible only in channel, not stored
  const channelReply = (webSearchUsed ? '🔍 ' : '') + taskConfirmation + buildActionChannelSuffix(finalReply, actionResults);

  // 8. Log usage with correct channel
  db.prepare(`INSERT INTO usage_events (id, user_id, provider, model, tokens_in, tokens_out, cost_usd, channel, tool)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ai.chat')`).run(
    uuid(), userId, provider, model,
    tokensIn, tokensOut, creditCost, msg.channel,
  );

  // A4: Structured token usage log (makes savings visible in monitoring)
  logger.info({
    model,
    promptTokens: tokensIn,
    completionTokens: tokensOut,
    totalTokens: tokensIn + tokensOut,
    compressed: true,
    webSearchUsed,
  }, 'LLM call stats');

  // 9. Deduct credits
  if (creditCost > 0) {
    db.prepare('UPDATE users SET credits = MAX(0, credits - ?) WHERE id = ?').run(creditCost, userId);
  }
  deductSubscriptionCredits(userId, creditCost);

  // 10. Log assistant response (clean text without action blocks)
  logConversation(userId, 'assistant', finalReply, requestId, provider, model);

  // Log for fine-tuning dataset (non-blocking)
  logTrainingExample({
    userId,
    input: msg.text,
    output: finalReply,
    provider,
    model,
    tokensIn,
    tokensOut,
    channel: msg.channel,
  });

  // 79.2: Fire-and-forget Ollama memory extraction (non-blocking)
  extractMemoriesWithOllama(userId, msg.text, finalReply).catch(() => { /* non-fatal */ });

  // 11. Send response back through originating channel
  await sendChannelResponse({
    channel: msg.channel,
    externalId: msg.externalId,
    text: channelReply,
    replyToMessageId: msg.messageId,
  });

  // 11b. For Telegram: send actual photo/video media for any successful generate_image/generate_video actions.
  //      Media is delivered natively so the user sees the image/video inline in the chat.
  //      Relative paths (e.g. /api/images/cache/xxx.jpg) are made absolute using config.apiUrl.
  if (msg.channel === 'telegram') {
    for (const ar of actionResults) {
      if ((ar.tool === 'generate_image' || ar.tool === 'take_screenshot') && ar.success && ar.imageUrl) {
        const absoluteUrl = ar.imageUrl.startsWith('http')
          ? ar.imageUrl
          : `${config.apiUrl}${ar.imageUrl}`;
        await sendTelegramPhoto(msg.externalId, absoluteUrl).catch((e: unknown) =>
          logger.warn({ err: (e as Error).message, chatId: msg.externalId }, 'Failed to send Telegram photo'),
        );
      } else if (ar.tool === 'generate_video' && ar.success && ar.videoUrl) {
        const absoluteUrl = ar.videoUrl.startsWith('http')
          ? ar.videoUrl
          : `${config.apiUrl}${ar.videoUrl}`;
        await sendTelegramVideo(msg.externalId, absoluteUrl).catch((e: unknown) =>
          logger.warn({ err: (e as Error).message, chatId: msg.externalId }, 'Failed to send Telegram video'),
        );
      }
    }
  }

  logger.info({
    requestId,
    channel: msg.channel,
    userId,
    provider,
    latencyMs: Date.now() - startTime,
    creditCost,
  }, 'Channel message processed');
}

// ---- Channel Dispatchers ----

export async function sendChannelResponse(response: ChannelResponse): Promise<void> {
  switch (response.channel) {
    case 'telegram':
      await sendTelegramMessage(
        response.externalId,
        response.text,
        response.replyToMessageId ? parseInt(response.replyToMessageId, 10) : undefined,
      );
      break;
    case 'whatsapp': {
      const { sendWhatsAppMessage } = await import('./whatsapp.js');
      await sendWhatsAppMessage(response.externalId, response.text, response.replyToMessageId);
      break;
    }
    default:
      logger.warn({ channel: response.channel }, 'Unknown channel for response dispatch');
  }
}

async function sendUnlinkedResponse(msg: NormalizedMessage): Promise<void> {
  const linkMessage = msg.channel === 'telegram'
    ? 'Hi! To use me, link your GeekSpace account first.\n\nUse /link <your-email> or go to your GeekSpace dashboard → Connections → Telegram.'
    : 'Hi! To use me, please link your account at your GeekSpace dashboard (Connections page).';

  await sendChannelResponse({
    channel: msg.channel,
    externalId: msg.externalId,
    text: linkMessage,
  });
}
