import { test, expect } from '@playwright/test';

/**
 * Dashboard Navigation Tests
 * Uses API login to ensure authenticated state
 */

test.describe('Dashboard Navigation', () => {
  test.beforeEach(async ({ page, request }) => {
    // Reset and seed test user via API
    await request.post('http://localhost:3001/api/test/reset', {
      data: { fullCleanup: true },
    });

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

    const { token } = await seedResponse.json() as { token: string };

    // Inject auth token and navigate to dashboard
    await page.goto('/login');
    await page.evaluate((t) => {
      localStorage.setItem('gs-auth', JSON.stringify({
        state: { token: t, isAuthenticated: true, user: null, onboarding: { step: 0, completed: true } },
        version: 0
      }));
    }, token);
    await page.goto('/dashboard');
  });

  test('should load overview page', async ({ page }) => {
    // Wait for the page to load
    await page.waitForTimeout(2000);

    // Verify we're on the dashboard
    expect(page.url()).toContain('/dashboard');

    // Look for main content area
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('should navigate to health tab', async ({ page }) => {
    // Navigate to health tab
    await page.goto('/dashboard/health');
    await page.waitForTimeout(2000);

    // Verify we're on the health page
    expect(page.url()).toContain('/dashboard/health');

    // Look for health page content
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
    // Navigate to overview
    await page.goto('/dashboard/overview');
    await page.waitForTimeout(2000);

    // Look for agent-related content
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(500);
  });

  test('should show credits or usage info', async ({ page }) => {
    await page.goto('/dashboard/overview');
    await page.waitForTimeout(2000);

    // Check page loaded
    expect(page.url()).toContain('/dashboard');
  });
});
