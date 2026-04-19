# Server Testing Guide

## Running tests

```bash
cd server
npm test                         # all tests
npx vitest run src/modules/billing/__tests__/stripe.test.ts  # single file
npx vitest run -t "test name"    # single test by name
```

Set `TEST_MODE=true` (already set by vitest config) to skip real LLM calls.

## MSW — HTTP mock layer

Every test file automatically gets the msw server started via `src/test/mocks/setup.ts` (registered in `vitest.config.ts` → `setupFiles`). The setup:

- Starts the mock server in `beforeAll` with `onUnhandledRequest: 'error'` — any outbound HTTP call that doesn't match a handler will throw and fail the test.
- Resets handlers to defaults in `afterEach` — per-test overrides don't leak.
- Closes the server in `afterAll`.

### Default handlers

| Handler file | Mocked endpoints |
|---|---|
| `handlers/groq.ts` | `POST https://api.groq.com/openai/v1/chat/completions` |
| `handlers/openrouter.ts` | `POST https://openrouter.ai/api/v1/chat/completions` |
| `handlers/stripe.ts` | `GET https://api.stripe.com/v1/payment_methods/:id` |
| `handlers/razorpay.ts` | `POST https://api.razorpay.com/v1/orders` |
| `handlers/google.ts` | Google OAuth token + userinfo endpoints |
| `handlers/github.ts` | GitHub OAuth token + user + repos endpoints |

### Override a handler in a single test

Use `server.use(...)` to push an override that lasts only for that test (reset in `afterEach`):

```ts
import { server } from '../test/mocks/server.js';
import { groq429Handler } from '../test/mocks/handlers/groq.js';

it('falls back to OpenRouter on Groq 429', async () => {
  server.use(groq429Handler);
  // ... run your code; Groq calls will return 429
});
```

Pre-built error handlers are exported from each handler file:
- `groq429Handler`, `groq500Handler` — from `handlers/groq.js`
- `openrouter429Handler` — from `handlers/openrouter.js`

### Add a new provider stub

1. Create `src/test/mocks/handlers/<provider>.ts`.
2. Export an array named `<provider>Handlers` and any per-scenario overrides.
3. Import and spread into `defaultHandlers` in `src/test/mocks/server.ts`.

### Stripe webhook helpers

Build a properly-signed Stripe webhook body for integration tests:

```ts
import { buildStripeWebhookPayload, TEST_STRIPE_WEBHOOK_SECRET } from '../test/mocks/handlers/stripe.js';

process.env.STRIPE_WEBHOOK_SECRET = TEST_STRIPE_WEBHOOK_SECRET;

const { body, signature } = buildStripeWebhookPayload('checkout.session.completed', {
  id: 'cs_test_123',
  customer: 'cus_test',
  metadata: { userId: 'user-id', plan: 'pro' },
});

await request(app)
  .post('/api/billing/webhook')
  .set('stripe-signature', signature)
  .set('Content-Type', 'application/json')
  .send(body);
```

### Razorpay webhook helpers

```ts
import { buildRazorpayWebhookPayload, TEST_RAZORPAY_KEY_SECRET } from '../test/mocks/handlers/razorpay.js';

process.env.RAZORPAY_KEY_SECRET = TEST_RAZORPAY_KEY_SECRET;

const { body, signature } = buildRazorpayWebhookPayload('payment.captured', {
  id: 'pay_test_123',
  order_id: 'order_test_abc',
  amount: 50000,
  status: 'captured',
});

await request(app)
  .post('/api/billing/razorpay/webhook')
  .set('x-razorpay-signature', signature)
  .set('Content-Type', 'application/json')
  .send(body);
```

## TEST_MODE=true conventions

When `TEST_MODE=true`, the app:
- Skips sending real Telegram messages.
- Skips initializing external LLM providers at startup.
- Uses an in-memory or temp SQLite DB (set via `DB_PATH` in `src/test/setup.ts`).

Tests that exercise LLM code paths should rely on the msw Groq/OpenRouter handlers rather than `TEST_MODE` skips, so the routing logic itself is exercised.

## Database helpers

`src/test/setup.ts` exports:

| Export | Purpose |
|---|---|
| `resetDatabase()` | Truncate all tables — call in `beforeEach` for isolation |
| `createTestUser(opts?)` | Insert a user + subscription + agent config, return `{ id, email, username, password }` |
| `generateTestToken(userId)` | Sign a JWT for the given user |
| `makeAuthHeader(userId)` | Return `"Bearer <token>"` for Supertest `.set('Authorization', ...)` |
| `cleanupTestUser(userId)` | Delete all rows belonging to a specific user |
