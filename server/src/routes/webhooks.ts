// ============================================================
// Webhook Routes — Telegram Bot + n8n Callbacks
//
// These are UNAUTHENTICATED endpoints called by external services.
// Each has its own verification mechanism.
// ============================================================

import { Router } from 'express';
import { config } from '../config.js';
import { logger } from '../logger.js';
import {
  verifyTelegramWebhook,
  parseTelegramUpdate,
  extractBotCommand,
  sendTelegramMessage,
  sendTelegramButtons,
  getBotUsername,
  answerCallbackQuery,
  getTelegramFileUrl,
  downloadTelegramFile,
  type TelegramUpdate,
} from '../services/telegram.js';
import { handleIncomingMessage, sendChannelResponse } from '../services/message-router.js';
import {
  getOrCreateOnboarding,
  handleOnboardingCallback,
  startOnboarding,
} from '../services/onboarding.js';
import { v4 as uuid } from 'uuid';
import {
  isVoiceEnabled,
  downloadTelegramVoice,
  transcribeVoice,
  textToSpeech,
  sendTelegramVoice,
  voiceCreditCost,
} from '../services/voice.js';
import { routeChat, type ChatMessage, deductSubscriptionCredits } from '../services/llm.js';
import { getConversationContext, logConversation, extractMemories } from '../services/memory.js';
import { buildChannelSystemPrompt } from '../services/message-router.js';
import { db } from '../db/index.js';
import { cacheGet, cacheSet } from '../services/cache.js';
import { handleEscalationReply } from '../services/escalation.js';

// Extend Express Request to include requestId for pipeline tracing
interface RequestWithId {
  requestId: string;
}

export const webhooksRouter = Router();

// ================================================================
// TELEGRAM WEBHOOK
// ================================================================

webhooksRouter.post('/telegram', async (req, res) => {
  // Generate request-id for tracing this message through the pipeline
  const requestId = uuid();
  (req as RequestWithId).requestId = requestId;

  // Verify secret token — reject if secret not configured (secure by default)
  if (!config.telegramWebhookSecret) {
    logger.warn({ requestId }, 'Telegram webhook: no secret configured, rejecting');
    res.sendStatus(401);
    return;
  }
  const secretToken = req.headers['x-telegram-bot-api-secret-token'] as string;
  if (!verifyTelegramWebhook(secretToken)) {
    logger.warn({ requestId }, 'Telegram webhook: invalid secret token');
    res.sendStatus(403);
    return;
  }

  // Respond immediately — Telegram requires fast 200
  res.sendStatus(200);

  const update = req.body as TelegramUpdate;

  // Per-chat rate limiting — max 20 requests / 60s per chat_id
  // Must happen after 200 response (Telegram needs instant ACK)
  const rlChatId = String(
    update.message?.chat?.id ?? update.callback_query?.message?.chat?.id ?? 'unknown'
  );
  try {
    const rlKey = `telegram:ratelimit:${rlChatId}`;
    const rlCount = Number(await cacheGet(rlKey) || 0) + 1;
    await cacheSet(rlKey, String(rlCount), 60);
    if (rlCount > 20) {
      logger.warn({ requestId, chatId: rlChatId, count: rlCount }, 'Telegram rate limit exceeded — dropping update');
      return;
    }
  } catch {
    // Redis unavailable — allow request through, do not block
  }

  logger.info({ requestId, updateId: update.update_id }, 'Telegram webhook received');

  // ── Bot-message filter (7.2) ─────────────────────────────────────────────
  // Skip messages from bots to prevent feedback loops and spam
  if (update.message?.from?.is_bot === true) {
    logger.info({ requestId, updateId: update.update_id }, 'Telegram webhook: skipping bot message');
    return;
  }

  // Skip oversized text to prevent abuse / prompt injection via huge payloads
  if (update.message?.text && update.message.text.length > 8000) {
    logger.warn({ requestId, updateId: update.update_id, length: update.message.text.length }, 'Telegram webhook: skipping oversized message');
    return;
  }

  try {
    const chatId = update.message?.chat.id || update.callback_query?.message?.chat.id;

    // Handle callback queries (button clicks) first
    if (update.callback_query) {
      const callbackData = update.callback_query.data;
      const callbackChatId = String(update.callback_query.message?.chat?.id);
      const callbackQueryId = update.callback_query.id;

      if (callbackData && callbackChatId) {
        // Answer the callback query immediately
        await answerCallbackQuery(callbackQueryId);

        // ── Reminder action buttons ──────────────────────────────────────
        if (callbackData.startsWith('reminder:')) {
          const [, action, reminderId] = callbackData.split(':');
          const link = db.prepare(
            "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
          ).get(callbackChatId) as { user_id: string } | undefined;

          if (link && reminderId) {
            if (action === 'done') {
              db.prepare("UPDATE reminders SET completed = 1, completed_at = ? WHERE id = ? AND user_id = ?")
                .run(Date.now(), reminderId, link.user_id);
              await sendTelegramMessage(callbackChatId, '✅ Reminder marked as done!');
            } else if (action === 'snooze') {
              // Snooze by 1 hour
              const reminder = db.prepare("SELECT datetime, text FROM reminders WHERE id = ? AND user_id = ?")
                .get(reminderId, link.user_id) as { datetime: string; text: string } | undefined;
              if (reminder) {
                const snoozedAt = new Date(Date.now() + 3600_000);
                const newDatetime = snoozedAt.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
                const newScheduledFor = snoozedAt.getTime();
                db.prepare("UPDATE reminders SET datetime = ?, scheduled_for = ? WHERE id = ? AND user_id = ?")
                  .run(newDatetime, newScheduledFor, reminderId, link.user_id);
                db.prepare("INSERT OR IGNORE INTO snooze_log (reminder_id, user_id, snoozed_at, preset, new_datetime) VALUES (?, ?, ?, ?, ?)")
                  .run(reminderId, link.user_id, Date.now(), '1h', newDatetime);
                await sendTelegramMessage(callbackChatId, `💤 Snoozed! "${reminder.text}" will remind you in 1 hour.`);
              }
            } else if (action === 'delete') {
              db.prepare("DELETE FROM reminders WHERE id = ? AND user_id = ?").run(reminderId, link.user_id);
              await sendTelegramMessage(callbackChatId, '🗑️ Reminder deleted.');
            }
          }
          return;
        }

        // ── Photo analysis save buttons ──────────────────────────────────
        if (callbackData.startsWith('photo:')) {
          const [, action, encodedContent] = callbackData.split(':');
          if (action === 'save' && encodedContent) {
            const link2 = db.prepare(
              "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
            ).get(callbackChatId) as { user_id: string } | undefined;
            if (link2) {
              const content = decodeURIComponent(encodedContent);
              db.prepare(`
                INSERT INTO notes (user_id, title, content, tags, created_at, updated_at)
                VALUES (?, ?, ?, ?, unixepoch('now')*1000, unixepoch('now')*1000)
              `).run(link2.user_id, `📸 Photo Analysis`, content, JSON.stringify(['photo', 'telegram']));
              await sendTelegramMessage(callbackChatId, '✅ Saved as a note!');
            }
          } else if (action === 'dismiss') {
            await sendTelegramMessage(callbackChatId, 'OK, not saved.');
          }
          return;
        }

        // ── Focus session buttons ────────────────────────────────────────
        if (callbackData.startsWith('focus:')) {
          const [, action] = callbackData.split(':');
          const link = db.prepare(
            "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
          ).get(callbackChatId) as { user_id: string } | undefined;

          if (link) {
            if (action === 'done') {
              // Mark the most recent active focus session as completed
              const session = db.prepare(
                "SELECT id FROM focus_sessions WHERE user_id = ? AND completed = 0 ORDER BY started_at DESC LIMIT 1"
              ).get(link.user_id) as { id: number } | undefined;
              if (session) {
                db.prepare("UPDATE focus_sessions SET completed = 1, ended_at = ? WHERE id = ?")
                  .run(Date.now(), session.id);
              }
              await sendTelegramMessage(callbackChatId, '🎉 Focus session complete! Great work.');
            } else if (action === 'pause') {
              await sendTelegramMessage(callbackChatId, '⏸️ Session paused. Take a short break — type "resume focus" when ready.');
            }
          }
          return;
        }

        // Try to handle as onboarding callback
        const handled = await handleOnboardingCallback(callbackChatId, callbackData);
        if (handled) {
          return; // Onboarding handled it
        }

        // Otherwise, it's a regular action chip - handle accordingly
        logger.info({ callbackData, chatId: callbackChatId }, 'Unhandled callback query');
      }
      return;
    }

    // Handle bot commands first
    const command = extractBotCommand(update);
    if (command) {
      // Special handling for /start command - begin onboarding
      if (command.command === 'start') {
        await startOnboarding(String(chatId));
        return;
      }
      await handleTelegramCommand(command, update, requestId);
      return;
    }

    // Check if user is in onboarding mode
    if (chatId) {
      const session = getOrCreateOnboarding(String(chatId));
      if (session.state !== 'complete' && session.state !== 'welcome') {
        // User is in onboarding but sent a text message instead of clicking buttons
        await sendTelegramMessage(chatId,
          "Please use the buttons above to continue setup, or type /start to restart."
        );
        return;
      }
    }

    // Handle voice messages
    if (update.message?.voice) {
      await handleVoiceMessage(update, requestId);
      return;
    }

    // Handle photo messages — describe image using vision LLM
    if (update.message?.photo && update.message.photo.length > 0) {
      await handlePhotoMessage(update, requestId);
      return;
    }

    // Handle document messages — extract text/PDF to note
    if (update.message?.document) {
      await handleDocumentMessage(update, requestId);
      return;
    }

    // Handle regular text messages
    // Extract native reply context BEFORE parsing normalized message
    const replyToMessageId = update.message?.reply_to_message?.message_id;
    const normalized = parseTelegramUpdate(update);
    if (normalized) {
      // Check if this is a reply to an escalation before normal routing
      const escalationHandled = await handleEscalationReply(normalized.externalId, normalized.text, replyToMessageId);
      if (escalationHandled) return;

      await handleIncomingMessage({ ...normalized, requestId });

      // After handling, send action chips for agentic feel
      // This happens asynchronously after the main response
      setTimeout(async () => {
        try {
          const { sendActionChips } = await import('../services/onboarding.js');
          await sendActionChips(normalized.externalId);
        } catch {
          // Non-fatal
        }
      }, 2000);
    }
  } catch (err) {
    logger.error({ err, updateId: update.update_id, requestId }, 'Telegram webhook processing error');
  }
});

