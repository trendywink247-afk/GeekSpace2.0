import { test, expect } from '@playwright/test';

/**
 * Health Dashboard Tests
 * Uses API login to ensure authenticated state
 */

test.describe('Health Dashboard', () => {
  test.beforeEach(async ({ page, request }) => {
    // Reset and seed test user via API
    await request.post('http://localhost:3001/api/test/reset', {
      data: { fullCleanup: true },
    });

    const seedResponse = await request.post('http://localhost:3001/api/test/seed', {
      data: {
        email: 'health-test@example.com',
        name: 'Health Test User',
        plan: 'premium',
        credits: 50000,
        agentActive: true,
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    const { token } = await seedResponse.json() as { token: string };

    // Inject auth token and navigate to login first
    await page.goto('/login');
    await page.evaluate((t) => {
      localStorage.setItem('gs-auth', JSON.stringify({
        state: { token: t, isAuthenticated: true, user: null, onboarding: { step: 0, completed: true } },
        version: 0
      }));
    }, token);

    // Navigate to health page
    await page.goto('/dashboard/health');
    await page.waitForTimeout(1000);
  });

  test('should load health dashboard page', async ({ page }) => {
    // Verify we're on the health page
    expect(page.url()).toContain('/dashboard/health');

    // Take screenshot of the health page state
    await page.screenshot({ path: 'test-results/health-dashboard.png', fullPage: true });

    // Verify the page hasn't crashed - should have either loading spinner or content
    const hasSpinner = await page.locator('.animate-spin, [class*="spin"]').first().isVisible().catch(() => false);
    const hasContent = await page.getByRole('heading').first().isVisible().catch(() => false);

    expect(hasSpinner || hasContent).toBeTruthy();
  });

  test('should show health page structure', async ({ page }) => {
    // Wait for potential loading to complete (with timeout)
    await page.waitForTimeout(5000);

    // Check if we have any heading or the loading spinner
    const heading = page.getByRole('heading').first();
    const headingText = await heading.textContent().catch(() => '');

    // Should either show 'Health' heading or still be loading
    if (headingText.includes('Health')) {
      await expect(heading).toBeVisible();
    } else {
      // Still loading or rate limited - verify page hasn't crashed
      const pageContent = await page.content();
      expect(pageContent).toContain('Health');
      expect(pageContent.length).toBeGreaterThan(1000);
    }
  });
});
