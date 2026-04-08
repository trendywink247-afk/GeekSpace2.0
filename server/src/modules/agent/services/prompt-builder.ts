/**
 * Prompt builder — assembles system prompts for channel-based conversations.
 *
 * Extracted from message-router.ts. Exports:
 * - buildPersonalityInstructions() — slider values → natural-language instructions
 * - mapCreativityToTemperature() — creativity slider → LLM temperature
 * - buildChannelSystemPrompt() — full system prompt assembly
 * - buildActionChannelSuffix() — append action results to reply text
 * - TOOL_INSTRUCTIONS — injected into system prompts for tool-use
 *
 * @module services/prompt-builder
 */

import { DateTime } from 'luxon';
import { db } from '../../../db/index.js';
import { buildMemoryContext } from '../../../services/memory.js';
import { getPersonalityPrompt, getPersonality } from '../../../prompts/personalities.js';
import { OPENCLAW_IDENTITY_COMPACT } from '../../../prompts/openclaw-system.js';
import type { ActionResult } from './action-executor.js';

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

// ---- ReAct Tool Instructions ----
// Injected into system prompts so the LLM knows how to call tools.
export const TOOL_INSTRUCTIONS = `
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