// ---- Telegram Voice Message Handler ----

async function handleVoiceMessage(update: TelegramUpdate, requestId: string): Promise<void> {
  const msg = update.message!;
  const chatId = msg.chat.id;
  const voice = msg.voice!;

  // Check if voice is enabled
  if (!isVoiceEnabled()) {
    await sendTelegramMessage(chatId, 'Voice notes are not enabled yet. Please send a text message instead.');
    return;
  }

  // Reject voice notes longer than 5 minutes (cost/abuse guard)
  if (voice.duration > 300) {
    await sendTelegramMessage(chatId, 'Voice note too long (max 5 minutes). Please send a shorter message.');
    return;
  }

  // Check if user is linked
  const link = db.prepare(
    "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
  ).get(String(chatId)) as { user_id: string } | undefined;

  if (!link) {
    await sendTelegramMessage(chatId,
      'Link your account first to use voice notes. Go to your Agentin dashboard → Connections → Telegram.');
    return;
  }

  // Check credits (voice costs extra)
  const sub = db.prepare('SELECT credits_remaining, plan FROM subscriptions WHERE user_id = ?')
    .get(link.user_id) as { credits_remaining: number; plan?: string } | undefined;

  if (sub && sub.credits_remaining < 10) {
    await sendTelegramMessage(chatId, 'Not enough credits for voice processing. Voice notes require extra credits for transcription.');
    return;
  }

  const startTime = Date.now();

  try {
    // 1. Download audio
    await sendTelegramMessage(chatId, '🎙️ Processing your voice note...');
    const audioBuffer = await downloadTelegramVoice(voice.file_id);
    logger.info({ requestId, chatId, bytes: audioBuffer.length }, 'voice:downloaded');

    // 2. Transcribe (Groq Whisper)
    const transcript = await transcribeVoice(audioBuffer, 'audio/ogg');
    logger.info({ requestId, chatId, chars: transcript.length, transcript }, 'voice:transcribed');

    if (!transcript) {
      await sendTelegramMessage(chatId, "Sorry, I couldn't make out what you said. Please try again.");
      return;
    }

    // 3. Get user + agent config for system prompt
    const userRow = db.prepare('SELECT name, username, timezone FROM users WHERE id = ?')
      .get(link.user_id) as { name: string; username: string; timezone?: string } | undefined;
    const agentConfig = db.prepare('SELECT name, personality, mode, voice FROM agent_configs WHERE user_id = ?')
      .get(link.user_id) as Record<string, unknown> | undefined;

    // 4. Build LLM messages
    const history = getConversationContext(link.user_id) as ChatMessage[];
    const systemPrompt = buildChannelSystemPrompt(agentConfig, userRow ?? {}, link.user_id, 'telegram_voice', transcript);
    const systemPromptWithLang = systemPrompt +
      '\n\nIMPORTANT: Detect the language of the user\'s message. ' +
      'Always reply in the exact same language the user spoke in. ' +
      'If they spoke Hindi, reply in Hindi. ' +
      'If they spoke Telugu, reply in Telugu. ' +
      'If they spoke English, reply in English. ' +
      'Never switch languages unless the user does first.';
    const messages: ChatMessage[] = [...history, { role: 'user', content: transcript }];

    // 5. Route through LLM
    // Detect non-Latin script (Devanagari, Telugu, Tamil, Arabic) or Hinglish in transcript
    const transcriptHasNonLatin = /\p{Script=Devanagari}|\p{Script=Telugu}|\p{Script=Arabic}|\p{Script=Tamil}|\p{Script=Gujarati}/u.test(transcript);
    const HINGLISH_WORDS_VOICE = new Set(['aap','kya','kaise','hai','hain','ho','mera','meri','nahi','haan',
      'yaar','bhai','bolo','main','tum','woh','yeh','karo','batao','kitna','kahan','kab','kaun','kyun',
      'mujhe','tumhe','theek','accha','chalo','suno','bahut','abhi','lekin','aur','sirf','toh','naam','kaam']);
    const transcriptWords = transcript.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
    const transcriptIsHinglish = transcriptWords.filter(w => HINGLISH_WORDS_VOICE.has(w)).length >= 2;
    const voiceNeedsGroq = transcriptHasNonLatin || transcriptIsHinglish;

    const llmResponse = await routeChat(messages, {
      systemPrompt: systemPromptWithLang,
      userId: link.user_id,
      userPlan: (sub as { plan?: string } | undefined)?.plan,
      ...(voiceNeedsGroq ? { forceProvider: 'groq' as const } : {}),
    });

    // 6. Log conversation
    logConversation(link.user_id, 'user', transcript, requestId);
    logConversation(link.user_id, 'assistant', llmResponse.reply, requestId, llmResponse.provider, llmResponse.model);
    extractMemories(link.user_id, transcript);

    // 7. TTS → OGG Opus
    const audioReply = await textToSpeech(llmResponse.reply);
    const totalMs = Date.now() - startTime;
    logger.info({ requestId, chatId, bytes: audioReply.length, totalMs }, 'voice:tts complete');

    // 8. Send voice note (with transcript as caption)
    const caption = `🎤 "${transcript.slice(0, 200)}"`;
    await sendTelegramVoice(chatId, audioReply, msg.message_id, caption);

    // 9. Deduct credits
    const creditCost = voiceCreditCost(voice.duration || 0, llmResponse.reply.length);
    deductSubscriptionCredits(link.user_id, creditCost);

    logger.info({ requestId, chatId, creditCost, totalMs }, 'voice:pipeline complete');

  } catch (err) {
    logger.error({ err, requestId, chatId }, 'voice:pipeline error');
    await sendTelegramMessage(chatId, '⚠️ Voice processing failed. Please try again or send a text message.');
  }
}

