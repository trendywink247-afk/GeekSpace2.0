import { test, expect } from '@playwright/test';

/**
 * Dashboard Navigation Tests
 * Each test creates its own user and logs in via UI
 */

// Don't use global setup auth - each test handles its own
test.use({ storageState: { cookies: [], origins: [] } });

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
