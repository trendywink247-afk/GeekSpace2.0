/**
 * Unified Message Router
 *
 * Central entry point for all non-web chat channels (Telegram, WhatsApp,
 * future channels). Normalises incoming messages into a common shape,
 * resolves the sender to an authenticated user, enforces credit quotas,
 * builds a channel-aware system prompt, runs the ReAct tool-use loop,
 * and delivers the final response back through the originating channel.
 *
 * **Pipeline:**
 * ```
 * incoming message
 *   -> resolve user from channel_links
 *   -> credit / quota check
 *   -> fast-path detection (research, launch mode, keyword triggers)
 *   -> buildChannelSystemPrompt() with personality + memory
 *   -> runReactLoop() (multi-turn LLM + tool execution)
 *   -> post-processing (memory extraction, training log, action cards)
 *   -> sendChannelResponse() back to Telegram / WhatsApp / etc.
 * ```
 *
 * Also exports helper utilities consumed by `agent.ts` (the web-chat
 * handler): {@link buildPersonalityInstructions}, {@link buildChannelSystemPrompt},
 * and {@link mapCreativityToTemperature}.
 *
 * @module services/message-router
 */

import { v4 as uuid } from 'uuid';
import { DateTime } from 'luxon';
import { db } from '../../../db/index.js';
import { logger } from '../../../logger.js';
import { config } from '../../../config.js';
import { deductSubscriptionCredits, type ChatMessage } from './llm.js';
import { runReactLoop } from './react-loop.js';
import { bridgeChat, type BridgeRequest } from '../../../services/pico-kimi-bridge.js';
import { buildMemoryContext, logConversation, logTrainingExample, extractMemories, extractMemoriesWithOllama, getConversationContext, upsertMemory } from '../../../services/memory.js';
import { logActivity } from '../../../services/activity-log.js';
import { checkKeywordTriggers } from '../../../services/automations-engine.js';
import { sendTelegramMessage, sendTelegramPhoto, sendTelegramVideo, sendTelegramTyping, sendTelegramButtons } from '../../../services/telegram.js';
import { getPersonalityPrompt, getPersonality } from '../../../prompts/personalities.js';
import { OPENCLAW_IDENTITY_COMPACT } from '../../../prompts/openclaw-system.js';
import { parseActions, type ParsedAction } from '../../../services/action-parser.js';
import { executeAction, type ActionResult } from './action-executor.js';
import { compressPrompt, trimConversationHistory } from '../../../utils/token-format.js';
import { isSearchIntent, tavilySearch } from '../../../services/tavily.js';
import { searxngSearch } from '../../../services/searxng.js';
import { extractUrl } from '../../../services/firecrawl.js';
import { fetchAndExtract, smartSearch } from '../../../services/web-research.js';
import { buildHabitCard, buildExpenseCard, buildMultiExpenseCard, buildFocusCard, storeTelegramMessage } from '../../../services/telegram-cards.js';
import { addInboxMessage } from '../../../services/inbox.js';
import { checkContentSafety } from '../../../services/content-filter.js';
import { isLaunchModeRequest, runMultiAgentOrchestration } from './multi-agent-orchestrator.js';
import { isResearchRequest, runResearchJob } from '../../../services/research-job.js';
import { emitThinking, emitDone, emitDelegation, emitCommSent, emitCommReceived, emitTaskStarted, emitTaskCompleted } from './agent-state-bus.js';
import { detectDelegationTarget, routeDelegation } from '../../../services/delegation.js';
import { cacheDel } from '../../../services/cache.js';
import { getTodayFestival } from '../../../services/festival-calendar.js';

// ---- Fast-path collaboration events ----
// Emit delegation + task events so the office canvas shows agents collaborating on user requests,
// even when messages are handled by fast-paths that bypass the main delegation flow.
const FASTPATH_AGENT_MAP: Record<string, string> = {
  research: 'nova',     expense: 'pulse',    reminder: 'cal',
  focus: 'jarvis',      memory: 'edith',     website: 'forge',
  briefing: 'edith',    image: 'aria',       screenshot: 'forge',
  habit: 'echo',        doc: 'edith',        links: 'nova',
  workflow: 'jarvis',   notification: 'cal',
};

function emitFastPathCollab(userId: string, fastPath: string, summary: string): void {
  const specialist = FASTPATH_AGENT_MAP[fastPath] || 'jarvis';
  const taskId = `fp-${fastPath}-${Date.now()}`;
  emitThinking(userId, 'weebo', `Routing to ${specialist}...`);
  emitDelegation(userId, 'weebo', specialist, summary);
  emitCommSent(userId, 'weebo', specialist, summary, undefined);
  emitTaskStarted(userId, specialist, taskId, summary);
  // Schedule completion after visible delay (8s) so office polling (3s) catches collaboration state
  setTimeout(() => {
    emitCommReceived(userId, specialist, 'weebo', `Done: ${summary}`, undefined);
    emitTaskCompleted(userId, specialist, taskId, summary);
    emitDone(userId, specialist);
    emitDone(userId, 'weebo');
  }, 8000);
}

// ---- Indian Festival Calendar ----
// Delegates to festival-calendar.ts service. Returns a greeting string for backward compatibility.
function getIndianFestival(): string | null {
  const festival = getTodayFestival();
  if (!festival) return null;
  // Map festival type to appropriate greeting prefix
  const greetingMap: Record<string, string> = {
    'Republic Day': 'Happy Republic Day!',
    'Holi': 'Happy Holi!',
    'Eid ul-Fitr': 'Eid Mubarak!',
    'Ambedkar Jayanti': 'Happy Ambedkar Jayanti!',
    'Baisakhi': 'Happy Baisakhi!',
    'Good Friday': 'Good Friday greetings!',
    'Independence Day': 'Happy Independence Day!',
    'Gandhi Jayanti': 'Happy Gandhi Jayanti!',
    'Dussehra': 'Happy Dussehra!',
    'Diwali': 'Happy Diwali!',
    'Govardhan Puja': 'Happy Govardhan Puja!',
    'Christmas': 'Merry Christmas!',
  };
  return greetingMap[festival.name] || `Happy ${festival.name}!`;
}

// ---- Hinglish Greeting ----
// Returns a time-appropriate Hinglish or English greeting, alternating randomly.
function getHinglishGreeting(): string {
  const hour = new Date().getHours();
  const useHinglish = Math.random() < 0.5;

  if (hour < 12) {
    return useHinglish ? 'Suprabhat!' : 'Good morning!';
  } else if (hour < 17) {
    return useHinglish ? 'Namaste!' : 'Good afternoon!';
  } else {
    return useHinglish ? 'Namaste!' : 'Good evening!';
  }
}

// ---- Personality Instructions Builder ----
// Converts slider values (0-100) into natural-language system prompt instructions.
// Exported so agent.ts (web chat) and message-router.ts (Telegram/WhatsApp) both use it.

interface PersonalitySliders {
  creativity?: number;
  formality?: number;
  verbosity?: number;
  humor?: number;
  empathy?: number;
  system_prompt?: string;
}

export function buildPersonalityInstructions(p: PersonalitySliders | undefined | null): string {
  if (!p) return '';
  const parts: string[] = [];

  const creativity = p.creativity ?? 50;
  const formality = p.formality ?? 50;
  const verbosity = p.verbosity ?? 50;
  const humor = p.humor ?? 50;
  const empathy = p.empathy ?? 50;

  if (creativity > 70) parts.push('Be creative, exploratory, and use unexpected analogies.');
  else if (creativity < 30) parts.push('Be precise and straightforward. Stick to facts.');

  if (formality > 70) parts.push('Use formal, professional language. No contractions or slang.');
  else if (formality < 30) parts.push('Be very casual and conversational. Use contractions freely.');

  if (verbosity > 70) parts.push('Be thorough and comprehensive. Include examples and details.');
  else if (verbosity < 30) parts.push('Be concise. Respond in 1-3 sentences maximum.');

  if (humor > 70) parts.push('Feel free to use wit, wordplay, and light humor.');
  else if (humor < 30) parts.push('Keep responses serious and professional.');

  if (empathy > 70) parts.push('Acknowledge feelings first. Validate before advising.');
  else if (empathy < 30) parts.push('Be direct and factual. Skip emotional preambles.');

  return parts.join(' ');
}

/**
 * Map creativity slider (0-100) to LLM temperature (0.3-1.0).
 * Low creativity = precise (0.3), default = balanced (0.7), high = exploratory (1.0).
 */
