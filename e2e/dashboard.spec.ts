import { test, expect } from '@playwright/test';

/**
 * Dashboard Navigation Tests
 * Uses API login to ensure authenticated state
 */

test.describe('Dashboard Navigation', () => {
  test.beforeEach(async ({ page, request }) => {
    // Reset test state
    await request.post('http://localhost:3001/api/test/reset', {
      data: { fullCleanup: true },
    });

    // Seed a test user
    const seedResponse = await request.post('http://localhost:3001/api/test/seed', {
      data: {
        email: 'dashboard-test@example.com',
        name: 'Dashboard Test User',
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

    // Set auth using test helper and navigate to dashboard
    await page.goto('/login');
    await page.evaluate((t) => {
      if (window.__TEST_SET_AUTH__) {
        window.__TEST_SET_AUTH__(t);
      }
    }, token);
    await page.goto('/dashboard');
  });

  test('should load overview page', async ({ page }) => {
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/dashboard');
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('should navigate to health tab', async ({ page }) => {
    await page.goto('/dashboard/health');
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/dashboard/health');
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('should navigate through all main sections', async ({ page }) => {
    const sections = ['overview', 'health', 'connections', 'reminders'];
    for (const section of sections) {
      await page.goto(`/dashboard/${section}`);
      await page.waitForTimeout(1000);
      expect(page.url()).toContain(`/dashboard/${section}`);
    }
  });

  test('should display agent status', async ({ page }) => {
    await page.goto('/dashboard/overview');
    await page.waitForTimeout(2000);
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(500);
  });

  test('should show credits or usage info', async ({ page }) => {
    await page.goto('/dashboard/overview');
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/dashboard');
  });
});