// ---- Photo Message Handler (Vision LLM) ----

async function handlePhotoMessage(update: TelegramUpdate, requestId: string): Promise<void> {
  const msg = update.message!;
  const chatId = msg.chat.id;
  const caption = msg.caption || '';

  const link = db.prepare(
    "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
  ).get(String(chatId)) as { user_id: string } | undefined;
  if (!link) {
    await sendTelegramMessage(chatId, 'Link your account first to use photo analysis.');
    return;
  }

  // Get the largest photo variant (last in array)
  const photos = msg.photo!;
  const largest = photos[photos.length - 1];

  await sendTelegramMessage(chatId, '🖼️ Analysing your image...');

  try {
    const fileUrl = await getTelegramFileUrl(largest.file_id);
    if (!fileUrl) {
      await sendTelegramMessage(chatId, '⚠️ Could not access the image. Please try again.');
      return;
    }

    // Use vision-capable LLM (Groq llama-3.2-90b-vision-preview or OpenRouter)
    const { routeChat } = await import('../services/llm.js');
    const userMessage = caption
      ? `Describe this image and answer: ${caption}`
      : 'Describe this image in detail. What do you see?';

    const result = await routeChat(
      [{ role: 'user', content: [
        { type: 'text', text: userMessage },
        { type: 'image_url', image_url: { url: fileUrl } },
      ] as unknown as string }],
      {
        systemPrompt: 'You are a helpful AI assistant. Describe images clearly and concisely.',
        forceProvider: 'groq',
        userId: link.user_id,
      }
    );

    await sendTelegramMessage(chatId, result.reply || 'I could not analyse this image.');

    // Offer to save as note
    await sendTelegramButtons(chatId,
      'Would you like to save this analysis as a note?',
      [[
        { text: '📝 Save as note', callback_data: `photo:save:${encodeURIComponent(result.reply.slice(0, 200))}` },
        { text: '❌ No thanks', callback_data: 'photo:dismiss' },
      ]]
    );
  } catch (err) {
    logger.warn({ err, requestId, chatId }, 'Photo analysis failed');
    await sendTelegramMessage(chatId, '⚠️ Image analysis failed. Try adding a text caption with your question.');
  }
}

// ---- Document Message Handler (PDF/text → note) ----

