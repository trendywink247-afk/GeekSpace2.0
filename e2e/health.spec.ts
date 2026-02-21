import { test, expect } from '@playwright/test';

/**
 * Health Dashboard Tests
 * Uses API login to ensure authenticated state
 */

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
      },
    });
    expect(seedResponse.ok()).toBeTruthy();

    const { user } = await seedResponse.json() as { user: { id: string } };

    // Generate a token using the test auth endpoint
    const tokenResponse = await request.post('http://localhost:3001/api/test/auth/token', {
      data: { userId: user.id },
    });
    expect(tokenResponse.ok()).toBeTruthy();

    const { token } = await tokenResponse.json() as { token: string };

    // Inject auth token and navigate
    await page.goto('/login');
    await page.evaluate((t) => {
      localStorage.setItem('gs-auth', JSON.stringify({
        state: { token: t, isAuthenticated: true, user: null, onboarding: { step: 0, completed: true } },
        version: 0
      }));
    }, token);

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
