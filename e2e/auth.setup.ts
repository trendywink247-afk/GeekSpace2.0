import { chromium, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

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

    // Navigate to login page with retry logic
    console.log('Navigating to login page...');
    let loginSuccess = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await page.goto(`${baseURL}/login`, { timeout: 30000, waitUntil: 'networkidle' });

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
        await page.waitForTimeout(2000);
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