async function handleDocumentMessage(update: TelegramUpdate, requestId: string): Promise<void> {
  const msg = update.message!;
  const chatId = msg.chat.id;
  const doc = msg.document!;
  const caption = msg.caption || '';

  const link = db.prepare(
    "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
  ).get(String(chatId)) as { user_id: string } | undefined;
  if (!link) {
    await sendTelegramMessage(chatId, 'Link your account first to use document processing.');
    return;
  }

  const mimeType = doc.mime_type || '';
  const fileName = doc.file_name || 'document';
  const maxSize = 5 * 1024 * 1024; // 5MB limit

  if (doc.file_size && doc.file_size > maxSize) {
    await sendTelegramMessage(chatId, `⚠️ File too large (${Math.round(doc.file_size / 1024)}KB). Max 5MB supported.`);
    return;
  }

  // Only support text-extractable formats
  const supported = mimeType.includes('text') || mimeType.includes('pdf') ||
    mimeType.includes('markdown') || fileName.endsWith('.txt') || fileName.endsWith('.md');

  if (!supported) {
    await sendTelegramMessage(chatId, `📎 Got "${fileName}". I can extract text from .txt, .md, and .pdf files. For other formats, try copying the text directly.`);
    return;
  }

  await sendTelegramMessage(chatId, `📄 Processing "${fileName}"...`);

  try {
    const buffer = await downloadTelegramFile(doc.file_id);
    if (!buffer) {
      await sendTelegramMessage(chatId, '⚠️ Could not download the file. Please try again.');
      return;
    }

    // Extract text content
    let textContent = '';
    if (mimeType.includes('text') || fileName.endsWith('.txt') || fileName.endsWith('.md')) {
      textContent = buffer.toString('utf-8').slice(0, 10000);
    } else if (mimeType.includes('pdf')) {
      // For PDFs, extract raw text (basic extraction without heavy libraries)
      const rawText = buffer.toString('latin1');
      // Extract visible text between BT/ET PDF blocks (rudimentary)
      const matches = rawText.match(/\(([^)]{2,200})\)/g);
      if (matches && matches.length > 5) {
        textContent = matches.map(m => m.slice(1, -1)).join(' ').slice(0, 8000);
      } else {
        textContent = `[PDF: ${fileName}] — Could not extract text automatically.`;
      }
    }

    if (!textContent.trim()) {
      await sendTelegramMessage(chatId, `📄 "${fileName}" appears to be empty or unreadable.`);
      return;
    }

    // Save as note
    const title = caption || `📄 ${fileName}`;
    const noteContent = caption
      ? `Caption: ${caption}\n\n---\n${textContent}`
      : textContent;

    db.prepare(`
      INSERT INTO notes (user_id, title, content, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, unixepoch('now')*1000, unixepoch('now')*1000)
    `).run(link.user_id, title, noteContent.slice(0, 20000), JSON.stringify(['document', 'telegram']));

    const preview = textContent.slice(0, 200);
    await sendTelegramMessage(chatId,
      `✅ Saved "${title}" as a note!\n\nPreview:\n${preview}${textContent.length > 200 ? '...' : ''}\n\n` +
      `Use /search ${fileName.split('.')[0]} to find it later.`
    );

    logger.info({ requestId, chatId, userId: link.user_id, fileName, chars: textContent.length }, 'document:saved_as_note');
  } catch (err) {
    logger.warn({ err, requestId, chatId }, 'Document processing failed');
    await sendTelegramMessage(chatId, '⚠️ Document processing failed. Please try again.');
  }
}

// ---- Telegram Bot Command Handler ----

