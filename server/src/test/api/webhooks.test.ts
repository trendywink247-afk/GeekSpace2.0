/**
 * Webhook Route Tests
 * Telegram secret verification, bot-message filtering, n8n auth, missing fields.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

const sentMessages: Array<{ chatId: number | string; text: string }> = [];

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
    }),
    sendTelegramButtons: vi.fn(async () => {}),
    answerCallbackQuery: vi.fn(async () => {}),
    getBotUsername: vi.fn(() => 'testbot'),
    initTelegramBot: vi.fn(async () => {}),
    sendTelegramVoice: vi.fn(async () => {}),
    sendTelegramNotification: vi.fn(async () => {}),
  };
});

vi.mock('../../services/message-router.js', () => ({
  handleIncomingMessage: vi.fn(async () => {}),
  sendChannelResponse: vi.fn(async () => {}),
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

import request from 'supertest';
import { createApp } from '../../app.js';
import { resetDatabase } from '../setup.js';
import { config } from '../../config.js';

(config as Record<string, unknown>).isTestMode = true;

const app = createApp();

describe('Webhooks', () => {
  beforeAll(() => { resetDatabase(); });
  beforeEach(() => { sentMessages.length = 0; });

  it('POST /api/webhooks/telegram returns 401 when no secret configured', async () => {
    const orig = config.telegramWebhookSecret;
    config.telegramWebhookSecret = '';
    await request(app).post('/api/webhooks/telegram').send({ update_id: 1 }).expect(401);
    config.telegramWebhookSecret = orig;
  });

  it('POST /api/webhooks/telegram returns 403 with wrong secret', async () => {
    const orig = config.telegramWebhookSecret;
    config.telegramWebhookSecret = 'correct-secret';
    await request(app).post('/api/webhooks/telegram').set('x-telegram-bot-api-secret-token', 'wrong-secret').send({ update_id: 1 }).expect(403);
    config.telegramWebhookSecret = orig;
  });

  it('POST /api/webhooks/telegram returns 200 with valid secret', async () => {
    const orig = config.telegramWebhookSecret;
    config.telegramWebhookSecret = 'test-secret-74';
    await request(app)
      .post('/api/webhooks/telegram')
      .set('x-telegram-bot-api-secret-token', 'test-secret-74')
      .send({
        update_id: 1,
        message: {
          message_id: 1,
          from: { id: 123, is_bot: false, first_name: 'Test' },
          chat: { id: 123, type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text: 'Hello bot',
        },
      })
      .expect(200);
    config.telegramWebhookSecret = orig;
  });

  it('POST /api/webhooks/telegram silently drops bot messages', async () => {
    const orig = config.telegramWebhookSecret;
    config.telegramWebhookSecret = 'test-secret-74';
    await request(app)
      .post('/api/webhooks/telegram')
      .set('x-telegram-bot-api-secret-token', 'test-secret-74')
      .send({
        update_id: 2,
        message: {
          message_id: 2,
          from: { id: 999, is_bot: true, first_name: 'OtherBot' },
          chat: { id: 999, type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text: 'Bot message',
        },
      })
      .expect(200);
    await new Promise(r => setTimeout(r, 100));
    expect(sentMessages.length).toBe(0);
    config.telegramWebhookSecret = orig;
  });

  it('POST /api/webhooks/n8n/callback returns 503 when not configured', async () => {
    const orig = config.n8nWebhookSecret;
    config.n8nWebhookSecret = '';
    await request(app).post('/api/webhooks/n8n/callback').send({ userId: 'u1', channel: 'telegram', externalId: '123', message: 'hi' }).expect(503);
    config.n8nWebhookSecret = orig;
  });

  it('POST /api/webhooks/n8n/callback returns 401 with wrong secret', async () => {
    const orig = config.n8nWebhookSecret;
    config.n8nWebhookSecret = 'n8n-correct';
    await request(app).post('/api/webhooks/n8n/callback').set('x-n8n-secret', 'n8n-wrong').send({ userId: 'u1', channel: 'telegram', externalId: '123', message: 'hi' }).expect(401);
    config.n8nWebhookSecret = orig;
  });

  it('POST /api/webhooks/n8n/callback returns 400 with missing fields', async () => {
    const orig = config.n8nWebhookSecret;
    config.n8nWebhookSecret = 'n8n-test';
    await request(app).post('/api/webhooks/n8n/callback').set('x-n8n-secret', 'n8n-test').send({ userId: 'u1' }).expect(400);
    config.n8nWebhookSecret = orig;
  });
});
