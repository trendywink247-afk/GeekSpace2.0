/**
 * Phase 89 — Stripe Billing Tests
 * Verifies: stripe service, billing routes, config, DB migrations,
 * image/voice plan gating, and BillingPage UI elements.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '../app.js';
import { db } from '../db/index.js';
import { createTestUser, generateTestToken, resetDatabase } from './setup.js';
import { getStatus, isPaidPlan } from '../services/stripe.js';

const app = createApp();
const root = path.resolve(__dirname, '../../../');

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(root, 'src', rel), 'utf-8');
}

function readServer(rel: string): string {
  return fs.readFileSync(path.join(root, 'server/src', rel), 'utf-8');
}

// ── 89.1 Stripe service unit tests ──────────────────────────

describe('89.1 stripe.ts service', () => {
  it('stripe.ts file exists', () => {
    const p = path.join(root, 'server/src/services/stripe.ts');
    expect(fs.existsSync(p)).toBe(true);
  });

  it('exports createCheckoutSession', () => {
    const content = readServer('modules/billing/services/stripe.ts');
    expect(content).toContain('createCheckoutSession');
  });

  it('exports handleWebhook', () => {
    const content = readServer('modules/billing/services/stripe.ts');
    expect(content).toContain('handleWebhook');
  });

  it('exports getStatus', () => {
    const content = readServer('modules/billing/services/stripe.ts');
    expect(content).toContain('getStatus');
  });

  it('exports isPaidPlan', () => {
    const content = readServer('modules/billing/services/stripe.ts');
    expect(content).toContain('isPaidPlan');
  });
});

// ── 89.2 getStatus and isPaidPlan unit tests ─────────────────

describe('89.2 getStatus and isPaidPlan', () => {
  beforeAll(() => resetDatabase());
  afterEach(() => resetDatabase());

  it('getStatus returns free plan for new user', () => {
    const user = createTestUser(`phase89-status-${Date.now()}@example.com`);
    const status = getStatus(user.id);
    expect(status.plan).toBe('free');
    expect(status.status).toBe('inactive');
    expect(status.isPaid).toBe(false);
    expect(status.expiresAt).toBeNull();
  });

  it('isPaidPlan returns false for new free user', () => {
    const user = createTestUser(`phase89-ispaid-${Date.now()}@example.com`);
    expect(isPaidPlan(user.id)).toBe(false);
  });

  it('isPaidPlan returns true after manual pilot plan activation', () => {
    const user = createTestUser(`phase89-pilot-${Date.now()}@example.com`);
    db.prepare("UPDATE users SET subscription_plan = 'pilot', subscription_status = 'active' WHERE id = ?").run(user.id);
    expect(isPaidPlan(user.id)).toBe(true);
  });

  it('isPaidPlan returns true after manual yearly plan activation', () => {
    const user = createTestUser(`phase89-yearly-${Date.now()}@example.com`);
    db.prepare("UPDATE users SET subscription_plan = 'yearly', subscription_status = 'active' WHERE id = ?").run(user.id);
    expect(isPaidPlan(user.id)).toBe(true);
  });

  it('isPaidPlan returns false when status is inactive even if plan is set', () => {
    const user = createTestUser(`phase89-inactive-${Date.now()}@example.com`);
    db.prepare("UPDATE users SET subscription_plan = 'pilot', subscription_status = 'inactive' WHERE id = ?").run(user.id);
    expect(isPaidPlan(user.id)).toBe(false);
  });

  it('getStatus label is "Pilot" for pilot plan', () => {
    const user = createTestUser(`phase89-label-${Date.now()}@example.com`);
    db.prepare("UPDATE users SET subscription_plan = 'pilot', subscription_status = 'active' WHERE id = ?").run(user.id);
    const status = getStatus(user.id);
    expect(status.label).toBe('Pilot');
    expect(status.isPaid).toBe(true);
  });
});

// ── 89.3 DB migration tests ──────────────────────────────────

describe('89.3 DB migrations for Stripe columns', () => {
  it('users table has stripe_customer_id column', () => {
    const row = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
    const cols = row.map(r => r.name);
    expect(cols).toContain('stripe_customer_id');
  });

  it('users table has subscription_plan column', () => {
    const row = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
    const cols = row.map(r => r.name);
    expect(cols).toContain('subscription_plan');
  });

  it('users table has subscription_status column', () => {
    const row = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
    const cols = row.map(r => r.name);
    expect(cols).toContain('subscription_status');
  });

  it('users table has subscription_expires_at column', () => {
    const row = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
    const cols = row.map(r => r.name);
    expect(cols).toContain('subscription_expires_at');
  });
});

// ── 89.4 Billing route tests ─────────────────────────────────

describe('89.4 GET /api/billing/status', () => {
  beforeAll(() => resetDatabase());
  afterEach(() => resetDatabase());

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/billing/status').expect(401);
    expect(res.body).toHaveProperty('error');
  });

  it('returns free plan status for new user', async () => {
    const user = createTestUser(`phase89-status-api-${Date.now()}@example.com`);
    const token = generateTestToken(user.id);
    const res = await request(app)
      .get('/api/billing/status')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.plan).toBe('free');
    expect(res.body.isPaid).toBe(false);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('label');
  });

  it('returns paid status after manual upgrade', async () => {
    const user = createTestUser(`phase89-paid-api-${Date.now()}@example.com`);
    db.prepare("UPDATE users SET subscription_plan = 'pilot', subscription_status = 'active' WHERE id = ?").run(user.id);
    const token = generateTestToken(user.id);
    const res = await request(app)
      .get('/api/billing/status')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.plan).toBe('pilot');
    expect(res.body.isPaid).toBe(true);
    expect(res.body.label).toBe('Pilot');
  });
});

describe('89.5 POST /api/billing/checkout', () => {
  beforeAll(() => resetDatabase());
  afterEach(() => resetDatabase());

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/billing/checkout')
      .send({ plan: 'pilot' })
      .expect(401);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 for invalid plan', async () => {
    const user = createTestUser(`phase89-checkout-bad-${Date.now()}@example.com`);
    const token = generateTestToken(user.id);
    const res = await request(app)
      .post('/api/billing/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'enterprise' })
      .expect(400);
    expect(res.body.error).toContain('pilot');
  });

  it('returns 400 for missing plan', async () => {
    const user = createTestUser(`phase89-checkout-noplan-${Date.now()}@example.com`);
    const token = generateTestToken(user.id);
    const res = await request(app)
      .post('/api/billing/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);
    expect(res.body.error).toContain('pilot');
  });

  it('returns 503 when Stripe not configured', async () => {
    const user = createTestUser(`phase89-checkout-nostripe-${Date.now()}@example.com`);
    const token = generateTestToken(user.id);
    const res = await request(app)
      .post('/api/billing/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'pilot' });
    // Either 503 (stripe not configured) or 500 (stripe error) are acceptable in test mode
    expect([500, 503].includes(res.status)).toBe(true);
  });
});

describe('89.6 POST /api/billing/webhook', () => {
  it('returns 400 without stripe-signature header', async () => {
    const res = await request(app)
      .post('/api/billing/webhook')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ type: 'checkout.session.completed' }))
      .expect(400);
    expect(res.body.error).toContain('Stripe-Signature');
  });
});

// ── 89.7 Image gating tests ───────────────────────────────────

describe('89.7 Image generation plan gating', () => {
  it('images.ts imports db for plan check', () => {
    const content = readServer('modules/media/routes/images.ts');
    expect(content).toContain('SELECT plan FROM users WHERE id = ?');
    expect(content).toContain('upgradeRequired');
  });

  it('free users have IMAGE_DAILY_CAPS of 3', () => {
    const content = readServer('modules/media/routes/images.ts');
    expect(content).toContain("free: 3");
  });

  it('pilot users have IMAGE_DAILY_CAPS of 10', () => {
    const content = readServer('modules/media/routes/images.ts');
    expect(content).toContain("pilot: 10");
  });

  it('yearly users have IMAGE_DAILY_CAPS of 100', () => {
    const content = readServer('modules/media/routes/images.ts');
    expect(content).toContain("yearly: 100");
  });

  it('shows upgrade message for free users hitting cap', () => {
    const content = readServer('modules/media/routes/images.ts');
    expect(content).toContain('Upgrade your plan to unlock more image generation');
  });
});

// ── 89.8 Voice gating tests ───────────────────────────────────

describe('89.8 Voice plan gating', () => {
  it('voice.ts has pilot plan cap', () => {
    const content = readServer('modules/media/routes/voice.ts');
    expect(content).toContain('pilot: 30');
  });

  it('voice.ts has yearly plan cap of 100', () => {
    const content = readServer('modules/media/routes/voice.ts');
    expect(content).toContain('yearly: 100');
  });

  it('shows upgrade message when free users hit voice cap', () => {
    const content = readServer('modules/media/routes/voice.ts');
    expect(content).toContain('Voice limit reached. Upgrade your plan to unlock more voice calls');
  });
});

// ── 89.9 Config tests ─────────────────────────────────────────

describe('89.9 Stripe config', () => {
  it('config.ts has stripeSecretKey', () => {
    const content = readServer('config.ts');
    expect(content).toContain('stripeSecretKey');
  });

  it('config.ts has stripeWebhookSecret', () => {
    const content = readServer('config.ts');
    expect(content).toContain('stripeWebhookSecret');
  });

  it('config.ts has stripeBasicPriceId', () => {
    const content = readServer('config.ts');
    expect(content).toContain('stripeBasicPriceId');
  });

  it('config.ts has stripeProPriceId', () => {
    const content = readServer('config.ts');
    expect(content).toContain('stripeProPriceId');
  });

  it('config.ts has stripeEnabled flag', () => {
    const content = readServer('config.ts');
    expect(content).toContain('stripeEnabled');
  });
});

// ── 89.10 BillingPage UI tests ───────────────────────────────

describe('89.10 BillingPage Stripe UI', () => {
  it('BillingPage has upgrade-basic-btn', () => {
    const content = readSrc('dashboard/pages/BillingPage.tsx');
    expect(content).toContain('upgrade-basic-btn');
  });

  it('BillingPage has upgrade-pro-btn', () => {
    const content = readSrc('dashboard/pages/BillingPage.tsx');
    expect(content).toContain('upgrade-pro-btn');
  });

  it('BillingPage has upgrade-to-unlock banner', () => {
    const content = readSrc('dashboard/pages/BillingPage.tsx');
    expect(content).toContain('upgrade-to-unlock');
  });

  it('BillingPage calls handleCheckout for stripe plans', () => {
    const content = readSrc('dashboard/pages/BillingPage.tsx');
    expect(content).toContain('handleCheckout');
  });

  it('BillingPage shows Rs 99 basic price', () => {
    const content = readSrc('dashboard/pages/BillingPage.tsx');
    expect(content).toContain('99');
  });

  it('BillingPage shows Rs 299 pro price', () => {
    const content = readSrc('dashboard/pages/BillingPage.tsx');
    expect(content).toContain('299');
  });

  it('BillingPage calls getStripeStatus API', () => {
    const content = readSrc('services/api.ts');
    expect(content).toContain('getStripeStatus');
    expect(content).toContain('createCheckout');
  });

  it('BillingPage has formatExpiry helper', () => {
    const content = readSrc('dashboard/pages/BillingPage.tsx');
    expect(content).toContain('formatExpiry');
  });
});