async function handleTelegramCommand(
  cmd: { command: string; args: string },
  update: TelegramUpdate,
  requestId: string,
): Promise<void> {
  const chatId = update.message!.chat.id;
  const fromId = update.message!.from.id;
  const fromUsername = update.message!.from.username || '';

  switch (cmd.command) {
    case '/start': {
      // Deep link: /start link_XXXXXX
      if (cmd.args.startsWith('link_')) {
        const code = cmd.args.slice(5).toUpperCase();
        await handleLinkCode(chatId, String(fromId), fromUsername, code);
        return;
      }

      // Regular start
      const linked = db.prepare(
        "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
      ).get(String(chatId)) as { user_id: string } | undefined;

      if (linked) {
        const user = db.prepare('SELECT name FROM users WHERE id = ?').get(linked.user_id) as { name: string } | undefined;
        await sendTelegramMessage(chatId,
          `Welcome back, ${user?.name || 'there'}! Just type a message to chat with your AI agent.\n\n` +
          `Commands:\n/help — Show available commands\n/credits — Check credit balance\n/status — Connection status`
        );
      } else {
        await sendTelegramMessage(chatId,
          `Hi! I'm your Agentin AI assistant.\n\n` +
          `To get started, link your account:\n` +
          `1. Go to your Agentin dashboard → Connections\n` +
          `2. Click "Connect" on Telegram\n` +
          `3. Follow the instructions\n\n` +
          `Or use /link for instructions.`
        );
      }
      break;
    }

    case '/link': {
      // Direct email linking removed for security — use link code flow instead
      await sendTelegramMessage(chatId,
        'To link your account:\n' +
        '1. Go to your Agentin dashboard → Connections\n' +
        '2. Click "Connect" on Telegram\n' +
        '3. Click the link code to open this bot\n\n' +
        'This generates a secure one-time code that expires in 10 minutes.'
      );
      break;
    }

    case '/unlink': {
      const link = db.prepare(
        "SELECT id, user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
      ).get(String(chatId)) as { id: string; user_id: string } | undefined;

      if (!link) {
        await sendTelegramMessage(chatId, 'No linked account found.');
        return;
      }

      db.prepare('DELETE FROM channel_links WHERE id = ?').run(link.id);
      db.prepare(
        "UPDATE integrations SET status = 'disconnected', health = 0 WHERE user_id = ? AND type = 'telegram'"
      ).run(link.user_id);

      await sendTelegramMessage(chatId, 'Account unlinked. To re-link, go to your Agentin dashboard → Connections → Telegram.');
      break;
    }

    case '/credits': {
      const link = db.prepare(
        "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
      ).get(String(chatId)) as { user_id: string } | undefined;

      if (!link) {
        await sendTelegramMessage(chatId, 'Link your account first — go to your Agentin dashboard → Connections → Telegram.');
        return;
      }

      const sub = db.prepare(
        'SELECT plan, credits_remaining, credits_used_this_cycle, billing_cycle_end FROM subscriptions WHERE user_id = ?'
      ).get(link.user_id) as { plan: string; credits_remaining: number; credits_used_this_cycle: number; billing_cycle_end: string } | undefined;

      if (sub) {
        await sendTelegramMessage(chatId,
          `Plan: ${sub.plan}\nCredits remaining: ${sub.credits_remaining.toLocaleString()}\nUsed this cycle: ${sub.credits_used_this_cycle.toLocaleString()}\nResets: ${sub.billing_cycle_end.split('T')[0]}`
        );
      } else {
        const user = db.prepare('SELECT credits, plan FROM users WHERE id = ?').get(link.user_id) as { credits: number; plan: string };
        await sendTelegramMessage(chatId, `Plan: ${user.plan}\nCredits: ${user.credits.toLocaleString()}`);
      }
      break;
    }

    case '/status': {
      const link = db.prepare(
        "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
      ).get(String(chatId)) as { user_id: string } | undefined;

      if (!link) {
        await sendTelegramMessage(chatId, 'Not linked. Use /link <email> to connect.');
        return;
      }

      const user = db.prepare('SELECT name, username FROM users WHERE id = ?').get(link.user_id) as { name: string; username: string };
      const agentConfig = db.prepare('SELECT name, personality, mode FROM agent_configs WHERE user_id = ?').get(link.user_id) as { name: string; personality: string; mode: string } | undefined;

      await sendTelegramMessage(chatId,
        `Connected as: ${user.name} (@${user.username})\nAgent: ${agentConfig?.name || 'Geek'}\nPersonality: ${agentConfig?.personality || 'jarvis'}\nMode: ${agentConfig?.mode || 'builder'}`
      );
      break;
    }

    case '/help': {
      await sendTelegramMessage(chatId,
        `Agentin Bot Commands:\n\n` +
        `ACCOUNT\n` +
        `/start — Get started\n` +
        `/link — Link your Agentin account\n` +
        `/unlink — Unlink your account\n` +
        `/credits — Check credit balance\n` +
        `/status — Connection status\n` +
        `/model — View and switch AI models\n\n` +
        `PRODUCTIVITY\n` +
        `/habits — View and track daily habits\n` +
        `/study — Study dashboard (flashcards + focus)\n` +
        `/notes — View recent notes\n` +
        `/remind <text> — Set a quick reminder\n` +
        `/expenses — Monthly expense report\n` +
        `/search <keyword> — Search notes, reminders & habits\n\n` +
        `SETTINGS\n` +
        `/proactive — Toggle proactive AI messages\n` +
        `/agents — List your agents\n` +
        `/tasks — View recent tasks\n` +
        `/cancel — Cancel a queued task\n` +
        `/deploy — Deploy your portfolio\n` +
        `/help — Show this message\n\n` +
        `Or just type anything to chat with your AI agent!\n` +
        `Try: "morning briefing", "take note: ...", "make flashcards for Python"`
      );
      break;
    }

    case '/tasks': {
      const link = db.prepare(
        "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
      ).get(String(chatId)) as { user_id: string } | undefined;

      if (!link) { await sendTelegramMessage(chatId, 'Link your account first. Use /link for instructions.'); return; }

      const tasks = db.prepare(`
        SELECT task_type, description, status, completed_at, created_at
        FROM pico_tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT 10
      `).all(link.user_id) as Array<{ task_type: string; description: string; status: string; completed_at: string | null; created_at: string }>;

      if (tasks.length === 0) {
        await sendTelegramMessage(chatId, 'No tasks yet. Send a message like "remind me to check email at 5pm" to create one.');
        return;
      }

      const statusEmoji: Record<string, string> = { completed: '✅', running: '⏳', queued: '🔵', failed: '❌', cancelled: '⛔' };
      const lines = tasks.map((t, i) => {
        const emoji = statusEmoji[t.status] || '⚪';
        const desc = t.description.length > 50 ? t.description.slice(0, 50) + '...' : t.description;
        return `${i + 1}. ${emoji} ${desc}`;
      });
      await sendTelegramMessage(chatId, `Recent tasks:\n\n${lines.join('\n')}`);
      break;
    }

    case '/agents': {
      const link = db.prepare(
        "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
      ).get(String(chatId)) as { user_id: string } | undefined;

      if (!link) { await sendTelegramMessage(chatId, 'Link your account first. Use /link for instructions.'); return; }

      const agents = db.prepare(
        'SELECT slot, name, personality, status, tasks_completed, tasks_failed FROM pico_agents WHERE user_id = ? ORDER BY slot'
      ).all(link.user_id) as Array<{ slot: number; name: string; personality: string; status: string; tasks_completed: number; tasks_failed: number }>;

      if (agents.length === 0) {
        await sendTelegramMessage(chatId, 'No agents deployed yet.');
        return;
      }

      const personalityEmoji: Record<string, string> = { edith: '⚡', jarvis: '🎩', weebo: '🤖' };
      const lines = agents.map(a => {
        const emoji = personalityEmoji[a.personality] || '🤖';
        return `${emoji} Slot ${a.slot}: ${a.name} (${a.personality}) — ${a.status}\n   ✅ ${a.tasks_completed} done, ❌ ${a.tasks_failed} failed`;
      });
      await sendTelegramMessage(chatId, `Your agents:\n\n${lines.join('\n\n')}`);
      break;
    }

    case '/cancel': {
      const link = db.prepare(
        "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
      ).get(String(chatId)) as { user_id: string } | undefined;

      if (!link) { await sendTelegramMessage(chatId, 'Link your account first. Use /link for instructions.'); return; }

      const queued = db.prepare(
        "SELECT id, description FROM pico_tasks WHERE user_id = ? AND status = 'queued' ORDER BY created_at ASC LIMIT 1"
      ).get(link.user_id) as { id: string; description: string } | undefined;

      if (!queued) {
        await sendTelegramMessage(chatId, 'No queued tasks to cancel.');
        return;
      }

      db.prepare("UPDATE pico_tasks SET status = 'cancelled', completed_at = datetime('now') WHERE id = ?").run(queued.id);
      await sendTelegramMessage(chatId, `Cancelled: ${queued.description.slice(0, 80)}`);
      break;
    }

    case '/remind': {
      if (!cmd.args.trim()) {
        await sendTelegramMessage(chatId, 'Usage: /remind <text>\nExample: /remind check email in 30 minutes');
        return;
      }

      // Treat as a regular message so it goes through task auto-detection
      const normalized = parseTelegramUpdate(update);
      if (normalized) {
        // Override the text to prepend "remind me" if not already there
        if (!normalized.text.toLowerCase().startsWith('remind')) {
          normalized.text = `remind me ${cmd.args}`;
        } else {
          normalized.text = cmd.args;
        }
        await handleIncomingMessage({ ...normalized, requestId });
      }
      break;
    }

    case '/deploy': {
      const link = db.prepare(
        "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
      ).get(String(chatId)) as { user_id: string } | undefined;

      if (!link) { await sendTelegramMessage(chatId, 'Link your account first. Use /link for instructions.'); return; }

      // Deploy portfolio
      db.prepare('UPDATE portfolios SET is_public = 1 WHERE user_id = ?').run(link.user_id);
      const user = db.prepare('SELECT username FROM users WHERE id = ?').get(link.user_id) as { username: string } | undefined;
      const url = user ? `https://ai.agentin.chat/${user.username}` : 'your dashboard';
      await sendTelegramMessage(chatId, `Portfolio deployed! View it at ${url}`);
      break;
    }

    case '/model': {
      const link = db.prepare(
        "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
      ).get(String(chatId)) as { user_id: string } | undefined;

      if (!link) {
        await sendTelegramMessage(chatId, 'Link your account first. Use /link for instructions.');
        return;
      }

      // Get available models
      const models = db.prepare(`
        SELECT id, display_name, summary, status FROM free_models
        WHERE status IN ('active', 'new') ORDER BY curated DESC, context_length DESC
      `).all() as Array<{ id: string; display_name: string; summary: string; status: string }>;

      if (models.length === 0) {
        await sendTelegramMessage(chatId, 'No free models available right now. Check back later.');
        return;
      }

      // Get user's current preference
      const agentCfg = db.prepare('SELECT preferred_free_model FROM agent_configs WHERE user_id = ?')
        .get(link.user_id) as { preferred_free_model: string | null } | undefined;
      const currentPref = agentCfg?.preferred_free_model || 'auto';

      if (!cmd.args.trim()) {
        // List all models
        const lines = models.map((m, i) => {
          const check = m.id === currentPref ? ' ✅' : '';
          const badge = m.status === 'new' ? ' 🆕' : '';
          return `${i + 1}. ${m.display_name}${badge}${check}\n   ${m.summary}`;
        });

        const autoCheck = currentPref === 'auto' ? ' ✅' : '';
        await sendTelegramMessage(chatId,
          `🤖 Available Free Models:\n\n` +
          `0. Auto-select${autoCheck}\n   Let the system pick the best model\n\n` +
          `${lines.join('\n\n')}\n\n` +
          `Reply /model <number> to switch, or /model auto`
        );
        return;
      }

      // Handle /model auto
      if (cmd.args.trim().toLowerCase() === 'auto') {
        db.prepare("UPDATE agent_configs SET preferred_free_model = 'auto' WHERE user_id = ?").run(link.user_id);
        await sendTelegramMessage(chatId, '✅ Switched to auto-select. The system will pick the best available model.');
        return;
      }

      // Handle /model <number>
      const num = parseInt(cmd.args.trim(), 10);
      if (!isNaN(num) && num >= 1 && num <= models.length) {
        const chosen = models[num - 1];
        db.prepare('UPDATE agent_configs SET preferred_free_model = ? WHERE user_id = ?').run(chosen.id, link.user_id);
        await sendTelegramMessage(chatId, `✅ Switched to ${chosen.display_name}.\n${chosen.summary}`);
        return;
      }

      // Handle /model <partial name>
      const search = cmd.args.trim().toLowerCase();
      const match = models.find(m =>
        m.display_name.toLowerCase().includes(search) ||
        m.id.toLowerCase().includes(search)
      );

      if (match) {
        db.prepare('UPDATE agent_configs SET preferred_free_model = ? WHERE user_id = ?').run(match.id, link.user_id);
        await sendTelegramMessage(chatId, `✅ Switched to ${match.display_name}.\n${match.summary}`);
      } else {
        await sendTelegramMessage(chatId, `Model not found: "${cmd.args.trim()}"\nUse /model to see available models.`);
      }
      break;
    }

    case '/proactive': {
      const link = db.prepare(
        "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
      ).get(String(chatId)) as { user_id: string } | undefined;
      if (!link) { await sendTelegramMessage(chatId, 'Link your account first. Use /link for instructions.'); return; }
      const toggle = cmd.args.trim().toLowerCase();
      if (toggle === 'off') {
        db.prepare("UPDATE users SET proactive_enabled = 0 WHERE id = ?").run(link.user_id);
        await sendTelegramMessage(chatId, 'Proactive messages turned OFF. You can turn them back on with /proactive on');
      } else if (toggle === 'on') {
        db.prepare("UPDATE users SET proactive_enabled = 1 WHERE id = ?").run(link.user_id);
        await sendTelegramMessage(chatId, 'Proactive messages turned ON. You\'ll get daily briefings at 8am and weekly reports on Sundays.');
      } else {
        const user = db.prepare('SELECT proactive_enabled FROM users WHERE id = ?').get(link.user_id) as { proactive_enabled: number } | undefined;
        const status = user?.proactive_enabled !== 0 ? 'ON' : 'OFF';
        await sendTelegramMessage(chatId,
          `Proactive messages: ${status}\n\n` +
          `Scheduled:\n• Daily briefing: 8am IST\n• Overdue alerts: 10am IST\n• Weekly report: Sunday 9am IST\n\n` +
          `/proactive on — Enable\n/proactive off — Disable`
        );
      }
      break;
    }

    case '/study': {
      const link = db.prepare(
        "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
      ).get(String(chatId)) as { user_id: string } | undefined;
      if (!link) { await sendTelegramMessage(chatId, 'Link your account first.'); return; }
      // Show study stats: flashcard decks, focus sessions, recent notes
      const notesCount = (db.prepare("SELECT COUNT(*) as n FROM notes WHERE user_id = ? AND archived = 0 AND tags LIKE '%flashcard%'").get(link.user_id) as { n: number }).n;
      const focusCount = (db.prepare("SELECT COUNT(*) as n FROM focus_sessions WHERE user_id = ? AND started_at > ?").get(link.user_id, Date.now() - 7 * 24 * 60 * 60 * 1000) as { n: number }).n;
      const focusMin = (db.prepare("SELECT COALESCE(SUM(duration_min),0) as t FROM focus_sessions WHERE user_id = ? AND started_at > ?").get(link.user_id, Date.now() - 7 * 24 * 60 * 60 * 1000) as { t: number }).t;
      const recentFlashcards = db.prepare("SELECT title FROM notes WHERE user_id = ? AND archived = 0 AND tags LIKE '%flashcard%' ORDER BY updated_at DESC LIMIT 5").all(link.user_id) as Array<{ title: string }>;
      await sendTelegramMessage(chatId,
        `Your Study Dashboard (7 days):\n\n` +
        `Flashcard decks: ${notesCount}\nFocus sessions: ${focusCount} (${focusMin} min total)\n\n` +
        (recentFlashcards.length ? `Recent decks:\n${recentFlashcards.map(f => `• ${f.title}`).join('\n')}\n\n` : '') +
        `Commands:\n• "make flashcards for [topic]" — Create a deck\n• "start focus: [goal]" — 25-min Pomodoro\n• "study cards for [topic]" — Create quiz cards`
      );
      break;
    }

    case '/habits': {
      const link = db.prepare(
        "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
      ).get(String(chatId)) as { user_id: string } | undefined;
      if (!link) { await sendTelegramMessage(chatId, 'Link your account first.'); return; }
      const habits = db.prepare(
        "SELECT name, current_streak, longest_streak FROM habits WHERE user_id = ? ORDER BY current_streak DESC"
      ).all(link.user_id) as Array<{ name: string; current_streak: number; longest_streak: number }>;
      // Check which habits were logged today
      const today = new Date().toISOString().slice(0, 10);
      const loggedToday = db.prepare(
        "SELECT h.name FROM habit_logs hl JOIN habits h ON hl.habit_id = h.id WHERE hl.user_id = ? AND date(hl.logged_at/1000, 'unixepoch') = ?"
      ).all(link.user_id, today) as Array<{ name: string }>;
      const loggedNames = new Set(loggedToday.map(l => l.name));
      if (habits.length === 0) {
        await sendTelegramMessage(chatId, 'You have no habits yet. Say "track my morning workout" to start a habit!');
      } else {
        const lines = habits.map(h => {
          const done = loggedNames.has(h.name) ? '✅' : '⬜';
          const streak = h.current_streak > 0 ? ` 🔥${h.current_streak}d` : '';
          return `${done} ${h.name}${streak}`;
        });
        await sendTelegramMessage(chatId,
          `Your Habits (${today}):\n\n${lines.join('\n')}\n\n` +
          `To log a habit: "I did my [habit name]"\nTo add new: "track my [habit name]"`
        );
      }
      break;
    }

    case '/notes': {
      const link = db.prepare(
        "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
      ).get(String(chatId)) as { user_id: string } | undefined;
      if (!link) { await sendTelegramMessage(chatId, 'Link your account first.'); return; }
      const notes = db.prepare(
        "SELECT title, created_at FROM notes WHERE user_id = ? AND archived = 0 ORDER BY updated_at DESC LIMIT 10"
      ).all(link.user_id) as Array<{ title: string; created_at: number }>;
      if (notes.length === 0) {
        await sendTelegramMessage(chatId, 'No notes yet. Say "take note: [content]" to save one!');
      } else {
        const list = notes.map((n, i) => `${i + 1}. ${n.title}`).join('\n');
        await sendTelegramMessage(chatId,
          `Your recent notes (${notes.length}):\n\n${list}\n\n` +
          `To search: "find my notes about [topic]"\nTo add: "take note: [content]"`
        );
      }
      break;
    }

    case '/expenses': {
      const link = db.prepare(
        "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
      ).get(String(chatId)) as { user_id: string } | undefined;
      if (!link) { await sendTelegramMessage(chatId, 'Link your account first.'); return; }

      // Check if expenses table exists (may need migration)
      const hasTable = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='expenses'"
      ).get() as { name: string } | undefined;

      if (!hasTable) {
        await sendTelegramMessage(chatId, 'Expense tracker is being set up. Try again in a moment!');
        return;
      }

      const monthStart = new Date();
      monthStart.setDate(1);
      const monthStr = monthStart.toISOString().slice(0, 10);

      const rows = db.prepare(`
        SELECT amount, category, description, date, currency
        FROM expenses WHERE user_id = ? AND date >= ?
        ORDER BY date DESC, created_at DESC LIMIT 15
      `).all(link.user_id, monthStr) as Array<{ amount: number; category: string; description: string; date: string; currency: string }>;

      if (rows.length === 0) {
        await sendTelegramMessage(chatId,
          'No expenses this month yet.\n\nTo log one: "I spent $25 on food" or "log $50 transport to office"'
        );
        return;
      }

      const total = rows.reduce((s, r) => s + r.amount, 0);
      const currency = rows[0].currency;
      const byCat: Record<string, number> = {};
      for (const r of rows) byCat[r.category] = (byCat[r.category] || 0) + r.amount;

      const catLines = Object.entries(byCat)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, amt]) => `• ${cat}: ${currency}${amt.toFixed(2)}`)
        .join('\n');

      const recentLines = rows.slice(0, 5)
        .map(r => `  ${r.date} ${r.category}: ${currency}${r.amount.toFixed(2)}${r.description ? ' — ' + r.description : ''}`)
        .join('\n');

      await sendTelegramMessage(chatId,
        `Monthly Expenses (${monthStr.slice(0, 7)}):\n\nTotal: ${currency}${total.toFixed(2)}\n\nBy category:\n${catLines}\n\nRecent:\n${recentLines}\n\nTo add: "I spent $X on [category]"`
      );
      break;
    }

    case '/search': {
      const link = db.prepare(
        "SELECT user_id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
      ).get(String(chatId)) as { user_id: string } | undefined;
      if (!link) { await sendTelegramMessage(chatId, 'Link your account first.'); return; }

      const query = cmd.args.trim();
      if (!query) {
        await sendTelegramMessage(chatId, 'Search across notes, reminders, habits, and memories.\n\nUsage: /search [keyword]\nExample: /search python flashcards');
        return;
      }

      const like = `%${query}%`;
      const results: string[] = [];

      // Search notes
      const notes = db.prepare(`
        SELECT title, content FROM notes WHERE user_id = ? AND archived = 0
        AND (title LIKE ? OR content LIKE ?) LIMIT 3
      `).all(link.user_id, like, like) as Array<{ title: string; content: string }>;
      if (notes.length) {
        results.push(`Notes (${notes.length}):\n${notes.map(n => `  • ${n.title}`).join('\n')}`);
      }

      // Search reminders
      const reminders = db.prepare(`
        SELECT text, datetime FROM reminders WHERE user_id = ? AND completed = 0
        AND text LIKE ? LIMIT 3
      `).all(link.user_id, like) as Array<{ text: string; datetime: string }>;
      if (reminders.length) {
        results.push(`Reminders (${reminders.length}):\n${reminders.map(r => `  • ${r.text}${r.datetime ? ' @ ' + r.datetime : ''}`).join('\n')}`);
      }

      // Search habits
      const habits = db.prepare(`
        SELECT name, current_streak FROM habits WHERE user_id = ? AND name LIKE ? LIMIT 3
      `).all(link.user_id, like) as Array<{ name: string; current_streak: number }>;
      if (habits.length) {
        results.push(`Habits (${habits.length}):\n${habits.map(h => `  • ${h.name} (${h.current_streak}d streak)`).join('\n')}`);
      }

      // Search memories
      const memories = db.prepare(`
        SELECT content FROM user_memories WHERE user_id = ? AND content LIKE ? LIMIT 3
      `).all(link.user_id, like) as Array<{ content: string }>;
      if (memories.length) {
        results.push(`Memories (${memories.length}):\n${memories.map(m => `  • ${m.content.slice(0, 80)}...`).join('\n')}`);
      }

      if (results.length === 0) {
        await sendTelegramMessage(chatId, `No results found for "${query}". Try a different keyword.`);
      } else {
        await sendTelegramMessage(chatId,
          `Search results for "${query}":\n\n${results.join('\n\n')}`
        );
      }
      break;
    }

    default: {
      // Unknown command — treat as regular message
      const normalized = parseTelegramUpdate(update);
      if (normalized) {
        await handleIncomingMessage(normalized);
      }
      break;
    }
  }
}


