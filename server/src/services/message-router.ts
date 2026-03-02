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
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { config } from '../config.js';
import { routeChat, deductSubscriptionCredits, type ChatMessage } from './llm.js';
import { bridgeChat, type BridgeRequest } from './pico-kimi-bridge.js';
import { buildMemoryContext, logConversation, extractMemories, extractMemoriesWithOllama, getConversationContext } from './memory.js';
import { checkKeywordTriggers } from './automations-engine.js';
import { sendTelegramMessage } from './telegram.js';
import { getPersonalityPrompt, getPersonality } from '../prompts/personalities.js';
import { OPENCLAW_IDENTITY_COMPACT } from '../prompts/openclaw-system.js';
import { parseActions } from './action-parser.js';
import { executeAction, type ActionResult } from './action-executor.js';
import { compressPrompt, trimConversationHistory } from '../utils/token-format.js';
import { isSearchIntent, tavilySearch } from './tavily.js';
import { extractUrl, firecrawlScrape } from './firecrawl.js';

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

function buildChannelSystemPrompt(
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

  return `${OPENCLAW_IDENTITY_COMPACT}

--- PERSONALITY ---
${personalityPrompt}

--- USER SESSION ---
Agent name: ${agentName}. User: ${userName}. Voice: ${voice}. Mode: ${mode}.
Channel: ${channel}. This is a messaging app — keep responses SHORT and mobile-friendly.${memoryBlock}

IMPORTANT: Max 2-3 sentences for simple questions. No markdown formatting (no **, no ##, no bullet lists). Plain text only. Be concise.`;
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
      channelReply += `\n🖼️ ${ar.imageUrl}`;
      continue;
    }
    if (ar.tool === 'generate_video' && ar.videoUrl) {
      channelReply += `\n🎬 Video: ${ar.videoUrl}`;
      if ((ar.data?.estimatedTime as number) > 0) {
        channelReply += ` (renders in ~${ar.data?.estimatedTime}s)`;
      }
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

  // 4. Log user message + extract memories
  logConversation(userId, 'user', msg.text, requestId);
  extractMemories(userId, msg.text);
  logger.debug({ requestId, userId }, 'Activity logged and memories extracted');

  // 5. Fire keyword automation triggers (non-blocking)
  checkKeywordTriggers(userId, msg.text).catch((e: unknown) => console.debug('[bg]', (e as Error).message));

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
  const history = getConversationContext(userId);
  const userCredits = (user?.credits as number) || 0;

  // 6a. Token compression — compress system prompt + user message for LLM
  //     (msg.text kept original for logging/memory/channel delivery)
  systemPrompt = compressPrompt(systemPrompt);
  const llmUserText = compressPrompt(msg.text);

  // 6b. Web search enrichment (Tavily) — runs when search intent detected
  let webSearchUsed = false;
  if (isSearchIntent(msg.text) && process.env.TAVILY_API_KEY) {
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
      logger.debug({ err: (e as Error).message }, 'Tavily search failed, continuing');
    }
  }

  // 6c. URL scraping enrichment (Firecrawl) — runs when URL found in message
  //     Also handles /research <url> command
  const researchUrl = msg.text.startsWith('/research ')
    ? msg.text.replace('/research ', '').trim()
    : extractUrl(msg.text);
  if (researchUrl && process.env.FIRECRAWL_API_KEY) {
    try {
      const scraped = await firecrawlScrape(researchUrl);
      if (scraped.content) {
        systemPrompt += `\n\nPAGE_CONTENT [${scraped.title}]:\n${scraped.content}`;
        logger.debug({ url: researchUrl }, 'Firecrawl page scraped and injected');
      }
    } catch (e) {
      logger.debug({ err: (e as Error).message }, 'Firecrawl scrape failed, continuing');
    }
  }

  // 6d. Trim conversation history to token budget (3000 token estimate)
  const trimmedHistory = trimConversationHistory(history, 3000) as ChatMessage[];

  // 7. Route through bridge (PicoClaw for simple, Kimi for complex) or fallback to routeChat
  let replyText: string;
  let provider: string;
  let model: string;
  let tokensIn = 0;
  let tokensOut = 0;
  let creditCost = 0;

  if (config.bridgeEnabled) {
    // Use the bridge — routes trivial/simple → PicoClaw (2-5s), complex → Kimi
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
      logger.warn({ err: (err as Error).message }, 'Bridge failed for channel message, falling back to routeChat');
      // Fallback to routeChat
      const messages: ChatMessage[] = [...trimmedHistory, { role: 'user', content: llmUserText }];
      const result = await routeChat(messages, {
        systemPrompt,
        agentName: (agentConfig?.name as string) || 'Geek',
        userCredits,
      });
      replyText = result.reply;
      provider = result.provider;
      model = result.model;
      tokensIn = result.tokensIn;
      tokensOut = result.tokensOut;
      creditCost = result.creditCost;
    }
  } else {
    // Bridge not enabled — use routeChat directly
    const messages: ChatMessage[] = [...trimmedHistory, { role: 'user', content: llmUserText }];
    const result = await routeChat(messages, {
      systemPrompt,
      agentName: (agentConfig?.name as string) || 'Geek',
      userCredits,
    });
    replyText = result.reply;
    provider = result.provider;
    model = result.model;
    tokensIn = result.tokensIn;
    tokensOut = result.tokensOut;
    creditCost = result.creditCost;
  }

  // 7b. Parse and execute actions
  const { text: cleanReply, actions: parsedActions } = parseActions(replyText);
  const actionResults: ActionResult[] = [];

  for (const action of parsedActions) {
    // Inject baseUrl for generate_code actions to create preview links
    if (action.tool === 'generate_code') {
      action.params.baseUrl = config.apiUrl;
      // Self-destruct enabled by default (24h)
      action.params.selfDestruct = true;
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

  // 79.2: Fire-and-forget Ollama memory extraction (non-blocking)
  extractMemoriesWithOllama(userId, msg.text, finalReply).catch(() => { /* non-fatal */ });

  // 11. Send response back through originating channel
  await sendChannelResponse({
    channel: msg.channel,
    externalId: msg.externalId,
    text: channelReply,
    replyToMessageId: msg.messageId,
  });

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
