/**
 * Telegram Commands Tests — Phase 104 Command Center
 *
 * Verifies:
 * - /remind creates a reminder via message router
 * - /note creates a note in DB
 * - /focus creates a focus session in DB
 * - /habit logs a habit in DB
 * - /memory saves to user_memories
 * - /search returns results
 * - /brief returns briefing
 * - /help returns command list
 * - Unknown command falls through to normal AI chat
 * - setMyCommands registered on init
 */

import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from 'vitest';
import { v4 as uuid } from 'uuid';
import fs from 'fs';
import path from 'path';

// Track sent messages
const sentMessages: Array<{ chatId: number | string; text: string }> = [];
const sentButtons: Array<{ chatId: number | string; text: string; buttons: unknown }> = [];

vi.mock('../../services/cache.js', () => ({
  cacheGet: vi.fn(async () => null),
  cacheSet: vi.fn(async () => {}),
  cacheDel: vi.fn(async () => {}),
}));

vi.mock('../../services/telegram.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../services/telegram.js')>();
  return {
    ...original,
    sendTelegramMessage: vi.fn(async (chatId: number | string, text: string) => {
      sentMessages.push({ chatId, text });
      return { messageId: 1, success: true };
    }),
    sendTelegramButtons: vi.fn(async (chatId: number | string, text: string, buttons: unknown) => {
      sentButtons.push({ chatId, text, buttons });
      return { messageId: 1, success: true };
    }),
    answerCallbackQuery: vi.fn(async () => true),
    getBotUsername: vi.fn(() => 'testbot'),
    initTelegramBot: vi.fn(async () => {}),
    sendTelegramVoice: vi.fn(async () => {}),
    sendTelegramNotification: vi.fn(async () => ({ messageId: 1, success: true })),
    editTelegramMessage: vi.fn(async () => true),
  };
});

vi.mock('../../services/message-router.js', () => ({
  handleIncomingMessage: vi.fn(async () => {}),
  sendChannelResponse: vi.fn(async () => {}),
  buildChannelSystemPrompt: vi.fn(() => 'system prompt'),
}));

vi.mock('../../services/onboarding.js', () => ({
  getOrCreateOnboarding: vi.fn(() => ({ state: 'complete' })),
  handleOnboardingCallback: vi.fn(async () => false),
  startOnboarding: vi.fn(async () => {}),
  sendActionChips: vi.fn(async () => {}),
}));

vi.mock('../../services/escalation.js', () => ({
  handleEscalationReply: vi.fn(async () => false),
}));

vi.mock('../../services/voice.js', () => ({
  isVoiceEnabled: vi.fn(() => false),
  downloadTelegramVoice: vi.fn(async () => Buffer.from('')),
  transcribeVoice: vi.fn(async () => ''),
  textToSpeech: vi.fn(async () => Buffer.from('')),
  sendTelegramVoice: vi.fn(async () => {}),
  voiceCreditCost: vi.fn(() => 5),
}));

vi.mock('../../services/persona-engine.js', () => ({
  getPersonaResponse: vi.fn(async () => 'Nice work!'),
}));

vi.mock('../../services/search-index.js', () => ({
  indexNote: vi.fn(async () => {}),
  indexReminder: vi.fn(async () => {}),
  indexHabit: vi.fn(async () => {}),
  indexMemory: vi.fn(async () => {}),
}));

vi.mock('../../services/search-vector.js', () => ({
  semanticSearch: vi.fn(async () => []),
  upsertMemoryVector: vi.fn(async () => {}),
}));

vi.mock('../../services/event-bus.js', () => ({
  eventBus: { emit: vi.fn() },
}));

import request from 'supertest';
import { createApp } from '../../app.js';
import { resetDatabase, createTestUser } from '../setup.js';
import { config } from '../../config.js';
import { db } from '../../db/index.js';
import { handleIncomingMessage } from '../../services/message-router.js';
import {
  extractBotCommand,
  parseTelegramUpdate,
  type TelegramUpdate,
} from '../../services/telegram.js';

(config as Record<string, unknown>).isTestMode = true;

const app = createApp();
const WEBHOOK_SECRET = 'tg-cmd-test-secret';

// Helper to build a command update payload
function buildCommandUpdate(
  chatId: number,
  text: string,
  command: string,
): TelegramUpdate {
  return {
    update_id: Math.floor(Math.random() * 100000),
    message: {
      message_id: Math.floor(Math.random() * 100000),
      from: { id: chatId, is_bot: false, first_name: 'TestUser', username: 'testuser' },
      chat: { id: chatId, type: 'private' },
      date: Math.floor(Date.now() / 1000),
      text,
      entities: [{
        type: 'bot_command',
        offset: 0,
        length: command.length,
      }],
    },
  };
}

