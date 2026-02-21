import { chromium, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

/**
 * Wait for backend server to be ready
 */
async function waitForBackend(page: { request: { get: (url: string, options?: { timeout?: number }) => Promise<{ ok: () => boolean; status: () => number }> } }, url: string, maxAttempts = 30): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await page.request.get(`${url}/api/health`, { timeout: 5000 });
      if (response.ok() || response.status() === 429) {
        console.log(`Backend is ready after ${attempt} attempts`);
        return;
      }
    } catch {
      // Server not ready yet
    }
    console.log(`Waiting for backend... attempt ${attempt}/${maxAttempts}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error('Backend did not become ready in time');
}

/**
 * E2E Authentication Setup
 * Uses API to create user and generate token, then sets auth via test helper
 */
async function globalSetup() {
  const apiURL = process.env.API_URL || 'http://localhost:3001';
  const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173';

  // Launch browser for setup
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Wait for backend to be ready
    console.log('Waiting for backend to be ready...');
    await waitForBackend(page, apiURL, 30);

    // Reset test state first via API
    console.log('Resetting test state...');
    const resetResponse = await page.request.post(`${apiURL}/api/test/reset`, {
      data: { fullCleanup: true },
    });
    expect(resetResponse.ok(), `Test reset failed: ${await resetResponse.text()}`).toBeTruthy();
    console.log('Test state reset complete');

    // Create a test user via the seed endpoint
    console.log('Seeding test user...');
    const seedResponse = await page.request.post(`${apiURL}/api/test/seed`, {
      data: {
        email: 'e2e-test@example.com',
        name: 'E2E Test User',
        plan: 'premium',
        credits: 50000,
        agentActive: true,
        onboardingCompleted: true,
      },
    });
    expect(seedResponse.ok(), `Test seed failed: ${await seedResponse.text()}`).toBeTruthy();

    const { user } = await seedResponse.json() as { user: { id: string; email: string } };
    console.log('Test user seeded:', user.email);

    // Generate a token using the test auth endpoint
    console.log('Generating auth token...');
    const tokenResponse = await page.request.post(`${apiURL}/api/test/auth/token`, {
      data: { userId: user.id },
    });
    expect(tokenResponse.ok(), `Token generation failed: ${await tokenResponse.text()}`).toBeTruthy();

    const { token } = await tokenResponse.json() as { token: string };
    console.log('Auth token generated');

    // Navigate to the app and set auth using the test helper
    console.log('Setting up auth state via test helper...');
    await page.goto(`${baseURL}/login`);

    // Debug: Check if helper is available
    const helperCheck = await page.evaluate(() => {
      return {
        hasHelper: typeof window.__TEST_SET_AUTH__ === 'function',
        hostname: window.location.hostname,
      };
    });
    console.log('Auth helper check:', helperCheck);

    if (!helperCheck.hasHelper) {
      throw new Error(
        `__TEST_SET_AUTH__ not available. ` +
        `Hostname: ${helperCheck.hostname}. ` +
        `VITE_TEST_MODE must be set during build.`
      );
    }

    // Use the test helper to set auth directly in the store
    await page.evaluate(({ token: authToken, user: authUser }) => {
      if (window.__TEST_SET_AUTH__) {
        window.__TEST_SET_AUTH__(authToken, authUser);
      }
    }, { token, user });

    // Wait for Zustand persist to write to localStorage
    await page.waitForTimeout(500);

    // Reload to trigger rehydration from localStorage
    await page.reload();
    await page.waitForTimeout(500);

    // Verify auth works by navigating to dashboard
    console.log('Verifying auth state...');
    await page.goto(`${baseURL}/dashboard`);
    await page.waitForTimeout(1000);

    // Check that we're actually on the dashboard (not redirected to login)
    const url = page.url();
    if (url.includes('/login')) {
      throw new Error('Auth setup failed - redirected to login page');
    }
    console.log('Auth verified, current URL:', url);

    // Save storage state (cookies + localStorage) for other tests
    await page.context().storageState({ path: authFile });
    console.log('E2E authentication setup complete - storage state saved to', authFile);

  } catch (error) {
    console.error('E2E setup failed:', error);
    try {
      await page.screenshot({ path: 'test-results/setup-failed.png' });
      console.log('Screenshot saved to test-results/setup-failed.png');
    } catch {
      // Ignore screenshot error
    }
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
