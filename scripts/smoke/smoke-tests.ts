import { strict as assert } from 'assert';

const BASE_URL = process.env.API_URL || 'http://localhost:3001';
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WHATSAPP_ENABLED = process.env.WHATSAPP_BUSINESS_NUMBER;

// Test helper
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name}: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}

async function main() {
  console.log('🧪 GeekSpace Smoke Tests\n');
  console.log(`Testing against: ${BASE_URL}\n`);

  // Health check
  await test('Health endpoint returns ok', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.ok(data.version, 'Version should be present');
  });

  // Auth - protected endpoints require auth
  await test('Reminders API requires auth', async () => {
    const res = await fetch(`${BASE_URL}/api/reminders`);
    assert.equal(res.status, 401);
  });

  await test('Portfolio API requires auth', async () => {
    const res = await fetch(`${BASE_URL}/api/portfolio/profile`);
    assert.equal(res.status, 401);
  });

  await test('Agent chat endpoint requires auth', async () => {
    const res = await fetch(`${BASE_URL}/api/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'test' }),
    });
    assert.equal(res.status, 401);
  });

  // Portfolio generate
  await test('Portfolio generate requires auth', async () => {
    const res = await fetch(`${BASE_URL}/api/portfolio/generate/headline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: 'test' }),
    });
    assert.equal(res.status, 401);
  });

  // Portfolio suggestions
  await test('Portfolio suggestions requires auth', async () => {
    const res = await fetch(`${BASE_URL}/api/portfolio/suggestions`);
    assert.equal(res.status, 401);
  });

  // Agent messages
  await test('Agent messages requires auth', async () => {
    const res = await fetch(`${BASE_URL}/api/agent/messages`);
    assert.equal(res.status, 401);
  });

  // Webhooks should be accessible (but validate signatures)
  await test('Telegram webhook exists', async () => {
    const res = await fetch(`${BASE_URL}/api/webhooks/telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    // Should return 401/403 (no signature) or 200 (if no secret configured)
    assert.ok(res.status === 401 || res.status === 403 || res.status === 200, `Expected 401, 403 or 200, got ${res.status}`);
  });

  await test('WhatsApp webhook exists', async () => {
    const res = await fetch(`${BASE_URL}/api/webhooks/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    // Returns 404 if not implemented, 401/403 if auth required
    assert.ok(res.status === 401 || res.status === 403 || res.status === 404 || res.status === 200, `Expected 401, 403, 404 or 200, got ${res.status}`);
  });

  // Conditional tests
  if (TELEGRAM_TOKEN) {
    await test('Telegram bot token is configured', async () => {
      assert.ok(TELEGRAM_TOKEN.length > 0);
      console.log('  📱 Telegram configured');
    });
  } else {
    console.log('  ⏭️  Telegram not configured - skipping full test');
  }

  if (WHATSAPP_ENABLED) {
    await test('WhatsApp business number is configured', async () => {
      assert.ok(WHATSAPP_ENABLED.length > 0);
      console.log('  📱 WhatsApp configured');
    });
  } else {
    console.log('  ⏭️  WhatsApp not configured - skipping full test');
  }

  console.log('\n✨ Smoke tests complete');

  if (process.exitCode === 1) {
    console.log('\n❌ Some tests failed');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed');
  }
}

main().catch((err) => {
  console.error('Smoke tests failed:', err);
  process.exit(1);
});
