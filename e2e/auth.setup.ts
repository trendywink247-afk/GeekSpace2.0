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
 * Wait for frontend server to be ready by trying to load a page
 */
async function waitForFrontend(page: { goto: (url: string, options?: { timeout?: number; waitUntil?: string }) => Promise<{ status: () => number | null }> }, url: string, maxAttempts = 30): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await page.goto(`${url}/login`, { timeout: 10000, waitUntil: 'domcontentloaded' });
      if (response && response.status() !== null) {
        console.log(`Frontend is ready after ${attempt} attempts`);
        return;
      }
    } catch {
      // Server not ready yet
    }
    console.log(`Waiting for frontend... attempt ${attempt}/${maxAttempts}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error('Frontend did not become ready in time');
}

/**
 * E2E Authentication Setup
 * Creates a test user via TEST_MODE API and logs in via browser
 * Saves storage state (cookies + localStorage) for reuse across tests
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

    // Wait for frontend to be ready
    console.log('Waiting for frontend to be ready...');
    await waitForFrontend(page, baseURL, 30);
    console.log('Frontend is ready, proceeding with login...');

    // Navigate to login page with retry logic
    let loginSuccess = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        // Navigate to login page
        console.log(`Navigating to login page (attempt ${attempt})...`);
        const response = await page.goto(`${baseURL}/login`, { timeout: 30000, waitUntil: 'networkidle' });
        console.log(`Navigation response status: ${response?.status()}`);
        console.log(`Current URL: ${page.url()}`);

        // Take a screenshot to see what's on the page
        await page.screenshot({ path: `test-results/login-page-attempt-${attempt}.png` });
        console.log(`Screenshot saved to test-results/login-page-attempt-${attempt}.png`);

        // Wait for the login form to be ready
        await page.getByTestId('login-email').waitFor({ state: 'visible', timeout: 15000 });

        // Fill in login form
        await page.getByTestId('login-email').fill(credentials.email);
        await page.getByTestId('login-password').fill(credentials.password);
        await page.getByTestId('login-submit').click();

        // Wait for navigation to dashboard
        await page.waitForURL(/.*dashboard.*/, { timeout: 15000 });

        // Verify we're actually logged in by checking for dashboard element
        await expect(page.getByTestId('dashboard-sidebar')).toBeVisible({ timeout: 10000 });

        loginSuccess = true;
        console.log('Login successful on attempt', attempt);
        break;
      } catch (error) {
        console.log(`Login attempt ${attempt} failed:`, (error as Error).message);
        if (attempt === 3) throw error;
        // Wait before retry
        await page.waitForTimeout(3000);
      }
    }

    if (!loginSuccess) {
      throw new Error('Failed to login after 3 attempts');
    }

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
