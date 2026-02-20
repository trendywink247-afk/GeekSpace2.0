import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

/**
 * E2E Authentication Setup
 * Creates a test user via TEST_MODE API and logs in
 * This is more reliable than UI-based login for CI
 */
setup('authenticate', async ({ request }) => {
  const apiURL = process.env.API_URL || 'http://localhost:3001';

  // Reset test state first
  await request.post(`${apiURL}/api/test/reset`, {
    data: { fullCleanup: true },
  });

  // Create a test user via the seed endpoint
  const seedResponse = await request.post(`${apiURL}/api/test/seed`, {
    data: {
      email: 'e2e-test@example.com',
      name: 'E2E Test User',
      plan: 'premium',
      credits: 50000,
      agentActive: true,
    },
  });

  // Verify seed was successful
  expect(seedResponse.ok()).toBeTruthy();

  const { credentials } = await seedResponse.json() as { credentials: { email: string; password: string } };

  // Login to get a valid session
  const loginResponse = await request.post(`${apiURL}/api/auth/login`, {
    data: {
      email: credentials.email,
      password: credentials.password,
    },
  });

  expect(loginResponse.ok()).toBeTruthy();

  const { token } = await loginResponse.json() as { token: string };
  expect(token).toBeDefined();

  // Save authentication state for other tests
  await request.storageState({ path: authFile });

  console.log('E2E authentication setup complete');
});
