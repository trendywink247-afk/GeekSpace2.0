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
    const resetResponse = await page.request.post(`${apiURL}/api/test/reset`, {
      data: { fullCleanup: true },
    });
    expect(resetResponse.ok(), 'Test reset should succeed').toBeTruthy();

    // Create a test user via the seed endpoint
    const seedResponse = await page.request.post(`${apiURL}/api/test/seed`, {
      data: {
        email: 'e2e-test@example.com',
        name: 'E2E Test User',
        plan: 'premium',
        credits: 50000,
        agentActive: true,
      },
    });
    expect(seedResponse.ok(), 'Test seed should succeed').toBeTruthy();

    const { credentials } = await seedResponse.json() as { credentials: { email: string; password: string } };

    // Navigate to login page and login via UI to properly set localStorage
    await page.goto(`${baseURL}/login`);
    await page.getByTestId('login-email').fill(credentials.email);
    await page.getByTestId('login-password').fill(credentials.password);
    await page.getByTestId('login-submit').click();

    // Wait for navigation to dashboard
    await page.waitForURL(/.*dashboard.*/, { timeout: 10000 });

    // Verify we're actually logged in by checking for dashboard element
    await expect(page.getByTestId('dashboard-sidebar')).toBeVisible({ timeout: 5000 });

    // Save storage state (cookies + localStorage) for other tests
    await page.context().storageState({ path: authFile });

    console.log('E2E authentication setup complete - storage state saved to', authFile);
  } catch (error) {
    console.error('E2E setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