export function mapCreativityToTemperature(creativity: number | undefined): number {
  const c = creativity ?? 50;
  if (c < 30) return 0.3;
  if (c > 70) return 1.0;
  // Linear interpolation between 0.3 and 1.0 for the 30-70 range
  return 0.3 + ((c - 30) / 40) * 0.7;
}

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
- generate_code: Build or update a website. Two modes: (A) For personal pages (portfolio, landing page, blog): use template params {"template": "portfolio|landing|blog|business", "title": "...", "name": "...", "theme": "dark|light|purple|blue|gradient", "profession": "...", "location": "...", "bio": "...", "skills": ["skill1","skill2"], "email": "...", "tagline": "..."}. (B) For custom/creative apps (games, tools, generators, calculators, visualizers, anything interactive or non-standard): use {"prompt": "<detailed description of what to build>"}. Choose mode B whenever the request is NOT a standard personal/business page.
- send_email: Send an email. Params: {"to": "<recipient email>", "subject": "<subject>", "body": "<body>"}. Use when user says "send email to X", "email X about Y", "write an email", "compose email". Sends via user's connected Gmail account.
- delete_reminder: Delete reminders. To delete ALL pending reminders: {"deleteAll": true}. To delete one: {"reminderId": "<id>"}. Use this whenever the user says "delete my reminders", "cancel all reminders", "remove reminders", etc.
- list_reminders: Show pending reminders. Params: {}. ALWAYS use this when user says "what reminders do I have", "show my reminders", "list reminders", "any reminders?", "what have I got scheduled". NEVER guess or invent reminders — always call this tool.
- create_note: Save a note. Params: {"title": "<title>", "content": "<note content>", "tags": ["<tag1>"]}. Use when user says "save this", "take note", "note this down", "remember this".
- search_notes: Search saved notes. Params: {"query": "<search term>", "limit": 5}. Use when user says "find my note", "search notes", "what did I save about".
- create_memory: Save a personal fact or preference to long-term memory. Params: {"key": "<short label>", "value": "<the fact>", "category": "preference|personal|work|health|other"}. Use when user says "remember that I...", "I prefer X", "my X is Y", "I am a X", "I work at X", "I live in X", "don't forget that...", "always remember...", "keep in mind that...".
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
- portfolio_update_skills: Update portfolio skills list. Params: {"skills": ["Skill1", "Skill2"]}. Use when user says "update my skills", "my skills are X, Y, Z", "add skills to my portfolio".
- check_calendar: Check upcoming calendar events. Params: {"days": 1}. Use when user says "what's on my calendar", "any meetings today", "my schedule", "what do I have tomorrow", "upcoming events".
- create_calendar_event: Create a calendar event. Params: {"title": "<event title>", "start_time": "<ISO datetime or natural language>", "duration_minutes": 60, "attendees": ["email@example.com"], "location": "<location>"}. Use when user says "schedule a meeting", "create an event", "block time for", "add to calendar".
- find_free_slot: Find available time slots in the calendar. Params: {"duration_minutes": 60, "days_ahead": 7, "preference": "morning|afternoon|evening"}. Use when user says "find free time", "when am I free", "find a slot", "available time", "free slots".
- list_inbox: List recent email inbox messages. Params: {"limit": 5}. Use when user says "check my emails", "any new emails", "show inbox", "what emails do I have", "unread messages".
- create_goal: Create a goal for autonomous pursuit. Params: {"title": "<goal>", "description": "<details>", "category": "general|career|health|finance|learning|creative|technical|personal", "target_date": "<YYYY-MM-DD>"}. Use when user says "I want to...", "my goal is...", "help me achieve...", "set a goal for...", "I need to accomplish...".
- list_goals: List user's goals. Params: {"status": "active|completed|paused"}. Use when user says "show my goals", "what are my goals", "goal progress", "what am I working on".
- plan_goal: AI-decompose a goal into actionable steps. Params: {"goal_id": "<id>"}. Use after creating a goal to break it into steps.
- execute_goal_step: Execute the next available step on a goal. Params: {"goal_id": "<id>"}. Use when user says "work on my goal", "do the next step", "make progress on...".
- goal_status: Get detailed status of a goal with steps. Params: {"goal_id": "<id>"}. Use when user asks "how's my goal going", "goal progress", "status of...".
- save_artifact: Save a workspace artifact (research, draft, analysis). Params: {"title": "<title>", "content": "<content>", "type": "note|draft|research|code|plan|analysis", "goal_id": "<optional>"}. Use when an agent produces substantial output worth saving.

