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
 * Uses API login + localStorage injection for deterministic auth in CI
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
      },
    });
    expect(seedResponse.ok(), `Test seed failed: ${await seedResponse.text()}`).toBeTruthy();

    const { credentials } = await seedResponse.json() as { credentials: { email: string; password: string } };
    console.log('Test user seeded:', credentials.email);

    // Login via API to get the token
    console.log('Logging in via API...');
    const loginResponse = await page.request.post(`${apiURL}/api/auth/login`, {
      data: {
        email: credentials.email,
        password: credentials.password,
      },
    });
    expect(loginResponse.ok(), `Login failed: ${await loginResponse.text()}`).toBeTruthy();

    const { token } = await loginResponse.json() as { token: string };
    console.log('Login successful, got token');

    // Navigate to any page and inject the token into localStorage
    console.log('Navigating to app and setting auth state...');
    await page.goto(`${baseURL}/login`);

    // Inject the auth state into localStorage (matching Zustand persist format)
    // The persist middleware uses key 'gs-auth' with a specific structure
    const authState = {
      state: {
        token: token,
        isAuthenticated: true,
        user: null, // Will be fetched on first API call
        onboarding: { step: 0, completed: true },
      },
      version: 0,
    };

    await page.evaluate((state) => {
      localStorage.setItem('gs-auth', JSON.stringify(state));
    }, authState);

    // Now navigate to dashboard - should be authenticated
    console.log('Navigating to dashboard...');
    await page.goto(`${baseURL}/dashboard`);

    // Take a screenshot to debug
    await page.screenshot({ path: 'test-results/dashboard-after-auth.png' });
    console.log('Screenshot saved');

    // Check current URL
    console.log('Current URL:', page.url());

    // Verify we're on the dashboard
    await expect(page.getByTestId('dashboard-sidebar')).toBeVisible({ timeout: 10000 });
    console.log('Dashboard loaded successfully');

    // Save storage state (cookies + localStorage) for other tests
    await page.context().storageState({ path: authFile });

    console.log('E2E authentication setup complete - storage state saved to', authFile);
  } catch (error) {
    console.error('E2E setup failed:', error);
    // Take a screenshot for debugging
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