// ---- Link Code Handler ----

async function handleLinkCode(
  chatId: number,
  telegramId: string,
  telegramUsername: string,
  code: string,
): Promise<void> {
  // Look up the code
  const linkCode = db.prepare(
    "SELECT user_id, channel FROM link_codes WHERE code = ? AND channel = 'telegram' AND expires_at > datetime('now')"
  ).get(code) as { user_id: string; channel: string } | undefined;

  if (!linkCode) {
    await sendTelegramMessage(chatId, 'Invalid or expired link code. Please generate a new one from your dashboard.');
    return;
  }

  // Check if already linked
  const existing = db.prepare(
    "SELECT id FROM channel_links WHERE channel = 'telegram' AND external_id = ?"
  ).get(telegramId);

  if (existing) {
    await sendTelegramMessage(chatId, 'This Telegram account is already linked to an Agentin account.');
    // Clean up the code
    db.prepare('DELETE FROM link_codes WHERE code = ?').run(code);
    return;
  }

  // Create the link
  db.prepare(
    'INSERT INTO channel_links (id, user_id, channel, external_id, external_username) VALUES (?, ?, ?, ?, ?)'
  ).run(uuid(), linkCode.user_id, 'telegram', telegramId, telegramUsername);

  // Update integrations table
  db.prepare(
    "UPDATE integrations SET status = 'connected', health = 100, last_sync = ? WHERE user_id = ? AND type = 'telegram'"
  ).run(new Date().toISOString(), linkCode.user_id);

  // Delete the used code
  db.prepare('DELETE FROM link_codes WHERE code = ?').run(code);

  const user = db.prepare('SELECT name FROM users WHERE id = ?').get(linkCode.user_id) as { name: string };

  await sendTelegramMessage(chatId,
    `Account linked successfully! Welcome, ${user.name}.\n\nYou can now chat with your AI agent right here. Just type a message!`
  );
}

