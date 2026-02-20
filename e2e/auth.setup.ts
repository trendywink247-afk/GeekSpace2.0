import { test as setup, expect, request } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';
const apiURL = process.env.API_URL || 'http://localhost:3001';

/**
 * Authentication setup - runs before tests to create authenticated state
 * Uses test-mode seeding for deterministic test data
 */
setup('authenticate', async ({ page }) => {
  // First, reset test state to ensure clean slate
  const apiContext = await request.newContext({
    baseURL: apiURL,
  });

  // Reset test state with full cleanup
  const resetResponse = await apiContext.post('/api/test/reset', {
    data: { fullCleanup: true },
  });
  expect(resetResponse.ok()).toBeTruthy();

  // Create test user via test-mode API
  const seedResponse = await apiContext.post('/api/test/seed', {
    data: {
      email: 'test-e2e@example.com',
      name: 'E2E Test User',
      plan: 'premium',
      credits: 50000,
      agentActive: true,
      agentPersonality: 'jarvis',
    },
  });
  expect(seedResponse.ok()).toBeTruthy();

  const { credentials } = await seedResponse.json() as { credentials: { email: string; password: string } };

  await apiContext.dispose();

  // Navigate to login page
  await page.goto('/login');

  // Wait for login form to be ready
  await page.waitForSelector('[data-testid="login-email"]');

  // Fill in credentials
  await page.getByTestId('login-email').fill(credentials.email);
  await page.getByTestId('login-password').fill(credentials.password);
  await page.getByTestId('login-submit').click();

  // Wait for dashboard navigation
  await page.waitForURL(/.*dashboard.*/, { timeout: 10000 });

  // Verify we're logged in by checking for dashboard elements
  await expect(page.getByTestId('dashboard-sidebar')).toBeVisible();

  // Save authentication state for reuse across tests
  await page.context().storageState({ path: authFile });
});