Only call tools when the user explicitly requests an action. Do not chain more than 3 tool calls in one response.`;

// ---- Tool Trigger Detection ----
// Detects phrases that should bypass the bridge and use the ReAct loop directly,
// ensuring TOOL_INSTRUCTIONS are available and actions are executed.
function hasToolTrigger(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    // Notes
    /\b(save\s+(a\s+)?note|take\s+note|note\s+(this|it)|write\s+(this|it)\s+down|remember\s+this|jot\s+(this|it)|save\s+this)\b/i.test(lower) ||
    // Memory / "remember X" commands (anchored to start to avoid "do you remember" false positives)
    /^(?:(?:please\s+)?(?:remember|save|note\s+down|keep\s+in\s+mind)\s+(?:that\s+)?|(?:don'?t|never)\s+forget\s+(?:that\s+)?|always\s+remember\s+)/i.test(lower.trim()) ||
    // Personal facts that should be saved as memories
    /\bI\s+prefer\b/i.test(lower) ||
    /\bmy\s+(?:name|age|location|preference|fav(?:ou?rite)?|wife|husband|partner|dog|cat|pet|birthday|anniversary|address|phone|number|job|role|title)\s+is\b/i.test(lower) ||
    /\bI\s+(?:am|'m)\s+(?:a|an)\s+/i.test(lower) ||
    /\bI\s+(?:work|live|study|teach|learn)\s+(?:at|in|as|from)\b/i.test(lower) ||
    /\bI\s+(?:like|love|hate|dislike|enjoy|avoid)\s+/i.test(lower) ||
    /\bsearch\s+(my\s+)?notes?\b/i.test(lower) ||
    /\bfind\s+(my\s+)?note\b/i.test(lower) ||
    /\b(show|send|give|get|display)\s+(me\s+)?(my\s+)?(the\s+)?notes?\b/i.test(lower) ||
    /\bnotes?\s+(here|to\s+me|please|now)\b/i.test(lower) ||
    /\bwhat.{0,20}\b(note|notes)\b.{0,20}\b(save[d]?|store[d]?|have)\b/i.test(lower) ||
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
    // Portfolio skills update
    /\bupdate\s+(my\s+)?skills?\b/i.test(lower) ||
    /\bmy\s+skills?\s+(are|is)\b/i.test(lower) ||
    /\badd\s+skills?\s+(to\s+)?(my\s+)?portfolio\b/i.test(lower) ||
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
    /\bspent\s+[$₹€£]?\d/i.test(lower) ||
    /\bpaid\s+[$₹€£]?\d/i.test(lower) ||
    /\b\d+\s*(?:rupay?|rs\.?|rupees?|bucks?|dollars?)?\s+(?:on|for|at)\s+\w/i.test(lower) ||
    /\b[$₹€£]\d+(\.\d+)?\s+(on|for)\s+\w/i.test(lower) ||
    /\bshow\s+(my\s+)?(spending|expenses|purchases)\b/i.test(lower) ||
    /\b(how\s+much\s+(have\s+i\s+)?spent|my\s+expenses|expense\s+(report|summary|tracker))\b/i.test(lower) ||
    /\b(set\s+)?(monthly|weekly|daily)?\s*(budget|spending\s+limit)\b/i.test(lower) ||
    // === HINGLISH PATTERNS ===
    // Hinglish expense
    /[₹$]\d|\d+\s*(rupay?|rs\.?|bucks?)\b/i.test(lower) ||
    /kharch|kharcha|paisa\s+(gaya|diya|lagay)|bill\s+(pay|diya)/i.test(lower) ||
    /(swiggy|zomato|ola|uber|amazon|flipkart|netflix|hotstar|bigbasket|blinkit|zepto|rapido|myntra|meesho|phonepe|paytm|gpay|jio|airtel|vi|irctc|makemytrip|goibibo|bookmyshow)\s+pe\b/i.test(lower) ||
    /\b(pe|par|mein)\s+\d+\s*(rupay?|rs)/i.test(lower) ||
    // Hinglish habits
    /\b(gym|yoga|meditation|exercise|workout|padhai|study)\s+(kiya|ki|kar[ae]?)\b/i.test(lower) ||
    /\b(aaj|kal)\s+(mein?ne?|maine)\s+\w+\s+(kiya|ki)\b/i.test(lower) ||
    /habit\s+(log|track)\s+kar/i.test(lower) ||
    // Hinglish reminders
    /\bkal\b.*\b(baj[ae]?|subah|shaam|raat)\b/i.test(lower) ||
    /\b(subah|shaam|raat)\b.*\d+.*\breminder\b/i.test(lower) ||
    /yaad\s+dila(o|na)|remind\s+kar(o|na)/i.test(lower) ||
    /\breminder\s+(set|lagao|chahiye)\b/i.test(lower) ||
    // Hinglish notes
    /\bnote\s+banana|save\s+kar(o|na)\b/i.test(lower) ||
    /\byan?\s+(note|likh)\b/i.test(lower) ||
    // Calendar queries
    /\b(my\s+)?(calendar|schedule|meetings?|events?)\s*(today|tomorrow|this\s+week)?\b/i.test(lower) ||
    /\bwhat.{0,15}(calendar|schedule|meetings?)\b/i.test(lower) ||
    /\bany\s+(meetings?|events?)\s*(today|tomorrow)?\b/i.test(lower) ||
    // Calendar create + free slot
    /\b(schedule|create|add|book|block)\s+(a\s+)?(meeting|event|appointment|call|session)\b/i.test(lower) ||
    /\b(add|put)\s+(it\s+)?(on|to|in)\s+(my\s+)?calendar\b/i.test(lower) ||
    /\b(find|when|show)\s+(me\s+)?(free|available|open)\s+(time|slot|hour)/i.test(lower) ||
    /\bfree\s+slot/i.test(lower) ||
    /\bwhen\s+am\s+i\s+free/i.test(lower) ||
    /\bblock\s+(focus|deep\s+work|time)/i.test(lower) ||
    // Email/inbox queries
    /\b(check|show|read|list|any)\s+(my\s+)?(emails?|inbox|mail)\b/i.test(lower) ||
    /\b(new|unread)\s+(emails?|messages?)\b/i.test(lower) ||
    // Send email
    /\b(send|write|compose|draft)\s+(an?\s+)?(email|mail)\b/i.test(lower) ||
    /\bemail\s+\S+@\S+/i.test(lower) ||
    // Website / code generation
    /\b(build|create|make|generate)\b.{0,80}\b(website|site|portfolio|landing|blog|page|app|calculator|game|tool|generator|timer|clock|converter|tracker|editor|player|simulator|counter)\b/i.test(lower) ||
    /\bbuild\s+me\b/i.test(lower) ||
    // Image generation
    /\b(generate|create|make|draw|paint|sketch|render|imagine|visualize)\b.{0,40}\b(image|picture|photo|illustration|artwork|art|painting|portrait|wallpaper|logo|icon)\b/i.test(lower) ||
    /\b(draw|paint|sketch)\s+\S/i.test(lower) ||
    // Screenshot
    /\bscreenshot\b/i.test(lower) ||
    /\b(capture|grab)\s+(a\s+)?screen/i.test(lower) ||
    // Web search (explicit search intent — not "search notes")
    /\b(search|look\s+up|find|google)\s+(for\s+|about\s+|the\s+)?(?!my\s+note|note)/i.test(lower) ||
    /\bwhat.{0,10}(latest|current|recent|news|today)\b/i.test(lower) ||
    // URL crawl / link extraction
    /\b(read|fetch|crawl|open|visit)\s+(this\s+)?(url|link|page|article|site)\b/i.test(lower) ||
    /\b(get|extract|list|show)\s+(all\s+)?links?\s+(from|on)\b/i.test(lower) ||
    // Reminders (delete / list — not just create)
    /\b(delete|cancel|remove|clear)\s+(my\s+|all\s+)?(reminder|alarm)/i.test(lower) ||
    /\b(what|show|list|any)\s+(my\s+)?(reminder|alarm)s?\b/i.test(lower)
  );
}

// ---- Expense Fast-Path Parser ----
// Parses common expense messages directly without LLM, returning structured data
// for executeAction('track_expense', ...).
function parseExpenseIntent(message: string): { amount: number; description: string; category: string } | null {
  const lower = message.toLowerCase();

  // Pattern: "I/i spent/paid [currency] NUMBER on/for DESCRIPTION"
  let match = lower.match(/\bi\s+(?:spent|paid)\s*[$₹€£]?\s*(\d+(?:\.\d+)?)\s*(?:rupay?|rs\.?|rupees?|bucks?|dollars?)?\s*(?:on|for|pe|par|mein|at)\s+(.+)/i);
  if (match) {
    return { amount: parseFloat(match[1]), description: match[2].trim().slice(0, 100), category: guessCategory(match[2]) };
  }

  // Pattern: "spent/paid/bought/purchased/ordered [currency] NUMBER on/for DESCRIPTION"
  match = lower.match(/(?:spent|paid|bought|purchased|ordered|kharch|kharcha)\s*[$₹€£]?\s*(\d+(?:\.\d+)?)\s*(?:rupay?|rs\.?|rupees?|bucks?|dollars?)?\s*(?:on|for|pe|par|mein|at)\s+(.+)/i);
  if (match) {
    return { amount: parseFloat(match[1]), description: match[2].trim().slice(0, 100), category: guessCategory(match[2]) };
  }

  // Pattern: "NUMBER on/for DESCRIPTION" (e.g., "450 on uber")
  match = lower.match(/^[$₹€£]?\s*(\d+(?:\.\d+)?)\s*(?:rupay?|rs\.?|rupees?|bucks?|dollars?)?\s+(?:on|for|pe|par|at)\s+(.+)/i);
  if (match && parseFloat(match[1]) > 0) {
    return { amount: parseFloat(match[1]), description: match[2].trim().slice(0, 100), category: guessCategory(match[2]) };
  }

  // Pattern: "MERCHANT pe NUMBER rupay" (Hinglish)
  match = lower.match(/(swiggy|zomato|ola|uber|amazon|flipkart|netflix|hotstar|jio|airtel|vi|bigbasket|blinkit|zepto|dunzo|myntra|meesho|rapido|paytm|phonepe|gpay|irctc|makemytrip|goibibo|bookmyshow)\s+(?:pe|par|se|mein)\s*[$₹]?\s*(\d+)/i);
  if (match) {
    return { amount: parseFloat(match[2]), description: match[1], category: guessCategory(match[1]) };
  }

  return null;
}

// ---- Multi-Expense Parser ----
// Parses "spent 200 on uber, 500 on zomato, 150 on coffee" into an array
function parseMultiExpenseIntent(message: string): Array<{ amount: number; description: string; category: string }> | null {
  const lower = message.toLowerCase();
  // Must start with a spending verb
  if (!/\b(spent|paid|bought|purchased|ordered|kharch|kharcha)\b/i.test(lower)) return null;

  const results: Array<{ amount: number; description: string; category: string }> = [];

  // Split by comma, "and", "aur", "+"
  const parts = lower.split(/\s*(?:,|;|&|(?:\band\b)|(?:\baur\b)|(?:\bplus\b)|\+)\s*/);

  for (const part of parts) {
    // Pattern: [currency] NUMBER on/for/pe DESCRIPTION
    const match = part.match(/[$₹€£]?\s*(\d+(?:\.\d+)?)\s*(?:rupay?|rs\.?|rupees?|bucks?|dollars?)?\s*(?:on|for|pe|par|mein|at)\s+(.+)/i);
    if (match && parseFloat(match[1]) > 0) {
      results.push({
        amount: parseFloat(match[1]),
        description: match[2].trim().slice(0, 100),
        category: guessCategory(match[2]),
      });
      continue;
    }
    // Pattern: DESCRIPTION NUMBER (e.g. "zomato 500")
    const match2 = part.match(/([a-z][a-z\s]{1,30}?)\s+[$₹]?\s*(\d+(?:\.\d+)?)/i);
    if (match2 && parseFloat(match2[2]) > 0) {
      results.push({
        amount: parseFloat(match2[2]),
        description: match2[1].trim().slice(0, 100),
        category: guessCategory(match2[1]),
      });
    }
  }

  return results.length >= 2 ? results : null; // only return if 2+ expenses found
}

function guessCategory(text: string): string {
  const t = text.toLowerCase();
  if (/swiggy|zomato|food|khana|restaurant|cafe|pizza|burger|biryani|chai/i.test(t)) return 'food';
  if (/uber|ola|rapido|cab|taxi|auto|bus|train|metro|petrol|diesel|fuel|irctc/i.test(t)) return 'transport';
  if (/amazon|flipkart|myntra|meesho|shopping|clothes|shoes|dress|saree/i.test(t)) return 'shopping';
  if (/netflix|hotstar|prime|spotify|movie|cinema|theatre|entertainment|bookmyshow/i.test(t)) return 'entertainment';
  if (/jio|airtel|vodafone|vi\b|phone|mobile|recharge|internet|wifi/i.test(t)) return 'utilities';
  if (/rent|electricity|water|gas|bill|maintenance/i.test(t)) return 'bills';
  if (/doctor|hospital|medicine|pharmacy|medical|health/i.test(t)) return 'health';
  if (/gym|yoga|fitness|sports|swimming/i.test(t)) return 'fitness';
  if (/grocery|groceries|vegetables|fruits|milk|bigbasket|blinkit|zepto|dunzo/i.test(t)) return 'groceries';
  if (/makemytrip|goibibo|travel|flight|hotel|booking/i.test(t)) return 'travel';
  if (/phonepe|paytm|gpay/i.test(t)) return 'other'; // payment apps — category depends on what was paid for
  return 'other';
}

// ---- Focus Fast-Path Parser ----
// Parses focus session requests directly without LLM.
function parseFocusIntent(message: string): { goal: string; duration_min: number } | null {
  const lower = message.toLowerCase();
  if (!/\b(focus|pomodoro|concentrate|deep\s+work)\b/i.test(lower)) return null;

  // Extract duration
  const durationMatch = lower.match(/(\d+)\s*(?:min(?:ute)?s?|m\b)/);
  const duration = durationMatch ? parseInt(durationMatch[1]) : 25;

  // Extract goal — everything after "on", "to", "for" following focus keyword
  const goalMatch = lower.match(/(?:focus|pomodoro|concentrate)\s+(?:on|to|for)\s+(.+)/i) ||
                    lower.match(/\b(?:need|want|gotta|have)\s+(?:to\s+)?(?:focus|concentrate)\s+(?:on|for)\s+(.+)/i) ||
                    lower.match(/\d+\s*min(?:ute)?s?\s+(?:to|on|for)\s+(.+)/i) ||
                    lower.match(/(?:focus\s+session\s+(?:to|on|for)\s+)(.+)/i);
  const goal = goalMatch ? goalMatch[1].trim().slice(0, 100) : 'Deep work';

  return { goal, duration_min: Math.min(Math.max(duration, 5), 120) };
}

// ---- Reminder Fast-Path Parser ----
// Parses common reminder messages directly without LLM.
// Returns { text, datetime } for executeAction('set_reminder', ...).
function parseReminderIntent(message: string): { text: string; datetime: string } | null {
  const lower = message.toLowerCase();

  // Must contain a reminder keyword
  if (!/\b(remind|reminder|alarm|wake|yaad\s+dila|alert\s+me)\b/i.test(lower)) return null;

  // Pattern: "set an alarm for 6am [tomorrow]" or "alarm at 7am"
  let match = lower.match(/(?:set\s+)?(?:an?\s+)?alarm\s+(?:for\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(.*)/i);
  if (match) return { text: 'alarm', datetime: `${match[1].trim()} ${match[2] || ''}`.trim() };

  // Pattern: "wake me [up] at TIME [tomorrow]"
  match = lower.match(/wake\s+(?:me\s+)?(?:up\s+)?(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(.*)/i);
  if (match) return { text: 'wake up', datetime: `${match[1].trim()} ${match[2] || ''}`.trim() };

  // Pattern: "remind me to TASK at/in/on TIME"
  match = lower.match(/remind\s+me\s+(?:to\s+)?(.+?)\s+(?:at|by|on|around)\s+(.+)/i);
  if (match) return { text: match[1].trim(), datetime: match[2].trim() };

  // Pattern: "remind me in DURATION to TASK"
  match = lower.match(/remind\s+me\s+in\s+(\d+\s*(?:min(?:ute)?s?|hours?|hrs?|days?))\s+(?:to\s+)?(.+)/i);
  if (match) return { text: match[2].trim(), datetime: `in ${match[1].trim()}` };

  // Pattern: "remind me TASK tomorrow/today"
  match = lower.match(/remind\s+me\s+(?:to\s+)?(.+?)\s+(tomorrow|today|tonight|kal|aaj)\s*(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm|baje)?)?/i);
  if (match) {
    const timeStr = match[3] ? `${match[2]} at ${match[3]}` : match[2];
    return { text: match[1].trim(), datetime: timeStr.trim() };
  }

  // Pattern: "reminder: TASK at TIME" or "reminder TASK at TIME"
  match = lower.match(/reminder[:\s]+(.+?)\s+(?:at|by|on)\s+(.+)/i);
  if (match) return { text: match[1].trim(), datetime: match[2].trim() };

  // Pattern: "set a reminder for TIME to TASK"
  match = lower.match(/set\s+(?:a\s+)?reminder\s+(?:for\s+)?(.+?)\s+(?:to\s+)(.+)/i);
  if (match) return { text: match[2].trim(), datetime: match[1].trim() };

  // Hinglish: "yaad dila dena kal/aaj TIME TASK" (time-first order)
  // Note: "dila dena" / "dila do" / "dila na" are two words; "dilao" is one word
  match = lower.match(/yaad\s+dila(?:o|\s+(?:do|dena|na))\s+(kal|aaj|parso|subah|shaam)\s*(\d{1,2}\s*baje)?\s+(.+)/i);
  if (match) {
    const whenMap: Record<string, string> = { kal: 'tomorrow', aaj: 'today', parso: 'day after tomorrow', subah: 'tomorrow morning', shaam: 'tomorrow evening' };
    const when = whenMap[match[1].toLowerCase()] || match[1];
    const time = match[2] ? ` at ${match[2].replace(/\s*baje/, '')}` : '';
    return { text: match[3].trim(), datetime: `${when}${time}` };
  }

  // Hinglish: "yaad dila dena TASK kal/aaj TIME baje" (task-first order)
  match = lower.match(/yaad\s+dila(?:o|\s+(?:do|dena|na))\s+(.+?)\s+(kal|aaj|parso|subah|shaam)\s*(\d{1,2}\s*baje)?/i);
  if (match) {
    const whenMap: Record<string, string> = { kal: 'tomorrow', aaj: 'today', parso: 'day after tomorrow', subah: 'tomorrow morning', shaam: 'tomorrow evening' };
    const when = whenMap[match[2].toLowerCase()] || match[2];
    const time = match[3] ? ` at ${match[3].replace(/\s*baje/, '')}` : '';
    return { text: match[1].trim(), datetime: `${when}${time}` };
  }

  // Hinglish: "remind karo/karna TASK TIME"
  match = lower.match(/remind\s+kar(?:o|na)\s+(.+?)\s+(kal|aaj|tomorrow|today|\d{1,2}\s*(?:am|pm|baje)|\d{1,2}:\d{2})/i);
  if (match) return { text: match[1].trim(), datetime: match[2].trim() };

  // Hinglish: "remind karo/karna TASK" (no explicit time — default 1h)
  match = lower.match(/remind\s+kar(?:o|na)\s+(.{3,})/i);
  if (match && !/\b(what|show|list|cancel|delete|how|kya)\b/i.test(match[1])) {
    return { text: match[1].trim(), datetime: 'in 1 hour' };
  }

  // Simple: "remind me to TASK" (no time — let server default)
  match = lower.match(/remind\s+me\s+(?:to\s+)?(.{3,})/i);
  if (match && !/\b(what|show|list|cancel|delete|how)\b/i.test(match[1])) {
    return { text: match[1].trim(), datetime: 'in 1 hour' };
  }

  return null;
}

// ---- Habit Fast-Path Parser ----
// Parses habit completion messages directly without LLM.
// Returns { habitName, note } for executeAction('track_habit', ...).
function parseHabitIntent(message: string): { habitName: string; note: string } | null {
  const lower = message.toLowerCase();

  // Pattern: "log/track/mark HABIT" or "HABIT done/completed/kiya"
  let match: RegExpMatchArray | null;

  // "log morning workout", "track meditation", "mark gym as done"
  match = lower.match(/\b(?:log|track|mark)\s+(?:my\s+)?(.+?)(?:\s+(?:as\s+)?(?:done|completed?|finished?))?$/i);
  if (match && match[1].length >= 2 && match[1].length <= 50) {
    const habit = match[1].replace(/\s+(habit|session|routine)$/i, '').trim();
    if (habit.length >= 2) return { habitName: habit, note: '' };
  }

  // "gym done", "gym done today", "meditation completed", "workout finished"
  match = lower.match(/^(.+?)\s+(?:done|completed?|finished?|logged?|tracked?)(?:\s+(?:today|aaj))?$/i);
  if (match && match[1].length >= 2 && match[1].length <= 40 && !/\b(remind|expense|focus|note|search)\b/i.test(match[1])) {
    return { habitName: match[1].trim(), note: '' };
  }

  // "did my gym", "did yoga today", "completed running"
  match = lower.match(/\b(?:i\s+)?(?:did|completed?|finished?)\s+(?:my\s+)?(.+?)(?:\s+today|\s+aaj)?$/i);
  if (match && match[1].length >= 2 && match[1].length <= 40 && !/\b(remind|task|work|homework|assignment)\b/i.test(match[1])) {
    return { habitName: match[1].trim(), note: '' };
  }

  // "I meditated for 20 minutes", "studied for 2 hours today", "worked out for 45 min"
  match = lower.match(/\b(?:i\s+)?(meditated|studied|exercised|worked\s*out|trained|practiced|jogged|ran|walked|swam|cycled|read)\s+(?:for\s+)?(.+?)(?:\s+today|\s+aaj)?$/i);
  if (match) {
    return { habitName: match[1].replace(/\s+/g, ' ').trim(), note: match[2].trim() };
  }

  // Hinglish: "gym kiya", "yoga ki", "meditation kara", "exercise kiya aaj"
  match = lower.match(/^(.+?)\s+(?:kiya|ki|kara|kar\s*liya|ho\s*gaya|ho\s*gayi)(?:\s+(?:aaj|today))?$/i);
  if (match && match[1].length >= 2 && match[1].length <= 40) {
    return { habitName: match[1].trim(), note: '' };
  }

  // "aaj gym kiya", "aaj maine yoga ki"
  match = lower.match(/\b(?:aaj|today)\s+(?:maine?\s+)?(.+?)\s+(?:kiya|ki|kara|kar\s*liya)$/i);
  if (match && match[1].length >= 2 && match[1].length <= 40) {
    return { habitName: match[1].trim(), note: '' };
  }

  // "walked 5km", "ran 3 miles", "read 30 pages"
  match = lower.match(/^(walked|ran|read|studied|meditated|exercised|jogged|swam|cycled|worked\s*out|trained|practiced)\s+(?:for\s+)?(.+)/i);
  if (match) {
    return { habitName: match[1], note: match[2].trim() };
  }

  // "drank 8 glasses of water", "had 2 liters water"
  match = lower.match(/\b(?:drank|had)\s+(\d+)\s+(?:glasses?|liters?|litres?|cups?)\s+(?:of\s+)?water/i);
  if (match) {
    return { habitName: 'water', note: `${match[1]} glasses` };
  }

  return null;
}

// ---- Named Agent Detection ----
// Detects when the user addresses a specific named agent by name.
// Returns the personality ID to use, or null if no named agent detected.
export function detectNamedAgent(message: string): string | null {
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
  // NOTE: Reminder patterns ("remind me", "set a reminder") intentionally excluded —
  // they are handled by parseReminderIntent() fast-path (0 credits, <700ms).
  const patterns = [
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

/**
 * Assemble the full system prompt for a channel-based conversation.
 *
 * Combines personality profile, user memory context, current local
 * datetime (in the user's timezone), custom system prompt, tool-use
 * instructions, and channel-specific formatting rules into a single
 * string suitable for the LLM system message.
 *
 * @param agentConfig  - User's agent configuration (personality sliders, custom prompt, etc.)
 * @param user         - User record from the database
 * @param userId       - Authenticated user ID
 * @param channel      - Originating channel identifier (e.g. `"telegram"`, `"whatsapp"`)
 * @param userMessage  - Current user message, used for memory relevance scoring
 * @returns Fully assembled system prompt string
 */
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

  // Build personality instructions from slider values (creativity, formality, verbosity, humor, empathy)
  const personalityInstructions = buildPersonalityInstructions(agentConfig as PersonalitySliders | undefined);
  const customPrompt = (agentConfig?.system_prompt as string) || '';

  return `LANGUAGE RULE: Detect the language the user writes or speaks in. ALWAYS reply in that exact language — no exceptions. Hindi message → reply in Hindi. Telugu message → reply in Telugu. English message → reply in English. Never switch to a different language unless the user does first.