// Helper to send a command via the webhook
async function sendCommand(chatId: number, text: string, command: string) {
  const update = buildCommandUpdate(chatId, text, command);
  await request(app)
    .post('/api/webhooks/telegram')
    .set('x-telegram-bot-api-secret-token', WEBHOOK_SECRET)
    .send(update)
    .expect(200);
  // Wait for async processing
  await new Promise(r => setTimeout(r, 300));
}

describe('Telegram Command Center', () => {
  let testUser: ReturnType<typeof createTestUser>;
  const chatId = 77701;

  beforeAll(() => {
    resetDatabase();
    (config as Record<string, unknown>).telegramWebhookSecret = WEBHOOK_SECRET;
    testUser = createTestUser();

    // Link the test user to the chat
    db.prepare(
      "INSERT INTO channel_links (id, user_id, channel, external_id, external_username, is_verified) VALUES (?, ?, 'telegram', ?, 'testuser', 1)"
    ).run(uuid(), testUser.id, String(chatId));
  });

  beforeEach(() => {
    sentMessages.length = 0;
    sentButtons.length = 0;
    vi.clearAllMocks();
  });

  // ── Unit tests for extractBotCommand ──────────────────────────

  describe('extractBotCommand parser', () => {
    it('parses /note command with args', () => {
      const update: TelegramUpdate = buildCommandUpdate(chatId, '/note idea: new feature', '/note');
      const result = extractBotCommand(update);
      expect(result).toEqual({ command: '/note', args: 'idea: new feature' });
    });

    it('parses /focus command with number arg', () => {
      const update: TelegramUpdate = buildCommandUpdate(chatId, '/focus 45', '/focus');
      const result = extractBotCommand(update);
      expect(result).toEqual({ command: '/focus', args: '45' });
    });

    it('parses /habit with hyphenated name', () => {
      const update: TelegramUpdate = buildCommandUpdate(chatId, '/habit morning-workout', '/habit');
      const result = extractBotCommand(update);
      expect(result).toEqual({ command: '/habit', args: 'morning-workout' });
    });

    it('parses /memory with full sentence', () => {
      const update: TelegramUpdate = buildCommandUpdate(chatId, '/memory I prefer dark mode', '/memory');
      const result = extractBotCommand(update);
      expect(result).toEqual({ command: '/memory', args: 'I prefer dark mode' });
    });

    it('parses /brief with no args', () => {
      const update: TelegramUpdate = buildCommandUpdate(chatId, '/brief', '/brief');
      const result = extractBotCommand(update);
      expect(result).toEqual({ command: '/brief', args: '' });
    });

    it('parses /help with no args', () => {
      const update: TelegramUpdate = buildCommandUpdate(chatId, '/help', '/help');
      const result = extractBotCommand(update);
      expect(result).toEqual({ command: '/help', args: '' });
    });

    it('strips @botname from command', () => {
      const update: TelegramUpdate = {
        update_id: 1,
        message: {
          message_id: 1,
          from: { id: chatId, is_bot: false, first_name: 'Test' },
          chat: { id: chatId, type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text: '/note@mybot this is a note',
          entities: [{ type: 'bot_command', offset: 0, length: 11 }],
        },
      };
      const result = extractBotCommand(update);
      expect(result?.command).toBe('/note');
      expect(result?.args).toBe('this is a note');
    });

    it('returns null for non-command messages', () => {
      const update: TelegramUpdate = {
        update_id: 1,
        message: {
          message_id: 1,
          from: { id: chatId, is_bot: false, first_name: 'Test' },
          chat: { id: chatId, type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text: 'just a regular message',
        },
      };
      expect(extractBotCommand(update)).toBeNull();
    });
  });

  // ── /help command ─────────────────────────────────────────────

  describe('/help', () => {
    it('returns comprehensive command list', async () => {
      await sendCommand(chatId, '/help', '/help');

      expect(sentMessages.length).toBeGreaterThanOrEqual(1);
      const helpText = sentMessages[0].text;
      expect(helpText).toContain('/remind');
      expect(helpText).toContain('/note');
      expect(helpText).toContain('/focus');
      expect(helpText).toContain('/habit');
      expect(helpText).toContain('/brief');
      expect(helpText).toContain('/search');
      expect(helpText).toContain('/memory');
      expect(helpText).toContain('QUICK ACTIONS');
      expect(helpText).toContain('DASHBOARD');
      expect(helpText).toContain('ACCOUNT');
    });
  });

  // ── /remind command ───────────────────────────────────────────

  describe('/remind', () => {
    it('routes to message handler with "remind me" prefix', async () => {
      await sendCommand(chatId, '/remind call dentist Friday 3pm', '/remind');
      expect(handleIncomingMessage).toHaveBeenCalled();
    });

    it('shows usage when no args provided', async () => {
      await sendCommand(chatId, '/remind', '/remind');
      expect(sentMessages.some(m => m.text.includes('Usage'))).toBe(true);
    });
  });

  // ── /note command ─────────────────────────────────────────────

  describe('/note', () => {
    it('creates a note in DB', async () => {
      const noteText = `test-note-${Date.now()}`;
      await sendCommand(chatId, `/note ${noteText}`, '/note');

      // Check that a note was created
      const note = db.prepare(
        "SELECT title, content, tags FROM notes WHERE user_id = ? AND content LIKE ?"
      ).get(testUser.id, `%${noteText}%`) as { title: string; content: string; tags: string } | undefined;

      expect(note).toBeTruthy();
      expect(note!.content).toContain(noteText);
      expect(note!.tags).toContain('telegram');
    });

    it('sends note card with inline buttons', async () => {
      await sendCommand(chatId, '/note buy groceries tomorrow', '/note');
      // Should send a card with pin/delete buttons
      expect(sentButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('shows usage when no args provided', async () => {
      await sendCommand(chatId, '/note', '/note');
      expect(sentMessages.some(m => m.text.includes('Usage'))).toBe(true);
    });
  });

  // ── /focus command ────────────────────────────────────────────

  describe('/focus', () => {
    it('creates a focus session in DB', async () => {
      await sendCommand(chatId, '/focus 30', '/focus');

      const session = db.prepare(
        "SELECT goal, duration_min, completed FROM focus_sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT 1"
      ).get(testUser.id) as { goal: string; duration_min: number; completed: number } | undefined;

      expect(session).toBeTruthy();
      expect(session!.duration_min).toBe(30);
      expect(session!.completed).toBe(0);
    });

    it('defaults to 25 min when no arg given', async () => {
      await sendCommand(chatId, '/focus', '/focus');

      const session = db.prepare(
        "SELECT duration_min FROM focus_sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT 1"
      ).get(testUser.id) as { duration_min: number } | undefined;

      expect(session).toBeTruthy();
      expect(session!.duration_min).toBe(25);
    });

    it('rejects invalid duration', async () => {
      await sendCommand(chatId, '/focus abc', '/focus');
      expect(sentMessages.some(m => m.text.includes('Usage') || m.text.includes('1-480'))).toBe(true);
    });

    it('rejects out of range duration', async () => {
      await sendCommand(chatId, '/focus 999', '/focus');
      expect(sentMessages.some(m => m.text.includes('1-480'))).toBe(true);
    });
  });

  // ── /habit command ────────────────────────────────────────────

  describe('/habit', () => {
    it('creates and logs a habit in DB', async () => {
      const habitName = `habit-${Date.now()}`;
      await sendCommand(chatId, `/habit ${habitName}`, '/habit');

      const habit = db.prepare(
        "SELECT id, name, current_streak FROM habits WHERE user_id = ? AND name = ?"
      ).get(testUser.id, habitName) as { id: number; name: string; current_streak: number } | undefined;

      expect(habit).toBeTruthy();
      expect(habit!.current_streak).toBe(1);
    });

    it('sends habit card with inline buttons', async () => {
      const habitName = `card-habit-${Date.now()}`;
      await sendCommand(chatId, `/habit ${habitName}`, '/habit');
      expect(sentButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('shows usage when no args provided', async () => {
      await sendCommand(chatId, '/habit', '/habit');
      expect(sentMessages.some(m => m.text.includes('Usage'))).toBe(true);
    });
  });

  // ── /brief command ────────────────────────────────────────────

  describe('/brief', () => {
    it('returns daily briefing text', async () => {
      await sendCommand(chatId, '/brief', '/brief');

      // Briefing should contain common elements
      expect(sentMessages.length).toBeGreaterThanOrEqual(1);
      const briefText = sentMessages.find(m =>
        m.text.includes('Briefing') || m.text.includes('Pending') || m.text.includes('Habits')
      );
      expect(briefText).toBeTruthy();
    });

    it('supports weekly briefing with arg', async () => {
      await sendCommand(chatId, '/brief weekly', '/brief');
      expect(sentMessages.some(m => m.text.includes('Weekly') || m.text.includes('7 days'))).toBe(true);
    });
  });

  // ── /memory command ───────────────────────────────────────────

  describe('/memory', () => {
    it('saves a fact to user_memories', async () => {
      const fact = 'I prefer dark mode always';
      await sendCommand(chatId, `/memory ${fact}`, '/memory');

      const memory = db.prepare(
        "SELECT key, value FROM user_memories WHERE user_id = ? AND value = ?"
      ).get(testUser.id, fact) as { key: string; value: string } | undefined;

      expect(memory).toBeTruthy();
      expect(memory!.value).toBe(fact);
    });

    it('confirms save with brain emoji', async () => {
      await sendCommand(chatId, '/memory My birthday is March 15', '/memory');
      expect(sentMessages.some(m => m.text.includes('🧠') && m.text.includes('Saved'))).toBe(true);
    });

    it('shows usage when no args provided', async () => {
      await sendCommand(chatId, '/memory', '/memory');
      expect(sentMessages.some(m => m.text.includes('Usage'))).toBe(true);
    });
  });

  // ── /search command ───────────────────────────────────────────

  describe('/search', () => {
    it('returns search results from notes', async () => {
      // Create a note to search for
      const keyword = `searchable-${Date.now()}`;
      db.prepare(`
        INSERT INTO notes (user_id, title, content, tags, created_at, updated_at)
        VALUES (?, ?, ?, '[]', unixepoch('now')*1000, unixepoch('now')*1000)
      `).run(testUser.id, `${keyword} note`, `Content about ${keyword}`);

      await sendCommand(chatId, `/search ${keyword}`, '/search');

      expect(sentMessages.some(m =>
        m.text.includes('Search results') || m.text.includes(keyword)
      )).toBe(true);
    });

    it('returns no results message for nonexistent query', async () => {
      await sendCommand(chatId, '/search xyznonexistent999', '/search');
      expect(sentMessages.some(m => m.text.includes('No results'))).toBe(true);
    });

    it('shows usage when no args provided', async () => {
      await sendCommand(chatId, '/search', '/search');
      expect(sentMessages.some(m => m.text.includes('Usage') || m.text.includes('Search across'))).toBe(true);
    });
  });

  // ── Unknown command fallthrough ───────────────────────────────

  describe('Unknown command fallthrough', () => {
    it('routes unknown commands to normal AI chat', async () => {
      await sendCommand(chatId, '/unknowncmd hello', '/unknowncmd');
      expect(handleIncomingMessage).toHaveBeenCalled();
    });
  });

  // ── Unlinked user handling ────────────────────────────────────

  describe('Unlinked user commands', () => {
    const unlinkedChatId = 88801;

    it('/note prompts to link account', async () => {
      await sendCommand(unlinkedChatId, '/note test note', '/note');
      expect(sentMessages.some(m => m.text.includes('Link your account'))).toBe(true);
    });

    it('/focus prompts to link account', async () => {
      await sendCommand(unlinkedChatId, '/focus 25', '/focus');
      expect(sentMessages.some(m => m.text.includes('Link your account'))).toBe(true);
    });

    it('/habit prompts to link account', async () => {
      await sendCommand(unlinkedChatId, '/habit workout', '/habit');
      expect(sentMessages.some(m => m.text.includes('Link your account'))).toBe(true);
    });

    it('/memory prompts to link account', async () => {
      await sendCommand(unlinkedChatId, '/memory test fact', '/memory');
      expect(sentMessages.some(m => m.text.includes('Link your account'))).toBe(true);
    });

    it('/brief prompts to link account', async () => {
      await sendCommand(unlinkedChatId, '/brief', '/brief');
      expect(sentMessages.some(m => m.text.includes('Link your account'))).toBe(true);
    });
  });

  // ── setMyCommands registration ────────────────────────────────

  describe('setMyCommands', () => {
    it('telegram.ts contains registerBotCommands function', () => {
      // Verify the init function registers commands
      const telegramTs = fs.readFileSync(
        path.resolve(__dirname, '../../modules/integrations/services/telegram.ts'),
        'utf-8'
      );
      expect(telegramTs).toContain('setMyCommands');
      expect(telegramTs).toContain('registerBotCommands');
      expect(telegramTs).toContain("command: 'remind'");
      expect(telegramTs).toContain("command: 'note'");
      expect(telegramTs).toContain("command: 'focus'");
      expect(telegramTs).toContain("command: 'habit'");
      expect(telegramTs).toContain("command: 'brief'");
      expect(telegramTs).toContain("command: 'search'");
      expect(telegramTs).toContain("command: 'memory'");
      expect(telegramTs).toContain("command: 'help'");
    });
  });
});
