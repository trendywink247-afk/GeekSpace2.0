import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { createApp } from '../../../app.js';
import { db } from '../../../db/index.js';
import { resetDatabase, createTestUser } from '../../../test/setup.js';
import {
  buildRazorpayWebhookPayload,
  TEST_RAZORPAY_KEY_SECRET,
} from '../../../test/mocks/handlers/razorpay.js';

const app = createApp();

function postWebhook(body: string, signature: string) {
  // Use application/octet-stream to prevent superagent from JSON-serializing the body.
  // The app-level express.raw({ type: '*/*' }) captures it as a raw Buffer.
  return request(app)
    .post('/api/billing/razorpay/webhook')
    .set('Content-Type', 'application/octet-stream')
    .set('x-razorpay-signature', signature)
    .send(body);
}

function makePaymentData(userId: string, plan: string, extra: Record<string, unknown> = {}) {
  return {
    id: `pay_test_${uuid().replace(/-/g, '')}`,
    order_id: `order_test_${uuid().replace(/-/g, '')}`,
    status: 'captured',
    notes: { userId, plan },
    ...extra,
  };
}

describe('POST /api/billing/razorpay/webhook', () => {
  beforeAll(() => resetDatabase());
  afterEach(() => resetDatabase());

  describe('signature verification', () => {
    it('returns 400 when x-razorpay-signature header is missing', async () => {
      const res = await request(app)
        .post('/api/billing/razorpay/webhook')
        .set('Content-Type', 'application/json')
        .send(Buffer.from('{}'));
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 400 when signature is invalid', async () => {
      const { body } = buildRazorpayWebhookPayload('payment.captured', {
        id: 'pay_test',
        status: 'captured',
        notes: {},
      });
      const res = await postWebhook(body, 'invalid_signature_value');
      expect(res.status).toBe(400);
    });

    it('returns 400 when signature uses the wrong secret', async () => {
      const { body, signature } = buildRazorpayWebhookPayload(
        'payment.captured',
        { id: 'pay_test', status: 'captured', notes: {} },
        'wrong_secret_entirely',
      );
      const res = await postWebhook(body, signature);
      expect(res.status).toBe(400);
    });

    it('returns 200 for a validly signed unknown event', async () => {
      const { body, signature } = buildRazorpayWebhookPayload('some.unknown.event', {});
      const res = await postWebhook(body, signature);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ received: true });
    });
  });

  describe('payment.captured', () => {
    it('activates subscription plan and updates users table', async () => {
      const user = createTestUser();
      const { body, signature } = buildRazorpayWebhookPayload(
        'payment.captured',
        makePaymentData(user.id, 'pilot'),
      );

      const res = await postWebhook(body, signature);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ received: true });

      const sub = db.prepare(
        'SELECT plan, credits_remaining FROM subscriptions WHERE user_id = ?',
      ).get(user.id) as { plan: string; credits_remaining: number } | undefined;

      expect(sub).toBeDefined();
      expect(sub!.plan).toBe('pilot');

      const userRow = db.prepare(
        'SELECT subscription_plan, subscription_status FROM users WHERE id = ?',
      ).get(user.id) as { subscription_plan: string; subscription_status: string };

      expect(userRow.subscription_plan).toBe('pilot');
      expect(userRow.subscription_status).toBe('active');
    });

    it('grants the correct credit count for the plan', async () => {
      const user = createTestUser();
      const { body, signature } = buildRazorpayWebhookPayload(
        'payment.captured',
        makePaymentData(user.id, 'halfyear'),
      );

      await postWebhook(body, signature);

      const sub = db.prepare(
        'SELECT credits_remaining FROM subscriptions WHERE user_id = ?',
      ).get(user.id) as { credits_remaining: number };

      // halfyear plan has 700,000 credits
      expect(sub.credits_remaining).toBe(700_000);
    });

    it('is a no-op when notes.userId is missing', async () => {
      const { body, signature } = buildRazorpayWebhookPayload('payment.captured', {
        id: `pay_test_${uuid().replace(/-/g, '')}`,
        status: 'captured',
        notes: { plan: 'pilot' }, // no userId
      });
      const res = await postWebhook(body, signature);
      expect(res.status).toBe(200);
    });

    it('is a no-op when notes.plan is missing', async () => {
      const user = createTestUser();
      const { body, signature } = buildRazorpayWebhookPayload('payment.captured', {
        id: `pay_test_${uuid().replace(/-/g, '')}`,
        status: 'captured',
        notes: { userId: user.id }, // no plan
      });
      const res = await postWebhook(body, signature);
      expect(res.status).toBe(200);
    });

    it('is a no-op when notes reference an unknown plan', async () => {
      const user = createTestUser();
      const { body, signature } = buildRazorpayWebhookPayload(
        'payment.captured',
        makePaymentData(user.id, 'nonexistent_plan_xyz'),
      );

      const res = await postWebhook(body, signature);
      expect(res.status).toBe(200);

      // Plan should remain unchanged from createTestUser default
      const sub = db.prepare(
        'SELECT plan FROM subscriptions WHERE user_id = ?',
      ).get(user.id) as { plan: string };
      expect(sub.plan).toBe('premium');
    });

    it('replays are idempotent — repeated captured events converge to same state', async () => {
      const user = createTestUser();
      const paymentData = makePaymentData(user.id, 'pilot');

      const { body: b1, signature: s1 } = buildRazorpayWebhookPayload('payment.captured', paymentData);
      const first = await postWebhook(b1, s1);
      expect(first.status).toBe(200);

      const creditsMid = (db.prepare(
        'SELECT credits_remaining FROM subscriptions WHERE user_id = ?',
      ).get(user.id) as { credits_remaining: number }).credits_remaining;

      const { body: b2, signature: s2 } = buildRazorpayWebhookPayload('payment.captured', paymentData);
      const second = await postWebhook(b2, s2);
      expect(second.status).toBe(200);

      const creditsAfter = (db.prepare(
        'SELECT credits_remaining FROM subscriptions WHERE user_id = ?',
      ).get(user.id) as { credits_remaining: number }).credits_remaining;

      // Second replay resets to the same plan credits, not double-adding
      expect(creditsAfter).toBe(creditsMid);
    });
  });

  describe('payment.failed', () => {
    it('returns 200 without mutating the subscription', async () => {
      const user = createTestUser();
      const { body, signature } = buildRazorpayWebhookPayload('payment.failed', {
        id: `pay_test_${uuid().replace(/-/g, '')}`,
        order_id: `order_test_${uuid().replace(/-/g, '')}`,
        status: 'failed',
        notes: { userId: user.id, plan: 'pilot' },
      });

      const res = await postWebhook(body, signature);
      expect(res.status).toBe(200);

      // Subscription unchanged
      const sub = db.prepare(
        'SELECT plan FROM subscriptions WHERE user_id = ?',
      ).get(user.id) as { plan: string };
      expect(sub.plan).toBe('premium');
    });
  });

  describe('unknown event types', () => {
    it('returns 200 without error', async () => {
      const { body, signature } = buildRazorpayWebhookPayload('refund.created', {
        id: `rfnd_test_${uuid().replace(/-/g, '')}`,
      });
      const res = await postWebhook(body, signature);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ received: true });
    });
  });

  // Ensure the secret constant matches vitest env
  it('TEST_RAZORPAY_KEY_SECRET matches the vitest env var', () => {
    expect(TEST_RAZORPAY_KEY_SECRET).toBe(process.env.RAZORPAY_KEY_SECRET);
  });
});
