import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { createApp } from '../../../app.js';
import { db } from '../../../db/index.js';
import { resetDatabase, createTestUser } from '../../../test/setup.js';
import {
  buildStripeWebhookPayload,
  TEST_STRIPE_WEBHOOK_SECRET,
} from '../../../test/mocks/handlers/stripe.js';

const app = createApp();

function postWebhook(body: string, signature: string) {
  // Use application/octet-stream to prevent superagent from JSON-serializing the string body.
  // The app-level express.raw({ type: '*/*' }) captures this as a raw Buffer before express.json() runs.
  return request(app)
    .post('/api/billing/webhook')
    .set('Content-Type', 'application/octet-stream')
    .set('stripe-signature', signature)
    .send(body);
}

describe('POST /api/billing/webhook (Stripe)', () => {
  beforeAll(() => resetDatabase());
  afterEach(() => resetDatabase());

  describe('signature verification', () => {
    it('returns 400 when stripe-signature header is missing', async () => {
      const res = await request(app)
        .post('/api/billing/webhook')
        .set('Content-Type', 'application/json')
        .send(Buffer.from('{}'));
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 400 when signature uses the wrong secret', async () => {
      const { body, signature } = buildStripeWebhookPayload(
        'checkout.session.completed',
        {},
        'whsec_wrong_secret',
      );
      const res = await postWebhook(body, signature);
      expect(res.status).toBe(400);
    });

    it('returns 400 when signature is malformed', async () => {
      const { body } = buildStripeWebhookPayload('checkout.session.completed', {});
      const res = await postWebhook(body, 'not-a-valid-stripe-signature');
      expect(res.status).toBe(400);
    });

    it('returns 200 for a validly signed unknown event', async () => {
      const { body, signature } = buildStripeWebhookPayload('unknown.event.type', {
        id: `obj_${uuid().replace(/-/g, '')}`,
      });
      const res = await postWebhook(body, signature);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ received: true });
    });
  });

  describe('checkout.session.completed — day pass', () => {
    it('inserts a day_pass row and grants 2000 credits', async () => {
      const user = createTestUser();
      const sessionId = `cs_test_${uuid().replace(/-/g, '')}`;

      const { body, signature } = buildStripeWebhookPayload('checkout.session.completed', {
        id: sessionId,
        metadata: { userId: user.id, type: 'day_pass' },
        subscription: null,
      });

      const res = await postWebhook(body, signature);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ received: true });

      const pass = db.prepare(
        'SELECT user_id, credits_granted FROM day_passes WHERE stripe_checkout_session_id = ?',
      ).get(sessionId) as { user_id: string; credits_granted: number } | undefined;

      expect(pass).toBeDefined();
      expect(pass!.user_id).toBe(user.id);
      expect(pass!.credits_granted).toBe(2000);
    });

    it('is idempotent — posting the same session_id twice grants credits only once', async () => {
      const user = createTestUser();
      const sessionId = `cs_test_${uuid().replace(/-/g, '')}`;

      const buildPayload = () =>
        buildStripeWebhookPayload('checkout.session.completed', {
          id: sessionId,
          metadata: { userId: user.id, type: 'day_pass' },
          subscription: null,
        });

      // First call — should insert exactly one day_passes row
      const { body: b1, signature: s1 } = buildPayload();
      await postWebhook(b1, s1);

      const countAfterFirst = (db.prepare(
        'SELECT COUNT(*) as cnt FROM day_passes WHERE stripe_checkout_session_id = ?',
      ).get(sessionId) as { cnt: number }).cnt;
      expect(countAfterFirst).toBe(1);

      // Second call — same session id, should be a no-op (idempotent)
      const { body: b2, signature: s2 } = buildPayload();
      await postWebhook(b2, s2);

      const countAfterSecond = (db.prepare(
        'SELECT COUNT(*) as cnt FROM day_passes WHERE stripe_checkout_session_id = ?',
      ).get(sessionId) as { cnt: number }).cnt;
      // Must not insert a duplicate row
      expect(countAfterSecond).toBe(1);
    });

    it('no-ops gracefully when userId metadata is missing', async () => {
      const sessionId = `cs_test_${uuid().replace(/-/g, '')}`;
      const { body, signature } = buildStripeWebhookPayload('checkout.session.completed', {
        id: sessionId,
        metadata: { type: 'day_pass' }, // no userId
        subscription: null,
      });
      const res = await postWebhook(body, signature);
      expect(res.status).toBe(200);
    });
  });

  describe('checkout.session.completed — subscription plan', () => {
    it('sets subscription_plan and subscription_status on the user', async () => {
      const user = createTestUser();

      const { body, signature } = buildStripeWebhookPayload('checkout.session.completed', {
        id: `cs_test_${uuid().replace(/-/g, '')}`,
        metadata: { userId: user.id, plan: 'pilot' },
        subscription: null, // null avoids the subscriptions.retrieve() API call
      });

      const res = await postWebhook(body, signature);
      expect(res.status).toBe(200);

      const row = db.prepare(
        'SELECT subscription_plan, subscription_status FROM users WHERE id = ?',
      ).get(user.id) as { subscription_plan: string; subscription_status: string };

      expect(row.subscription_plan).toBe('pilot');
      expect(row.subscription_status).toBe('active');
    });

    it('no-ops when plan metadata is missing on a non-day-pass session', async () => {
      const user = createTestUser();
      const { body, signature } = buildStripeWebhookPayload('checkout.session.completed', {
        id: `cs_test_${uuid().replace(/-/g, '')}`,
        metadata: { userId: user.id }, // no plan, no type
        subscription: null,
      });
      const res = await postWebhook(body, signature);
      expect(res.status).toBe(200);
    });
  });

  describe('customer.subscription.updated', () => {
    it('sets subscription_status to active and records expiry', async () => {
      const user = createTestUser();
      const customerId = `cus_test_${uuid().replace(/-/g, '')}`;
      db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customerId, user.id);

      const anchor = Math.floor(Date.now() / 1000) + 2_592_000; // +30 days
      const { body, signature } = buildStripeWebhookPayload('customer.subscription.updated', {
        id: `sub_test_${uuid().replace(/-/g, '')}`,
        customer: customerId,
        status: 'active',
        billing_cycle_anchor: anchor,
      });

      const res = await postWebhook(body, signature);
      expect(res.status).toBe(200);

      const row = db.prepare(
        'SELECT subscription_status, subscription_expires_at FROM users WHERE id = ?',
      ).get(user.id) as { subscription_status: string; subscription_expires_at: number | null };

      expect(row.subscription_status).toBe('active');
      expect(row.subscription_expires_at).toBe(anchor);
    });

    it('sets status to inactive for non-active subscription states', async () => {
      const user = createTestUser();
      const customerId = `cus_test_${uuid().replace(/-/g, '')}`;
      db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customerId, user.id);

      const { body, signature } = buildStripeWebhookPayload('customer.subscription.updated', {
        id: `sub_test_${uuid().replace(/-/g, '')}`,
        customer: customerId,
        status: 'past_due',
        billing_cycle_anchor: null,
      });

      await postWebhook(body, signature);

      const row = db.prepare(
        'SELECT subscription_status FROM users WHERE id = ?',
      ).get(user.id) as { subscription_status: string };
      expect(row.subscription_status).toBe('inactive');
    });
  });

  describe('customer.subscription.deleted', () => {
    it('downgrades user to free plan and clears expiry', async () => {
      const user = createTestUser();
      const customerId = `cus_test_${uuid().replace(/-/g, '')}`;
      db.prepare(
        'UPDATE users SET stripe_customer_id = ?, subscription_plan = ?, subscription_status = ? WHERE id = ?',
      ).run(customerId, 'pilot', 'active', user.id);

      const { body, signature } = buildStripeWebhookPayload('customer.subscription.deleted', {
        id: `sub_test_${uuid().replace(/-/g, '')}`,
        customer: customerId,
        status: 'canceled',
      });

      const res = await postWebhook(body, signature);
      expect(res.status).toBe(200);

      const row = db.prepare(
        'SELECT subscription_plan, subscription_status, subscription_expires_at FROM users WHERE id = ?',
      ).get(user.id) as {
        subscription_plan: string;
        subscription_status: string;
        subscription_expires_at: number | null;
      };

      expect(row.subscription_plan).toBe('free');
      expect(row.subscription_status).toBe('inactive');
      expect(row.subscription_expires_at).toBeNull();
    });
  });

  describe('unknown event types', () => {
    it('returns 200 without error for unhandled Stripe events', async () => {
      const { body, signature } = buildStripeWebhookPayload('invoice.payment_succeeded', {
        id: `in_test_${uuid().replace(/-/g, '')}`,
      });
      const res = await postWebhook(body, signature);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ received: true });
    });
  });

  // Ensure the secret constant exported from the fixture matches what config uses
  it('TEST_STRIPE_WEBHOOK_SECRET matches the vitest env var', () => {
    expect(TEST_STRIPE_WEBHOOK_SECRET).toBe(process.env.STRIPE_WEBHOOK_SECRET);
  });
});
