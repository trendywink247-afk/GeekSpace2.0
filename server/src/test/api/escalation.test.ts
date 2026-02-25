import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetDatabase, createTestUser, cleanupTestUser } from '../setup.js';
import { db } from '../../db/index.js';
import { v4 as uuid } from 'uuid';

// ---- In-memory cache mock ----
const cacheStore: Map<string, string> = new Map();

vi.mock('../../services/cache.js', () => ({
  cacheGet: vi.fn(async (key: string) => cacheStore.get(key) ?? null),
  cacheSet: vi.fn(async (key: string, value: string) => { cacheStore.set(key, value); }),
  cacheDel: vi.fn(async (key: string) => { cacheStore.delete(key); }),
}));

// ---- Telegram mock ----
const sentMessages: Array<{ chatId: number; text: string }> = [];

vi.mock('../../services/telegram.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../services/telegram.js')>();
  return {
    ...original,
    sendTelegramMessage: vi.fn(async (chatId: number, text: string) => {
      sentMessages.push({ chatId, text });
    }),
  };
});

// Import after mocks are set up
const { handleEscalationReply, markEscalationAnswered } = await import('../../services/escalation.js');

// ---- Helpers ----

function makeEscalation(overrides: Partial<import('../../services/escalation.js').EscalationData> = {}): import('../../services/escalation.js').EscalationData {
  return {
    id: uuid(),
    ownerUserId: '',
    ownerUsername: 'owner',
    visitorName: 'Alice',
    question: 'What is the pricing for your service?',
    context: 'User asked about pricing',
    status: 'pending',
    createdAt: new Date().toISOString(),
    notifMessageId: 100,
    ...overrides,
  };
}

async function seedEscalation(
  userId: string,
  telegramExternalId: string,
  escalation: import('../../services/escalation.js').EscalationData,
) {
  // Link telegram channel
  db.prepare(
    "INSERT OR REPLACE INTO channel_links (id, user_id, channel, external_id) VALUES (?, ?, 'telegram', ?)"
  ).run(uuid(), userId, telegramExternalId);

  // Seed escalation data into mock cache
  const escData = { ...escalation, ownerUserId: userId };
  cacheStore.set(`escalation:${escalation.id}`, JSON.stringify(escData));
  cacheStore.set(`escalations:owner:${userId}`, JSON.stringify([escalation.id]));
  return escData;
}

// ============================================================

describe('Escalation Service', () => {
  let userId: string;
  const telegramId = '9990001';

  beforeEach(() => {
    resetDatabase();
    cacheStore.clear();
    sentMessages.length = 0;
    const user = createTestUser(`escalation-${Date.now()}@example.com`);
    userId = user.id;
  });

  afterEach(() => {
    cleanupTestUser(userId);
  });

  // ── 7.1.1 — Tier 1: native reply match ──────────────────────────────────
  it('Tier 1: native reply to escalation message → returns true and confirms', async () => {
    const esc = makeEscalation({ notifMessageId: 42 });
    await seedEscalation(userId, telegramId, esc);

    const result = await handleEscalationReply(telegramId, 'Pricing is $29/month', 42);

    expect(result).toBe(true);

    // Cache should be updated to answered
    const raw = cacheStore.get(`escalation:${esc.id}`);
    expect(raw).toBeTruthy();
    const updated = JSON.parse(raw!);
    expect(updated.status).toBe('answered');
    expect(updated.ownerResponse).toBe('Pricing is $29/month');

    // Confirm message sent to owner
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].chatId).toBe(Number(telegramId));
    expect(sentMessages[0].text).toContain('Alice');
  });

  // ── 7.1.2 — Tier 1: reply to non-escalation message ─────────────────────
  it('Tier 1: reply to non-escalation message ID → returns false', async () => {
    const esc = makeEscalation({ notifMessageId: 42 });
    await seedEscalation(userId, telegramId, esc);

    // Reply to a different message ID (not an escalation notification)
    const result = await handleEscalationReply(telegramId, 'Hello!', 999);

    expect(result).toBe(false);
    expect(sentMessages).toHaveLength(0);
  });

  // ── 7.1.3 — Tier 2: keyword match ────────────────────────────────────────
  it('Tier 2: keyword match in short message → returns true', async () => {
    const esc = makeEscalation({
      visitorName: 'Bob Jones',
      question: 'What pricing plans exist?',
      notifMessageId: undefined, // no native reply available
    });
    await seedEscalation(userId, telegramId, esc);

    // "pricing" appears in the question → should match
    const result = await handleEscalationReply(telegramId, 'The pricing starts at $29', undefined);

    expect(result).toBe(true);
  });

  // ── 7.1.4 — Tier 2: no keyword match → falls through ─────────────────────
  it('Tier 2: no keyword match in short message → returns false', async () => {
    const esc = makeEscalation({
      visitorName: 'Carol',
      question: 'How does shipping work for large orders?',
    });
    await seedEscalation(userId, telegramId, esc);

    // Completely unrelated text with no keywords from the question
    const result = await handleEscalationReply(telegramId, 'xyz random unrelated stuff', undefined);

    expect(result).toBe(false);
  });

  // ── 7.1.5 — No pending escalations → false ───────────────────────────────
  it('No pending escalations → returns false', async () => {
    // Create channel link but no pending escalations
    db.prepare(
      "INSERT OR REPLACE INTO channel_links (id, user_id, channel, external_id) VALUES (?, ?, 'telegram', ?)"
    ).run(uuid(), userId, telegramId);

    const result = await handleEscalationReply(telegramId, 'hello', undefined);
    expect(result).toBe(false);
  });

  // ── 7.1.6 — No channel link → false ──────────────────────────────────────
  it('No channel link for telegram ID → returns false', async () => {
    const result = await handleEscalationReply('99999999', 'hello', undefined);
    expect(result).toBe(false);
  });

  // ── 7.1.7 — markEscalationAnswered removes ID from pending list ───────────
  it('markEscalationAnswered removes escalation from pending list', async () => {
    const esc1 = makeEscalation({ id: 'esc-1' });
    const esc2 = makeEscalation({ id: 'esc-2' });

    cacheStore.set('escalation:esc-1', JSON.stringify({ ...esc1, ownerUserId: userId }));
    cacheStore.set('escalation:esc-2', JSON.stringify({ ...esc2, ownerUserId: userId }));
    const pendingKey = `escalations:owner:${userId}`;
    cacheStore.set(pendingKey, JSON.stringify(['esc-1', 'esc-2']));

    // Mark first one answered
    db.prepare(
      "INSERT OR REPLACE INTO channel_links (id, user_id, channel, external_id) VALUES (?, ?, 'telegram', ?)"
    ).run(uuid(), userId, telegramId);

    await markEscalationAnswered(
      { ...esc1, ownerUserId: userId },
      ['esc-1', 'esc-2'],
      0, // idx of esc-1
      userId,
      pendingKey,
      telegramId,
      'Answer to first question',
    );

    // Pending list should now only have esc-2
    const remaining = JSON.parse(cacheStore.get(pendingKey)!);
    expect(remaining).toEqual(['esc-2']);

    // esc-1 should be marked answered
    const updated = JSON.parse(cacheStore.get('escalation:esc-1')!);
    expect(updated.status).toBe('answered');
  });
});
