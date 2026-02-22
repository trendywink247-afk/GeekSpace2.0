import { chromium, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const authFile = path.resolve(process.cwd(), 'playwright/.auth/user.json');

/**
 * Ensure directory exists for file path
 */
function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('Created directory:', dir);
  }
}

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
 * Uses API to create test user, then performs real login via UI
 * Storage state is saved for other tests to use
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

    // Reset test state once at the start of the test run (per-worker in CI)
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
        email: `test-e2e-${Date.now()}@example.com`,
        name: 'E2E Test User',
        plan: 'premium',
        credits: 50000,
        agentActive: true,
        onboardingCompleted: true,
      },
    });
    expect(seedResponse.ok(), `Test seed failed: ${await seedResponse.text()}`).toBeTruthy();

    const { user, credentials } = await seedResponse.json() as { user: { id: string; email: string }; credentials: { email: string; password: string } };
    console.log('Test user seeded:', user.email);
    console.log('Test user credentials received');

    // Navigate to login and perform real login via UI
    console.log('Performing login via UI...');
    await page.goto(`${baseURL}/login`);
    await page.getByTestId('login-email').fill(credentials.email);
    await page.getByTestId('login-password').fill(credentials.password);
    await page.getByTestId('login-submit').click();

    // Wait for dashboard to load by checking URL and stable shell element (mobile-safe)
    console.log('Waiting for dashboard to load...');
    await page.waitForURL(/\/dashboard/, { timeout: 30000 });
    await page.waitForSelector('[data-testid="dashboard-shell"]', { timeout: 30000 });

    // Check that we're actually on the dashboard (not redirected to login)
    const url = page.url();
    if (url.includes('/login')) {
      throw new Error('Auth setup failed - redirected to login page');
    }
    console.log('Auth verified, current URL:', url);

    // Ensure directory exists before saving
    ensureDir(authFile);

    // Save storage state (cookies + localStorage) for other tests
    await page.context().storageState({ path: authFile });
    console.log('E2E authentication setup complete - storage state saved to', authFile);

    // Verify file was created
    if (fs.existsSync(authFile)) {
      const stats = fs.statSync(authFile);
      console.log('Auth file verified:', authFile, 'Size:', stats.size, 'bytes');
    } else {
      console.error('Auth file was not created:', authFile);
    }

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