// ================================================================
// N8N CALLBACK WEBHOOK
// ================================================================

webhooksRouter.post('/n8n/callback', async (req, res) => {
  // Require n8n webhook secret — reject if not configured or mismatch
  if (!config.n8nWebhookSecret) {
    logger.warn('n8n webhook: N8N_WEBHOOK_SECRET not configured — rejecting request');
    res.status(503).json({ error: 'n8n webhook not configured' });
    return;
  }
  const secret = req.headers['x-n8n-secret'] as string;
  if (secret !== config.n8nWebhookSecret) {
    logger.warn('n8n webhook: invalid or missing secret');
    res.sendStatus(401);
    return;
  }

  const { userId, channel, externalId, message } = req.body;

  if (!userId || !channel || !externalId || !message) {
    res.status(400).json({ error: 'Missing required fields: userId, channel, externalId, message' });
    return;
  }

  try {
    await sendChannelResponse({
      channel,
      externalId,
      text: message,
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err, userId, channel }, 'n8n callback relay failed');
    res.status(500).json({ error: 'Failed to relay message' });
  }
});

// ================================================================
// WHATSAPP WEBHOOK
// ================================================================

webhooksRouter.post('/whatsapp', async (req, res) => {
  // Verify webhook signature if configured
  const signature = req.headers['x-whatsapp-signature'] as string;
  const body = JSON.stringify(req.body);

  const { verifyWhatsAppWebhook } = await import('../services/whatsapp.js');
  if (!verifyWhatsAppWebhook(signature, body)) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  try {
    const { entry } = req.body;

    // Process incoming WhatsApp messages
    if (entry && entry.length > 0) {
      for (const e of entry) {
        if (e.changes) {
          for (const change of e.changes) {
            if (change.value?.messages) {
              for (const message of change.value.messages) {
                // Handle LINK command for account linking
                if (message.text?.body?.startsWith('LINK ')) {
                  const code = message.text.body.slice(5).trim();
                  await handleWhatsAppLinkCode(
                    message.from,
                    change.value.contacts?.[0]?.profile?.name || '',
                    code
                  );
                } else {
                  // Regular message - route through message router
                  const normalized = {
                    channel: 'whatsapp' as const,
                    externalId: message.from,
                    text: message.text?.body || '',
                    messageId: message.id,
                    senderName: change.value.contacts?.[0]?.profile?.name || '',
                    timestamp: new Date(message.timestamp * 1000).toISOString(),
                  };
                  await handleIncomingMessage(normalized);
                }
              }
            }
          }
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'WhatsApp webhook processing error');
    res.status(500).json({ error: 'Processing failed' });
  }
});

async function handleWhatsAppLinkCode(
  phoneNumber: string,
  name: string,
  code: string,
): Promise<void> {
  // Look up the code
  const linkCode = db.prepare(
    "SELECT user_id FROM link_codes WHERE code = ? AND channel = 'whatsapp' AND expires_at > datetime('now')"
  ).get(code) as { user_id: string } | undefined;

  if (!linkCode) {
    // Send error message via WhatsApp (would need actual API integration)
    logger.warn({ phoneNumber, code }, 'Invalid or expired WhatsApp link code');
    return;
  }

  // Check if already linked
  const existing = db.prepare(
    "SELECT id FROM channel_links WHERE channel = 'whatsapp' AND external_id = ?"
  ).get(phoneNumber);

  if (existing) {
    logger.info({ phoneNumber }, 'WhatsApp account already linked');
    return;
  }

  // Create the link
  db.prepare(
    'INSERT INTO channel_links (id, user_id, channel, external_id, external_username) VALUES (?, ?, ?, ?, ?)'
  ).run(uuid(), linkCode.user_id, 'whatsapp', phoneNumber, name);

  // Update integrations table
  db.prepare(
    "UPDATE integrations SET status = 'connected', health = 100, last_sync = ? WHERE user_id = ? AND type = 'whatsapp'"
  ).run(new Date().toISOString(), linkCode.user_id);

  // Delete the used code
  db.prepare('DELETE FROM link_codes WHERE code = ?').run(code);

  logger.info({ userId: linkCode.user_id, phoneNumber }, 'WhatsApp account linked');
}
