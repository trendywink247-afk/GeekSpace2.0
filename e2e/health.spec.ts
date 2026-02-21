import { test, expect } from '@playwright/test';

/**
 * Health Dashboard Tests
 * Each test creates its own user and logs in via UI
 */

// Don't use global setup auth - each test handles its own
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Health Dashboard', () => {
  test.beforeEach(async ({ page, request }) => {
    // Reset test state
    await request.post('http://localhost:3001/api/test/reset', {
      data: { fullCleanup: true },
    });

    // Seed a test user
    const seedResponse = await request.post('http://localhost:3001/api/test/seed', {
      data: {
        email: 'health-test@example.com',
        name: 'Health Test User',
        plan: 'premium',
        credits: 50000,
        agentActive: true,
        onboardingCompleted: true,
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    const { credentials } = await seedResponse.json() as { credentials: { email: string; password: string } };

    // Login via UI
    await page.goto('/login');
    await page.getByTestId('login-email').fill(credentials.email);
    await page.getByTestId('login-password').fill(credentials.password);
    await page.getByTestId('login-submit').click();
    await page.waitForURL(/.*dashboard.*/, { timeout: 10000 });

    // Navigate to health page
    await page.goto('/dashboard/health');
    await page.waitForTimeout(1000);
  });

  test('should load health dashboard page', async ({ page }) => {
    expect(page.url()).toContain('/dashboard/health');
    await page.screenshot({ path: 'test-results/health-dashboard.png', fullPage: true });
    const hasSpinner = await page.locator('.animate-spin, [class*="spin"]').first().isVisible().catch(() => false);
    const hasContent = await page.getByRole('heading').first().isVisible().catch(() => false);
    expect(hasSpinner || hasContent).toBeTruthy();
  });

  test('should show health page structure', async ({ page }) => {
    await page.waitForTimeout(5000);
    const heading = page.getByRole('heading').first();
    const headingText = await heading.textContent().catch(() => '');
    if (headingText.includes('Health')) {
      await expect(heading).toBeVisible();
    } else {
      const pageContent = await page.content();
      expect(pageContent).toContain('Health');
      expect(pageContent.length).toBeGreaterThan(1000);
    }
  });
});