YOUR IDENTITY: Your name is ${agentName}. If anyone asks who you are, what your name is, or what to call you, answer with your name: ${agentName}.

${OPENCLAW_IDENTITY_COMPACT}

--- PERSONALITY ---
${personalityPrompt}
${personalityInstructions ? `\n--- PERSONALITY TUNING ---\n${personalityInstructions}` : ''}
${customPrompt ? `\n--- CUSTOM INSTRUCTIONS ---\n${customPrompt}` : ''}

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

/**
 * Process an incoming message from any external channel end-to-end.
 *
 * This is the main exported function of the message router. It orchestrates
 * user resolution, credit checking, content safety filtering, system-prompt
 * assembly, LLM inference (via the ReAct loop), action execution, memory
 * extraction, and response delivery -- all in a single async call.
 *
 * The function never throws to the caller; errors are caught internally,
 * logged, and a user-facing error message is sent back through the channel.
 *
 * **Side effects:**
 * - Deducts subscription credits proportional to token usage
 * - Persists conversation to `conversation_log` for context reconstruction
 * - Extracts and upserts memories from both user and assistant messages
 * - Fires keyword-trigger automations if the message matches
 * - Emits SSE agent-state events for the live office canvas
 *
 * @param msg - Normalised message from the channel adapter (Telegram, WhatsApp, etc.)
 */
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

  // 2a. Send typing indicator for Telegram (immediate feedback)
  if (msg.channel === 'telegram') {
    sendTelegramTyping(msg.externalId).catch(() => {});
  }

  // 2. Check credits
  if (subscription && subscription.credits_remaining <= 0) {
    logger.info({ requestId, userId }, 'User has no credits');
    const resetDate = subscription.billing_cycle_end?.split('T')[0] || 'next cycle';
    await sendChannelResponse({
      channel: msg.channel,
      externalId: msg.externalId,
      text: `Hey! You've used all your credits for this billing cycle.\n\nCredits reset on ${resetDate}.\n\nTip: Upgrade your plan for more credits, or wait for the reset. Fast-path features (expenses, reminders, habits, focus) still work for free!`,
      replyToMessageId: msg.messageId,
    });
    return;
  }

  try {
  // 3. Update last_message_at in channel_links + last_sync in integrations (78.6: reflect real activity time)
  const now = new Date().toISOString();
  db.prepare('UPDATE channel_links SET last_message_at = ? WHERE channel = ? AND external_id = ?')
    .run(now, msg.channel, msg.externalId);
  db.prepare("UPDATE integrations SET last_sync = ? WHERE user_id = ? AND type = ?")
    .run(now, userId, msg.channel);

  // Capture conversation history BEFORE logging current message (prevents duplication in LLM context)
  const history = getConversationContext(userId, 16000);

  // 4. Log user message + extract memories
  logConversation(userId, 'user', msg.text, requestId);
  extractMemories(userId, msg.text);
  logger.debug({ requestId, userId }, 'Activity logged and memories extracted');

  // Extract entities from user message (async, non-blocking)
  import('../../../services/graph-memory.js').then(({ processMessageEntities }) => {
    processMessageEntities(userId, msg.text);
  }).catch(() => {});

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

  // 5a. Website builder fast-path — detect website creation/edit intent directly
  //     and execute generate_code without LLM to bypass model format unreliability
  {
    const createWebsitePattern = /\b(?:build|create|make|generate)\b.{0,80}\b(?:website|site|portfolio|landing|blog|page|app|calculator|game|tool|generator|visualizer|dashboard|quiz|timer|clock|converter|tracker|editor|player|simulator|counter)\b/i;
    const editWebsitePattern = /\b(?:change|update|edit|modify|redesign|redo|refresh|revamp|adjust|tweak|rebuild|switch|add|remove|make|give|turn)\b.{0,80}\b(?:website|site|portfolio|landing|blog|page|theme|background|color|font|section|layout|style|heading|title|bio|skills?|contact|footer|header|nav|dark|light|purple|blue|gradient|professional|modern|minimal|dashboard|search|bar|button|image|gallery|form|menu|vibe|aesthetic|look|design|feel|text|spacing|padding|margin|border|shadow|animation|responsive|mobile|card|grid|flex|icon|logo|hero|banner|sidebar|testimonial|pricing|feature|table|list|link|hover|rounded|bold|italic|bigger|smaller|larger|wider|taller|centered|glassmorphism|neumorphism|brutalism|cyberpunk|retro|vintage|neon|zen|futuristic|elegant|playful|clean|sleek|fancy|cool|beautiful|stunning|gorgeous)\b/i;
    // Hinglish edit: noun before verb (SOV order) — "website mein dark mode lagao", "theme badlo"
    const hinglishEditPattern = /\b(?:website|site|portfolio|theme|dark|light|color|background)\b.{0,60}\b(?:lagao|karo|badlo|hatao|banao|dikhao|change\s+karo|kar\s*do)\b/i;

    // Guard: skip website builder if this is a launch mode / multi-agent request
    const isLaunchMsg = /\blaunch\s+mode\b/i.test(msg.text);
    if (!isLaunchMsg && (createWebsitePattern.test(msg.text) || editWebsitePattern.test(msg.text) || hinglishEditPattern.test(msg.text))) {
      emitFastPathCollab(userId, 'website', `Building: ${msg.text.slice(0, 40)}`);
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
        // Extract comma-separated skills: "Skills: Figma, Adobe CC, React" or "skills are Figma and React" or "update skills to X, Y"
        const skillsRaw = (msg.text.match(/\bskills?\s+(?:to|with|as)\s+([A-Za-z0-9 ,&/]+?)$/i)
          ?? msg.text.match(/\bskills?\s*(?:are|:)\s*([A-Za-z0-9 ,&/]+?)(?:\.|theme|dark|light|\n|$)/i))?.[1];
        const skillsMatch = skillsRaw ? skillsRaw.split(/[,&]/).map(s => s.trim()).filter(s => s.length > 1) : null;
        // Extract bio/tagline from edit messages: "change bio to X" or "bio: X"
        const bioMatch = msg.text.match(/\b(?:bio|tagline|about|description|headline)\s*(?:to|as|:)\s+(.+)/i)?.[1]?.trim();

        const isEdit = (editWebsitePattern.test(msg.text) || hinglishEditPattern.test(msg.text)) && !createWebsitePattern.test(msg.text);

        const { executeAction } = await import('./action-executor.js');
        const baseUrl = config.publicUrl || config.apiUrl;

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
        // If user mentions a product/startup/brand name, prefer LLM path for richer custom output.
        const hasProductContext = /\b(startup|company|brand|product|store|shop|agency|studio)\b/i.test(msg.text)
          || /\b(?:called|named)\s+[A-Z][a-zA-Z]+/.test(msg.text);
        // Structural/style edits need LLM even on template artifacts
        const isStructuralEdit = isEdit && /\b(add|remove|insert|delete|include|create)\s+(?:a\s+)?(?:new\s+)?\w+\s*(section|form|button|link|image|gallery|map|video|testimonial|project)/i.test(msg.text);
        const isStyleEdit = isEdit && /\b(glassmorphism|neumorphism|brutalism|cyberpunk|retro|vintage|neon|zen|futuristic|elegant|sunset|warm|cool|serif|sans-serif|monospace|golden|silver|rounded|shadow|gradient|animation|animate|transition|hover|parallax|3d|bento|grid|masonry|bold|italic|bigger|smaller|wider|taller)\b/i.test(msg.text);
        // Template edits only for simple param changes (theme, skills, bio); everything else → LLM
        const isSimpleTemplateEdit = isEdit && !isStructuralEdit && !isStyleEdit
          && (!!themeMatch || !!skillsMatch?.length || !!bioMatch || !!nameMatch || !!professionMatch || !!locationMatch);
        const isPersonalTemplate =
          (isEdit && editTargetIsTemplate && isSimpleTemplateEdit) ||
          (!isEdit && !hasProductContext && (
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
          if (bioMatch) artifactParams.bio = bioMatch;
          logger.debug({ skillsMatch, bioMatch, nameMatch: nameMatch?.[1], isEdit }, 'Website fast-path: extracted params');

          // Enrich from user profile when creating NEW site with no personal details (skip for edits — stored params suffice)
          if (!isEdit && !nameMatch && !professionMatch && !locationMatch && !skillsMatch?.length) {
            try {
              const profile = db.prepare('SELECT headline, about, skills FROM portfolios WHERE user_id = ?').get(userId) as { headline?: string; about?: string; skills?: string } | undefined;
              const userRow = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as { username?: string } | undefined;
              const memories = db.prepare("SELECT key, value FROM user_memories WHERE user_id = ? AND key IN ('preferred_name','role','location','company') LIMIT 4").all(userId) as { key: string; value: string }[];
              const memMap = Object.fromEntries(memories.map(m => [m.key, m.value]));

              if (!artifactParams.name) {
                artifactParams.name = memMap.preferred_name || userRow?.username || undefined;
              }
              if (!artifactParams.profession && (profile?.headline || memMap.role)) {
                artifactParams.profession = profile?.headline || memMap.role;
              }
              if (!artifactParams.location && memMap.location) {
                artifactParams.location = memMap.location;
              }
              if (profile?.skills) {
                try {
                  const parsed = JSON.parse(profile.skills);
                  if (Array.isArray(parsed) && parsed.length > 0) artifactParams.skills = parsed.slice(0, 8);
                } catch { /* ignore */ }
              }
              if (profile?.about) {
                artifactParams.bio = String(profile.about).slice(0, 200);
              }
            } catch { /* non-fatal — just use defaults */ }
          }
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
      emitFastPathCollab(userId, 'reminder', 'Deleting reminders');
      // Clear FK references in inbox_messages before deleting (no ON DELETE CASCADE)
      db.prepare('UPDATE inbox_messages SET related_reminder_id = NULL WHERE user_id = ? AND related_reminder_id IN (SELECT id FROM reminders WHERE user_id = ? AND completed = 0)').run(userId, userId);
      const { changes } = db.prepare('DELETE FROM reminders WHERE user_id = ? AND completed = 0').run(userId);
      const reply = changes > 0 ? `Done! Deleted ${changes} pending reminder${changes !== 1 ? 's' : ''}.` : `You don't have any pending reminders to delete.`;
      logConversation(userId, 'assistant', reply, requestId, 'builtin', 'delete-reminder');
      await sendChannelResponse({ channel: msg.channel, externalId: msg.externalId, text: reply });
      logger.info({ channel: msg.channel, userId, changes }, 'Reminder delete-all fast-path executed');
      return;
    }
    // "cancel reminder 3" or "delete my last reminder" — pass to LLM (needs context)
    // Only delete-all gets the fast-path since it doesn't need specific reminderId
    if (deleteSinglePattern.test(msg.text) && /\b(last|latest|that|this|it)\b/i.test(msg.text)) {
      const last = db.prepare('SELECT id, text FROM reminders WHERE user_id = ? AND completed = 0 ORDER BY created_at DESC LIMIT 1').get(userId) as { id: string; text: string } | undefined;
      if (last) {
        db.prepare('UPDATE inbox_messages SET related_reminder_id = NULL WHERE related_reminder_id = ?').run(last.id);
        db.prepare('DELETE FROM reminders WHERE id = ?').run(last.id);
        const reply = `Cancelled: "${last.text}"`;
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
      emitFastPathCollab(userId, 'image', `Creating image: ${msg.text.slice(0, 40)}`);
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
      emitFastPathCollab(userId, 'screenshot', `Screenshot: ${msg.text.slice(0, 40)}`);
      const urlMatch = msg.text.match(/https?:\/\/\S+/) ?? msg.text.match(/\b([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,})\b/);
      let targetUrl = urlMatch?.[0] ?? '';
      if (targetUrl && !targetUrl.startsWith('http')) targetUrl = `https://${targetUrl}`;
      if (targetUrl) {
        try {
          const { fetchScreenshot } = await import('../../../services/web-research.js');
          const base64Png = await fetchScreenshot(targetUrl);
          // Compress PNG → JPEG to stay within Telegram's 10MB photo limit
          const photoData = await compressScreenshot(base64Png).catch(() => `data:image/png;base64,${base64Png}`);
          const reply = `Here's the screenshot of ${targetUrl}!`;
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
      emitFastPathCollab(userId, 'links', `Extracting links: ${msg.text.slice(0, 40)}`);
      const urlMatch = msg.text.match(/https?:\/\/\S+/) ?? msg.text.match(/\b([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,})\b/);
      let targetUrl = urlMatch?.[0] ?? '';
      if (targetUrl && !targetUrl.startsWith('http')) targetUrl = `https://${targetUrl}`;
      if (targetUrl) {
        try {
          const { extractLinks } = await import('../../../services/web-research.js');
          const links = await extractLinks(targetUrl);
          const linkList = links.slice(0, 20).map(l => `• ${l.text}: ${l.href}`).join('\n');
          const reply = `Found ${links.length} links on ${targetUrl}:\n\n${linkList}`;
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
    const briefingPattern = /\b(morning|daily|weekly)\s+(briefing|summary)\b|\b(show|give)\s+(me\s+)?(my\s+)?(?:(?:daily|weekly)\s+)?(briefing|agenda|summary)\b|\bwhat.{0,20}on\s+my\s+agenda\b/i;
    // Guard: skip briefing fast-path when user is creating/managing an automation or workflow
    const isAutomationCreate = /\b(create|set\s+up|add|build)\s+(an?\s+)?(automation|workflow)\b/i.test(msg.text);
    if (!isAutomationCreate && briefingPattern.test(msg.text)) {
      emitFastPathCollab(userId, 'briefing', 'Preparing briefing');
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
      // Inject festival greeting + Hinglish greeting at top of briefing
      const festivalMsg = getIndianFestival();
      const greeting = getHinglishGreeting();
      const lines: string[] = [];
      if (festivalMsg) lines.push(festivalMsg);
      lines.push(
        `${greeting} Your ${type} briefing:`,
        `• Pending reminders: ${pendingReminders}`,
        `• Habits logged (${isWeekly ? '7 days' : 'today'}): ${habitsDone}`,
        `• Notes saved: ${notesSaved}`,
        `• Focus sessions: ${focusSessions.n}${focusSessions.total ? ` (${focusSessions.total} min)` : ''}`,
      );
      if (upcomingReminders.length) {
        lines.push('', 'Upcoming:');
        const briefingUserTz = (db.prepare('SELECT timezone FROM users WHERE id = ?').get(userId) as { timezone?: string } | undefined)?.timezone || 'Asia/Kolkata';
        upcomingReminders.forEach(r => {
          let t = r.datetime;
          try { t = new Date(r.datetime).toLocaleString('en-IN', { timeZone: briefingUserTz, dateStyle: 'short', timeStyle: 'short' }); } catch { }
          lines.push(`  ${r.text} — ${t}`);
        });
      }
      if (recentNotes.length) lines.push('', `Recent notes: ${recentNotes.map(n => n.title).join(', ')}`);
      const reply = lines.join('\n');
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
      emitFastPathCollab(userId, 'workflow', 'Listing workflows');
      const rows = db.prepare(`SELECT id, name, trigger, enabled FROM user_workflows WHERE user_id = ? ORDER BY created_at DESC LIMIT 15`).all(userId) as Array<{id:number; name:string; trigger:string; enabled:number}>;
      let reply: string;
      if (rows.length === 0) {
        reply = 'You have no automations yet. Say "create automation" to make one.';
      } else {
        const list = rows.map((w, i) => `${i + 1}. ${w.enabled ? '✓' : '⏸'} ${w.name} (id:${w.id}, trigger:${w.trigger})`).join('\n');
        reply = `Your automations (${rows.length}):\n${list}`;
      }
      logConversation(userId, 'assistant', reply, requestId, 'builtin', 'list-workflows');
      await sendChannelResponse({ channel: msg.channel, externalId: msg.externalId, text: reply });
      logger.info({ channel: msg.channel, userId, count: rows.length }, 'List workflows fast-path executed');
      return;
    }
  }

  // 5ag. Async research fast-path (Telegram only)
  // For web chat, streaming SSE handles long responses fine — no need for async delivery.
  // Fire-and-forget: sends "On it!" immediately, then delivers Tavily results when done.
  if (msg.channel === 'telegram' && isResearchRequest(msg.text) && !hasToolTrigger(msg.text)) {
    await sendChannelResponse({
      channel: msg.channel,
      externalId: msg.externalId,
      text: "On it! Researching now — I'll send results in a few minutes 🔍",
      replyToMessageId: msg.messageId,
    });
    logConversation(userId, 'assistant', "Researching...", requestId, 'builtin', 'research-job');
    runResearchJob({ query: msg.text, chatId: msg.externalId }).catch(() => {});
    emitFastPathCollab(userId, 'research', `Researching: ${msg.text.slice(0, 50)}`);
    logger.info({ channel: msg.channel, userId, query: msg.text.slice(0, 60) }, 'Research fast-path fired');
    return;
  }

  // 5ah. Document capture fast-path — save directly to Agentin Docs (0 credits, <50ms)
  {
    const docCapturePattern = /^(?:\/note|note:|doc:|capture:|save (?:a )?(?:note|doc)s?:?|save to docs?:)\s+(.+)/is;
    const docMatch = msg.text.match(docCapturePattern);
    if (docMatch) {
      emitFastPathCollab(userId, 'doc', `Saving document`);
      const text = docMatch[1].trim();
      const title = text.split(/[.!?\n]/)[0].slice(0, 60) || 'Quick Note';

      // Insert into documents table
      db.prepare(`
        INSERT INTO documents (user_id, title, content, content_text, word_count, source)
        VALUES (?, ?, ?, ?, ?, 'telegram')
      `).run(
        userId,
        title,
        JSON.stringify([{ type: 'paragraph', content: [{ type: 'text', text }] }]),
        text,
        text.split(/\s+/).filter(Boolean).length,
      );

      const savedTitle = title.length > 50 ? title.slice(0, 50) + '...' : title;
      const reply = `\u{1F4DD} Saved to Docs: "${savedTitle}"\n\n${text.length > 200 ? text.slice(0, 200) + '...' : text}`;
      logConversation(userId, 'assistant', reply, requestId, 'builtin', 'doc-capture');
      await sendChannelResponse({ channel: msg.channel, externalId: msg.externalId, text: reply });
      logger.info({ channel: msg.channel, userId, titleLen: title.length, wordCount: text.split(/\s+/).filter(Boolean).length, latencyMs: Date.now() - startTime }, 'Doc capture fast-path executed');
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

  // GAP-1 FIX: Use unified agent router for @mention parsing + agent selection
  const { parseMentions, resolveSpecialist, buildAgentMemoryContext } = await import('./unified-agent-router.js');
  const { mentionedAgents } = parseMentions(msg.text);
  const explicitAgent = (msg as unknown as Record<string, unknown>)._overridePersonality as string
    || (mentionedAgents.length > 0 ? mentionedAgents[0] : null)
    || detectNamedAgent(msg.text);

  // Intent-based auto-delegation: if no explicit agent mention, detect intent → route to specialist
  let namedAgent = explicitAgent;
  let delegationResult: ReturnType<typeof routeDelegation> = null;
  if (!namedAgent) {
    const sub = db.prepare('SELECT plan FROM subscriptions WHERE user_id = ?').get(userId) as { plan: string } | undefined;
    const userPlan = sub?.plan || 'free';
    delegationResult = routeDelegation(userId, userPlan, msg.text);
    if (delegationResult) {
      namedAgent = delegationResult.agent;
      logger.info({ userId, agent: delegationResult.agent, reason: delegationResult.reason },
        'Intent-based delegation (Telegram/channel)');
    }
  }

  const effectivePersonalityId = namedAgent || (agentConfig?.personality as string) || 'jarvis';
  const { coreAgent, specialist } = resolveSpecialist(effectivePersonalityId as Parameters<typeof resolveSpecialist>[0]);
  const resolvedAgentName = namedAgent
    ? getPersonality(namedAgent).name
    : resolveAgentName(agentConfig, effectivePersonalityId);
  const agentIconMap: Record<string, string> = {
    edith: 'zap', jarvis: 'clock', weebo: 'bot',
    aria: 'sparkles', forge: 'code', pulse: 'bar-chart',
    echo: 'heart', cal: 'calendar', nova: 'search',
  };
  const agentIcon = agentIconMap[effectivePersonalityId] ?? 'bot';
  emitThinking(userId, effectivePersonalityId, `${resolvedAgentName} is processing...`);
  // If user addressed a specific named agent, rebuild system prompt with that personality
  if (namedAgent) {
    const overriddenConfig = { ...(agentConfig || {}), personality: namedAgent, name: getPersonality(namedAgent).name };
    systemPrompt = buildChannelSystemPrompt(overriddenConfig, user, userId, msg.channel, msg.text);
    systemPrompt = compressPrompt(systemPrompt);
    logger.info({ userId, namedAgent, resolvedAgentName }, 'Named agent routing: overriding personality');
  }

  // GAP-2 FIX: Per-agent memory context (from unified-agent-router)
  try {
    const agentMemoryBlock = buildAgentMemoryContext(userId, effectivePersonalityId as Parameters<typeof resolveSpecialist>[0], msg.text);
    if (agentMemoryBlock) systemPrompt += agentMemoryBlock;
  } catch { /* non-fatal — agent memory table may not have namespace column yet */ }

  // GAP-5 FIX: Specialist delegation visibility
  // Emit delegation events for both explicit specialist routing AND intent-based delegation
  if (specialist || delegationResult) {
    const delegateTo = delegationResult?.agent || specialist;
    const delegateReason = delegationResult?.reason || `${getPersonality(specialist || coreAgent).description} capabilities`;
    emitDelegation(userId, coreAgent, delegateTo!, `Delegating: ${delegateReason}`);
    emitCommSent(userId, coreAgent, delegateTo!, `Handling: "${msg.text.slice(0, 60)}" — ${delegateReason}`, undefined);
  }

  // 6a. Semantic memory recall (Qdrant vector search)
  try {
    const { semanticSearch } = await import('../../../services/search-vector.js');
    const semanticResults = await semanticSearch(userId, msg.text, 5);
    if (semanticResults.length > 0) {
      const memoryLines = semanticResults.map(r => `- ${r.key}`).join('\n');
      systemPrompt += `\n\n--- What I remember about you ---\n${memoryLines}\n`;
    }
  } catch { /* Qdrant may be unavailable — non-fatal */ }

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

  // 6b. Web search enrichment — SearXNG (free, primary) → Tavily (fallback) → crawl4ai smart search
  let webSearchUsed = false;
  if (isSearchIntent(msg.text)) {
    // Try SearXNG first (free, self-hosted, unlimited)
    try {
      const searxResult = await searxngSearch(msg.text, 5);
      if (searxResult.results.length > 0) {
        const context = searxResult.results
          .map((r) => `[${r.title}]: ${r.content}`)
          .join('\n');
        systemPrompt += `\n\nWEB_SEARCH_RESULTS:\n${context}`;
        webSearchUsed = true;
        logger.debug({ query: msg.text, resultCount: searxResult.results.length }, 'SearXNG search enriched prompt');
      }
    } catch (e) {
      logger.debug({ err: (e as Error).message }, 'SearXNG search failed, trying Tavily fallback');
    }
    // Tavily fallback (paid, higher quality for complex queries)
    if (!webSearchUsed && process.env.TAVILY_API_KEY) {
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
  const BARE_DOMAIN_RE_MSG = /\b([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,})\b/;
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
  let reactDeferredActions: ParsedAction[] = [];

  // ── Launch Mode: Multi-Agent Parallel Orchestration ─────────────────────
  if (isLaunchModeRequest(msg.text)) {
    logger.info({ userId, msg: msg.text }, 'multi-agent:launch-mode-detected');
    try {
      const orchResult = await runMultiAgentOrchestration(msg.text, userId, userCredits);
      replyText = orchResult.text;
      provider = 'multi-agent';
      model = `parallel(${orchResult.totalAgents})`;
      tokensIn = 0;
      tokensOut = 0;
      creditCost = orchResult.totalAgents * 2;
    } catch (err) {
      logger.warn({ err: (err as Error).message, userId }, 'multi-agent:failed, falling back to single agent');
      // Fall through to normal routing
      replyText = '';
      provider = '';
      model = '';
    }
    if (replyText) {
      // Skip to response delivery
      await deductSubscriptionCredits(userId, creditCost);
      await sendChannelResponse({ channel: msg.channel, externalId: msg.externalId, text: replyText });
      logger.info({ channel: msg.channel, userId, provider, latencyMs: Date.now() - startTime, creditCost }, 'Channel message processed');
      return;
    }
  }

  // ── Multi-expense fast-path: "spent 200 on uber, 500 on zomato, 150 on coffee" ──
  const multiExpenseMatch = parseMultiExpenseIntent(msg.text);
  if (multiExpenseMatch) {
    logger.info({ count: multiExpenseMatch.length, userId }, 'Multi-expense fast-path triggered');
    emitFastPathCollab(userId, 'expense', `Logging ${multiExpenseMatch.length} expenses`);
    const loggedExpenses: Array<{ id: number; description: string; amount: number; category: string }> = [];
    for (const exp of multiExpenseMatch) {
      const action = { tool: 'track_expense', params: { amount: exp.amount, description: exp.description, category: exp.category } };
      const result = await executeAction(userId, action);
      const expId = (result.data as Record<string, unknown>)?.expenseId;
      if (expId) loggedExpenses.push({ id: Number(expId), description: exp.description, amount: exp.amount, category: exp.category });
    }
    const total = multiExpenseMatch.reduce((s, e) => s + e.amount, 0);
    replyText = `Logged ${multiExpenseMatch.length} expenses totalling ₹${total}`;
    provider = 'fast-path';
    model = 'multi-expense-parser';
    tokensIn = 0; tokensOut = 0; creditCost = 0;
    logConversation(userId, 'assistant', replyText, requestId, 'builtin', 'multi-expense-fast-path');
    if (msg.channel === 'telegram' && msg.externalId && loggedExpenses.length > 0) {
      const card = buildMultiExpenseCard(loggedExpenses);
      const sent = await sendTelegramButtons(msg.externalId, card.text, card.reply_markup.inline_keyboard);
      if (sent?.messageId) storeTelegramMessage(userId, msg.externalId, sent.messageId, 'expense', String(loggedExpenses[0].id));
    } else {
      await sendChannelResponse({ channel: msg.channel, externalId: msg.externalId, text: replyText });
    }
    logger.info({ channel: msg.channel, userId, provider, count: multiExpenseMatch.length, total, latencyMs: Date.now() - startTime }, 'Channel message processed (multi-expense fast-path)');
    return;
  }

  // ── Expense fast-path: parse amount + merchant directly, bypass LLM ──
  const expenseMatch = parseExpenseIntent(msg.text);
  if (expenseMatch) {
    logger.info({ expenseMatch, userId }, 'Expense fast-path triggered');
    emitFastPathCollab(userId, 'expense', `Logging expense: ${msg.text.slice(0, 40)}`);
    const action = { tool: 'track_expense', params: { amount: expenseMatch.amount, description: expenseMatch.description, category: expenseMatch.category } };
    const result = await executeAction(userId, action);
    replyText = result.message || `Logged ${expenseMatch.amount} for ${expenseMatch.description || expenseMatch.category || 'expense'}`;
    provider = 'fast-path';
    model = 'expense-parser';
    tokensIn = 0;
    tokensOut = 0;
    creditCost = 0;
    logConversation(userId, 'assistant', replyText, requestId, 'builtin', 'expense-fast-path');
    // Send button card on Telegram, plain text elsewhere
    const expId = (result.data as Record<string, unknown>)?.expenseId;
    if (msg.channel === 'telegram' && msg.externalId && expId) {
      const card = buildExpenseCard({ id: Number(expId), description: expenseMatch.description, amount: expenseMatch.amount });
      const sent = await sendTelegramButtons(msg.externalId, card.text, card.reply_markup.inline_keyboard);
      if (sent?.messageId) storeTelegramMessage(userId, msg.externalId, sent.messageId, 'expense', String(expId));
    } else {
      await sendChannelResponse({ channel: msg.channel, externalId: msg.externalId, text: replyText });
    }
    logger.info({ channel: msg.channel, userId, provider, latencyMs: Date.now() - startTime, creditCost }, 'Channel message processed (expense fast-path)');
    return;
  }

  // ── Focus fast-path: parse duration + goal directly, bypass LLM ──
  const focusMatch = parseFocusIntent(msg.text);
  if (focusMatch) {
    logger.info({ focusMatch, userId }, 'Focus fast-path triggered');
    emitFastPathCollab(userId, 'focus', `Focus: ${focusMatch.goal}`);
    const action = { tool: 'start_focus', params: { goal: focusMatch.goal, duration_min: focusMatch.duration_min } };
    const result = await executeAction(userId, action);
    replyText = result.message || `Focus session started: ${focusMatch.goal} (${focusMatch.duration_min} min)`;
    provider = 'fast-path';
    model = 'focus-parser';
    tokensIn = 0;
    tokensOut = 0;
    creditCost = 0;
    logConversation(userId, 'assistant', replyText, requestId, 'builtin', 'focus-fast-path');
    // Send button card on Telegram, plain text elsewhere
    const focData = result.data as Record<string, unknown> | undefined;
    if (msg.channel === 'telegram' && msg.externalId && focData?.sessionId) {
      const card = buildFocusCard({ id: Number(focData.sessionId), goal: focusMatch.goal, durationMin: focusMatch.duration_min });
      const sent = await sendTelegramButtons(msg.externalId, card.text, card.reply_markup.inline_keyboard);
      if (sent?.messageId) storeTelegramMessage(userId, msg.externalId, sent.messageId, 'focus', String(focData.sessionId));
    } else {
      await sendChannelResponse({ channel: msg.channel, externalId: msg.externalId, text: replyText });
    }
    logger.info({ channel: msg.channel, userId, provider, latencyMs: Date.now() - startTime, creditCost }, 'Channel message processed (focus fast-path)');
    return;
  }

  // ── Reminder fast-path: parse "remind me to X at Y" directly, bypass LLM ──
  const reminderMatch = parseReminderIntent(msg.text);
  if (reminderMatch) {
    logger.info({ reminderMatch, userId }, 'Reminder fast-path triggered');
    emitFastPathCollab(userId, 'reminder', `Reminder: ${reminderMatch.text.slice(0, 40)}`);
    const action = { tool: 'set_reminder', params: { text: reminderMatch.text, datetime: reminderMatch.datetime, channel: msg.channel === 'telegram' ? 'telegram' : 'push' } };
    const result = await executeAction(userId, action);
    replyText = result.message || `Reminder set: ${reminderMatch.text}`;
    provider = 'fast-path';
    model = 'reminder-parser';
    tokensIn = 0;
    tokensOut = 0;
    creditCost = 0;
    logConversation(userId, 'assistant', replyText, requestId, 'builtin', 'reminder-fast-path');
    // Skip duplicate text if an inline card was already sent via Telegram
    if (!(result.cardSent && msg.channel === 'telegram')) {
      await sendChannelResponse({ channel: msg.channel, externalId: msg.externalId, text: replyText });
    }
    logger.info({ channel: msg.channel, userId, provider, latencyMs: Date.now() - startTime, creditCost }, 'Channel message processed (reminder fast-path)');
    return;
  }

  // ── Memory fast-path: "remember that X" / "don't forget X" → save immediately ──
  const memoryMatch = msg.text.match(/^(?:remember|don'?t forget|keep in mind|note down|save|store)\s+(?:that\s+)?(.{5,200}?)(?:\s*[.!?]?\s*)$/i);
  if (memoryMatch) {
    const fact = memoryMatch[1].trim();
    const memKey = fact.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 50);
    upsertMemory(userId, 'fact', memKey, fact, 0.95, 'explicit');
    emitFastPathCollab(userId, 'memory', `Saving: ${fact.slice(0, 40)}`);
    replyText = `Got it, I'll remember that: "${fact}"`;
    provider = 'fast-path';
    model = 'memory-parser';
    tokensIn = 0;
    tokensOut = 0;
    creditCost = 0;
    logConversation(userId, 'assistant', replyText, requestId, 'builtin', 'memory-fast-path');
    await sendChannelResponse({ channel: msg.channel, externalId: msg.externalId, text: replyText });
    logger.info({ memoryKey: memKey, userId }, 'Memory fast-path triggered');
    logger.info({ channel: msg.channel, userId, provider, latencyMs: Date.now() - startTime, creditCost }, 'Channel message processed (memory fast-path)');
    return;
  }

  // ── Habit fast-path: parse "gym done" / "log meditation" directly, bypass LLM ──
  const habitMatch = parseHabitIntent(msg.text);
  if (habitMatch) {
    logger.info({ habitMatch, userId }, 'Habit fast-path triggered');
    emitFastPathCollab(userId, 'habit', `Tracking: ${habitMatch.habitName}`);
    const action = { tool: 'track_habit', params: { habitName: habitMatch.habitName, note: habitMatch.note } };
    const result = await executeAction(userId, action);
    replyText = result.message || `Logged: ${habitMatch.habitName}`;
    provider = 'fast-path';
    model = 'habit-parser';
    tokensIn = 0;
    tokensOut = 0;
    creditCost = 0;
    logConversation(userId, 'assistant', replyText, requestId, 'builtin', 'habit-fast-path');
    // Send button card on Telegram, plain text elsewhere
    const habData = result.data as Record<string, unknown> | undefined;
    if (msg.channel === 'telegram' && msg.externalId && habData?.habitId) {
      const card = buildHabitCard({ id: Number(habData.habitId), name: habitMatch.habitName, streak: Number(habData.streak ?? 0) });
      const sent = await sendTelegramButtons(msg.externalId, card.text, card.reply_markup.inline_keyboard);
      if (sent?.messageId) storeTelegramMessage(userId, msg.externalId, sent.messageId, 'habit', String(habData.habitId));
    } else {
      await sendChannelResponse({ channel: msg.channel, externalId: msg.externalId, text: replyText });
    }
    logger.info({ channel: msg.channel, userId, provider, latencyMs: Date.now() - startTime, creditCost }, 'Channel message processed (habit fast-path)');
    return;
  }

  // ── Notification preference fast-path: "turn off habit reminders" / "enable streak notifications" ──
  const proactiveTypePattern = /\b(?:turn\s+(?:off|on)|(?:dis|en)able|stop|start)\s+(?:the\s+)?(.+?)\s*(?:notification|alert|reminder|nudge|message)s?\b/i;
  const proactiveTypeMatch = msg.text.match(proactiveTypePattern);
  if (proactiveTypeMatch) {
    emitFastPathCollab(userId, 'notification', `Updating notification settings`);
    const isEnable = /\b(?:on|enable|start)\b/i.test(msg.text);
    const typeRaw = proactiveTypeMatch[1].toLowerCase().trim();
    const typeMap: Record<string, string> = {
      'briefing': 'daily_briefing', 'morning': 'daily_briefing', 'daily': 'daily_briefing',
      'overdue': 'overdue_alert',
      'habit': 'habit_nudge',
      'idle': 'idle_check_in', 'check in': 'idle_check_in', 'checkin': 'idle_check_in',
      'weekly': 'weekly_report',
      'streak': 'streak_milestone',
      'expense': 'expense_spike', 'spending': 'expense_spike',
    };
    const proactiveType = typeMap[typeRaw];
    if (proactiveType) {
      try {
        const existing = db.prepare('SELECT proactive_preferences FROM agent_configs WHERE user_id = ?')
          .get(userId) as { proactive_preferences: string } | undefined;
        const prefs = existing?.proactive_preferences ? JSON.parse(existing.proactive_preferences) : {};
        prefs[proactiveType] = isEnable;
        db.prepare('UPDATE agent_configs SET proactive_preferences = ? WHERE user_id = ?')
          .run(JSON.stringify(prefs), userId);
        const action = isEnable ? 'enabled' : 'disabled';
        const label = proactiveType.replace(/_/g, ' ');
        replyText = `${label.charAt(0).toUpperCase() + label.slice(1)} notifications ${action}.`;
        provider = 'fast-path';
        model = 'notif-pref';
        tokensIn = 0;
        tokensOut = 0;
        creditCost = 0;
        logConversation(userId, 'assistant', replyText, requestId, 'builtin', 'notif-pref-fast-path');
        await sendChannelResponse({ channel: msg.channel, externalId: msg.externalId, text: replyText });
        logger.info({ channel: msg.channel, userId, proactiveType, isEnable, provider, latencyMs: Date.now() - startTime, creditCost }, 'Channel message processed (notif-pref fast-path)');
        return;
      } catch (err) {
        logger.warn({ err, userId }, 'Failed to update proactive preferences');
      }
    }
  }

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
    'didi','bhaiya','beta','yaar','dost','mere','tere','unka','unki','naam','kaam',
    'aaj','kal','kaisa','mausam','haal','wala','wali','achha','sunao','dikhao',
    'khana','paani','ghar','bahar','andar','upar','neeche','pehle','baad','saath']);
  const msgWords = msg.text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
  const hinglishMatches = msgWords.filter(w => HINGLISH_WORDS.has(w)).length;
  const hasHinglish = hinglishMatches >= 2;

  const needsGroq = hasNonLatinScript || hasHinglish;

  if (needsGroq) {
    const reason = hasNonLatinScript ? 'non-latin-script' : 'hinglish';
    logger.info({ userId, reason }, 'Multilingual input detected — routing to Groq via ReAct loop');
    const messages: ChatMessage[] = [...trimmedHistory, { role: 'user', content: llmUserText }];
    const reactResult = await runReactLoop(messages, { systemPrompt, agentName: resolvedAgentName, userCredits, userId, forceProvider: 'groq' });
    replyText = reactResult.text;
    provider = reactResult.provider;
    model = reactResult.model;
    tokensIn = reactResult.tokensIn;
    tokensOut = reactResult.tokensOut;
    creditCost = reactResult.creditCost;
    reactDeferredActions = reactResult.deferredActions;
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
        agentId: effectivePersonalityId,
        userCredits,
        userId,
      });
      replyText = reactResult.text;
      provider = reactResult.provider;
      model = reactResult.model;
      tokensIn = reactResult.tokensIn;
      tokensOut = reactResult.tokensOut;
      creditCost = reactResult.creditCost;
      reactDeferredActions = reactResult.deferredActions;
    }
  } else {
    // Bridge not enabled or tool trigger detected — use ReAct loop
    // Force Groq for tool-triggered messages (free models don't emit <<<ACTION>>> reliably)
    const forceGroqForTools = hasToolTrigger(msg.text) ? 'groq' as const : undefined;
    const messages: ChatMessage[] = [...trimmedHistory, { role: 'user', content: llmUserText }];
    const reactResult = await runReactLoop(messages, {
      systemPrompt,
      agentName: (agentConfig?.name as string) || 'Geek',
      agentId: effectivePersonalityId,
      userCredits,
      userId,
      forceProvider: forceGroqForTools,
    });
    replyText = reactResult.text;
    provider = reactResult.provider;
    model = reactResult.model;
    tokensIn = reactResult.tokensIn;
    tokensOut = reactResult.tokensOut;
    creditCost = reactResult.creditCost;
    reactDeferredActions = reactResult.deferredActions;
  }

  // 7b. Parse and execute actions (from LLM reply text + deferred actions from ReAct loop)
  const { text: cleanReply, actions: parsedActions } = parseActions(replyText);
  // Merge: actions parsed from reply text + deferred generate_code actions from ReAct loop
  const allActions = [...parsedActions, ...reactDeferredActions];
  const actionResults: ActionResult[] = [];

  // Detect edit intent for generate_code: if user says update/change/edit/fix/modify their website,
  // look up their most recent artifact and inject existingArtifactId so the action updates it in-place.
  const editWebsiteIntent = /\b(?:update|change|edit|modify|fix|improve|redesign|redo|refresh|revamp|add to|remove from|make it|adjust|tweak)\b/i;

  for (const action of allActions) {
    // Inject baseUrl for generate_code actions to create preview links
    if (action.tool === 'generate_code') {
      action.params.baseUrl = config.publicUrl || config.apiUrl;
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
  logActivity(userId, `${resolvedAgentName} replied`, finalReply.slice(0, 80), agentIcon);
  emitDone(userId, effectivePersonalityId, `${resolvedAgentName} finished`);

  // Emit comm_received after delegation completes — shows the specialist reporting back
  if (delegationResult) {
    emitCommReceived(userId, delegationResult.agent, coreAgent, `Done: ${finalReply.slice(0, 60)}`, undefined);
  }

  // GAP-4 FIX: Create agent task for complex queries (research, multi-step)
  // GAP-5 FIX: Specialist delegation completion
  // GAP-6 FIX: Invalidate recommendation cache
  try {
    const isComplexQuery = tokensOut > 200 || creditCost > 5;
    if (isComplexQuery) {
      const { createAgentTask, startTask, completeTask } = await import('./agent-task-queue.js');
      const task = createAgentTask(userId, coreAgent as 'weebo' | 'edith' | 'jarvis', msg.text.slice(0, 100), msg.text, 5, 'chat');
      startTask(task.id);
      completeTask(task.id, finalReply.slice(0, 500));
      emitThinking(userId, effectivePersonalityId, `${resolvedAgentName} completing task...`);
      const { emitTaskStarted: ets, emitTaskCompleted: etc } = await import('./agent-state-bus.js');
      ets(userId, effectivePersonalityId, task.id, msg.text.slice(0, 60));
      etc(userId, effectivePersonalityId, task.id, 'Complete');
    }
    if (specialist && !delegationResult) {
      emitCommSent(userId, specialist, coreAgent, 'Analysis complete', undefined);
    }
    // Invalidate recommendation cache
    cacheDel(`recs:${userId}`).catch(() => {});
  } catch { /* non-fatal wiring — never break chat */ }

  // Embed conversation for semantic memory (fire-and-forget)
  import('../../../services/search-vector.js').then(({ upsertMemoryVector }) => {
    const memKey = msg.text.slice(0, 100);
    const memVal = `User asked: ${msg.text.slice(0, 200)}\nAgent replied: ${finalReply.slice(0, 300)}`;
    upsertMemoryVector(userId, memKey, memVal, 'conversation').catch(() => {});
  }).catch(() => {});

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

  // Fire-and-forget: check keyword automation triggers after response is sent
  checkKeywordTriggers(userId, msg.text).catch((e: unknown) =>
    logger.debug({ err: (e as Error).message }, 'keyword trigger bg error'));

  } catch (err: unknown) {
    logger.error({ err: (err as Error).message, requestId, channel: msg.channel }, 'Unhandled error in handleIncomingMessage');
    await sendChannelResponse({
      channel: msg.channel,
      externalId: msg.externalId,
      text: "Something went wrong on my end. Please try again in a moment.",
      replyToMessageId: msg.messageId,
    }).catch(() => { /* last-resort — don't throw */ });
  }
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
      const { sendWhatsAppMessage } = await import('../../../services/whatsapp.js');
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
